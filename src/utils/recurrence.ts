/**
 * Repeating tasks. Completing one moves it to its next date; the database does
 * that on its own (`public.next_occurrence`), this mirror only lets the UI show
 * the result right away. Keep both in sync.
 */
import type { ISODate, Recurrence } from '../types/index.ts';
import { addDays, diffDays, formatDayMonth, parseDate, toISODate, weekdayOf } from './dates.ts';

const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Adds months keeping the day, clamped to the month's end (31 jan + 1 = 28/29 fev), like Postgres. */
function addMonthsClamped(iso: ISODate, months: number): ISODate {
  const d = parseDate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return toISODate(d);
}

const isWeekend = (iso: ISODate) => weekdayOf(iso) % 6 === 0;

/** First date of the series after both `due` and `today` (an overdue task skips the missed dates). */
export function nextOccurrence(rule: Recurrence, due: ISODate, today: ISODate): ISODate {
  const base = due > today ? due : today;
  switch (rule) {
    case 'daily':
      return addDays(base, 1);
    case 'weekdays': {
      let next = addDays(base, 1);
      while (isWeekend(next)) next = addDays(next, 1);
      return next;
    }
    case 'weekly':
      return addDays(due, 7 * (Math.floor(diffDays(base, due) / 7) + 1));
    case 'monthly':
    case 'yearly': {
      const months = rule === 'monthly' ? 1 : 12;
      const [by, bm] = base.split('-').map(Number);
      const [dy, dm] = due.split('-').map(Number);
      let step = Math.floor(((by - dy) * 12 + bm - dm) / months);
      let next = addMonthsClamped(due, step * months);
      while (next <= base) next = addMonthsClamped(due, ++step * months);
      return next;
    }
  }
}

/** First date on/after `today` that fits the rule (a new weekday task created on a Saturday starts Monday). */
export function firstOccurrence(rule: Recurrence, today: ISODate): ISODate {
  return rule === 'weekdays' && isWeekend(today) ? nextOccurrence(rule, today, today) : today;
}

/** "Todo dia", "Toda segunda", "Todo dia 5"… `due` makes the label specific. */
export function recurrenceLabel(rule: Recurrence, due?: ISODate | null): string {
  switch (rule) {
    case 'daily':
      return 'Todo dia';
    case 'weekdays':
      return 'Dias úteis';
    case 'weekly': {
      if (!due) return 'Toda semana';
      const day = weekdayOf(due);
      return `${day % 6 === 0 ? 'Todo' : 'Toda'} ${WEEKDAY_NAMES[day]}`;
    }
    case 'monthly':
      return due ? `Todo dia ${Number(due.slice(8))}` : 'Todo mês';
    case 'yearly':
      return due ? `Todo ano, ${formatDayMonth(due)}` : 'Todo ano';
  }
}
