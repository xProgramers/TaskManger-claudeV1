import { useState, type FormEvent } from 'react';
import type { ISODate } from '@/types';
import { cn } from '@/utils/cn';
import { formatDayMonthShort, formatTime, nowTimeIn, relativeDayLabel } from '@/utils/dates';
import { parseQuickAdd } from '@/utils/quickAdd';
import { PRIORITY_LABEL } from '@/utils/task';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useCategories } from '@/hooks/useCategories';
import { useTaskActions } from '@/hooks/useTasks';
import { PlusIcon } from './icons';
import { Spinner } from './ui/Spinner';

interface QuickAddProps {
  /** Date used when the text doesn't mention one. */
  defaultDate: ISODate | null;
  placeholder?: string;
  categoryId?: string | null;
}

/**
 * One-line creation. Plain text creates a task for `defaultDate`; date/time
 * words are understood and shown before saving, so nothing is guessed silently.
 */
export function QuickAdd({ defaultDate, placeholder = 'Adicionar tarefa', categoryId = null }: QuickAddProps) {
  const { today, timezone, timeFormat, prefs } = usePreferences();
  const { categories, byId } = useCategories();
  const { create } = useTaskActions();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = text.trim()
    ? parseQuickAdd(text, { today, nowTime: nowTimeIn(timezone), categories })
    : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed || !parsed.title || saving) return;
    setSaving(true);
    const date = parsed.date ?? defaultDate;
    try {
      await create({
        title: parsed.title,
        due_date: date,
        due_time: date ? parsed.time : null,
        priority: parsed.priority ?? 'medium',
        category_id: parsed.categoryId ?? categoryId,
        reminder_offset_minutes: date && parsed.time ? (prefs?.default_reminder_minutes ?? null) : null,
      });
      setText('');
    } catch {
      // toast shown; keep the text so nothing is lost
    } finally {
      setSaving(false);
    }
  };

  const summary: string[] = [];
  if (parsed?.date) summary.push(`${relativeDayLabel(parsed.date, today)} (${formatDayMonthShort(parsed.date)})`);
  if (parsed?.time) summary.push(formatTime(parsed.time, timeFormat));
  if (parsed?.priority) summary.push(`prioridade ${PRIORITY_LABEL[parsed.priority].toLowerCase()}`);
  if (parsed?.categoryId) summary.push(byId.get(parsed.categoryId)?.name ?? '');

  return (
    <form onSubmit={submit} className="group">
      <div
        className={cn(
          'flex h-11 items-center gap-3 rounded-sm border border-transparent px-3 transition-colors',
          'hover:bg-hover focus-within:border-line focus-within:bg-surface',
        )}
      >
        <span className="flex size-[18px] items-center justify-center text-accent">
          {saving ? <Spinner size={15} /> : <PlusIcon size={17} strokeWidth={2} />}
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && text) {
              e.stopPropagation();
              setText('');
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={summary.length ? 'quickadd-summary' : undefined}
          maxLength={260}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none"
        />
        {text.trim() && (
          <span className="hidden shrink-0 text-xs text-ink-3 sm:inline">Enter para criar</span>
        )}
      </div>
      {summary.length > 0 && (
        <p id="quickadd-summary" className="tnum px-3 pt-1 pl-[42px] text-sm text-accent" aria-live="polite">
          {parsed?.title ? `“${parsed.title}”: ` : ''}
          {summary.join(', ')}
        </p>
      )}
    </form>
  );
}
