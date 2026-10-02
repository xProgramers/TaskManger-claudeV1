/**
 * send-reminders — Web Push delivery for reminders that are already due.
 *
 * Invoked by `public.dispatch_due_notifications()` (pg_cron, every minute) via
 * pg_net, AFTER the notifications were atomically flipped to `sent`. This
 * function therefore never decides *what* is due; it only delivers. That keeps
 * delivery idempotent: a notification id is handed to this function once.
 *
 * Auth: JWT verification is disabled for this function because the caller is
 * the database, not a user. Instead the request must carry the shared
 * `x-dispatch-secret` stored in Supabase Vault.
 *
 * Browser limitation (documented on purpose): Web Push only reaches browsers
 * that granted permission and registered a subscription. Safari on iOS requires
 * the app to be installed to the Home Screen. When no subscription exists, the
 * user still gets the in-app notification (bell + Realtime toast).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { sendWebPush, type VapidKeys } from './webpush.ts';

interface DispatchConfig {
  reminders_dispatch_secret?: string;
  vapid_public_key?: string;
  vapid_private_key?: string;
  vapid_subject?: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  task_id: string | null;
  title: string;
  message: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 500;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: config, error: configError } = await supabase.rpc('get_push_dispatch_config');
  const cfg = (config ?? {}) as DispatchConfig;
  if (configError || !cfg.reminders_dispatch_secret || !cfg.vapid_public_key || !cfg.vapid_private_key) {
    console.error('send-reminders: missing configuration', configError);
    return json({ error: 'not_configured' }, 500);
  }

  const provided = req.headers.get('x-dispatch-secret') ?? '';
  if (!timingSafeEqual(provided, cfg.reminders_dispatch_secret)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let ids: string[] = [];
  try {
    const body = await req.json();
    ids = Array.isArray(body?.notification_ids) ? body.notification_ids : [];
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  ids = ids.filter((id) => typeof id === 'string' && UUID_RE.test(id)).slice(0, MAX_IDS);
  if (ids.length === 0) return json({ delivered: 0 });

  const { data: notifications, error: nError } = await supabase
    .from('notifications')
    .select('id, user_id, task_id, title, message')
    .in('id', ids)
    .neq('status', 'pending');
  if (nError) {
    console.error('send-reminders: load notifications failed', nError);
    return json({ error: 'load_failed' }, 500);
  }

  const userIds = [...new Set((notifications as NotificationRow[]).map((n) => n.user_id))];
  const [{ data: subs, error: sError }, { data: profiles, error: pError }] = await Promise.all([
    supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds),
    supabase.from('profiles').select('id, notifications_enabled').in('id', userIds),
  ]);
  if (sError || pError) {
    console.error('send-reminders: load subscriptions failed', sError ?? pError);
    return json({ error: 'load_failed' }, 500);
  }

  const enabled = new Set((profiles ?? []).filter((p) => p.notifications_enabled).map((p) => p.id as string));
  const subsByUser = new Map<string, SubscriptionRow[]>();
  for (const s of (subs ?? []) as SubscriptionRow[]) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  const vapid: VapidKeys = {
    publicKey: cfg.vapid_public_key,
    privateKey: cfg.vapid_private_key,
    subject: cfg.vapid_subject || Deno.env.get('SUPABASE_URL')!,
  };

  const goneIds = new Set<string>();
  const usedIds = new Set<string>();
  let delivered = 0;

  const jobs = (notifications as NotificationRow[])
    .filter((n) => enabled.has(n.user_id))
    .flatMap((n) =>
      (subsByUser.get(n.user_id) ?? []).map(async (s) => {
        try {
          const result = await sendWebPush(
            { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
            {
              id: n.id,
              title: n.title,
              body: n.message,
              taskId: n.task_id,
              url: n.task_id ? `/?task=${n.task_id}` : '/',
            },
            vapid,
            { topic: n.id.replace(/-/g, '') },
          );
          if (result.gone) goneIds.add(s.id);
          else if (result.ok) {
            usedIds.add(s.id);
            delivered++;
          } else console.warn('send-reminders: push rejected', result.status);
        } catch (err) {
          console.error('send-reminders: push failed', err);
        }
      }),
    );

  await Promise.all(jobs);

  if (goneIds.size > 0) {
    await supabase.from('push_subscriptions').delete().in('id', [...goneIds]);
  }
  if (usedIds.size > 0) {
    await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).in('id', [...usedIds]);
  }

  return json({ delivered, removed: goneIds.size });
});
