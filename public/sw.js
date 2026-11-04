/* Prumo service worker — only handles reminders (Web Push).
 *
 * It intentionally does not cache the app: the goal is to receive reminders
 * while no tab is open, not offline support.
 *
 * Every notification uses `tag = notification id`, so if the same reminder is
 * shown by an open tab (via Realtime) and by a push, the browser keeps one.
 *
 * "Concluir" / "Adiar 1h": a push carries a signed token, so the button calls
 * the `reminder-action` Edge Function directly (no tab needed). A notification
 * shown by an open tab has no token; the button asks that tab to do it. One
 * request per tap and no retries: on failure the app opens instead.
 */

const ACTIONS = [
  { action: 'complete', title: 'Concluir' },
  { action: 'snooze', title: 'Adiar 1h' },
];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Prumo', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Lembrete de tarefa';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.id || undefined,
      renotify: false,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      actions: data.token ? ACTIONS : [],
      data: { url: data.url || '/', id: data.id || null, actionUrl: data.actionUrl, token: data.token },
    }),
  );
});

async function runAction(data, action) {
  try {
    const res = await fetch(data.actionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.id, action, token: data.token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL(data.url || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const tab = windows.find((client) => new URL(client.url).origin === self.location.origin);

      if (event.action && data.token) {
        if (await runAction(data, event.action)) {
          if (tab) tab.postMessage({ type: 'prumo:refresh' });
          return;
        }
      } else if (event.action && tab) {
        tab.postMessage({ type: 'prumo:action', action: event.action, id: data.id, taskId: data.taskId });
        return;
      }

      if (tab) {
        await tab.focus();
        tab.postMessage({ type: 'prumo:open', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
