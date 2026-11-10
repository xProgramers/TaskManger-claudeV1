import { useTaskUI } from '@/contexts/TaskUIContext';
import { useTaskActions } from '@/hooks/useTasks';
import { Dialog } from './ui/Layer';
import { TaskForm } from './TaskForm';

/** "Nova tarefa" — the fastest flow in the app: N → type → Enter. */
export function TaskModal() {
  const { createOpen, createDefaults, closeCreate } = useTaskUI();
  const { create } = useTaskActions();

  return (
    <Dialog open={createOpen} onClose={closeCreate} title="Nova tarefa" hideTitle position="top" className="flex max-h-[84vh] max-w-[680px] flex-col max-sm:max-h-[92dvh]">
      {createOpen && (
        <TaskForm
          naturalLanguage
          submitLabel="Criar tarefa"
          initial={{
            title: createDefaults.title ?? '',
            description: '',
            due_date: createDefaults.due_date ?? null,
            due_time: createDefaults.due_time ?? null,
            priority: 'medium',
            category_id: createDefaults.category_id ?? null,
            reminder_offset_minutes: null,
            recurrence: null,
            checklist: [],
          }}
          onSubmit={async (input) => {
            await create(input);
            closeCreate();
          }}
          onCancel={closeCreate}
        />
      )}
    </Dialog>
  );
}
