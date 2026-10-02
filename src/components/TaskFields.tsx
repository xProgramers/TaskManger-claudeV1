/**
 * Compact "chip" pickers used by the task form: each shows the current value
 * and opens a small popover/menu. Keyboard: Enter/Space opens, Esc closes and
 * returns focus to the chip.
 */
import { useRef, useState, type ReactNode, type Ref } from 'react';
import type { Category, ISODate, ISOTime, ReminderOffset, TaskPriority, TimeFormat } from '@/types';
import { REMINDER_OFFSETS } from '@/types';
import { cn } from '@/utils/cn';
import {
  addDays,
  formatReminderOffset,
  formatTime,
  formatWeekdayShort,
  relativeDayLabel,
  startOfWeek,
  weekdayOf,
} from '@/utils/dates';
import { PRIORITY_LABEL } from '@/utils/task';
import { BellIcon, CalendarIcon, CheckIcon, ClockIcon, TagIcon, XIcon } from '@/components/icons';
import { CategoryDot, PriorityGlyph } from '@/components/Badges';
import { Menu, MenuItem, MenuSeparator, Popover } from '@/components/ui/Layer';
import { MiniCalendar } from '@/components/ui/MiniCalendar';

interface ChipProps {
  icon: ReactNode;
  children: ReactNode;
  active?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  'aria-haspopup'?: 'menu' | 'dialog';
  'aria-expanded'?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  label: string;
}

function Chip({ icon, children, active, onClear, clearLabel, disabled, buttonRef, label, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center rounded-sm border text-sm transition-colors',
        active ? 'border-line-strong bg-surface text-ink' : 'border-line bg-surface text-ink-2',
        disabled && 'opacity-50',
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        className={cn('inline-flex h-full items-center gap-1.5 rounded-sm px-2.5 hover:text-ink', onClear && active && 'pr-1.5')}
        {...rest}
      >
        <span className={active ? 'text-ink-2' : 'text-ink-3'}>{icon}</span>
        <span className="font-medium">{children}</span>
      </button>
      {onClear && active && (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className="mr-1 rounded-xs p-0.5 text-ink-3 hover:bg-hover hover:text-ink"
        >
          <XIcon size={12} />
        </button>
      )}
    </span>
  );
}

// --- Date ----------------------------------------------------------------------

interface DateChipProps {
  value: ISODate | null;
  today: ISODate;
  weekStartsOn: 0 | 1;
  onChange: (value: ISODate | null) => void;
}

export function DateChip({ value, today, weekStartsOn, onChange }: DateChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const nextMonday = addDays(startOfWeek(today, 1), 7);
  const weekendDay = weekdayOf(today) === 6 ? today : addDays(today, (6 - weekdayOf(today) + 7) % 7);

  const quick: { label: string; date: ISODate }[] = [
    { label: 'Hoje', date: today },
    { label: 'Amanhã', date: addDays(today, 1) },
    { label: 'Fim de semana', date: weekendDay },
    { label: 'Próxima segunda', date: nextMonday },
  ];
  const pick = (d: ISODate | null) => {
    onChange(d);
    setOpen(false);
  };

  return (
    <>
      <Chip
        buttonRef={ref}
        icon={<CalendarIcon size={14} />}
        active={Boolean(value)}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClear={() => onChange(null)}
        clearLabel="Remover data"
        label={value ? `Data: ${relativeDayLabel(value, today)}. Alterar data` : 'Definir data'}
      >
        {value ? relativeDayLabel(value, today) : 'Data'}
      </Chip>
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} label="Escolher data">
        <div className="flex flex-col gap-0.5 border-b border-line pb-1">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => pick(q.date)}
              className="flex h-8 items-center justify-between rounded-xs px-2.5 text-base text-ink hover:bg-hover"
            >
              {q.label}
              <span className="tnum text-sm text-ink-3">
                {formatWeekdayShort(q.date)} {Number(q.date.slice(8))}
              </span>
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex h-8 items-center rounded-xs px-2.5 text-base text-ink-2 hover:bg-hover"
            >
              Sem data
            </button>
          )}
        </div>
        <MiniCalendar value={value} today={today} weekStartsOn={weekStartsOn} onSelect={(d) => pick(d)} />
      </Popover>
    </>
  );
}

// --- Time ----------------------------------------------------------------------

const TIME_SLOTS: ISOTime[] = ['08:00', '09:00', '12:00', '14:00', '18:00', '20:00'];

interface TimeChipProps {
  value: ISOTime | null;
  format: TimeFormat;
  disabled?: boolean;
  onChange: (value: ISOTime | null) => void;
}

export function TimeChip({ value, format, disabled, onChange }: TimeChipProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLButtonElement>(null);
  const pick = (t: ISOTime | null) => {
    onChange(t);
    setOpen(false);
  };

  return (
    <>
      <Chip
        buttonRef={ref}
        icon={<ClockIcon size={14} />}
        active={Boolean(value)}
        disabled={disabled}
        onClick={() => {
          setDraft(value ?? '');
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClear={() => onChange(null)}
        clearLabel="Remover horário"
        label={value ? `Horário: ${formatTime(value, format)}. Alterar` : disabled ? 'Horário (defina uma data antes)' : 'Definir horário'}
      >
        <span className="tnum">{value ? formatTime(value, format) : 'Horário'}</span>
      </Chip>
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} label="Escolher horário" className="w-56">
        <form
          className="flex gap-1.5 p-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{2}:\d{2}$/.test(draft)) pick(draft);
          }}
        >
          <input
            type="time"
            aria-label="Horário"
            data-autofocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="tnum h-8 min-w-0 flex-1 rounded-sm border border-line bg-surface px-2 text-base text-ink focus:border-accent focus:outline-none"
          />
          <button type="submit" className="h-8 rounded-sm bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
            OK
          </button>
        </form>
        <div className="grid grid-cols-3 gap-1 border-t border-line p-1.5">
          {TIME_SLOTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => pick(t)}
              className={cn(
                'tnum h-7 rounded-xs text-sm hover:bg-hover',
                value === t ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-2',
              )}
            >
              {formatTime(t, format)}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

// --- Priority -----------------------------------------------------------------

export function PriorityChip({ value, onChange }: { value: TaskPriority; onChange: (p: TaskPriority) => void }) {
  return (
    <Menu
      label="Prioridade"
      align="start"
      trigger={(t) => (
        <Chip
          buttonRef={t.ref}
          onClick={t.onClick}
          aria-haspopup={t['aria-haspopup']}
          aria-expanded={t['aria-expanded']}
          icon={<PriorityGlyph priority={value} />}
          active={value !== 'medium'}
          label={`Prioridade: ${PRIORITY_LABEL[value]}. Alterar`}
        >
          {PRIORITY_LABEL[value]}
        </Chip>
      )}
    >
      {(['high', 'medium', 'low'] as const).map((p) => (
        <MenuItem
          key={p}
          onSelect={() => onChange(p)}
          icon={<PriorityGlyph priority={p} />}
          hint={value === p ? <CheckIcon size={14} className="text-accent" /> : null}
        >
          {PRIORITY_LABEL[p]}
        </MenuItem>
      ))}
    </Menu>
  );
}

// --- Category -----------------------------------------------------------------

interface CategoryChipProps {
  value: string | null;
  categories: Category[];
  onChange: (id: string | null) => void;
  onManage: () => void;
}

export function CategoryChip({ value, categories, onChange, onManage }: CategoryChipProps) {
  const current = categories.find((c) => c.id === value);
  return (
    <Menu
      label="Categoria"
      align="start"
      trigger={(t) => (
        <Chip
          buttonRef={t.ref}
          onClick={t.onClick}
          aria-haspopup={t['aria-haspopup']}
          aria-expanded={t['aria-expanded']}
          icon={current ? <CategoryDot color={current.color} /> : <TagIcon size={14} />}
          active={Boolean(current)}
          label={current ? `Categoria: ${current.name}. Alterar` : 'Definir categoria'}
        >
          {current?.name ?? 'Categoria'}
        </Chip>
      )}
    >
      {categories.map((c) => (
        <MenuItem
          key={c.id}
          onSelect={() => onChange(c.id)}
          icon={<CategoryDot color={c.color} />}
          hint={value === c.id ? <CheckIcon size={14} className="text-accent" /> : null}
        >
          {c.name}
        </MenuItem>
      ))}
      {categories.length > 0 && <MenuSeparator />}
      {value && <MenuItem onSelect={() => onChange(null)}>Sem categoria</MenuItem>}
      <MenuItem onSelect={onManage}>{categories.length ? 'Gerenciar categorias' : 'Criar categoria'}</MenuItem>
    </Menu>
  );
}

// --- Reminder -----------------------------------------------------------------

interface ReminderChipProps {
  value: ReminderOffset | null;
  disabled?: boolean;
  hasTime: boolean;
  onChange: (v: ReminderOffset | null) => void;
}

export function ReminderChip({ value, disabled, hasTime, onChange }: ReminderChipProps) {
  const short = (m: ReminderOffset) =>
    m === 0 ? 'No horário' : m === 60 ? '1 h antes' : m === 1440 ? '1 dia antes' : `${m} min antes`;
  return (
    <Menu
      label="Lembrete"
      align="start"
      trigger={(t) => (
        <Chip
          buttonRef={t.ref}
          onClick={t.onClick}
          aria-haspopup={t['aria-haspopup']}
          aria-expanded={t['aria-expanded']}
          disabled={disabled}
          icon={<BellIcon size={14} />}
          active={value !== null}
          onClear={() => onChange(null)}
          clearLabel="Remover lembrete"
          label={
            disabled
              ? 'Lembrete (defina uma data antes)'
              : value !== null
                ? `Lembrete: ${formatReminderOffset(value)}. Alterar`
                : 'Definir lembrete'
          }
        >
          {value !== null ? short(value) : 'Lembrete'}
        </Chip>
      )}
    >
      {REMINDER_OFFSETS.map((m) => (
        <MenuItem key={m} onSelect={() => onChange(m)} hint={value === m ? <CheckIcon size={14} className="text-accent" /> : null}>
          {formatReminderOffset(m)}
        </MenuItem>
      ))}
      {!hasTime && (
        <p className="px-2.5 pt-1 pb-1.5 text-xs text-ink-3">Sem horário definido, o lembrete usa 09:00 do dia.</p>
      )}
    </Menu>
  );
}
