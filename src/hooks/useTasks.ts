import { useCallback, useState } from 'react';
import type { Page, Task, TaskFilters, TaskInput, TaskPatch, TaskStatus } from '@/types';
import { api } from '@/services';
import { getQueryData, invalidateQueries, setQueryData, updateQueries, useQuery, type QueryKey } from '@/lib/query';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useToast } from '@/contexts/ToastContext';
import { computeDueAt } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';

export const TASKS = ['tasks'] as const;
const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useRangeTasks(from: string, to: string, enabled = true) {
  return useQuery(['tasks', 'range', from, to], () => api.tasks.listRange(from, to), { enabled, keepPrevious: true });
}

export function useOverdueTasks() {
  const { today } = usePreferences();
  // `today` in the key makes the list refresh when the day turns.
  return useQuery(['tasks', 'overdue', today], () => api.tasks.listOverdue(new Date()));
}

export function useTask(id: string | null) {
  return useQuery(['tasks', 'one', id], () => (id ? api.tasks.get(id) : Promise.resolve(null)), {
    enabled: Boolean(id),
  });
}

export function useTaskCount() {
  return useQuery(['tasks', 'count'], () => api.tasks.countAll(), { staleTime: 60_000 });
}

export function usePendingCount(from: string, to: string) {
  return useQuery(['tasks', 'pending-count', from, to], () => api.tasks.countPendingBetween(from, to));
}

export interface InfiniteData<T> {
  rows: T[];
  hasMore: boolean;
  pages: number;
}

function dedupe(rows: Task[]): Task[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** Paginated list that refetches every loaded page together (no jump on refresh). */
function useInfiniteTasks(key: QueryKey, fetchPage: (page: number) => Promise<Page<Task>>) {
  const query = useQuery<InfiniteData<Task>>(
    key,
    async () => {
      const pages = getQueryData<InfiniteData<Task>>(key)?.pages ?? 1;
      const results = await Promise.all(Array.from({ length: pages }, (_, i) => fetchPage(i)));
      return { rows: dedupe(results.flatMap((r) => r.rows)), hasMore: results[results.length - 1].hasMore, pages };
    },
    { keepPrevious: true },
  );
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    const current = getQueryData<InfiniteData<Task>>(key);
    if (!current?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(current.pages);
      setQueryData<InfiniteData<Task>>(key, (old) => ({
        rows: dedupe([...(old?.rows ?? []), ...next.rows]),
        hasMore: next.hasMore,
        pages: (old?.pages ?? 1) + 1,
      }));
    } finally {
      setLoadingMore(false);
    }
  }, [JSON.stringify(key), loadingMore, fetchPage]); // key is compared by value

  return { ...query, loadingMore, loadMore };
}

export function useUpcomingTasks() {
  const { today } = usePreferences();
  const fetchPage = useCallback((p: number) => api.tasks.listUpcoming(today, p, PAGE_SIZE), [today]);
  return useInfiniteTasks(['tasks', 'upcoming', today], fetchPage);
}

export function useFilteredTasks(filters: TaskFilters) {
  const { dateContext } = usePreferences();
  const fetchPage = useCallback(
    (p: number) => api.tasks.list(filters, dateContext, p, PAGE_SIZE),
    [JSON.stringify(filters), dateContext.today, dateContext.timezone], // filters compared by value
  );
  return useInfiniteTasks(['tasks', 'list', filters, dateContext.today], fetchPage);
}

export function useCompletedTasks() {
  const fetchPage = useCallback((p: number) => api.tasks.listCompleted(p, PAGE_SIZE), []);
  return useInfiniteTasks(['tasks', 'completed'], fetchPage);
}

// ---------------------------------------------------------------------------
// Cache helpers for optimistic updates
// ---------------------------------------------------------------------------

type TaskMapper = (t: Task) => Task | null;

function mapTasksIn(data: unknown, fn: TaskMapper): unknown {
  if (Array.isArray(data)) {
    let changed = false;
    const next: Task[] = [];
    for (const t of data as Task[]) {
      const r = fn(t);
      if (r !== t) changed = true;
      if (r) next.push(r);
    }
    return changed ? next : data;
  }
  if (data && typeof data === 'object' && 'rows' in data) {
    const d = data as InfiniteData<Task>;
    const rows = mapTasksIn(d.rows, fn) as Task[];
    return rows === d.rows ? data : { ...d, rows };
  }
  if (data && typeof data === 'object' && 'title' in data && 'status' in data) {
    return fn(data as Task) ?? null;
  }
  return data;
}

export function patchTaskInCache(next: Task) {
  updateQueries(TASKS, (data) => mapTasksIn(data, (t) => (t.id === next.id ? next : t)));
}

function removeTaskFromCache(id: string) {
  updateQueries(TASKS, (data) => mapTasksIn(data, (t) => (t.id === id ? null : t)));
}

function applyPatch(task: Task, patch: TaskPatch, timezone: string): Task {
  const next: Task = { ...task, ...patch } as Task;
  if ('due_date' in patch || 'due_time' in patch) next.timezone = timezone;
  if (!next.due_date) {
    next.due_time = null;
    next.reminder_offset_minutes = null;
  }
  next.due_at = computeDueAt(next.due_date, next.due_time, next.timezone);
  if (patch.status && patch.status !== task.status) {
    next.completed_at = patch.status === 'completed' ? new Date().toISOString() : null;
  }
  return next;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
/** Coalesces bursts of mutations into one background refresh. */
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => invalidateQueries(TASKS), 900); // after list animations finish
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useTaskActions() {
  const { timezone } = usePreferences();
  const { toast } = useToast();

  const create = useCallback(
    async (input: TaskInput) => {
      try {
        const task = await api.tasks.create(input, timezone);
        setQueryData(['tasks', 'one', task.id], task);
        invalidateQueries(TASKS); // show it everywhere right away
        toast({ message: 'Tarefa criada', description: task.title });
        return task;
      } catch (e) {
        toast({ message: errorMessage(e, 'Não foi possível criar a tarefa.'), tone: 'error' });
        throw e;
      }
    },
    [timezone, toast],
  );

  const update = useCallback(
    async (task: Task, patch: TaskPatch, opts: { silent?: boolean; message?: string } = {}) => {
      const optimistic = applyPatch(task, patch, timezone);
      patchTaskInCache(optimistic);
      try {
        const saved = await api.tasks.update(task.id, patch, timezone);
        patchTaskInCache(saved);
        scheduleRefresh();
        if (!opts.silent) toast({ message: opts.message ?? 'Alterações salvas' });
        return saved;
      } catch (e) {
        patchTaskInCache(task); // roll back
        toast({ message: errorMessage(e, 'Não foi possível salvar a tarefa.'), tone: 'error' });
        throw e;
      }
    },
    [timezone, toast],
  );

  const setStatus = useCallback(
    async (task: Task, status: TaskStatus) => {
      try {
        await update(task, { status }, { silent: true });
      } catch {
        return;
      }
      if (status === 'completed') {
        toast({
          message: 'Tarefa concluída',
          description: task.title,
          action: { label: 'Desfazer', onClick: () => void update({ ...task, status: 'completed' }, { status: 'pending' }, { silent: true }) },
        });
      } else if (status === 'pending' && task.status === 'completed') {
        toast({ message: 'Tarefa reaberta', description: task.title });
      }
    },
    [update, toast],
  );

  const remove = useCallback(
    async (task: Task) => {
      removeTaskFromCache(task.id);
      try {
        await api.tasks.remove(task.id);
        scheduleRefresh();
        invalidateQueries(['notifications']);
        toast({ message: 'Tarefa excluída', description: task.title });
      } catch (e) {
        scheduleRefresh(); // restore from server
        toast({ message: errorMessage(e, 'Não foi possível excluir a tarefa.'), tone: 'error' });
        throw e;
      }
    },
    [toast],
  );

  return { create, update, setStatus, remove };
}
