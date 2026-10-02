/**
 * Minimal, dependency-free Web Push sender (RFC 8030 / 8291 / 8292).
 *
 * Uses only WebCrypto, so it runs unchanged on Deno (Supabase Edge Functions)
 * and Node 20+. Payload encryption is `aes128gcm`; authentication is VAPID
 * (ES256 JWT).
 */

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // base64url, uncompressed P-256 point (65 bytes)
  auth: string; // base64url, 16 bytes
}

export interface VapidKeys {
  publicKey: string; // base64url, uncompressed P-256 point (65 bytes)
  privateKey: string; // base64url, 32-byte scalar
  subject: string; // "mailto:..." or "https://..."
}

export interface PushResult {
  ok: boolean;
  status: number;
  /** Subscription is permanently invalid and should be deleted. */
  gone: boolean;
}

const RECORD_SIZE = 4096;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;
const JWT_LIFETIME_SECONDS = 60 * 60 * 12;

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** Single-block HKDF (output <= 32 bytes), as used by RFC 8291. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

function publicKeyToJwk(publicKey: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error('Invalid P-256 public key');
  }
  return {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(publicKey.slice(1, 33)),
    y: b64urlEncode(publicKey.slice(33, 65)),
    ext: true,
  };
}

async function importVapidSigningKey(vapid: VapidKeys): Promise<CryptoKey> {
  const jwk = { ...publicKeyToJwk(b64urlDecode(vapid.publicKey)), d: vapid.privateKey };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

export async function createVapidJwt(audience: string, vapid: VapidKeys, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: audience, exp: nowSeconds + JWT_LIFETIME_SECONDS, sub: vapid.subject })),
  );
  const signingInput = `${header}.${claims}`;
  const key = await importVapidSigningKey(vapid);
  // WebCrypto returns the raw r||s (IEEE P1363) form, which is exactly what JWS ES256 expects.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)),
  );
  return `${signingInput}.${b64urlEncode(signature)}`;
}

/** Encrypts `payload` for a subscription using RFC 8291 (aes128gcm). */
export async function encryptPayload(payload: Uint8Array, sub: PushSubscriptionKeys): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);

  const asKeys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256),
  );

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // Single record: payload followed by the 0x02 "last record" delimiter.
  const plaintext = concat(payload, new Uint8Array([2]));
  if (plaintext.length + 16 > RECORD_SIZE) throw new Error('Payload too large');

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);

  return concat(header, ciphertext);
}

export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: unknown,
  vapid: VapidKeys,
  options: { ttlSeconds?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string } = {},
): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub);
  const jwt = await createVapidJwt(new URL(sub.endpoint).origin, vapid);

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    TTL: String(options.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    Urgency: options.urgency ?? 'high',
    Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
  };
  // Topic (<= 32 url-safe chars) lets the push service collapse duplicates.
  if (options.topic) headers.Topic = options.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);

  const res = await fetch(sub.endpoint, { method: 'POST', headers, body });
  // Drain the body so the connection can be reused.
  await res.arrayBuffer().catch(() => undefined);

  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
