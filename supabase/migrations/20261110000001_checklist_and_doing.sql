-- =============================================================================
-- Checklist da tarefa + coluna "Fazendo" do Kanban
-- =============================================================================
-- checklist: lista [{id, text, done}] guardada na própria tarefa (sem tabela
--   nova, sem consulta extra). Até 50 itens.
-- doing: tarefa pendente que a pessoa já começou (coluna "Fazendo"). O status
--   continua 'pending', então lembretes e contagens não mudam.
-- Ao concluir, doing volta a false. Tarefa que repete volta com o checklist
-- desmarcado na próxima data. Espelho no modo demo: src/services/mock/index.ts.
-- =============================================================================

alter table public.tasks
  add column checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 50),
  add column doing boolean not null default false;

-- Same as 20261104000001, plus doing/checklist handling.
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := trim(new.title);
  new.description := nullif(trim(new.description), '');

  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'completed' then
    new.doing := false;
  end if;

  if new.due_date is null then
    new.recurrence := null;
  elsif tg_op = 'UPDATE' and new.recurrence is not null
        and old.status = 'pending' and new.status = 'completed' then
    new.status := 'pending';
    new.due_date := public.next_occurrence(new.recurrence, new.due_date, (now() at time zone new.timezone)::date);
    new.checklist := coalesce(
      (select jsonb_agg(item || '{"done": false}'::jsonb) from jsonb_array_elements(new.checklist) as item),
      '[]'::jsonb
    );
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

revoke execute on function public.tasks_before_write() from public, anon, authenticated;
