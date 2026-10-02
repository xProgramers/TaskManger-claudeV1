/* Prumo service worker — only handles reminders (Web Push).
 *
 * It intentionally does not cache the app: the goal is to receive reminders
 * while no tab is open, not offline support.
 *
 * Every notification uses `tag = notification id`, so if the same reminder is
 * shown by an open tab (via Realtime) and by a push, the browser keeps one.
 */

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
      data: { url: data.url || '/', id: data.id || null },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          client.postMessage({ type: 'prumo:open', url });
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
