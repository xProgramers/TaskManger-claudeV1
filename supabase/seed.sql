-- =============================================================================
-- DEMONSTRATION DATA for a real Supabase account (optional).
-- Run in the SQL editor after creating your user. Replace the e-mail below.
-- The app also has a fully local demo mode: `npm run dev:demo`.
-- =============================================================================
do $$
declare
  uid uuid := (select id from auth.users where email = 'voce@exemplo.com');
  tz text;
  today date;
  c_trab uuid; c_pess uuid; c_est uuid; c_fin uuid; c_sau uuid;
begin
  if uid is null then raise exception 'Usuário não encontrado: ajuste o e-mail no seed.'; end if;
  select timezone into tz from public.profiles where id = uid;
  today := (now() at time zone tz)::date;

  insert into public.categories (user_id, name, color) values (uid, 'Trabalho', '#5B7FA6') returning id into c_trab;
  insert into public.categories (user_id, name, color) values (uid, 'Pessoal',  '#4F8A6E') returning id into c_pess;
  insert into public.categories (user_id, name, color) values (uid, 'Estudos',  '#8A6BA8') returning id into c_est;
  insert into public.categories (user_id, name, color) values (uid, 'Finanças', '#A0744B') returning id into c_fin;
  insert into public.categories (user_id, name, color) values (uid, 'Saúde',    '#B05B6E') returning id into c_sau;

  insert into public.tasks (user_id, title, description, status, priority, due_date, due_time, timezone, reminder_offset_minutes, category_id) values
    (uid, 'Reunião com equipe', null, 'completed', 'high', today, '09:00', tz, null, c_trab),
    (uid, 'Finalizar relatório financeiro', 'Consolidar números do mês.', 'pending', 'high', today, '10:30', tz, 15, c_trab),
    (uid, 'Estudar documentação', null, 'pending', 'medium', today, '14:00', tz, 15, c_est),
    (uid, 'Academia', null, 'pending', 'low', today, '17:00', tz, 30, c_sau),
    (uid, 'Pagar fatura do cartão', null, 'pending', 'high', today - 1, null, tz, null, c_fin),
    (uid, 'Comprar ração', null, 'pending', 'medium', today + 1, '18:00', tz, 15, c_pess),
    (uid, 'Planejamento da sprint', null, 'pending', 'high', today + 1, '10:00', tz, 15, c_trab),
    (uid, 'Consulta no dentista', null, 'pending', 'medium', today + 3, '08:30', tz, 1440, c_sau),
    (uid, 'Prova de inglês', null, 'pending', 'high', today + 12, '19:00', tz, 60, c_est),
    (uid, 'Atualizar currículo', null, 'completed', 'medium', today - 2, null, tz, null, c_est);
end $$;
