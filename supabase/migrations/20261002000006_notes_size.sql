-- Quadro: resizable notes. Size in pixels; NULL means the default size.
alter table public.notes
  add column w integer check (w between 160 and 900),
  add column h integer check (h between 120 and 900);
