/**
 * Tarefas do dia em colunas (Kanban): A fazer, Fazendo e Feito.
 * Arrastar um cartão entre colunas muda o estado da tarefa. Sem bibliotecas:
 * drag and drop nativo do navegador.
 */
import { useState, type CSSProperties, type DragEvent } from 'react';
import type { Category, ISODate, Task, TimeFormat } from '@/types';
import { cn } from '@/utils/cn';
import { formatTime, relativeDayLabel } from '@/utils/dates';
import { isOverdue } from '@/utils/task';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useCategories } from '@/hooks/useCategories';
import { useTaskActions } from '@/hooks/useTasks';
import { BellIcon, ChecklistIcon, ClockIcon, PlusIcon, RepeatIcon, TextIcon } from '@/components/icons';
import { CategoryBadge, PriorityGlyph } from '@/components/Badges';
import { TaskCheckbox } from './TaskItem';
import { checklistProgress } from './Checklist';

type Column = 'todo' | 'doing' | 'done';

const COLUMNS: { id: Column; title: string; empty: string }[] = [
  { id: 'todo', title: 'A fazer', empty: 'Nada por fazer.' },
  { id: 'doing', title: 'Fazendo', empty: 'Arraste para cá o que você começou.' },
  { id: 'done', title: 'Feito', empty: 'Arraste para cá o que terminou.' },
];

const columnOf = (t: Task): Column => (t.status === 'completed' ? 'done' : t.doing ? 'doing' : 'todo');

interface TaskBoardProps {
  /** Pendentes de hoje e atrasadas. */
  pending: Task[];
  /** Concluídas hoje. */
  done: Task[];
  today: ISODate;
}

export function TaskBoard({ pending, done, today }: TaskBoardProps) {
  const { timeFormat } = usePreferences();
  const { byId } = useCategories();
  const { openTask, openCreate } = useTaskUI();
  const { update, setStatus } = useTaskActions();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Column | null>(null);

  const all = [...pending, ...done];
  const move = (task: Task, to: Column) => {
    const from = columnOf(task);
    if (from === to) return;
    if (to === 'done') void setStatus(task, 'completed');
    else if (from === 'done') void update(task, { status: 'pending', doing: to === 'doing' }, { silent: true });
    else void update(task, { doing: to === 'doing' }, { silent: true });
  };

  const onDrop = (e: DragEvent, col: Column) => {
    e.preventDefault();
    const task = all.find((t) => t.id === e.dataTransfer.getData('text/plain'));
    if (task) move(task, col);
    setDragging(null);
    setOver(null);
  };

  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible">
      {COLUMNS.map((col) => {
        const tasks = all.filter((t) => columnOf(t) === col.id);
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => onDrop(e, col.id)}
            className={cn(
              'flex min-h-[280px] w-[82vw] shrink-0 snap-start flex-col rounded-md border bg-sunken/70 p-2 transition-colors sm:w-auto',
              over === col.id && dragging ? 'border-accent bg-accent-soft/60' : 'border-line',
            )}
          >
            <div className="flex items-center justify-between px-1.5 pt-0.5 pb-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 rounded-full',
                    col.id === 'todo' ? 'bg-line-strong' : col.id === 'doing' ? 'bg-late' : 'bg-accent',
                  )}
                />
                {col.title}
                <span className="tnum font-normal text-ink-3">{tasks.length}</span>
              </h3>
            </div>

            <ul className="flex flex-1 flex-col gap-2">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Card
                    task={t}
                    category={t.category_id ? byId.get(t.category_id) : undefined}
                    today={today}
                    timeFormat={timeFormat}
                    dragging={dragging === t.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', t.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragging(t.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onOpen={() => openTask(t.id)}
                    onToggle={() => void setStatus(t, t.status === 'completed' ? 'pending' : 'completed')}
                  />
                </li>
              ))}
              {tasks.length === 0 && <li className="px-1.5 py-3 text-sm text-ink-3">{col.empty}</li>}
            </ul>

            {col.id === 'todo' && (
              <button
                type="button"
                onClick={() => openCreate({ due_date: today })}
                className="mt-2 flex h-8 items-center gap-1.5 rounded-sm px-1.5 text-sm font-medium text-ink-3 hover:bg-hover hover:text-ink"
              >
                <PlusIcon size={14} />
                Adicionar tarefa
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface CardProps {
  task: Task;
  category?: Category;
  today: ISODate;
  timeFormat: TimeFormat;
  dragging: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onToggle: () => void;
}

function Card({ task, category, today, timeFormat, dragging, onDragStart, onDragEnd, onOpen, onToggle }: CardProps) {
  const done = task.status === 'completed';
  const overdue = isOverdue(task);
  const late = overdue && task.due_date && task.due_date < today;
  const list = checklistProgress(task.checklist);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={category ? ({ '--tint': category.color } as CSSProperties) : undefined}
      className={cn(
        'group relative cursor-grab overflow-hidden rounded-sm border border-line bg-surface py-2.5 pr-2.5 pl-3.5 shadow-[0_1px_0_rgb(0_0_0/0.04)] transition-[opacity,border-color] hover:border-line-strong active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-(--tint,var(--color-accent))" />
      <div className="flex items-start gap-2.5">
        <div className="pt-px">
          <TaskCheckbox
            checked={done}
            onChange={onToggle}
            label={done ? `Reabrir: ${task.title}` : `Concluir: ${task.title}`}
            priority={task.priority}
          />
        </div>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none">
          <span className={cn('block text-base leading-5 break-words', done ? 'text-ink-3 line-through' : 'text-ink')}>
            {task.title}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-3">
            {(task.due_time || late) && (
              <span className={cn('tnum inline-flex items-center gap-1', overdue && !done ? 'font-medium text-late' : '')}>
                <ClockIcon size={12} />
                {late ? relativeDayLabel(task.due_date!, today) : formatTime(task.due_time!, timeFormat)}
              </span>
            )}
            {list.total > 0 && (
              <span
                className={cn(
                  'tnum inline-flex items-center gap-1',
                  list.done === list.total && 'rounded-xs bg-accent-soft px-1 font-medium text-accent',
                )}
                title="Checklist"
              >
                <ChecklistIcon size={12} />
                {list.done}/{list.total}
              </span>
            )}
            {task.description && <TextIcon size={12} aria-label="Tem descrição" />}
            {task.recurrence && !done && <RepeatIcon size={12} aria-label="Repete" />}
            {task.reminder_offset_minutes !== null && !done && <BellIcon size={12} aria-label="Lembrete ativo" />}
            <PriorityGlyph priority={task.priority} className="ml-auto" />
          </span>
          {category && <CategoryBadge category={category} className="mt-1.5 text-xs" />}
        </button>
      </div>
    </div>
  );
}
