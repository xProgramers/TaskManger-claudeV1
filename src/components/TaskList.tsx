import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Task } from '@/types';
import { cn } from '@/utils/cn';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useCategories } from '@/hooks/useCategories';
import { useTaskActions } from '@/hooks/useTasks';
import { TaskItem, type TaskItemProps } from './TaskItem';

/** Time the checkmark stays visible before the row collapses. */
const CHECK_MS = 300;
/** Collapse duration (matches TaskItem's transition). */
const COLLAPSE_MS = 320;

type Phase = 'checked' | 'collapsing';

interface TaskListProps {
  tasks: Task[];
  /** Completed tasks leave the list (after a short check + collapse animation). */
  hideCompleted?: boolean;
  when?: TaskItemProps['when'];
  renderTrailing?: (task: Task) => ReactNode;
  className?: string;
  label?: string;
}

export function TaskList({ tasks, hideCompleted, when = 'time', renderTrailing, className, label }: TaskListProps) {
  const { today, timeFormat } = usePreferences();
  const { byId } = useCategories();
  const { openTask } = useTaskUI();
  const { setStatus } = useTaskActions();
  const [phases, setPhases] = useState<Map<string, Phase>>(() => new Map());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const setPhase = (id: string, phase: Phase | null) =>
    setPhases((m) => {
      const next = new Map(m);
      if (phase) next.set(id, phase);
      else next.delete(id);
      return next;
    });

  const onToggle = useCallback(
    (task: Task) => {
      const completing = task.status !== 'completed';
      if (completing && hideCompleted) {
        setPhase(task.id, 'checked');
        timers.current.push(
          setTimeout(() => setPhase(task.id, 'collapsing'), CHECK_MS),
          setTimeout(() => setPhase(task.id, null), CHECK_MS + COLLAPSE_MS),
        );
      }
      void setStatus(task, completing ? 'completed' : 'pending');
    },
    [hideCompleted, setStatus],
  );

  const openOne = useCallback((t: Task) => openTask(t.id), [openTask]);
  const visible = hideCompleted ? tasks.filter((t) => t.status !== 'completed' || phases.has(t.id)) : tasks;

  return (
    <ul className={cn('flex flex-col', className)} aria-label={label}>
      {visible.map((t) => {
        const leaving = t.status === 'completed' && phases.get(t.id) === 'collapsing';
        return (
          <li key={t.id} inert={leaving || undefined}>
            <TaskItem
              task={t}
              category={t.category_id ? byId.get(t.category_id) : undefined}
              today={today}
              timeFormat={timeFormat}
              when={when}
              onToggle={onToggle}
              onOpen={openOne}
              trailing={renderTrailing?.(t)}
              leaving={leaving}
            />
          </li>
        );
      })}
    </ul>
  );
}
