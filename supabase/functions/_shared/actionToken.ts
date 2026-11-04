/**
 * Token for the "Concluir" / "Adiar 1h" buttons of a reminder's system
 * notification. The service worker has no user session, so each push carries
 * HMAC(dispatch secret, notification id): it only acts on that one reminder.
 */
const encoder = new TextEncoder();

export async function actionToken(secret: string, notificationId: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`reminder-action:${notificationId}`)));
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
