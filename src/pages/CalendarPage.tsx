import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { ISODate, ISOTime, Task } from '@/types';
import { cn } from '@/utils/cn';
import {
  addDays,
  addMonths,
  capitalize,
  formatDayLong,
  formatDayMonthShort,
  formatMonthYear,
  formatTime,
  formatWeekdayShort,
  isSameMonth,
  monthGrid,
  normalizeTime,
  weekDays,
  weekdayLabels,
} from '@/utils/dates';
import { compareWithinDay, groupByDate, isOverdue } from '@/utils/task';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useCategories } from '@/hooks/useCategories';
import { useRangeTasks, useTaskActions } from '@/hooks/useTasks';
import { useMediaQuery } from '@/hooks/useUtils';
import { TaskList } from '@/components/TaskList';
import { PriorityGlyph, CategoryDot } from '@/components/Badges';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Form';
import { Spinner } from '@/components/ui/Spinner';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/components/icons';

type View = 'month' | 'week' | 'day';

const HOUR_PX = 52;
const BLOCK_MINUTES = 45; // visual length of a timed task
const DRAG_TYPE = 'application/x-prumo-task';

export function CalendarPage() {
  const { today, weekStartsOn, timeFormat } = usePreferences();
  const isSmall = !useMediaQuery('(min-width: 768px)');
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<ISODate>(today);
  const [selected, setSelected] = useState<ISODate>(today);

  const range = useMemo(() => {
    if (view === 'month') {
      const grid = monthGrid(cursor, weekStartsOn);
      return { from: grid[0], to: grid[41], days: grid };
    }
    if (view === 'week') {
      const days = weekDays(cursor, weekStartsOn);
      return { from: days[0], to: days[6], days };
    }
    return { from: cursor, to: cursor, days: [cursor] };
  }, [view, cursor, weekStartsOn]);

  const { data, isLoading, isError, isFetching, refetch } = useRangeTasks(range.from, range.to);
  const byDay = useMemo(() => groupByDate(data ?? []), [data]);

  const step = (dir: 1 | -1) => {
    if (view === 'month') setCursor((c) => addMonths(c, dir));
    else setCursor((c) => addDays(c, dir * (view === 'week' ? 7 : 1)));
  };
  const goToday = () => {
    setCursor(today);
    setSelected(today);
  };

  const title =
    view === 'month'
      ? formatMonthYear(cursor)
      : view === 'week'
        ? `${formatDayMonthShort(range.from)} – ${formatDayMonthShort(range.to)}`
        : capitalize(formatDayLong(cursor));

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold tracking-[-0.02em] text-ink" aria-live="polite">
          {title}
          {isFetching && !isLoading && <Spinner size={14} className="ml-2 inline text-ink-3" />}
        </h1>
        <div className="flex items-center gap-1">
          <IconButton label={view === 'month' ? 'Mês anterior' : view === 'week' ? 'Semana anterior' : 'Dia anterior'} onClick={() => step(-1)}>
            <ChevronLeftIcon />
          </IconButton>
          <Button size="sm" onClick={goToday}>
            Hoje
          </Button>
          <IconButton label={view === 'month' ? 'Próximo mês' : view === 'week' ? 'Próxima semana' : 'Próximo dia'} onClick={() => step(1)}>
            <ChevronRightIcon />
          </IconButton>
        </div>
        <Segmented<View>
          label="Visualização"
          value={view}
          onChange={(v) => {
            setView(v);
            if (v === 'day') setCursor(selected);
          }}
          options={[
            { value: 'month', label: 'Mês' },
            { value: 'week', label: 'Semana' },
            { value: 'day', label: 'Dia' },
          ]}
        />
      </div>

      <div className="mt-5">
        {isError ? (
          <ErrorState message="Não foi possível carregar o calendário." onRetry={() => void refetch()} />
        ) : view === 'month' ? (
          <MonthView
            days={range.days}
            month={cursor}
            byDay={byDay}
            compact={isSmall}
            selected={selected}
            onSelect={setSelected}
            onOpenDay={(d) => {
              setCursor(d);
              setSelected(d);
              setView('day');
            }}
            loading={isLoading}
          />
        ) : (
          <TimeGrid days={range.days} byDay={byDay} timeFormat={timeFormat} />
        )}
      </div>

      {view === 'month' && isSmall && (
        <section className="mt-6" aria-labelledby="agenda-title">
          <div className="mb-1 flex items-baseline justify-between px-3">
            <h2 id="agenda-title" className="text-base font-semibold text-ink">
              {capitalize(formatDayLong(selected))}
            </h2>
          </div>
          {(byDay.get(selected) ?? []).length ? (
            <TaskList tasks={byDay.get(selected) ?? []} label="Tarefas do dia selecionado" />
          ) : (
            <EmptyState compact title="Dia livre." description="Nenhuma tarefa marcada para este dia." />
          )}
        </section>
      )}
      <p className="mt-4 hidden text-sm text-ink-3 md:block">
        Arraste uma tarefa para outro dia ou horário para reagendar. Clique em um espaço vazio para criar.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag and drop (mouse); keyboard users reschedule through "Editar".
// ---------------------------------------------------------------------------

function useReschedule() {
  const { update } = useTaskActions();
  const tasksRef = useRef(new Map<string, Task>());
  const register = (t: Task) => tasksRef.current.set(t.id, t);
  /** `time`: undefined keeps the current time, null makes it an all-day task. */
  const drop = (e: DragEvent, date: ISODate, time?: ISOTime | null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE);
    const task = tasksRef.current.get(id);
    if (!task) return;
    const patch: { due_date: ISODate; due_time?: ISOTime | null } = { due_date: date };
    if (time !== undefined) patch.due_time = time;
    const currentTime = task.due_time ? normalizeTime(task.due_time) : null;
    if (task.due_date === date && (time === undefined || currentTime === time)) return;
    void update(task, patch, { message: 'Tarefa reagendada' });
  };
  return { register, drop };
}

function startDrag(e: DragEvent, task: Task) {
  e.dataTransfer.setData(DRAG_TYPE, task.id);
  e.dataTransfer.effectAllowed = 'move';
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

interface MonthViewProps {
  days: ISODate[];
  month: ISODate;
  byDay: Map<ISODate, Task[]>;
  compact: boolean;
  selected: ISODate;
  onSelect: (d: ISODate) => void;
  onOpenDay: (d: ISODate) => void;
  loading: boolean;
}

function MonthView({ days, month, byDay, compact, selected, onSelect, onOpenDay, loading }: MonthViewProps) {
  const { today, weekStartsOn, timeFormat } = usePreferences();
  const { openCreate, openTask } = useTaskUI();
  const { byId } = useCategories();
  const { register, drop } = useReschedule();
  const [dragOver, setDragOver] = useState<ISODate | null>(null);
  const MAX = 3;

  return (
    <div role="grid" aria-label="Calendário mensal" aria-busy={loading} className="overflow-hidden rounded-md border border-line bg-surface">
      <div role="row" className="grid grid-cols-7 border-b border-line bg-sunken/60">
        {weekdayLabels(weekStartsOn).map((l) => (
          <div key={l} role="columnheader" className="px-2 py-2 text-xs font-medium text-ink-3 md:px-3">
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d, i) => {
          const tasks = byDay.get(d) ?? [];
          const inMonth = isSameMonth(d, month);
          const isToday = d === today;
          const pendingCount = tasks.filter((t) => t.status === 'pending').length;
          return (
            <div
              key={d}
              role="gridcell"
              aria-label={`${capitalize(formatDayLong(d))}, ${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}`}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                e.preventDefault();
                setDragOver(d);
              }}
              onDragLeave={() => setDragOver((x) => (x === d ? null : x))}
              onDrop={(e) => {
                setDragOver(null);
                drop(e, d);
              }}
              className={cn(
                'group relative flex flex-col border-line',
                i % 7 !== 6 && 'border-r',
                i < 35 && 'border-b',
                compact ? 'min-h-14' : 'min-h-[118px]',
                !inMonth && 'bg-sunken/40',
                dragOver === d && 'bg-accent-soft',
                compact && selected === d && 'bg-hover',
              )}
            >
              <button
                type="button"
                onClick={() => (compact ? onSelect(d) : openCreate({ due_date: d }))}
                aria-label={compact ? `Ver ${formatDayLong(d)}` : `Criar tarefa em ${formatDayLong(d)}`}
                className="absolute inset-0 z-0 focus-visible:outline-offset-[-2px]"
              />
              <div className="pointer-events-none relative z-10 flex items-center justify-between px-1.5 pt-1.5 md:px-2">
                <span
                  className={cn(
                    'tnum flex size-6 items-center justify-center rounded-full text-sm',
                    isToday ? 'bg-accent font-semibold text-accent-ink' : inMonth ? 'text-ink' : 'text-ink-3',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {!compact && (
                  <PlusIcon size={13} className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </div>

              {compact ? (
                <div className="pointer-events-none relative z-10 flex flex-wrap justify-center gap-0.5 px-1 pt-1" aria-hidden="true">
                  {tasks.slice(0, 4).map((t) => (
                    <span
                      key={t.id}
                      className={cn('size-1.5 rounded-full', t.status === 'completed' && 'opacity-35')}
                      style={{ background: (t.category_id && byId.get(t.category_id)?.color) || 'var(--color-ink-3)' }}
                    />
                  ))}
                </div>
              ) : (
                <ul className="relative z-10 mt-1 flex flex-col gap-0.5 px-1 pb-1.5">
                  {tasks.slice(0, MAX).map((t) => {
                    register(t);
                    const cat = t.category_id ? byId.get(t.category_id) : undefined;
                    const done = t.status === 'completed';
                    const late = isOverdue(t);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          draggable={!done}
                          onDragStart={(e) => startDrag(e, t)}
                          onClick={() => openTask(t.id)}
                          title={t.title}
                          className={cn(
                            'flex h-6 w-full items-center gap-1.5 rounded-xs border-l-2 bg-sunken/70 pr-1.5 pl-1.5 text-left text-xs transition-colors hover:bg-hover',
                            done ? 'text-ink-3 line-through' : late ? 'text-late' : 'text-ink',
                            !done && 'cursor-grab active:cursor-grabbing',
                          )}
                          style={{ borderLeftColor: cat?.color ?? 'var(--color-line-strong)' }}
                        >
                          {t.due_time && <span className="tnum shrink-0 text-ink-3">{formatTime(t.due_time, timeFormat)}</span>}
                          <span className="truncate">{t.title}</span>
                          {t.priority === 'high' && !done && <PriorityGlyph priority="high" className="ml-auto scale-75 text-ink-2" />}
                        </button>
                      </li>
                    );
                  })}
                  {tasks.length > MAX && (
                    <li>
                      <button
                        type="button"
                        onClick={() => onOpenDay(d)}
                        className="h-5 w-full rounded-xs px-1.5 text-left text-xs font-medium text-ink-3 hover:bg-hover hover:text-ink"
                      >
                        +{tasks.length - MAX} mais
                      </button>
                    </li>
                  )}
                </ul>
              )}
              {pendingCount > 0 && <span className="sr-only">{pendingCount} pendentes</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week / Day time grid
// ---------------------------------------------------------------------------

interface Placed {
  task: Task;
  top: number;
  col: number;
  cols: number;
}

/** Positions timed tasks; overlapping ones share the width side by side. */
function layoutDay(tasks: Task[]): Placed[] {
  const timed = tasks.filter((t) => t.due_time).sort(compareWithinDay);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => (p.cols = cols));
    cluster = [];
  };
  for (const task of timed) {
    const [h, m] = task.due_time!.split(':').map(Number);
    const start = h * 60 + m;
    if (start >= clusterEnd) flush();
    const used = new Set(cluster.filter((p) => p.top / HOUR_PX * 60 + BLOCK_MINUTES > start).map((p) => p.col));
    let col = 0;
    while (used.has(col)) col++;
    const p: Placed = { task, top: (start / 60) * HOUR_PX, col, cols: 1 };
    cluster.push(p);
    placed.push(p);
    clusterEnd = Math.max(clusterEnd, start + BLOCK_MINUTES);
  }
  flush();
  return placed;
}

function TimeGrid({ days, byDay, timeFormat }: { days: ISODate[]; byDay: Map<ISODate, Task[]>; timeFormat: '24h' | '12h' }) {
  const { today, timezone } = usePreferences();
  const { openCreate, openTask } = useTaskUI();
  const { byId } = useCategories();
  const { register, drop } = useReschedule();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [dragSlot, setDragSlot] = useState<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: HOUR_PX * 7 - 8 });
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowParts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(now)
    .split(':')
    .map(Number);
  const nowTop = ((nowParts[0] * 60 + nowParts[1]) / 60) * HOUR_PX;
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const single = days.length === 1;

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      {/* Day headers + all-day row */}
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="border-r border-line" />
        {days.map((d) => (
          <div key={d} className="border-r border-line px-2 py-2 last:border-r-0">
            <div className={cn('text-xs font-medium', d === today ? 'text-accent' : 'text-ink-3')}>
              {formatWeekdayShort(d)}
            </div>
            <div className={cn('tnum text-lg font-semibold', d === today ? 'text-accent' : 'text-ink')}>{Number(d.slice(8))}</div>
          </div>
        ))}
        <div className="flex items-start justify-end border-t border-r border-line px-1.5 py-1.5 text-2xs text-ink-3">Dia todo</div>
        {days.map((d) => {
          const untimed = (byDay.get(d) ?? []).filter((t) => !t.due_time);
          return (
            <div
              key={d}
              onDragOver={(e) => e.dataTransfer.types.includes(DRAG_TYPE) && e.preventDefault()}
              onDrop={(e) => drop(e, d, null)}
              className="flex min-h-9 flex-col gap-0.5 border-t border-r border-line p-1 last:border-r-0"
            >
              {untimed.map((t) => {
                register(t);
                const cat = t.category_id ? byId.get(t.category_id) : undefined;
                return (
                  <button
                    key={t.id}
                    type="button"
                    draggable={t.status !== 'completed'}
                    onDragStart={(e) => startDrag(e, t)}
                    onClick={() => openTask(t.id)}
                    className={cn(
                      'flex h-6 items-center gap-1.5 truncate rounded-xs border-l-2 bg-sunken px-1.5 text-left text-xs hover:bg-hover',
                      t.status === 'completed' ? 'text-ink-3 line-through' : isOverdue(t) ? 'text-late' : 'text-ink',
                    )}
                    style={{ borderLeftColor: cat?.color ?? 'var(--color-line-strong)' }}
                  >
                    <span className="truncate">{t.title}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Hours */}
      <div ref={scrollRef} className="relative max-h-[calc(100dvh-260px)] min-h-[420px] overflow-y-auto scrollbar-thin">
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="relative border-r border-line">
            {hours.map((h) => (
              <div key={h} className="tnum relative pr-2 text-right text-2xs text-ink-3" style={{ height: HOUR_PX }}>
                {h > 0 && <span className="relative -top-2">{formatTime(`${String(h).padStart(2, '0')}:00`, timeFormat)}</span>}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const placed = layoutDay(byDay.get(d) ?? []);
            return (
              <div key={d} className="relative border-r border-line last:border-r-0">
                {hours.map((h) => {
                  const slot = `${d}T${h}`;
                  const time = `${String(h).padStart(2, '0')}:00`;
                  return (
                    <button
                      key={h}
                      type="button"
                      tabIndex={-1}
                      aria-label={`Criar tarefa em ${formatDayLong(d)} às ${formatTime(time, timeFormat)}`}
                      onClick={() => openCreate({ due_date: d, due_time: time })}
                      onDragOver={(e) => {
                        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                        e.preventDefault();
                        setDragSlot(slot);
                      }}
                      onDragLeave={() => setDragSlot((s) => (s === slot ? null : s))}
                      onDrop={(e) => {
                        setDragSlot(null);
                        drop(e, d, time);
                      }}
                      className={cn(
                        'block w-full border-b border-line/70 hover:bg-hover/60',
                        dragSlot === slot && 'bg-accent-soft',
                      )}
                      style={{ height: HOUR_PX }}
                    />
                  );
                })}

                {d === today && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }} aria-hidden="true">
                    <div className="relative h-px bg-accent">
                      <span className="absolute -top-[3px] -left-[3px] size-[7px] rounded-full bg-accent" />
                    </div>
                  </div>
                )}

                {placed.map(({ task: t, top, col, cols }) => {
                  register(t);
                  const cat = t.category_id ? byId.get(t.category_id) : undefined;
                  const done = t.status === 'completed';
                  return (
                    <button
                      key={t.id}
                      type="button"
                      draggable={!done}
                      onDragStart={(e) => startDrag(e, t)}
                      onClick={() => openTask(t.id)}
                      className={cn(
                        'absolute z-10 flex flex-col overflow-hidden rounded-xs border border-l-[3px] border-line bg-surface px-1.5 py-1 text-left shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:border-line-strong',
                        !done && 'cursor-grab active:cursor-grabbing',
                      )}
                      style={{
                        top: top + 1,
                        height: (BLOCK_MINUTES / 60) * HOUR_PX - 2,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        borderLeftColor: cat?.color ?? 'var(--color-ink-3)',
                      }}
                    >
                      <span className={cn('truncate text-xs font-medium', done ? 'text-ink-3 line-through' : isOverdue(t) ? 'text-late' : 'text-ink')}>
                        {t.title}
                      </span>
                      <span className="tnum flex items-center gap-1 truncate text-2xs text-ink-3">
                        {formatTime(t.due_time!, timeFormat)}
                        {single && cat && (
                          <>
                            <CategoryDot color={cat.color} className="ml-1" /> {cat.name}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

