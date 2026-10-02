import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ISODate, ISOTime, ReminderOffset, TaskInput, TaskPriority } from '@/types';
import { cn } from '@/utils/cn';
import { formatDayMonthShort, formatTime, nowTimeIn, normalizeTime, relativeDayLabel } from '@/utils/dates';
import { parseQuickAdd, type QuickTokenKind } from '@/utils/quickAdd';
import { PRIORITY_LABEL } from '@/utils/task';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Form';
import { EnterIcon, XIcon } from '@/components/icons';
import { CategoryChip, DateChip, PriorityChip, ReminderChip, TimeChip } from './TaskFields';

export interface TaskFormValues {
  title: string;
  description: string;
  due_date: ISODate | null;
  due_time: ISOTime | null;
  priority: TaskPriority;
  category_id: string | null;
  reminder_offset_minutes: ReminderOffset | null;
}

interface TaskFormProps {
  initial: TaskFormValues;
  submitLabel: string;
  onSubmit: (values: TaskInput) => Promise<unknown>;
  onCancel: () => void;
  /** Understand "amanhã às 18h" etc. typed in the title (creation only). */
  naturalLanguage?: boolean;
  /** True when editing: the reminder default is not auto-applied. */
  editing?: boolean;
}

const TOKEN_LABEL: Record<QuickTokenKind, string> = {
  date: 'data',
  time: 'horário',
  priority: 'prioridade',
  category: 'categoria',
};

export function TaskForm({ initial, submitLabel, onSubmit, onCancel, naturalLanguage, editing }: TaskFormProps) {
  const { today, timezone, timeFormat, weekStartsOn, prefs } = usePreferences();
  const { categories, byId } = useCategories();
  const { openCategories } = useTaskUI();

  const [v, setV] = useState<TaskFormValues>(initial);
  const [ignored, setIgnored] = useState<QuickTokenKind[]>([]);
  const [reminderTouched, setReminderTouched] = useState(editing ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const parsed = useMemo(
    () =>
      naturalLanguage
        ? parseQuickAdd(v.title, { today, nowTime: nowTimeIn(timezone), categories, ignore: ignored })
        : null,
    [naturalLanguage, v.title, today, timezone, categories, ignored],
  );

  // What will actually be saved: typed tokens fill in what the chips don't override.
  const effective = {
    title: (parsed?.title ?? v.title).trim(),
    due_date: parsed?.date ?? v.due_date,
    due_time: parsed?.time ?? v.due_time,
    priority: parsed?.priority ?? v.priority,
    category_id: parsed?.categoryId ?? v.category_id,
  };
  const defaultReminder = (prefs?.default_reminder_minutes ?? null) as ReminderOffset | null;
  const reminder: ReminderOffset | null = !effective.due_date
    ? null
    : reminderTouched
      ? v.reminder_offset_minutes
      : effective.due_time
        ? defaultReminder
        : null;

  /** Picking a value by hand wins over what was typed (the text stays in the title). */
  const setManual = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K], kind?: QuickTokenKind) => {
    setV((prev) => ({ ...prev, [key]: value }));
    if (kind && parsed?.tokens.some((t) => t.kind === kind)) setIgnored((s) => [...s, kind]);
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    if (!effective.title) {
      setError('Dê um título para a tarefa.');
      titleRef.current?.focus();
      return;
    }
    if (effective.title.length > 200) {
      setError('O título pode ter até 200 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title: effective.title,
        description: v.description.trim() || null,
        due_date: effective.due_date,
        due_time: effective.due_date && effective.due_time ? normalizeTime(effective.due_time) : null,
        priority: effective.priority,
        category_id: effective.category_id,
        reminder_offset_minutes: reminder,
      });
    } catch {
      // The toast already explained; keep the form open with the user's input.
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const onTitleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };
  const onDescriptionKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  };

  const tokenText = (kind: QuickTokenKind): string => {
    switch (kind) {
      case 'date':
        return parsed?.date ? `${relativeDayLabel(parsed.date, today)}, ${formatDayMonthShort(parsed.date)}` : '';
      case 'time':
        return parsed?.time ? formatTime(parsed.time, timeFormat) : '';
      case 'priority':
        return parsed?.priority ? `Prioridade ${PRIORITY_LABEL[parsed.priority].toLowerCase()}` : '';
      case 'category':
        return parsed?.categoryId ? (byId.get(parsed.categoryId)?.name ?? '') : '';
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <div className="px-5 pt-4">
        <label htmlFor="task-title" className="sr-only">
          Título da tarefa
        </label>
        <textarea
          id="task-title"
          ref={titleRef}
          data-autofocus
          rows={1}
          value={v.title}
          maxLength={260}
          onChange={(e) => {
            setV((p) => ({ ...p, title: e.target.value.replace(/\n/g, ' ') }));
            if (error) setError(null);
          }}
          onKeyDown={onTitleKey}
          placeholder={naturalLanguage ? 'Ex.: Enviar relatório amanhã às 14h' : 'Título da tarefa'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'task-title-error' : parsed?.tokens.length ? 'task-understood' : undefined}
          className="field-sizing-content block min-h-7 w-full resize-none bg-transparent text-lg font-medium text-ink placeholder:font-normal placeholder:text-ink-3 focus:outline-none"
        />
        {error && (
          <p id="task-title-error" role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}

        {parsed && parsed.tokens.length > 0 && (
          <div id="task-understood" className="mt-2 flex flex-wrap items-center gap-1.5 text-sm" aria-live="polite">
            <span className="text-ink-3">Entendi:</span>
            {parsed.tokens.map((t) => (
              <span
                key={t.kind}
                className="inline-flex h-6 items-center gap-1 rounded-xs bg-accent-soft pr-1 pl-2 font-medium text-accent"
              >
                {tokenText(t.kind)}
                <button
                  type="button"
                  onClick={() => setIgnored((s) => [...s, t.kind])}
                  aria-label={`Não usar “${t.text}” como ${TOKEN_LABEL[t.kind]}`}
                  title={`Manter “${t.text}” no título`}
                  className="rounded-xs p-0.5 hover:bg-accent/15"
                >
                  <XIcon size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <label htmlFor="task-description" className="sr-only">
          Descrição
        </label>
        <textarea
          id="task-description"
          value={v.description}
          maxLength={5000}
          onChange={(e) => setV((p) => ({ ...p, description: e.target.value }))}
          onKeyDown={onDescriptionKey}
          placeholder="Descrição (opcional)"
          className="field-sizing-content mt-2 block max-h-56 min-h-6 w-full resize-none bg-transparent text-base leading-6 text-ink-2 placeholder:text-ink-3 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 px-5 pt-4 pb-4">
        <DateChip
          value={effective.due_date}
          today={today}
          weekStartsOn={weekStartsOn}
          onChange={(d) => {
            setManual('due_date', d, 'date');
            if (!d) setManual('due_time', null, 'time');
          }}
        />
        <TimeChip
          value={effective.due_time}
          format={timeFormat}
          disabled={!effective.due_date}
          onChange={(t) => setManual('due_time', t, 'time')}
        />
        <PriorityChip value={effective.priority} onChange={(p) => setManual('priority', p, 'priority')} />
        <CategoryChip
          value={effective.category_id}
          categories={categories}
          onChange={(c) => setManual('category_id', c, 'category')}
          onManage={openCategories}
        />
        <ReminderChip
          value={reminder}
          disabled={!effective.due_date}
          hasTime={Boolean(effective.due_time)}
          onChange={(r) => {
            setReminderTouched(true);
            setV((p) => ({ ...p, reminder_offset_minutes: r }));
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className={cn('hidden items-center gap-1.5 text-sm text-ink-3 sm:flex')}>
          <Kbd>
            <EnterIcon size={11} />
          </Kbd>
          para {editing ? 'salvar' : 'criar'}
          <span className="px-1 text-line-strong">/</span>
          <Kbd>Esc</Kbd> para cancelar
        </p>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
