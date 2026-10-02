-- =============================================================================
-- Reminders: notifications, push subscriptions, scheduling & dispatch
-- =============================================================================
-- Lifecycle of a reminder
--
--   task insert/update ──► sync_task_reminder() ──► notifications (pending)
--                                                     │  one pending row per task
--                                                     │  (partial unique index)
--   pg_cron, every minute ──► dispatch_due_notifications()
--                                │  claims due rows with FOR UPDATE SKIP LOCKED
--                                │  and flips them to 'sent' atomically
--                                │  (=> idempotent, never delivered twice)
--                                ├─► Realtime UPDATE event ─► open tabs show toast
--                                │                            + browser Notification
--                                └─► pg_net POST ─► Edge Function `send-reminders`
--                                                   └─► Web Push (works with the
--                                                       tab closed, via service worker)
--
--   Editing the task's date/time/reminder replaces the pending row; completing,
--   cancelling or deleting the task removes it. Already-sent rows are kept as
--   history.
-- =============================================================================

create type public.notification_status as enum ('pending', 'sent', 'read');

create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  task_id        uuid references public.tasks (id) on delete set null,
  title          text not null check (char_length(title) <= 200),
  message        text not null check (char_length(message) <= 500),
  scheduled_for  timestamptz not null,
  status         public.notification_status not null default 'pending',
  sent_at        timestamptz,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

-- At most one pending reminder per task (idempotency guard).
create unique index notifications_one_pending_per_task
  on public.notifications (task_id) where status = 'pending';
-- Dispatcher scan.
create index notifications_due_idx
  on public.notifications (scheduled_for) where status = 'pending';
-- Bell / inbox.
create index notifications_user_inbox_idx
  on public.notifications (user_id, sent_at desc) where status in ('sent', 'read');

alter table public.notifications enable row level security;

create policy "notifications: select own delivered" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id and status <> 'pending');

create policy "notifications: delete own delivered" on public.notifications
  for delete to authenticated
  using ((select auth.uid()) = user_id and status <> 'pending');

-- Clients never write notifications directly; only triggers / RPCs do.
revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;

-- ---------------------------------------------------------------------------
-- Reminder scheduling (runs as definer because clients can't insert)
-- ---------------------------------------------------------------------------
-- Anchor for date-only tasks: 09:00 local time on the due date.
create or replace function public.task_reminder_at(
  p_due_date date, p_due_time time, p_timezone text, p_offset integer
) returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_due_date is null or p_offset is null then null
    else ((p_due_date + coalesce(p_due_time, time '09:00')) at time zone p_timezone)
         - make_interval(mins => p_offset)
  end;
$$;

create or replace function public.reminder_title(p_offset integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_offset
    when 0    then 'É hora da sua tarefa'
    when 5    then 'Começa em 5 minutos'
    when 15   then 'Começa em 15 minutos'
    when 30   then 'Começa em 30 minutos'
    when 60   then 'Começa em 1 hora'
    when 1440 then 'É amanhã'
    else 'Lembrete de tarefa'
  end;
$$;

create or replace function public.sync_task_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target timestamptz;
begin
  v_target := public.task_reminder_at(new.due_date, new.due_time, new.timezone, new.reminder_offset_minutes);

  -- No reminder wanted, task not actionable, or the deadline already passed.
  if v_target is null
     or new.status <> 'pending'
     or ((new.due_date + coalesce(new.due_time, time '09:00')) at time zone new.timezone) <= now()
  then
    delete from public.notifications where task_id = new.id and status = 'pending';
    return null;
  end if;

  -- Same reminder already delivered (e.g. user only edited the title after it
  -- fired): don't schedule it again.
  if exists (
    select 1 from public.notifications
    where task_id = new.id and status <> 'pending' and scheduled_for = v_target
  ) then
    delete from public.notifications where task_id = new.id and status = 'pending';
    return null;
  end if;

  insert into public.notifications (user_id, task_id, title, message, scheduled_for)
  values (new.user_id, new.id, public.reminder_title(new.reminder_offset_minutes), new.title, v_target)
  on conflict (task_id) where status = 'pending'
  do update set
    title = excluded.title,
    message = excluded.message,
    scheduled_for = excluded.scheduled_for;

  return null;
end;
$$;

create trigger tasks_sync_reminder_ins
  after insert on public.tasks
  for each row execute function public.sync_task_reminder();

create trigger tasks_sync_reminder_upd
  after update of title, status, due_date, due_time, timezone, reminder_offset_minutes on public.tasks
  for each row execute function public.sync_task_reminder();

-- Deleting a task cancels its pending reminder (history rows keep task_id = null).
create or replace function public.cancel_task_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications where task_id = old.id and status = 'pending';
  return old;
end;
$$;

create trigger tasks_cancel_reminder
  before delete on public.tasks
  for each row execute function public.cancel_task_reminder();

-- ---------------------------------------------------------------------------
-- Client RPCs for the inbox
-- ---------------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notifications
     set status = 'read', read_at = now()
   where user_id = (select auth.uid())
     and status = 'sent'
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Web Push subscriptions (one row per browser/device)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  endpoint      text not null unique check (char_length(endpoint) <= 2048),
  p256dh        text not null check (char_length(p256dh) <= 256),
  auth          text not null check (char_length(auth) <= 256),
  user_agent    text check (char_length(user_agent) <= 512),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: select own" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;

-- Upsert by endpoint. A browser that switches accounts moves to the new user.
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 512))
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent;
end;
$$;

revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

revoke execute on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.unregister_push_subscription(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: open tabs receive their own notifications (RLS applies).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;
