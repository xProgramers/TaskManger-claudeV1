-- =============================================================================
-- Dispatcher: pg_cron (every minute) -> claim due reminders -> Web Push
-- =============================================================================
-- Secrets live in Supabase Vault (never in migrations / git):
--   reminders_project_url       https://<ref>.supabase.co
--   reminders_dispatch_secret   random string shared with the Edge Function
--   vapid_public_key            Web Push VAPID public key  (base64url)
--   vapid_private_key           Web Push VAPID private key (base64url)
--   vapid_subject               mailto:you@example.com
-- See supabase/setup_secrets.sql.example.
--
-- The in-app notification does NOT depend on the Edge Function: flipping the
-- row to 'sent' is what the bell / Realtime listen to. Web Push is a best-effort
-- extra delivery channel for when no tab is open.
-- =============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.dispatch_due_notifications(p_batch integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed  integer := 0;
  v_push_ids uuid[];
  v_url      text;
  v_secret   text;
begin
  with due as (
    select id
      from public.notifications
     where status = 'pending'
       and scheduled_for <= now()
     order by scheduled_for
     limit p_batch
     for update skip locked
  ), claimed as (
    update public.notifications n
       set status = 'sent', sent_at = now()
      from due
     where n.id = due.id
    returning n.id, n.user_id
  )
  select count(*),
         array_agg(c.id) filter (
           where exists (
             select 1
               from public.push_subscriptions s
               join public.profiles p on p.id = s.user_id
              where s.user_id = c.user_id
                and p.notifications_enabled
           )
         )
    into v_claimed, v_push_ids
    from claimed c;

  if coalesce(cardinality(v_push_ids), 0) > 0 then
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'reminders_project_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'reminders_dispatch_secret';

    if v_url is not null and v_secret is not null then
      perform net.http_post(
        url     := v_url || '/functions/v1/send-reminders',
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-dispatch-secret', v_secret
                   ),
        body    := jsonb_build_object('notification_ids', to_jsonb(v_push_ids)),
        timeout_milliseconds := 10000
      );
    end if;
  end if;

  return v_claimed;
end;
$$;

revoke execute on function public.dispatch_due_notifications(integer) from public, anon, authenticated;

-- Configuration read by the Edge Function (service role only).
create or replace function public.get_push_dispatch_config()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_object_agg(name, decrypted_secret)
    from vault.decrypted_secrets
   where name in ('reminders_dispatch_secret', 'vapid_public_key', 'vapid_private_key', 'vapid_subject');
$$;

revoke execute on function public.get_push_dispatch_config() from public, anon, authenticated;
grant execute on function public.get_push_dispatch_config() to service_role;

-- Run every minute. Reminder precision is therefore ~1 minute.
select cron.schedule(
  'dispatch-reminders',
  '* * * * *',
  $$select public.dispatch_due_notifications();$$
);
