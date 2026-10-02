import { useMemo } from 'react';
import type { Task } from '@/types';
import { instantToDate, relativeDayLabel } from '@/utils/dates';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useCompletedTasks, useTaskActions } from '@/hooks/useTasks';
import { useInfiniteScroll } from '@/hooks/useUtils';
import { TaskList } from '@/components/TaskList';
import { ReopenButton } from '@/components/TaskItem';
import { PageTitle } from '@/components/PageParts';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Spinner, TaskListSkeleton } from '@/components/ui/Spinner';

/** "Concluídas hoje", "Concluídas ontem", "Concluídas em 28 de setembro" */
function completedHeading(day: string, today: string): string {
  if (day === 'sem-data') return 'Sem data de conclusão';
  const label = relativeDayLabel(day, today);
  return label === 'Hoje' || label === 'Ontem' ? `Concluídas ${label.toLowerCase()}` : `Concluídas em ${label}`;
}

export function CompletedPage() {
  const { today, timezone } = usePreferences();
  const { setStatus } = useTaskActions();
  const { data, isLoading, isError, refetch, loadMore, loadingMore } = useCompletedTasks();
  const sentinel = useInfiniteScroll(() => void loadMore(), Boolean(data?.hasMore));

  // Group by the day it was completed, in the user's zone.
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of data?.rows ?? []) {
      const day = t.completed_at ? instantToDate(t.completed_at, timezone) : 'sem-data';
      const list = map.get(day) ?? [];
      list.push(t);
      map.set(day, list);
    }
    return [...map.entries()];
  }, [data, timezone]);

  return (
    <div className="mx-auto max-w-[760px]">
      <PageTitle title="Concluídas" subtitle="Seu histórico. Nada é apagado automaticamente." />

      <div className="mt-6">
        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TaskListSkeleton rows={6} />
        ) : groups.length === 0 ? (
          <EmptyState
            title="Nenhuma tarefa concluída ainda."
            description="Marque uma tarefa como feita e ela passa a fazer parte do seu histórico aqui."
          />
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(([day, tasks]) => (
              <section key={day} aria-labelledby={`done-${day}`}>
                <h2 id={`done-${day}`} className="mb-1 flex items-baseline gap-2 px-3 text-base font-semibold text-ink">
                  {completedHeading(day, today)}
                  <span className="tnum text-sm font-normal text-ink-3">{tasks.length}</span>
                </h2>
                <TaskList
                  tasks={tasks}
                  when="date"
                  label={`Concluídas em ${day}`}
                  renderTrailing={(t) =>
                    t.status === 'completed' ? <ReopenButton title={t.title} onClick={() => void setStatus(t, 'pending')} /> : null
                  }
                />
              </section>
            ))}
            <div ref={sentinel} className="flex h-10 items-center justify-center text-ink-3">
              {loadingMore && <Spinner />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
