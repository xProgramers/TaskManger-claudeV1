import { memo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Category, Task } from '@/types';
import { cn } from '@/utils/cn';
import { formatTime, relativeDayLabel } from '@/utils/dates';
import { isOverdue } from '@/utils/task';
import { BellIcon, CheckIcon, ClockIcon, ReopenIcon, TextIcon } from '@/components/icons';
import { CategoryBadge, PriorityBadge } from '@/components/Badges';
import type { TimeFormat } from '@/types';

interface TaskCheckboxProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  priority: Task['priority'];
  tinted?: boolean;
}

export function TaskCheckbox({ checked, onChange, label, priority, tinted }: TaskCheckboxProps) {
  const [popKey, setPopKey] = useState(0);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        setPopKey((k) => k + 1);
        onChange();
      }}
      className="group/check -m-2 flex size-9 shrink-0 items-center justify-center rounded-full"
    >
      <span
        key={popKey}
        className={cn(
          'flex size-[18px] items-center justify-center rounded-full border transition-colors duration-150',
          popKey > 0 && 'animate-check',
          checked
            ? 'border-accent bg-accent text-accent-ink'
            : cn(
                'text-transparent group-hover/check:text-ink-3',
                tinted && 'bg-surface',
                priority === 'high'
                  ? 'border-ink-2 border-[1.75px]'
                  : tinted
                    ? 'border-[color-mix(in_oklab,var(--tint)_55%,transparent)] group-hover/check:border-(--tint)'
                    : 'border-line-strong group-hover/check:border-ink-3',
              ),
        )}
      >
        <CheckIcon size={11} strokeWidth={3} />
      </span>
    </button>
  );
}

export interface TaskItemProps {
  task: Task;
  category?: Category;
  today: string;
  timeFormat: TimeFormat;
  /** 'time' (default) shows only the time; 'date' shows day + time. */
  when?: 'time' | 'date' | 'none';
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  /** Extra trailing content (e.g. a "Reabrir" button on the completed screen). */
  trailing?: ReactNode;
  leaving?: boolean;
  /** Light wash of the tag colour (accent when untagged) with a bar on the left (today's tasks). */
  highlight?: boolean;
}

function TaskItemBase({ task, category, today, timeFormat, when = 'time', onToggle, onOpen, trailing, leaving, highlight }: TaskItemProps) {
  const done = task.status === 'completed';
  const overdue = isOverdue(task);
  const time = task.due_time ? formatTime(task.due_time, timeFormat) : null;
  const dayLabel = task.due_date ? relativeDayLabel(task.due_date, today) : null;

  let whenText: string | null = null;
  if (when === 'time') whenText = time;
  else if (when === 'date') whenText = dayLabel ? (time ? `${dayLabel}, ${time}` : dayLabel) : null;

  // Overdue from a previous day: say which day, since the row may not show it.
  const lateDetail = overdue && task.due_date && task.due_date < today && when !== 'date' ? dayLabel : null;

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
        leaving ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            'group relative flex items-start gap-3 px-3 py-2.5',
            highlight ? 'task-tint rounded-md' : 'rounded-sm transition-colors duration-150 hover:bg-hover focus-within:bg-hover',
          )}
          style={highlight && category ? ({ '--tint': category.color } as CSSProperties) : undefined}
        >
          <div className="pt-px">
            <TaskCheckbox
              checked={done}
              onChange={() => onToggle(task)}
              label={done ? `Reabrir: ${task.title}` : `Concluir: ${task.title}`}
              priority={task.priority}
              tinted={highlight && !done}
            />
          </div>

          <button
            type="button"
            onClick={() => onOpen(task)}
            className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none"
            aria-label={`Abrir tarefa: ${task.title}`}
          >
            {when !== 'none' && (
              <span
                className={cn(
                  'tnum shrink-0 pt-px text-sm',
                  when === 'time' ? 'w-[52px]' : 'w-[118px] truncate max-sm:w-[84px]',
                  overdue ? 'text-late' : done ? 'text-ink-3' : 'text-ink-2',
                  !whenText && 'text-ink-3/60',
                )}
              >
                {whenText ?? (when === 'time' ? '—' : 'Sem data')}
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-base leading-5 break-words transition-colors duration-200',
                  done ? 'text-ink-3 line-through decoration-ink-3/60' : 'text-ink',
                )}
              >
                {task.title}
              </span>
              {(category || overdue || task.description || task.reminder_offset_minutes !== null) && (
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
                  {overdue && (
                    <span className="inline-flex items-center gap-1 font-medium text-late">
                      <ClockIcon size={13} />
                      Atrasada{lateDetail ? ` · ${lateDetail === 'Ontem' ? 'ontem' : lateDetail}` : ''}
                    </span>
                  )}
                  {category && <CategoryBadge category={category} className={done ? 'text-ink-3' : undefined} />}
                  {task.description && (
                    <span className="inline-flex items-center" title="Tem descrição">
                      <TextIcon size={13} />
                      <span className="sr-only">Tem descrição</span>
                    </span>
                  )}
                  {task.reminder_offset_minutes !== null && !done && (
                    <span className="inline-flex items-center" title="Lembrete ativo">
                      <BellIcon size={13} />
                      <span className="sr-only">Lembrete ativo</span>
                    </span>
                  )}
                </span>
              )}
            </span>

            <PriorityBadge priority={task.priority} className={cn('pt-1', done && 'opacity-50')} />
          </button>
          {trailing}
        </div>
      </div>
    </div>
  );
}

export const TaskItem = memo(TaskItemBase);

export function ReopenButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Reabrir: ${title}`}
      className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-xs px-2 text-sm font-medium text-ink-2 opacity-100 hover:bg-surface hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
    >
      <ReopenIcon size={14} />
      Reabrir
    </button>
  );
}
