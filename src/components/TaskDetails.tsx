import { useEffect, useState, type ReactNode } from 'react';
import type { Task } from '@/types';
import { cn } from '@/utils/cn';
import {
  formatDayLong,
  formatInstant,
  formatReminderOffset,
  formatTime,
  relativeDayLabel,
  zonedToInstant,
} from '@/utils/dates';
import { isOverdue } from '@/utils/task';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useCategories } from '@/hooks/useCategories';
import { useTask, useTaskActions } from '@/hooks/useTasks';
import { CheckIcon, ClockIcon, PencilIcon, ReopenIcon, TrashIcon } from './icons';
import { CategoryBadge, PriorityBadge } from './Badges';
import { Sheet } from './ui/Layer';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Spinner';
import { ConfirmDialog } from './ConfirmDialog';
import { TaskForm } from './TaskForm';
import { TaskCheckbox } from './TaskItem';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] items-baseline gap-3 py-2">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="min-w-0 text-base text-ink">{children}</dd>
    </div>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-ink-3">{children}</span>;

export function TaskDetails() {
  const { taskId, closeTask } = useTaskUI();
  const { data: task, isLoading } = useTask(taskId);
  const [editing, setEditing] = useState(false);

  useEffect(() => setEditing(false), [taskId]);

  return (
    <Sheet open={Boolean(taskId)} onClose={closeTask} title={task ? `Tarefa: ${task.title}` : 'Detalhes da tarefa'}>
      {isLoading ? (
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !task ? (
        <div className="p-6">
          <p className="text-md font-semibold text-ink">Esta tarefa não existe mais.</p>
          <p className="mt-1 text-base text-ink-2">Ela pode ter sido excluída em outro dispositivo.</p>
        </div>
      ) : editing ? (
        <div className="overflow-y-auto scrollbar-thin">
          <EditTask task={task} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <ViewTask task={task} onEdit={() => setEditing(true)} onDeleted={closeTask} />
      )}
    </Sheet>
  );
}

function EditTask({ task, onDone }: { task: Task; onDone: () => void }) {
  const { update } = useTaskActions();
  return (
    <TaskForm
      editing
      submitLabel="Salvar"
      initial={{
        title: task.title,
        description: task.description ?? '',
        due_date: task.due_date,
        due_time: task.due_time ? task.due_time.slice(0, 5) : null,
        priority: task.priority,
        category_id: task.category_id,
        reminder_offset_minutes: task.reminder_offset_minutes,
      }}
      onSubmit={async (input) => {
        await update(task, input, { message: 'Alterações salvas' });
        onDone();
      }}
      onCancel={onDone}
    />
  );
}

function ViewTask({ task, onEdit, onDeleted }: { task: Task; onEdit: () => void; onDeleted: () => void }) {
  const { today, timezone, timeFormat } = usePreferences();
  const { byId } = useCategories();
  const { setStatus, remove } = useTaskActions();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const done = task.status === 'completed';
  const overdue = isOverdue(task);
  const category = task.category_id ? byId.get(task.category_id) : undefined;

  const reminderAt =
    task.due_date && task.reminder_offset_minutes !== null
      ? new Date(
          zonedToInstant(task.due_date, task.due_time ?? '09:00', task.timezone).getTime() -
            task.reminder_offset_minutes * 60_000,
        ).toISOString()
      : null;

  const statusLabel = done ? 'Concluída' : task.status === 'cancelled' ? 'Cancelada' : overdue ? 'Atrasada' : 'Pendente';

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-6 scrollbar-thin">
        <div className="flex items-start gap-3">
          <div className="pt-1">
            <TaskCheckbox
              checked={done}
              onChange={() => void setStatus(task, done ? 'pending' : 'completed')}
              label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}
              priority={task.priority}
            />
          </div>
          <h3 className={cn('text-xl font-semibold break-words text-ink', done && 'text-ink-3 line-through decoration-1')}>
            {task.title}
          </h3>
        </div>

        <div className="mt-4 text-base leading-6 whitespace-pre-wrap text-ink-2">
          {task.description ?? <Muted>Sem descrição</Muted>}
        </div>

        <dl className="mt-6 divide-y divide-line border-t border-b border-line">
          <Row label="Status">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 font-medium',
                overdue ? 'text-late' : done ? 'text-accent' : 'text-ink',
              )}
            >
              {overdue && <ClockIcon size={14} />}
              {done && <CheckIcon size={14} />}
              {statusLabel}
            </span>
          </Row>
          <Row label="Data">
            {task.due_date ? (
              <>
                {relativeDayLabel(task.due_date, today)}
                <span className="text-ink-3"> · {formatDayLong(task.due_date)}</span>
              </>
            ) : (
              <Muted>Sem data</Muted>
            )}
          </Row>
          <Row label="Horário">
            {task.due_time ? <span className="tnum">{formatTime(task.due_time, timeFormat)}</span> : <Muted>Sem horário</Muted>}
          </Row>
          <Row label="Prioridade">
            <PriorityBadge priority={task.priority} showLabel className="text-ink" />
          </Row>
          <Row label="Categoria">{category ? <CategoryBadge category={category} className="text-base text-ink" /> : <Muted>Sem categoria</Muted>}</Row>
          <Row label="Lembrete">
            {reminderAt ? (
              <>
                {formatReminderOffset(task.reminder_offset_minutes)}
                <span className="tnum text-ink-3"> · {formatInstant(reminderAt, timezone, timeFormat, today)}</span>
              </>
            ) : (
              <Muted>Sem lembrete</Muted>
            )}
          </Row>
          <Row label="Criada em">
            <span className="tnum text-ink-2">{formatInstant(task.created_at, timezone, timeFormat, today)}</span>
          </Row>
          {task.completed_at && (
            <Row label="Concluída em">
              <span className="tnum text-ink-2">{formatInstant(task.completed_at, timezone, timeFormat, today)}</span>
            </Row>
          )}
        </dl>
        {task.timezone !== timezone && task.due_time && (
          <p className="mt-3 text-sm text-ink-3">
            Criada no fuso {task.timezone.replace('_', ' ')}; horários mostrados no seu fuso atual.
          </p>
        )}
      </div>

      <div className="safe-bottom flex shrink-0 items-center gap-2 border-t border-line px-4 py-3">
        <Button
          variant={done ? 'secondary' : 'primary'}
          leading={done ? <ReopenIcon size={15} /> : <CheckIcon size={15} />}
          onClick={() => void setStatus(task, done ? 'pending' : 'completed')}
        >
          {done ? 'Reabrir' : 'Concluir'}
        </Button>
        <Button leading={<PencilIcon size={15} />} onClick={onEdit}>
          Editar
        </Button>
        <Button
          variant="ghost"
          className="ml-auto text-danger hover:bg-danger-soft hover:text-danger"
          leading={<TrashIcon size={15} />}
          onClick={() => setConfirming(true)}
        >
          Excluir
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Excluir tarefa?"
        description={
          <>
            “{task.title}” será excluída permanentemente, junto com o lembrete agendado. Esta ação não pode ser
            desfeita.
          </>
        }
        confirmLabel="Excluir tarefa"
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await remove(task);
            setConfirming(false);
            onDeleted();
          } catch {
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
