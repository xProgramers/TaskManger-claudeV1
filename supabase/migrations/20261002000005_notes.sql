-- =============================================================================
-- Quadro: sticky notes on a screen-sized board
-- =============================================================================
-- Positions are stored as fractions (0..1) of the board's width/height, so a
-- note keeps its relative place on any screen size. `z` is the stacking order
-- (bring-to-front on interaction).
-- =============================================================================

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content     text not null default '' check (char_length(content) <= 2000),
  color       text not null default 'yellow'
                check (color in ('yellow', 'green', 'blue', 'pink', 'violet', 'gray')),
  x           real not null default 0.05 check (x >= 0 and x <= 1),
  y           real not null default 0.05 check (y >= 0 and y <= 1),
  z           integer not null default 0 check (z >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index notes_user_idx on public.notes (user_id, z);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

create policy "notes: select own" on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes: insert own" on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes: update own" on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "notes: delete own" on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.notes from anon;
