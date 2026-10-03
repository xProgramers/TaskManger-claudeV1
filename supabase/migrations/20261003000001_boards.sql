-- =============================================================================
-- Quadro: ambientes (boards). Each note lives in exactly one environment.
-- =============================================================================
-- * A user can have as many environments as they want ("Trabalho", "Pessoal"…),
--   each with a free name and a color for its icon.
-- * Existing notes move to an initial environment called "Geral".
-- * Backward compatible: a note inserted without board_id goes to the user's
--   first environment (created on demand), so older clients keep working.
-- * Deleting an environment deletes its notes (the app asks first).
-- =============================================================================

create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  color       text not null default '#5B7FA6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id) -- target of the composite FK from notes
);

create unique index boards_user_name_unique on public.boards (user_id, lower(trim(name)));

create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

alter table public.boards enable row level security;

create policy "boards: select own" on public.boards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "boards: insert own" on public.boards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "boards: update own" on public.boards
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "boards: delete own" on public.boards
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.boards from anon;

-- ---------------------------------------------------------------------------
-- Existing notes -> one initial environment per user
-- ---------------------------------------------------------------------------
alter table public.notes add column board_id uuid;

insert into public.boards (user_id, name)
select distinct user_id, 'Geral' from public.notes;

update public.notes n
   set board_id = b.id
  from public.boards b
 where b.user_id = n.user_id
   and n.board_id is null;

-- Notes without board_id (older clients) go to the user's first environment.
create or replace function public.notes_assign_board()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.board_id is null then
    select b.id into new.board_id
      from public.boards b
     where b.user_id = new.user_id
     order by b.created_at, b.id
     limit 1;
    if new.board_id is null then
      insert into public.boards (user_id, name)
      values (new.user_id, 'Geral')
      on conflict (user_id, lower(trim(name))) do nothing;
      select b.id into new.board_id
        from public.boards b
       where b.user_id = new.user_id
       order by b.created_at, b.id
       limit 1;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.notes_assign_board() from public, anon, authenticated;

create trigger notes_assign_board
  before insert on public.notes
  for each row execute function public.notes_assign_board();

alter table public.notes
  alter column board_id set not null,
  add constraint notes_board_fk foreign key (board_id, user_id)
    references public.boards (id, user_id) on delete cascade;

create index notes_board_idx on public.notes (board_id, user_id, z);

comment on table public.boards is 'Quadro environments ("ambientes"): named, colored groups of notes.';
comment on column public.notes.board_id is 'Environment the note belongs to. Filled automatically when omitted.';
