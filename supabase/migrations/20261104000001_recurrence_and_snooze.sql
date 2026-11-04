-- =============================================================================
-- Repeating tasks + "Adiar 1h" on a reminder
-- =============================================================================
-- Repeating task: completing it does not close it; it moves to its next date
-- (and tasks_sync_reminder schedules the next reminder). Missed dates are
-- skipped, so an overdue daily task lands on tomorrow, not on a past day.
-- Mirror of this logic for the UI: src/utils/recurrence.ts.
-- =============================================================================

alter table public.tasks
  add column recurrence text
    check (recurrence in ('daily', 'weekdays', 'weekly', 'monthly', 'yearly')),
  add constraint tasks_recurrence_requires_date check (recurrence is null or due_date is not null);

-- First date of the series after both p_due and p_today. Months without the
-- day use their last day (Postgres date + interval clamps). Never loops more
-- than twice.
create or replace function public.next_occurrence(p_rule text, p_due date, p_today date)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_base   date := greatest(p_due, p_today);
  v_next   date;
  v_months integer;
  v_step   integer;
begin
  case p_rule
    when 'daily' then
      return v_base + 1;
    when 'weekdays' then
      v_next := v_base + 1;
      while extract(isodow from v_next) > 5 loop
        v_next := v_next + 1;
      end loop;
      return v_next;
    when 'weekly' then
      return p_due + 7 * ((v_base - p_due) / 7 + 1);
    else -- monthly, yearly
      v_months := case p_rule when 'monthly' then 1 else 12 end;
      v_step := ((extract(year from v_base) - extract(year from p_due)) * 12
                + extract(month from v_base) - extract(month from p_due))::integer / v_months;
      loop
        v_next := (p_due + make_interval(months => v_step * v_months))::date;
        exit when v_next > v_base;
        v_step := v_step + 1;
      end loop;
      return v_next;
  end case;
end;
$$;

revoke execute on function public.next_occurrence(text, date, date) from public, anon;
grant execute on function public.next_occurrence(text, date, date) to authenticated, service_role;

-- Same as 20261002000001, plus the two recurrence rules at the top.
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := trim(new.title);
  new.description := nullif(trim(new.description), '');

  if new.due_date is null then
    new.recurrence := null;
  elsif tg_op = 'UPDATE' and new.recurrence is not null
        and old.status = 'pending' and new.status = 'completed' then
    new.status := 'pending';
    new.due_date := public.next_occurrence(new.recurrence, new.due_date, (now() at time zone new.timezone)::date);
  end if;

  if new.due_date is null then
    new.due_at := null;
  elsif new.due_time is not null then
    new.due_at := (new.due_date + new.due_time) at time zone new.timezone;
  else
    -- Date-only task: deadline is the end of that day in the user's timezone.
    new.due_at := ((new.due_date + 1)::timestamp at time zone new.timezone) - interval '1 second';
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.user_id := old.user_id; -- ownership is immutable
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

-- =============================================================================
-- Snooze: remind again about a delivered reminder's task in p_minutes.
-- Called by the app (signed-in user) and by the `reminder-action` Edge
-- Function (service role, after checking the notification's signed token).
-- =============================================================================
create or replace function public.snooze_reminder(p_notification_id uuid, p_minutes integer default 60)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_task uuid;
  v_message text;
  v_at timestamptz := now() + make_interval(mins => p_minutes);
begin
  if p_minutes not between 5 and 1440 then
    raise exception 'invalid snooze' using errcode = '22023';
  end if;

  select n.user_id, n.task_id, n.message into v_user, v_task, v_message
    from public.notifications n
    join public.tasks t on t.id = n.task_id and t.status = 'pending'
   where n.id = p_notification_id
     and n.status <> 'pending'
     and (n.user_id = (select auth.uid()) or (select auth.jwt() ->> 'role') = 'service_role');
  if v_task is null then
    raise exception 'reminder not found' using errcode = 'P0002';
  end if;

  -- One pending reminder per task: keep whichever comes first.
  insert into public.notifications (user_id, task_id, title, message, scheduled_for)
  values (v_user, v_task, 'Lembrete adiado', v_message, v_at)
  on conflict (task_id) where status = 'pending'
  do update set scheduled_for = least(public.notifications.scheduled_for, excluded.scheduled_for);

  update public.notifications set status = 'read', read_at = now()
   where id = p_notification_id and status = 'sent';

  return v_at;
end;
$$;

revoke execute on function public.snooze_reminder(uuid, integer) from public, anon;
grant execute on function public.snooze_reminder(uuid, integer) to authenticated, service_role;
