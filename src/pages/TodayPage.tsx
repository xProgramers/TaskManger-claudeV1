import { useMemo, useState } from 'react';
import { addDays, capitalize, formatDayLong, relativeDayLabel } from '@/utils/dates';
import { compareWithinDay, groupByDate, summarizeDay } from '@/utils/task';
import { Link } from '@/lib/router';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { usePendingCount, useOverdueTasks, useRangeTasks, useTaskCount } from '@/hooks/useTasks';
import { TaskList } from '@/components/TaskList';
import { QuickAdd } from '@/components/QuickAdd';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import { DayProgress, Section, Stat, StatRow } from '@/components/PageParts';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { TaskListSkeleton } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Form';
import { ChevronDownIcon, ChevronRightIcon, LogoMark, PlusIcon, SunIcon } from '@/components/icons';

function greeting(hour: number) {
  if (hour < 5) return 'Boa noite';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function TodayPage() {
  const { today, prefs, timezone } = usePreferences();
  const { openCreate, openTask } = useTaskUI();
  const horizonEnd = addDays(today, 7);

  // Today + the next 7 days in one request; overdue in another.
  const range = useRangeTasks(today, horizonEnd);
  const overdue = useOverdueTasks();
  const count = useTaskCount();
  const upcomingCount = usePendingCount(addDays(today, 1), horizonEnd);
  const [showDone, setShowDone] = useState(false);

  const byDay = useMemo(() => groupByDate(range.data ?? []), [range.data]);
  const todayTasks = byDay.get(today) ?? [];
  const pendingToday = todayTasks.filter((t) => t.status === 'pending').sort(compareWithinDay);
  const doneToday = todayTasks.filter((t) => t.status === 'completed');
  // Overdue tasks from today are already in the Today list.
  const overdueEarlier = (overdue.data ?? []).filter((t) => t.due_date !== today);
  const summary = summarizeDay(range.data ?? [], today);
  const nextDays = [1, 2, 3].map((n) => addDays(today, n));

  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone }).format(new Date()));
  const firstName = prefs?.full_name?.split(' ')[0];

  if (count.data === 0 && !range.isLoading) {
    return <Onboarding onCreate={() => openCreate({ due_date: today })} name={firstName} />;
  }

  return (
    <div className="max-w-[960px]">
      <header>
        <p className="text-base text-ink-2">
          {greeting(hour)}
          {firstName ? `, ${firstName}` : ''}.
        </p>
        <h1 className="mt-1 text-[28px] leading-[34px] font-semibold tracking-[-0.025em] text-ink sm:text-display">
          {capitalize(formatDayLong(today))}
        </h1>
        <DayProgress summary={summary} />
      </header>

      <StatRow>
        <Stat value={range.data ? pendingToday.length : undefined} label="Pendentes hoje" />
        <Stat value={range.data ? doneToday.length : undefined} label="Concluídas hoje" />
        <Stat value={overdue.data?.length} label="Atrasadas" tone="late" />
        <Stat value={upcomingCount.data} label="Próximos 7 dias" />
      </StatRow>

      <div className="mt-6">
        <NotificationPrompt />
      </div>

      {overdueEarlier.length > 0 && (
        <Section title="Atrasadas" count={overdueEarlier.length} tone="late">
          <TaskList tasks={overdueEarlier} hideCompleted when="date" label="Tarefas atrasadas" />
        </Section>
      )}

      <Section
        title="Hoje"
        tone="accent"
        icon={<SunIcon size={15} />}
        count={range.data ? pendingToday.length : undefined}
      >
        <QuickAdd defaultDate={today} placeholder="Adicionar tarefa para hoje" />
        {range.isError ? (
          <ErrorState onRetry={() => void range.refetch()} />
        ) : range.isLoading ? (
          <TaskListSkeleton rows={4} />
        ) : pendingToday.length === 0 ? (
          <EmptyState
            className="mt-2"
            compact
            title={doneToday.length ? 'Tudo feito por hoje.' : 'Tudo tranquilo por aqui.'}
            description={
              doneToday.length
                ? `Você concluiu ${doneToday.length} ${doneToday.length === 1 ? 'tarefa' : 'tarefas'} hoje.`
                : 'Você não possui tarefas para hoje.'
            }
            action={
              <Button size="sm" leading={<PlusIcon size={14} />} onClick={() => openCreate({ due_date: today })}>
                Criar tarefa
              </Button>
            }
          />
        ) : (
          <TaskList tasks={pendingToday} hideCompleted highlight label="Tarefas de hoje" />
        )}

        {doneToday.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowDone((s) => !s)}
              aria-expanded={showDone}
              className="flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-ink-3 hover:bg-hover hover:text-ink"
            >
              {showDone ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
              Concluídas hoje
              <span className="tnum font-normal">{doneToday.length}</span>
            </button>
            {showDone && <TaskList tasks={doneToday} label="Concluídas hoje" />}
          </div>
        )}
      </Section>

      <Section
        title="A seguir"
        action={
          <Link to="/proximas" className="text-sm font-medium text-accent hover:underline">
            Ver próximas
          </Link>
        }
      >
        {range.isLoading ? (
          <TaskListSkeleton rows={3} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {nextDays.map((day) => {
              const tasks = (byDay.get(day) ?? []).filter((t) => t.status === 'pending');
              const label = relativeDayLabel(day, today);
              return (
                <div key={day} className="group flex min-h-[120px] flex-col rounded-md border border-line bg-surface p-3">
                  <div className="flex items-baseline justify-between px-1">
                    <h3 className="text-sm font-semibold text-ink">{label}</h3>
                    <span className="tnum text-sm text-ink-3" aria-label={`${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}`}>
                      {tasks.length}
                    </span>
                  </div>
                  <ul className="mt-1.5 flex flex-col">
                    {tasks.slice(0, 3).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openTask(t.id)}
                          className="flex w-full items-baseline gap-1.5 truncate rounded-xs px-1 py-0.5 text-left text-sm text-ink-2 hover:bg-hover hover:text-ink"
                        >
                          {t.due_time && <span className="tnum text-ink-3">{t.due_time.slice(0, 5)}</span>}
                          <span className="truncate">{t.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {tasks.length === 0 && <p className="px-1 text-sm text-ink-3">Dia livre</p>}
                  {tasks.length > 3 && (
                    <Link to="/proximas" className="px-1 text-sm text-ink-3 hover:text-ink">
                      +{tasks.length - 3} mais
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => openCreate({ due_date: day })}
                    aria-label={`Adicionar tarefa para ${label.toLowerCase()}`}
                    className="mt-auto self-start rounded-xs px-1 pt-2 text-xs font-medium text-accent opacity-100 hover:underline sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    + Adicionar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function Onboarding({ onCreate, name }: { onCreate: () => void; name?: string }) {
  return (
    <div className="flex max-w-[520px] flex-col items-start pt-[8vh]">
      <LogoMark size={40} />
      <h1 className="mt-6 text-[30px] leading-9 font-semibold tracking-[-0.025em] text-ink">
        Organize seu dia em poucos segundos{name ? `, ${name}` : ''}.
      </h1>
      <p className="mt-3 max-w-[44ch] text-md text-ink-2">
        Escreva o que precisa fazer e quando, por exemplo “Enviar relatório amanhã às 14h”. O Prumo entende a data e o
        horário e te lembra na hora certa.
      </p>
      <Button variant="primary" size="lg" className="mt-6" leading={<PlusIcon size={16} />} onClick={onCreate}>
        Criar minha primeira tarefa
      </Button>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-3">
        ou pressione <Kbd>N</Kbd> a qualquer momento
      </p>
    </div>
  );
}
