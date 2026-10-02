/**
 * DEMONSTRATION DATA — implementation of the Api contract over the local
 * demo database (see ./db.ts). Not used when Supabase is configured.
 */
import type { Api, AuthEvent } from '@/services/api';
import type { AppNotification, AuthUser, Page, Task, TaskFilters } from '@/types';
import { computeDueAt } from '@/utils/dates';
import { AppError } from '@/utils/errors';
import { compareChronological, isOverdue, periodRange, PRIORITY_ORDER } from '@/utils/task';
import { DEMO_USER, demoDb, latency, newId, persist, syncReminder } from './db';

type AuthListener = (user: AuthUser | null, event: AuthEvent) => void;
const authListeners = new Set<AuthListener>();
const notifyAuth = (event: AuthEvent) => {
  const user = demoDb().signedIn ? { ...DEMO_USER } : null;
  authListeners.forEach((l) => l(user, event));
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const paginate = <T,>(rows: T[], pageIndex: number, pageSize: number): Page<T> => ({
  rows: rows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
  hasMore: rows.length > (pageIndex + 1) * pageSize,
});

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function findTask(id: string): Task {
  const t = demoDb().tasks.find((x) => x.id === id);
  if (!t) throw new AppError('Este item não existe mais.');
  return t;
}

// ---------------------------------------------------------------------------
// Reminder delivery simulation (stands in for pg_cron + Realtime).
// ---------------------------------------------------------------------------
const deliveryListeners = new Set<(n: AppNotification) => void>();
let deliveryTimer: ReturnType<typeof setInterval> | null = null;

function deliverDue() {
  const db = demoDb();
  const now = Date.now();
  let changed = false;
  for (const n of db.notifications) {
    if (n.status === 'pending' && new Date(n.scheduled_for).getTime() <= now) {
      n.status = 'sent';
      n.sent_at = new Date().toISOString();
      changed = true;
      deliveryListeners.forEach((l) => l(clone(n)));
    }
  }
  if (changed) persist();
}

export const mockApi: Api = {
  mode: 'demo',

  auth: {
    async getUser() {
      return demoDb().signedIn ? { ...DEMO_USER } : null;
    },
    onChange(callback) {
      authListeners.add(callback);
      return () => authListeners.delete(callback);
    },
    async signIn(email, password) {
      await latency(300);
      if (!email.includes('@') || password.length < 1) throw new AppError('E-mail ou senha incorretos.');
      demoDb().signedIn = true;
      persist();
      notifyAuth('SIGNED_IN');
    },
    async signUp({ fullName }) {
      await latency(300);
      const db = demoDb();
      db.signedIn = true;
      if (fullName.trim()) db.profile.full_name = fullName.trim();
      persist();
      notifyAuth('SIGNED_IN');
      return { needsConfirmation: false };
    },
    async signOut() {
      demoDb().signedIn = false;
      persist();
      notifyAuth('SIGNED_OUT');
    },
    async requestPasswordReset() {
      await latency(300);
    },
    async updatePassword() {
      await latency(300);
    },
  },

  tasks: {
    async listRange(from, to) {
      await latency();
      return clone(
        demoDb()
          .tasks.filter((t) => t.status !== 'cancelled' && t.due_date && t.due_date >= from && t.due_date <= to)
          .sort(compareChronological),
      );
    },
    async listOverdue(now, limit = 100) {
      await latency();
      return clone(
        demoDb()
          .tasks.filter((t) => isOverdue(t, now))
          .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
          .slice(0, limit),
      );
    },
    async listUpcoming(from, pageIndex, pageSize) {
      await latency();
      const rows = demoDb()
        .tasks.filter((t) => t.status === 'pending' && t.due_date && t.due_date >= from)
        .sort(compareChronological);
      return clone(paginate(rows, pageIndex, pageSize));
    },
    async list(filters: TaskFilters, ctx, pageIndex, pageSize) {
      await latency();
      const db = demoDb();
      const now = new Date();
      const term = fold(filters.search.trim());
      let rows = db.tasks.filter((t) => {
        if (filters.status === 'all' && t.status === 'cancelled') return false;
        if (filters.status === 'pending' && t.status !== 'pending') return false;
        if (filters.status === 'completed' && t.status !== 'completed') return false;
        if (filters.status === 'overdue' && !isOverdue(t, now)) return false;
        if (filters.priority !== 'any' && t.priority !== filters.priority) return false;
        if (filters.categoryId !== 'any' && t.category_id !== filters.categoryId) return false;
        if (filters.period !== 'any') {
          const r = periodRange(filters.period, ctx.today);
          if (!t.due_date || t.due_date < r.from || t.due_date > r.to) return false;
        }
        if (term && !fold(`${t.title} ${t.description ?? ''}`).includes(term)) return false;
        return true;
      });
      rows = rows.sort((a, b) => {
        switch (filters.sort) {
          case 'priority':
            return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || compareChronological(a, b);
          case 'created':
            return b.created_at.localeCompare(a.created_at);
          case 'status':
            return a.status.localeCompare(b.status) * -1 || compareChronological(a, b);
          default:
            return compareChronological(a, b);
        }
      });
      return clone(paginate(rows, pageIndex, pageSize));
    },
    async listCompleted(pageIndex, pageSize) {
      await latency();
      const rows = demoDb()
        .tasks.filter((t) => t.status === 'completed')
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
      return clone(paginate(rows, pageIndex, pageSize));
    },
    async search(query, categoryIds, limit = 20) {
      await latency(90);
      const term = fold(query.trim());
      if (!term) return [];
      return clone(
        demoDb()
          .tasks.filter(
            (t) =>
              t.status !== 'cancelled' &&
              (fold(`${t.title} ${t.description ?? ''}`).includes(term) ||
                (t.category_id !== null && categoryIds.includes(t.category_id))),
          )
          .sort((a, b) => (a.status === b.status ? compareChronological(a, b) : a.status === 'pending' ? -1 : 1))
          .slice(0, limit),
      );
    },
    async get(id) {
      await latency(80);
      const t = demoDb().tasks.find((x) => x.id === id);
      return t ? clone(t) : null;
    },
    async countAll() {
      return demoDb().tasks.length;
    },
    async countPendingBetween(from, to) {
      return demoDb().tasks.filter((t) => t.status === 'pending' && t.due_date && t.due_date >= from && t.due_date <= to)
        .length;
    },
    async create(input, timezone) {
      await latency();
      const title = input.title.trim();
      if (!title) throw new AppError('Dê um título para a tarefa.');
      const now = new Date().toISOString();
      const task: Task = {
        id: newId(),
        user_id: DEMO_USER.id,
        title: title.slice(0, 200),
        description: input.description?.trim() || null,
        status: 'pending',
        priority: input.priority ?? 'medium',
        due_date: input.due_date ?? null,
        due_time: input.due_date ? (input.due_time ?? null) : null,
        timezone,
        due_at: null,
        reminder_offset_minutes: input.due_date ? (input.reminder_offset_minutes ?? null) : null,
        category_id: input.category_id ?? null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      };
      task.due_at = computeDueAt(task.due_date, task.due_time, timezone);
      const db = demoDb();
      db.tasks.push(task);
      syncReminder(db, task);
      persist();
      return clone(task);
    },
    async update(id, patch, timezone) {
      await latency();
      const db = demoDb();
      const task = findTask(id);
      const prevStatus = task.status;
      Object.assign(task, patch);
      if ('title' in patch) task.title = (patch.title ?? '').trim();
      if ('description' in patch) task.description = patch.description?.trim() || null;
      if ('due_date' in patch || 'due_time' in patch) task.timezone = timezone;
      if (!task.due_date) {
        task.due_time = null;
        task.reminder_offset_minutes = null;
      }
      task.due_at = computeDueAt(task.due_date, task.due_time, task.timezone);
      if (task.status !== prevStatus) task.completed_at = task.status === 'completed' ? new Date().toISOString() : null;
      task.updated_at = new Date().toISOString();
      syncReminder(db, task);
      persist();
      return clone(task);
    },
    async remove(id) {
      await latency();
      const db = demoDb();
      db.tasks = db.tasks.filter((t) => t.id !== id);
      db.notifications = db.notifications
        .filter((n) => !(n.task_id === id && n.status === 'pending'))
        .map((n) => (n.task_id === id ? { ...n, task_id: null } : n));
      persist();
    },
  },

  categories: {
    async list() {
      await latency(80);
      return clone([...demoDb().categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    },
    async create(input) {
      await latency();
      const db = demoDb();
      const name = input.name.trim();
      if (db.categories.some((c) => fold(c.name) === fold(name))) {
        throw new AppError('Já existe uma categoria com esse nome.');
      }
      const c = { id: newId(), user_id: DEMO_USER.id, name, color: input.color, created_at: new Date().toISOString() };
      db.categories.push(c);
      persist();
      return clone(c);
    },
    async update(id, input) {
      await latency();
      const db = demoDb();
      const c = db.categories.find((x) => x.id === id);
      if (!c) throw new AppError('Este item não existe mais.');
      if (input.name && db.categories.some((x) => x.id !== id && fold(x.name) === fold(input.name!))) {
        throw new AppError('Já existe uma categoria com esse nome.');
      }
      Object.assign(c, input, input.name ? { name: input.name.trim() } : {});
      persist();
      return clone(c);
    },
    async remove(id) {
      await latency();
      const db = demoDb();
      db.categories = db.categories.filter((c) => c.id !== id);
      db.tasks.forEach((t) => {
        if (t.category_id === id) t.category_id = null;
      });
      persist();
    },
  },

  notifications: {
    async list(limit = 30) {
      await latency(100);
      deliverDue();
      return clone(
        demoDb()
          .notifications.filter((n) => n.status !== 'pending')
          .sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''))
          .slice(0, limit),
      );
    },
    async markRead(ids) {
      const now = new Date().toISOString();
      demoDb().notifications.forEach((n) => {
        if (n.status === 'sent' && (!ids || ids.includes(n.id))) {
          n.status = 'read';
          n.read_at = now;
        }
      });
      persist();
    },
    async remove(id) {
      const db = demoDb();
      db.notifications = db.notifications.filter((n) => n.id !== id);
      persist();
    },
    subscribe(_userId, onDelivered) {
      deliveryListeners.add(onDelivered);
      deliveryTimer ??= setInterval(deliverDue, 15_000);
      return () => {
        deliveryListeners.delete(onDelivered);
        if (deliveryListeners.size === 0 && deliveryTimer) {
          clearInterval(deliveryTimer);
          deliveryTimer = null;
        }
      };
    },
  },

  profile: {
    async get() {
      await latency(80);
      return clone(demoDb().profile);
    },
    async update(patch) {
      await latency();
      const db = demoDb();
      Object.assign(db.profile, patch, { updated_at: new Date().toISOString() });
      persist();
      return clone(db.profile);
    },
  },

  push: {
    // Web Push needs a real backend; in the demo the open tab shows reminders.
    async register() {},
    async unregister() {},
  },
};
