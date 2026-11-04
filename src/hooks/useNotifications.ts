import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AppNotification } from '@/types';
import { api } from '@/services';
import { invalidateQueries, setQueryData, useQuery } from '@/lib/query';
import { showSystemNotification, syncPushSubscription } from '@/lib/browserNotifications';
import { TASKS } from '@/hooks/useTasks';
import { errorMessage } from '@/utils/errors';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useToast } from '@/contexts/ToastContext';

export const NOTIFICATIONS = ['notifications'] as const;

export function useNotifications() {
  const query = useQuery(NOTIFICATIONS, () => api.notifications.list(30));
  const items = useMemo(() => query.data ?? [], [query.data]);
  const unread = items.filter((n) => n.status === 'sent').length;

  const markRead = useCallback(async (ids?: string[]) => {
    const now = new Date().toISOString();
    setQueryData<AppNotification[]>(NOTIFICATIONS, (old) =>
      (old ?? []).map((n) => (n.status === 'sent' && (!ids || ids.includes(n.id)) ? { ...n, status: 'read', read_at: now } : n)),
    );
    try {
      await api.notifications.markRead(ids);
    } catch {
      invalidateQueries(NOTIFICATIONS);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setQueryData<AppNotification[]>(NOTIFICATIONS, (old) => (old ?? []).filter((n) => n.id !== id));
    try {
      await api.notifications.remove(id);
    } catch {
      invalidateQueries(NOTIFICATIONS);
    }
  }, []);

  return { ...query, items, unread, markRead, remove };
}

/**
 * Mounted once in the app shell: listens for delivered reminders and surfaces
 * them (toast in-app, system notification when the tab is in the background).
 */
export function useReminderDelivery(openTask: (id: string) => void) {
  const { user } = useAuth();
  const { prefs, timezone } = usePreferences();
  const { toast } = useToast();
  const timezoneRef = useRef(timezone);
  timezoneRef.current = timezone;
  const enabled = prefs?.notifications_enabled ?? true;
  const openRef = useRef(openTask);
  openRef.current = openTask;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = api.notifications.subscribe(user.id, (n) => {
      setQueryData<AppNotification[]>(NOTIFICATIONS, (old) => [n, ...(old ?? []).filter((x) => x.id !== n.id)]);
      if (!enabledRef.current) return;
      toast({
        tone: 'reminder',
        message: n.title,
        description: n.message,
        action: n.task_id ? { label: 'Abrir', onClick: () => openRef.current(n.task_id!) } : undefined,
      });
      if (document.visibilityState !== 'visible') {
        void showSystemNotification(n.id, n.title, n.message, n.task_id);
      }
    });

    // Realtime may miss events while the laptop sleeps: catch up on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') invalidateQueries(NOTIFICATIONS);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, toast]);

  // Keep this browser's push subscription registered for the signed-in user.
  useEffect(() => {
    if (user && enabled) void syncPushSubscription(api.push);
  }, [user, enabled]);

  // Clicks on a system notification while a tab is open.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const runAction = async (action: string, id: string, taskId: string) => {
      try {
        if (action === 'complete') {
          await api.tasks.update(taskId, { status: 'completed' }, timezoneRef.current);
          toast({ message: 'Tarefa concluída' });
        } else {
          await api.notifications.snooze(id, 60);
          toast({ message: 'Lembrete adiado', description: 'Vou te lembrar de novo em 1 hora.' });
        }
      } catch (err) {
        toast({ message: errorMessage(err, 'Não foi possível fazer isso agora.'), tone: 'error' });
      }
      invalidateQueries(TASKS);
      invalidateQueries(NOTIFICATIONS);
    };
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string; action?: string; id?: string; taskId?: string } | null;
      if (data?.type === 'prumo:open' && data.url) {
        const taskId = new URL(data.url, window.location.origin).searchParams.get('task');
        if (taskId) openRef.current(taskId);
      } else if (data?.type === 'prumo:action' && data.action && data.id && data.taskId) {
        void runAction(data.action, data.id, data.taskId);
      } else if (data?.type === 'prumo:refresh') {
        invalidateQueries(TASKS);
        invalidateQueries(NOTIFICATIONS);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [toast]);
}
