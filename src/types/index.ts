/**
 * Domain types. Row types mirror the Postgres schema in
 * supabase/migrations (snake_case kept on purpose so rows map 1:1).
 */

export type TaskStatus = 'pending' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ThemePreference = 'light' | 'dark' | 'system';
export type TimeFormat = '24h' | '12h';
export type NotificationStatus = 'pending' | 'sent' | 'read';

/** Allowed reminder offsets, in minutes before the task. Mirrors a DB check constraint. */
export const REMINDER_OFFSETS = [0, 5, 15, 30, 60, 1440] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

/** "YYYY-MM-DD" — a calendar date with no time zone. */
export type ISODate = string;
/** "HH:MM" (or "HH:MM:SS" as returned by Postgres) — a wall-clock time. */
export type ISOTime = string;

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: ISODate | null;
  due_time: ISOTime | null;
  /** IANA zone the date/time were entered in. */
  timezone: string;
  /** Absolute deadline, derived by the database. */
  due_at: string | null;
  reminder_offset_minutes: ReminderOffset | null;
  category_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  due_date?: ISODate | null;
  due_time?: ISOTime | null;
  reminder_offset_minutes?: ReminderOffset | null;
  category_id?: string | null;
}

export type TaskPatch = Partial<TaskInput> & { status?: TaskStatus };

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CategoryInput {
  name: string;
  color: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  task_id: string | null;
  title: string;
  message: string;
  scheduled_for: string;
  status: NotificationStatus;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

/** Row of `profiles` — the user's preferences. */
export interface UserPreferences {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  theme: ThemePreference;
  time_format: TimeFormat;
  /** 0 = domingo, 1 = segunda. */
  week_starts_on: 0 | 1;
  notifications_enabled: boolean;
  default_reminder_minutes: ReminderOffset | null;
  created_at: string;
  updated_at: string;
}

export type UserPreferencesPatch = Partial<
  Pick<
    UserPreferences,
    | 'full_name'
    | 'avatar_url'
    | 'timezone'
    | 'theme'
    | 'time_format'
    | 'week_starts_on'
    | 'notifications_enabled'
    | 'default_reminder_minutes'
  >
>;

export interface AuthUser {
  id: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type StatusFilter = 'all' | 'pending' | 'completed' | 'overdue';
export type PeriodFilter = 'any' | 'today' | 'tomorrow' | 'week' | 'next30';
export type TaskSort = 'date' | 'priority' | 'created' | 'status';

export interface TaskFilters {
  search: string;
  status: StatusFilter;
  priority: TaskPriority | 'any';
  categoryId: string | 'any';
  period: PeriodFilter;
  sort: TaskSort;
}

export interface Page<T> {
  rows: T[];
  hasMore: boolean;
}

/** Context every date-sensitive query needs, so "today" means the user's today. */
export interface DateContext {
  timezone: string;
  today: ISODate;
  weekStartsOn: 0 | 1;
}

// ---------------------------------------------------------------------------
// Quadro (sticky notes)
// ---------------------------------------------------------------------------

export const NOTE_COLORS = ['yellow', 'green', 'blue', 'pink', 'violet', 'gray'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Note {
  id: string;
  user_id: string;
  content: string;
  color: NoteColor;
  /** Left edge as a fraction (0..1) of the board width. */
  x: number;
  /** Top edge as a fraction (0..1) of the board height. */
  y: number;
  /** Stacking order; higher is on top. */
  z: number;
  created_at: string;
  updated_at: string;
}

export type NotePatch = Partial<Pick<Note, 'content' | 'color' | 'x' | 'y' | 'z'>>;
