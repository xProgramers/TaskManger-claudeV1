import { useState } from 'react';
import type { ISODate } from '@/types';
import { cn } from '@/utils/cn';
import { addMonths, formatMonthYear, isSameMonth, monthGrid, parseDate, weekdayLabels } from '@/utils/dates';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { IconButton } from './Button';

interface MiniCalendarProps {
  value: ISODate | null;
  today: ISODate;
  weekStartsOn: 0 | 1;
  onSelect: (date: ISODate) => void;
}

/** Compact month grid for picking a date. Arrow keys move by day/week. */
export function MiniCalendar({ value, today, weekStartsOn, onSelect }: MiniCalendarProps) {
  const [month, setMonth] = useState<ISODate>(value ?? today);
  const [focusDay, setFocusDay] = useState<ISODate>(value ?? today);
  const days = monthGrid(month, weekStartsOn);

  const moveFocus = (delta: number) => {
    const d = parseDate(focusDay);
    d.setUTCDate(d.getUTCDate() + delta);
    const next = d.toISOString().slice(0, 10);
    setFocusDay(next);
    if (!isSameMonth(next, month)) setMonth(next);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-minical-day="${next}"]`)?.focus(),
    );
  };

  return (
    <div className="w-[248px] select-none p-1">
      <div className="mb-1 flex items-center justify-between">
        <span className="pl-1.5 text-base font-semibold text-ink" aria-live="polite">
          {formatMonthYear(month)}
        </span>
        <div className="flex">
          <IconButton size="sm" label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeftIcon />
          </IconButton>
          <IconButton size="sm" label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRightIcon />
          </IconButton>
        </div>
      </div>
      <div role="grid" aria-label={formatMonthYear(month)} className="grid grid-cols-7 gap-y-0.5">
        {weekdayLabels(weekStartsOn).map((l) => (
          <span key={l} role="columnheader" className="py-1 text-center text-2xs font-medium text-ink-3">
            {l.slice(0, 1)}
            <span className="sr-only">{l.slice(1)}</span>
          </span>
        ))}
        {days.map((d) => {
          const inMonth = isSameMonth(d, month);
          const selected = d === value;
          const isToday = d === today;
          const past = d < today;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-current={isToday ? 'date' : undefined}
              data-minical-day={d}
              tabIndex={d === focusDay ? 0 : -1}
              onClick={() => onSelect(d)}
              onKeyDown={(e) => {
                const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
                if (e.key in keys) {
                  e.preventDefault();
                  moveFocus(keys[e.key]);
                }
              }}
              className={cn(
                'tnum mx-auto flex size-8 items-center justify-center rounded-sm text-sm transition-colors',
                selected
                  ? 'bg-accent font-semibold text-accent-ink'
                  : cn(
                      'hover:bg-hover',
                      isToday && 'font-semibold text-accent',
                      !isToday && (inMonth ? (past ? 'text-ink-3' : 'text-ink') : 'text-ink-3/50'),
                    ),
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
