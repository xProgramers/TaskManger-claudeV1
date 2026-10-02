/**
 * Browser notifications (Web Notifications API + Push API).
 *
 * What works where — stated plainly, not hidden:
 *  - Tab open (any modern browser): reminders arrive in real time over
 *    Supabase Realtime; we show a toast and, if the tab is in the background,
 *    a system notification.
 *  - Tab closed: only through Web Push (service worker + VAPID). Supported by
 *    Chrome, Edge, Firefox and Safari 16.4+. On iPhone/iPad, Safari only
 *    allows it after the app is added to the Home Screen.
 *  - Permission denied/unsupported: reminders still appear in the bell
 *    (they are stored in the database), just without a system popup.
 */
import { env } from '@/lib/env';
import type { PushApi } from '@/services/api';

export type PermissionState = NotificationPermission | 'unsupported';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const pushSupported = () =>
  notificationsSupported() && 'serviceWorker' in navigator && 'PushManager' in window && Boolean(env.vapidPublicKey);

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function currentPermission(): PermissionState {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  registration ??= navigator.serviceWorker.register('/sw.js').catch((e) => {
    console.error('[prumo] service worker registration failed', e);
    return null;
  });
  return registration;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ensures this browser has a push subscription stored for the user. */
export async function syncPushSubscription(push: PushApi): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await registerServiceWorker();
  if (!reg) return false;
  try {
    let sub = await reg.pushManager.getSubscription();
    sub ??= await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
    });
    await push.register(sub.toJSON());
    return true;
  } catch (e) {
    console.error('[prumo] push subscription failed', e);
    return false;
  }
}

/** Asks for permission (must be called from a user gesture) and subscribes. */
export async function enableBrowserNotifications(push: PushApi): Promise<PermissionState> {
  if (!notificationsSupported()) return 'unsupported';
  const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (result === 'granted') await syncPushSubscription(push);
  return result;
}

export async function disablePushOnThisDevice(push: PushApi) {
  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await push.unregister(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/**
 * Shows a system notification from the page. Uses the service worker when
 * available so the same `tag` as a push de-duplicates them.
 */
export async function showSystemNotification(id: string, title: string, body: string, url: string) {
  if (currentPermission() !== 'granted') return;
  const options: NotificationOptions = { body, tag: id, icon: '/favicon.svg', data: { url, id } };
  const reg = await registerServiceWorker();
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, options);
}
