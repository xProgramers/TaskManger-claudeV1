/**
 * Task business rules shared by every screen (kept out of components).
 */
import type { ISODate, Task, TaskPriority } from '../types/index.ts';
import { addDays, normalizeTime } from './dates.ts';

export const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

/** Pending task whose deadline passed (date-only tasks are late from the next day). */
export function isOverdue(task: Pick<Task, 'status' | 'due_at'>, now: Date = new Date()): boolean {
  return task.status === 'pending' && task.due_at !== null && new Date(task.due_at).getTime() < now.getTime();
}

/** Timed tasks first, by time; then untimed by priority; then by creation. */
export function compareWithinDay(a: Task, b: Task): number {
  if (a.due_time && b.due_time) {
    const t = normalizeTime(a.due_time).localeCompare(normalizeTime(b.due_time));
    if (t !== 0) return t;
  } else if (a.due_time) return -1;
  else if (b.due_time) return 1;
  const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (p !== 0) return p;
  return a.created_at.localeCompare(b.created_at);
}

/** Chronological: by date (undated last), then within the day. */
export function compareChronological(a: Task, b: Task): number {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  }
  return compareWithinDay(a, b);
}

export function groupByDate(tasks: Task[]): Map<ISODate, Task[]> {
  const map = new Map<ISODate, Task[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const list = map.get(t.due_date) ?? [];
    list.push(t);
    map.set(t.due_date, list);
  }
  for (const list of map.values()) list.sort(compareWithinDay);
  return map;
}

export interface DaySummary {
  total: number;
  completed: number;
  pending: number;
  /** 0–1 */
  progress: number;
}

/** Summary over tasks due on a given day (cancelled tasks don't count). */
export function summarizeDay(tasks: Task[], day: ISODate): DaySummary {
  const relevant = tasks.filter((t) => t.due_date === day && t.status !== 'cancelled');
  const completed = relevant.filter((t) => t.status === 'completed').length;
  const total = relevant.length;
  return { total, completed, pending: total - completed, progress: total === 0 ? 0 : completed / total };
}

/** Date range [from, to] (inclusive) for a period filter. */
export function periodRange(
  period: 'today' | 'tomorrow' | 'week' | 'next30',
  today: ISODate,
): { from: ISODate; to: ISODate } {
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'tomorrow':
      return { from: addDays(today, 1), to: addDays(today, 1) };
    case 'week':
      return { from: today, to: addDays(today, 6) };
    case 'next30':
      return { from: today, to: addDays(today, 29) };
  }
}

export const CATEGORY_COLORS = [
  { value: '#5B7FA6', name: 'Azul ardósia' },
  { value: '#4F8A6E', name: 'Verde' },
  { value: '#5E8F94', name: 'Petróleo' },
  { value: '#8A6BA8', name: 'Violeta' },
  { value: '#B05B6E', name: 'Rosa' },
  { value: '#A0744B', name: 'Castanho' },
  { value: '#9C8A3A', name: 'Oliva' },
  { value: '#6B7280', name: 'Cinza' },
] as const;
