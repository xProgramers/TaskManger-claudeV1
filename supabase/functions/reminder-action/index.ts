/**
 * reminder-action — the "Concluir" and "Adiar 1h" buttons of a reminder's
 * system notification, pressed while no Prumo tab is open.
 *
 * The service worker has no user session, so it sends the token that came
 * with the push (see ../_shared/actionToken.ts). Requests are checked in order
 * of cost: body shape, then the token, then the database. A token only acts on
 * its own reminder, and only for 7 days after it was sent.
 *
 * JWT verification is disabled for this function (the token is the auth).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { actionToken, timingSafeEqual } from '../_shared/actionToken.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE_MS = 7 * 86_400_000;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { id?: unknown; action?: unknown; token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const { id, action, token } = body ?? {};
  if (
    typeof id !== 'string' ||
    !UUID_RE.test(id) ||
    (action !== 'complete' && action !== 'snooze') ||
    typeof token !== 'string' ||
    token.length !== 43 // base64url of a SHA-256 HMAC
  ) {
    return json({ error: 'invalid_body' }, 400);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: config, error: configError } = await supabase.rpc('get_push_dispatch_config');
  const secret = (config as { reminders_dispatch_secret?: string } | null)?.reminders_dispatch_secret;
  if (configError || !secret) {
    console.error('reminder-action: missing configuration', configError);
    return json({ error: 'not_configured' }, 500);
  }
  if (!timingSafeEqual(token, await actionToken(secret, id))) return json({ error: 'unauthorized' }, 401);

  const { data: reminder, error: loadError } = await supabase
    .from('notifications')
    .select('task_id, sent_at')
    .eq('id', id)
    .neq('status', 'pending')
    .maybeSingle();
  if (loadError) {
    console.error('reminder-action: load failed', loadError);
    return json({ error: 'load_failed' }, 500);
  }
  if (!reminder?.task_id || !reminder.sent_at || Date.now() - Date.parse(reminder.sent_at) > MAX_AGE_MS) {
    return json({ error: 'expired' }, 410);
  }

  const { error } =
    action === 'snooze'
      ? await supabase.rpc('snooze_reminder', { p_notification_id: id, p_minutes: 60 })
      : await supabase.from('tasks').update({ status: 'completed' }).eq('id', reminder.task_id).eq('status', 'pending');
  if (error) {
    console.error(`reminder-action: ${action} failed`, error);
    return json({ error: 'action_failed' }, 500);
  }
  if (action === 'complete') {
    await supabase.from('notifications').update({ status: 'read', read_at: new Date().toISOString() }).eq('id', id).eq('status', 'sent');
  }
  return json({ ok: true });
});
