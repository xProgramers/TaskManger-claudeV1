/**
 * Data-access contract. The UI talks only to this interface.
 *
 * Two implementations exist:
 *   - supabaseApi (services/supabase/*)  — production, real backend.
 *   - mockApi     (services/mock/*)      — DEMONSTRATION DATA ONLY, kept in
 *     localStorage. Enabled with VITE_DEMO_MODE=true (`npm run dev:demo`).
 */
import type {
  AppNotification,
  AuthUser,
  Category,
  CategoryInput,
  DateContext,
  ISODate,
  Note,
  NotePatch,
  Page,
  Task,
  TaskFilters,
  TaskInput,
  TaskPatch,
  UserPreferences,
  UserPreferencesPatch,
} from '@/types';

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED' | 'OTHER';

export interface AuthApi {
  getUser(): Promise<AuthUser | null>;
  onChange(callback: (user: AuthUser | null, event: AuthEvent) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** Returns true when the user must confirm the e-mail before signing in. */
  signUp(params: { email: string; password: string; fullName: string; timezone: string }): Promise<{
    needsConfirmation: boolean;
  }>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
}

export interface TasksApi {
  /** Pending + completed tasks due within [from, to]. */
  listRange(from: ISODate, to: ISODate): Promise<Task[]>;
  /** Pending tasks whose deadline is before `now`, oldest first. */
  listOverdue(now: Date, limit?: number): Promise<Task[]>;
  /** Pending tasks due on/after `from`, chronological, paginated. */
  listUpcoming(from: ISODate, page: number, pageSize: number): Promise<Page<Task>>;
  list(filters: TaskFilters, ctx: DateContext, page: number, pageSize: number): Promise<Page<Task>>;
  listCompleted(page: number, pageSize: number): Promise<Page<Task>>;
  search(query: string, categoryIds: string[], limit?: number): Promise<Task[]>;
  get(id: string): Promise<Task | null>;
  /** Number of tasks the user has ever created (onboarding). */
  countAll(): Promise<number>;
  countPendingBetween(from: ISODate, to: ISODate): Promise<number>;
  create(input: TaskInput, timezone: string): Promise<Task>;
  update(id: string, patch: TaskPatch, timezone: string): Promise<Task>;
  remove(id: string): Promise<void>;
}

export interface CategoriesApi {
  list(): Promise<Category[]>;
  create(input: CategoryInput): Promise<Category>;
  update(id: string, input: Partial<CategoryInput>): Promise<Category>;
  remove(id: string): Promise<void>;
}

export interface NotificationsApi {
  list(limit?: number): Promise<AppNotification[]>;
  markRead(ids?: string[]): Promise<void>;
  remove(id: string): Promise<void>;
  /** Called when a reminder is delivered (Realtime). Returns an unsubscribe fn. */
  subscribe(userId: string, onDelivered: (n: AppNotification) => void): () => void;
}

export interface ProfileApi {
  get(): Promise<UserPreferences>;
  update(patch: UserPreferencesPatch): Promise<UserPreferences>;
}

export interface NotesApi {
  list(): Promise<Note[]>;
  create(input: Pick<Note, 'x' | 'y' | 'z' | 'color'> & { content?: string; w?: number | null; h?: number | null }): Promise<Note>;
  update(id: string, patch: NotePatch): Promise<Note>;
  remove(id: string): Promise<void>;
}

export interface PushApi {
  register(subscription: PushSubscriptionJSON): Promise<void>;
  unregister(endpoint: string): Promise<void>;
}

export interface Api {
  mode: 'supabase' | 'demo';
  auth: AuthApi;
  tasks: TasksApi;
  categories: CategoriesApi;
  notifications: NotificationsApi;
  profile: ProfileApi;
  push: PushApi;
  notes: NotesApi;
}
