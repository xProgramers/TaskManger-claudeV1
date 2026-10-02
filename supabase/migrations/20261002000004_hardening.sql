-- =============================================================================
-- Hardening after the Supabase security/performance advisors
-- =============================================================================

-- Trigger functions must never be callable through /rest/v1/rpc.
-- (Triggers keep working: EXECUTE is only checked when the trigger is created.)
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.sync_task_reminder()   from public, anon, authenticated;
revoke execute on function public.cancel_task_reminder() from public, anon, authenticated;
revoke execute on function public.tasks_before_write()   from public, anon, authenticated;
revoke execute on function public.set_updated_at()       from public, anon, authenticated;

-- Pure helpers: not needed by anonymous visitors.
revoke execute on function public.task_reminder_at(date, time, text, integer) from public, anon;
revoke execute on function public.reminder_title(integer)                      from public, anon;
revoke execute on function public.is_valid_timezone(text)                      from public, anon;
grant  execute on function public.is_valid_timezone(text) to authenticated, service_role; -- used by CHECK constraints

-- Cover the composite FK tasks(category_id, user_id) -> categories(id, user_id).
-- (The older single-column tasks_category_idx becomes redundant; drop it at will:
--  drop index if exists public.tasks_category_idx;)
create index if not exists tasks_category_user_idx on public.tasks (category_id, user_id) where category_id is not null;

-- Intentionally callable by signed-in users (each filters by auth.uid()):
--   mark_notifications_read, register_push_subscription, unregister_push_subscription
