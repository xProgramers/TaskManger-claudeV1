import { useMemo } from 'react';
import type { ISODate, Task } from '@/types';
import { diffDays, formatDayMonthShort, relativeDayLabel } from '@/utils/dates';
import { compareWithinDay } from '@/utils/task';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useUpcomingTasks } from '@/hooks/useTasks';
import { useInfiniteScroll } from '@/hooks/useUtils';
import { TaskList } from '@/components/TaskList';
import { PageTitle } from '@/components/PageParts';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Spinner, TaskListSkeleton } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@/components/icons';

export function UpcomingPage() {
  const { today } = usePreferences();
  const { openCreate } = useTaskUI();
  const { data, isLoading, isError, refetch, loadMore, loadingMore } = useUpcomingTasks();
  const sentinel = useInfiniteScroll(() => void loadMore(), Boolean(data?.hasMore));

  const groups = useMemo(() => {
    const map = new Map<ISODate, Task[]>();
    for (const t of data?.rows ?? []) {
      if (!t.due_date) continue;
      const list = map.get(t.due_date) ?? [];
      list.push(t);
      map.set(t.due_date, list);
    }
    return [...map.entries()].map(([day, tasks]) => ({ day, tasks: tasks.sort(compareWithinDay) }));
  }, [data]);

  const total = data?.rows.filter((t) => t.status === 'pending').length ?? 0;

  return (
    <div className="mx-auto max-w-[760px]">
      <PageTitle title="Próximas" subtitle="O que vem por aí, em ordem cronológica." />

      <div className="mt-6">
        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TaskListSkeleton rows={6} />
        ) : total === 0 && groups.every((g) => g.tasks.every((t) => t.status !== 'pending')) ? (
          <EmptyState
            title="Nada agendado daqui pra frente."
            description="Quando você der uma data às suas tarefas, elas aparecem aqui organizadas por dia."
            action={
              <Button variant="primary" leading={<PlusIcon size={15} />} onClick={() => openCreate({ due_date: today })}>
                Criar tarefa
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(({ day, tasks }) => {
              const pending = tasks.filter((t) => t.status === 'pending').length;
              const label = relativeDayLabel(day, today);
              const far = diffDays(day, today) >= 7;
              return (
                <section key={day} aria-labelledby={`day-${day}`} className="group/day">
                  <div className="sticky top-14 z-10 -mx-3 flex items-baseline gap-2 bg-bg/95 px-6 py-2 backdrop-blur">
                    <h2 id={`day-${day}`} className="text-base font-semibold text-ink">
                      {label}
                    </h2>
                    {!far && label !== formatDayMonthShort(day) && (
                      <span className="tnum text-sm text-ink-3">{formatDayMonthShort(day)}</span>
                    )}
                    <span className="tnum text-sm text-ink-3">
                      {pending} {pending === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCreate({ due_date: day })}
                      className="ml-auto rounded-xs px-1.5 py-0.5 text-sm font-medium text-accent opacity-100 hover:bg-accent-soft sm:opacity-0 sm:group-hover/day:opacity-100 sm:focus-visible:opacity-100"
                      aria-label={`Adicionar tarefa em ${label}`}
                    >
                      + Adicionar
                    </button>
                  </div>
                  <TaskList tasks={tasks} hideCompleted label={`Tarefas de ${label}`} />
                </section>
              );
            })}
            <div ref={sentinel} className="flex h-10 items-center justify-center text-ink-3">
              {loadingMore && <Spinner />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
