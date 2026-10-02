-- =============================================================================
-- Core schema: profiles (user preferences), categories, tasks
-- =============================================================================
-- Design notes
-- * Every row is owned by an auth user (user_id) and protected by RLS.
-- * Tasks store the *wall-clock* intent of the user (due_date + due_time) plus
--   the IANA timezone it was created in. The absolute instant (due_at) is
--   derived server-side by a trigger, so the client can never send an
--   inconsistent timestamp. 18:00 in America/Sao_Paulo is always 21:00 UTC.
-- * category ownership is enforced with a composite FK (category_id, user_id),
--   so a user can never attach another user's category to their task.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.task_status   as enum ('pending', 'completed', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.theme_pref    as enum ('light', 'dark', 'system');
create type public.time_format   as enum ('24h', '12h');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Timezone validation helper (rejects unknown IANA names)
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users — holds UserPreferences)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                        uuid primary key references auth.users (id) on delete cascade,
  full_name                 text check (char_length(full_name) <= 120),
  avatar_url                text check (char_length(avatar_url) <= 2048),
  timezone                  text not null default 'America/Sao_Paulo'
                              check (public.is_valid_timezone(timezone)),
  theme                     public.theme_pref  not null default 'system',
  time_format               public.time_format not null default '24h',
  week_starts_on            smallint not null default 0 check (week_starts_on in (0, 1)), -- 0 = domingo, 1 = segunda
  notifications_enabled     boolean  not null default true,
  default_reminder_minutes  integer  check (default_reminder_minutes in (0, 5, 15, 30, 60, 1440)),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Profile is created automatically on sign-up (no client insert policy).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text := coalesce(new.raw_user_meta_data ->> 'timezone', 'America/Sao_Paulo');
begin
  if not public.is_valid_timezone(tz) then
    tz := 'America/Sao_Paulo';
  end if;

  insert into public.profiles (id, full_name, timezone)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    tz
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  color       text not null default '#6B7280' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  unique (id, user_id) -- target of the composite FK from tasks
);

create unique index categories_user_name_unique on public.categories (user_id, lower(trim(name)));

alter table public.categories enable row level security;

create policy "categories: select own" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories: insert own" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories: update own" on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "categories: delete own" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title                    text not null check (char_length(trim(title)) between 1 and 200),
  description              text check (char_length(description) <= 5000),
  status                   public.task_status   not null default 'pending',
  priority                 public.task_priority not null default 'medium',
  due_date                 date,
  due_time                 time,
  timezone                 text not null default 'America/Sao_Paulo'
                             check (public.is_valid_timezone(timezone)),
  -- Derived by trigger. Absolute instant of the deadline:
  --  * with due_time  -> due_date + due_time in `timezone`
  --  * date only      -> end of due_date in `timezone` (used for "atrasada")
  due_at                   timestamptz,
  -- Minutes before due to remind. NULL = no reminder.
  reminder_offset_minutes  integer check (reminder_offset_minutes in (0, 5, 15, 30, 60, 1440)),
  category_id              uuid,
  completed_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint tasks_time_requires_date check (due_time is null or due_date is not null),
  constraint tasks_reminder_requires_date check (reminder_offset_minutes is null or due_date is not null),
  constraint tasks_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete set null (category_id)
);

-- Indexes tuned for the app's queries (always scoped by user_id).
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_date, due_time);
create index tasks_user_due_at_idx     on public.tasks (user_id, due_at) where status = 'pending';
create index tasks_user_completed_idx  on public.tasks (user_id, completed_at desc) where status = 'completed';
create index tasks_user_created_idx    on public.tasks (user_id, created_at desc);
create index tasks_category_idx        on public.tasks (category_id) where category_id is not null;
create index tasks_title_trgm_idx      on public.tasks using gin (title extensions.gin_trgm_ops);
create index tasks_description_trgm_idx on public.tasks using gin (description extensions.gin_trgm_ops);

-- Derive due_at, normalize text, maintain completed_at.
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := trim(new.title);
  new.description := nullif(trim(new.description), '');

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

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

alter table public.tasks enable row level security;

create policy "tasks: select own" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks: insert own" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks: update own" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "tasks: delete own" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Never expose these tables to anonymous visitors at all.
revoke all on public.profiles, public.categories, public.tasks from anon;
