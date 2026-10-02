import type { Page, Task, TaskFilters, TaskInput, TaskPatch } from '@/types';
import type { TasksApi } from '@/services/api';
import { periodRange } from '@/utils/task';
import { toAppError } from '@/utils/errors';
import { getSupabase } from './client';

const COLUMNS =
  'id,user_id,title,description,status,priority,due_date,due_time,timezone,due_at,reminder_offset_minutes,category_id,completed_at,created_at,updated_at';

const asTask = (row: unknown) => row as Task;
const asTasks = (rows: unknown) => (rows ?? []) as Task[];

/** Strips characters that have meaning in PostgREST filter syntax. */
export function sanitizeSearch(query: string): string {
  return query
    .replace(/[%_,()"\\*:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function page<T>(rows: T[], pageSize: number): Page<T> {
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

const from = () => getSupabase().from('tasks');

export const supabaseTasks: TasksApi = {
  async listRange(start, end) {
    const { data, error } = await from()
      .select(COLUMNS)
      .gte('due_date', start)
      .lte('due_date', end)
      .neq('status', 'cancelled')
      .order('due_date')
      .order('due_time', { nullsFirst: false })
      .limit(1000);
    if (error) throw toAppError(error, 'Não foi possível carregar suas tarefas.');
    return asTasks(data);
  },

  async listOverdue(now, limit = 100) {
    const { data, error } = await from()
      .select(COLUMNS)
      .eq('status', 'pending')
      .lt('due_at', now.toISOString())
      .order('due_at')
      .limit(limit);
    if (error) throw toAppError(error, 'Não foi possível carregar as tarefas atrasadas.');
    return asTasks(data);
  },

  async listUpcoming(start, pageIndex, pageSize) {
    const offset = pageIndex * pageSize;
    const { data, error } = await from()
      .select(COLUMNS)
      .eq('status', 'pending')
      .gte('due_date', start)
      .order('due_date')
      .order('due_time', { nullsFirst: false })
      .order('created_at')
      .range(offset, offset + pageSize); // one extra row tells us if there is more
    if (error) throw toAppError(error, 'Não foi possível carregar as próximas tarefas.');
    return page(asTasks(data), pageSize);
  },

  async list(filters: TaskFilters, ctx, pageIndex, pageSize) {
    let q = from().select(COLUMNS);

    switch (filters.status) {
      case 'pending':
        q = q.eq('status', 'pending');
        break;
      case 'completed':
        q = q.eq('status', 'completed');
        break;
      case 'overdue':
        q = q.eq('status', 'pending').lt('due_at', new Date().toISOString());
        break;
      default:
        q = q.neq('status', 'cancelled');
    }
    if (filters.priority !== 'any') q = q.eq('priority', filters.priority);
    if (filters.categoryId !== 'any') q = q.eq('category_id', filters.categoryId);
    if (filters.period !== 'any') {
      const r = periodRange(filters.period, ctx.today);
      q = q.gte('due_date', r.from).lte('due_date', r.to);
    }
    const term = sanitizeSearch(filters.search);
    if (term) q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);

    switch (filters.sort) {
      case 'priority':
        q = q.order('priority', { ascending: false }).order('due_date', { nullsFirst: false });
        break;
      case 'created':
        q = q.order('created_at', { ascending: false });
        break;
      case 'status':
        q = q.order('status').order('due_date', { nullsFirst: false });
        break;
      default:
        q = q.order('due_date', { nullsFirst: false }).order('due_time', { nullsFirst: false });
    }
    q = q.order('id'); // stable pagination

    const offset = pageIndex * pageSize;
    const { data, error } = await q.range(offset, offset + pageSize);
    if (error) throw toAppError(error, 'Não foi possível carregar suas tarefas.');
    return page(asTasks(data), pageSize);
  },

  async listCompleted(pageIndex, pageSize) {
    const offset = pageIndex * pageSize;
    const { data, error } = await from()
      .select(COLUMNS)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .range(offset, offset + pageSize);
    if (error) throw toAppError(error, 'Não foi possível carregar as tarefas concluídas.');
    return page(asTasks(data), pageSize);
  },

  async search(query, categoryIds, limit = 20) {
    const term = sanitizeSearch(query);
    if (!term) return [];
    const ors = [`title.ilike.%${term}%`, `description.ilike.%${term}%`];
    if (categoryIds.length > 0) ors.push(`category_id.in.(${categoryIds.join(',')})`);
    const { data, error } = await from()
      .select(COLUMNS)
      .neq('status', 'cancelled')
      .or(ors.join(','))
      .order('status')
      .order('due_date', { nullsFirst: false })
      .limit(limit);
    if (error) throw toAppError(error, 'Não foi possível buscar.');
    return asTasks(data);
  },

  async get(id) {
    const { data, error } = await from().select(COLUMNS).eq('id', id).maybeSingle();
    if (error) throw toAppError(error, 'Não foi possível abrir a tarefa.');
    return data ? asTask(data) : null;
  },

  async countAll() {
    const { count, error } = await from().select('id', { count: 'exact', head: true });
    if (error) throw toAppError(error, 'Não foi possível carregar suas tarefas.');
    return count ?? 0;
  },

  async countPendingBetween(start, end) {
    const { count, error } = await from()
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('due_date', start)
      .lte('due_date', end);
    if (error) throw toAppError(error, 'Não foi possível carregar suas tarefas.');
    return count ?? 0;
  },

  async create(input: TaskInput, timezone) {
    const { data, error } = await from()
      .insert({ ...input, timezone })
      .select(COLUMNS)
      .single();
    if (error) throw toAppError(error, 'Não foi possível criar a tarefa.');
    return asTask(data);
  },

  async update(id, patch: TaskPatch, timezone) {
    // Re-anchor the task to the user's current zone whenever its schedule changes.
    const touchesSchedule = 'due_date' in patch || 'due_time' in patch;
    const { data, error } = await from()
      .update(touchesSchedule ? { ...patch, timezone } : patch)
      .eq('id', id)
      .select(COLUMNS)
      .single();
    if (error) throw toAppError(error, 'Não foi possível salvar a tarefa.');
    return asTask(data);
  },

  async remove(id) {
    const { error } = await from().delete().eq('id', id);
    if (error) throw toAppError(error, 'Não foi possível excluir a tarefa.');
  },
};
