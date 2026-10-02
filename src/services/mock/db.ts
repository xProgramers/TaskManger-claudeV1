/**
 * ============================================================================
 *  DEMONSTRATION DATA — NOT CONNECTED TO SUPABASE
 * ============================================================================
 * Used only when VITE_DEMO_MODE=true (`npm run dev:demo`) or when no Supabase
 * URL is configured. Everything lives in this browser's localStorage and
 * mirrors the database rules (reminder scheduling, completed_at, due_at) so the
 * UI behaves exactly as it does in production.
 */
import type {
  AppNotification,
  Category,
  ISODate,
  ReminderOffset,
  Task,
  TaskPriority,
  UserPreferences,
} from '@/types';
import { addDays, browserTimeZone, computeDueAt, todayIn, zonedToInstant } from '@/utils/dates';

export const DEMO_USER = { id: 'demo-user', email: 'demo@prumo.app' } as const;

const STORAGE_KEY = 'prumo:demo-db:v1';

export interface DemoDb {
  signedIn: boolean;
  profile: UserPreferences;
  categories: Category[];
  tasks: Task[];
  notifications: AppNotification[];
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const newId = uid;

/** Mirrors public.sync_task_reminder() from the database. */
export function syncReminder(db: DemoDb, task: Task, now = new Date()) {
  const pendingIdx = db.notifications.findIndex((n) => n.task_id === task.id && n.status === 'pending');
  const removePending = () => {
    if (pendingIdx >= 0) db.notifications.splice(pendingIdx, 1);
  };

  if (task.status !== 'pending' || !task.due_date || task.reminder_offset_minutes === null) return removePending();
  const anchor = zonedToInstant(task.due_date, task.due_time ?? '09:00', task.timezone);
  if (anchor.getTime() <= now.getTime()) return removePending();
  const target = new Date(anchor.getTime() - task.reminder_offset_minutes * 60_000).toISOString();

  if (db.notifications.some((n) => n.task_id === task.id && n.status !== 'pending' && n.scheduled_for === target)) {
    return removePending();
  }
  const titles: Record<number, string> = {
    0: 'É hora da sua tarefa',
    5: 'Começa em 5 minutos',
    15: 'Começa em 15 minutos',
    30: 'Começa em 30 minutos',
    60: 'Começa em 1 hora',
    1440: 'É amanhã',
  };
  const fields = { title: titles[task.reminder_offset_minutes], message: task.title, scheduled_for: target };
  if (pendingIdx >= 0) Object.assign(db.notifications[pendingIdx], fields);
  else
    db.notifications.push({
      id: uid(),
      user_id: task.user_id,
      task_id: task.id,
      status: 'pending',
      sent_at: null,
      read_at: null,
      created_at: now.toISOString(),
      ...fields,
    });
}

function seed(): DemoDb {
  const tz = browserTimeZone();
  const today = todayIn(tz);
  const now = new Date();
  const iso = now.toISOString();

  const categories: Category[] = [
    ['Trabalho', '#5B7FA6'],
    ['Pessoal', '#4F8A6E'],
    ['Estudos', '#8A6BA8'],
    ['Finanças', '#A0744B'],
    ['Saúde', '#B05B6E'],
  ].map(([name, color]) => ({ id: uid(), user_id: DEMO_USER.id, name, color, created_at: iso }));
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;

  const make = (
    title: string,
    day: ISODate | null,
    time: string | null,
    priority: TaskPriority,
    category: string | null,
    extra: Partial<Task> = {},
  ): Task => ({
    id: uid(),
    user_id: DEMO_USER.id,
    title,
    description: null,
    status: 'pending',
    priority,
    due_date: day,
    due_time: time,
    timezone: tz,
    due_at: computeDueAt(day, time, tz),
    reminder_offset_minutes: (time ? 15 : null) as ReminderOffset | null,
    category_id: category ? cat(category) : null,
    completed_at: null,
    created_at: new Date(now.getTime() - 3 * 86_400_000).toISOString(),
    updated_at: iso,
    ...extra,
  });
  const done = (daysAgo: number, hoursAgo = 2): Partial<Task> => ({
    status: 'completed',
    completed_at: new Date(now.getTime() - daysAgo * 86_400_000 - hoursAgo * 3_600_000).toISOString(),
  });

  const tasks: Task[] = [
    make('Reunião com equipe', today, '09:00', 'high', 'Trabalho', done(0, 6)),
    make('Finalizar relatório financeiro', today, '10:30', 'high', 'Trabalho', {
      ...done(0, 4),
      description: 'Consolidar números de setembro e enviar para a diretoria.',
    }),
    make('Estudar documentação da API', today, '14:00', 'medium', 'Estudos'),
    make('Academia', today, '17:00', 'low', 'Saúde'),
    make('Jantar com a Marina', today, '20:00', 'medium', 'Pessoal'),
    make('Responder e-mails pendentes', today, null, 'medium', 'Trabalho'),
    make('Pagar fatura do cartão', addDays(today, -1), null, 'high', 'Finanças', {
      description: 'Vence hoje no app do banco. Conferir lançamentos antes.',
    }),
    make('Agendar revisão do carro', addDays(today, -3), null, 'low', 'Pessoal'),
    make('Comprar ração', addDays(today, 1), '18:00', 'medium', 'Pessoal'),
    make('Planejamento da sprint', addDays(today, 1), '10:00', 'high', 'Trabalho'),
    make('Ler capítulo 4 — Design de Interfaces', addDays(today, 1), null, 'low', 'Estudos'),
    make('Consulta no dentista', addDays(today, 3), '08:30', 'medium', 'Saúde', { reminder_offset_minutes: 1440 }),
    make('Enviar proposta para cliente', addDays(today, 3), '15:00', 'high', 'Trabalho'),
    make('Declaração de despesas', addDays(today, 4), null, 'medium', 'Finanças'),
    make('Aniversário do pai', addDays(today, 6), null, 'high', 'Pessoal'),
    make('Revisar metas do trimestre', addDays(today, 8), '09:30', 'medium', 'Trabalho'),
    make('Prova de inglês', addDays(today, 12), '19:00', 'high', 'Estudos', { reminder_offset_minutes: 60 }),
    make('Renovar seguro residencial', addDays(today, 20), null, 'medium', 'Finanças'),
    make('Organizar fotos da viagem', null, null, 'low', 'Pessoal'),
    make('Atualizar currículo', addDays(today, -2), null, 'medium', 'Estudos', done(2)),
    make('Comprar presente', addDays(today, -4), null, 'medium', 'Pessoal', done(4)),
    make('Exame de sangue', addDays(today, -6), '07:30', 'high', 'Saúde', done(6)),
    make('Pagar condomínio', addDays(today, -8), null, 'high', 'Finanças', done(9)),
  ];

  const db: DemoDb = {
    signedIn: false,
    profile: {
      id: DEMO_USER.id,
      full_name: 'Victor Souza',
      avatar_url: null,
      timezone: tz,
      theme: 'system',
      time_format: '24h',
      week_starts_on: 0,
      notifications_enabled: true,
      default_reminder_minutes: 15,
      created_at: iso,
      updated_at: iso,
    },
    categories,
    tasks,
    notifications: [],
  };

  for (const t of tasks) syncReminder(db, t, now);
  // A few already-delivered reminders so the bell has history.
  const reportTask = tasks[1];
  db.notifications.push(
    {
      id: uid(),
      user_id: DEMO_USER.id,
      task_id: reportTask.id,
      title: 'Começa em 15 minutos',
      message: reportTask.title,
      scheduled_for: new Date(now.getTime() - 50 * 60_000).toISOString(),
      status: 'sent',
      sent_at: new Date(now.getTime() - 50 * 60_000).toISOString(),
      read_at: null,
      created_at: iso,
    },
    {
      id: uid(),
      user_id: DEMO_USER.id,
      task_id: tasks[0].id,
      title: 'É hora da sua tarefa',
      message: tasks[0].title,
      scheduled_for: new Date(now.getTime() - 7 * 3_600_000).toISOString(),
      status: 'read',
      sent_at: new Date(now.getTime() - 7 * 3_600_000).toISOString(),
      read_at: new Date(now.getTime() - 6 * 3_600_000).toISOString(),
      created_at: iso,
    },
  );
  return db;
}

let db: DemoDb | null = null;

export function demoDb(): DemoDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) db = JSON.parse(raw) as DemoDb;
  } catch {
    db = null;
  }
  if (!db) {
    db = seed();
    persist();
  }
  return db;
}

export function persist() {
  try {
    if (db) localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: the demo keeps working in memory.
  }
}

export function resetDemoDb() {
  db = seed();
  db.signedIn = true;
  persist();
}

/** Simulated network latency so loading states are visible in the demo. */
export const latency = (ms = 160) => new Promise((r) => setTimeout(r, ms));
