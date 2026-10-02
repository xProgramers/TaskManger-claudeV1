-- =============================================================================
-- Quadro infinito: notes get free world coordinates (pixels at 100% zoom).
-- =============================================================================
-- The old x/y columns were fractions (0..1) of a screen-sized board. They are
-- kept untouched for rollback; the app now reads/writes pos_x/pos_y.
-- Existing notes are converted assuming the old board was ~1200×700 px.

alter table public.notes
  add column pos_x double precision not null default 0 check (pos_x between -100000 and 100000),
  add column pos_y double precision not null default 0 check (pos_y between -100000 and 100000);

update public.notes
   set pos_x = round(x * 1200),
       pos_y = round(y * 700)
 where pos_x = 0 and pos_y = 0;

comment on column public.notes.x is 'Legacy: fractional position on the old fixed board. Unused since the infinite board.';
comment on column public.notes.y is 'Legacy: fractional position on the old fixed board. Unused since the infinite board.';
comment on column public.notes.pos_x is 'World X in pixels at 100% zoom (infinite board).';
comment on column public.notes.pos_y is 'World Y in pixels at 100% zoom (infinite board).';
