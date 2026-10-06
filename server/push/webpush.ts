/**
 * Web Push bez biblioteki: szyfrowanie treści (RFC 8291, `aes128gcm`) i podpis serwera
 * (VAPID, RFC 8292) na samym WebCrypto.
 *
 * Bez zależności, bo te same sto linijek działają w Cloudflare Workers, Deno i Node 20+,
 * a popularna paczka `web-push` stoi na `node:crypto` i na Workers nie wstanie. Poprawność
 * pilnuje test na wartościach z dodatku A RFC 8291.
 */

const enc = new TextEncoder();

export const b64u = (bytes: Uint8Array): string => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const fromB64u = (s: string): Uint8Array<ArrayBuffer> => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  parts.forEach((p) => {
    out.set(p, at);
    at += p.length;
  });
  return out;
};

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** Rozmiar rekordu w nagłówku. Wiadomość mieści się w jednym, więc to tylko deklaracja. */
const RECORD_SIZE = 4096;

/**
 * Szyfruje treść dla jednej subskrypcji. `salt` i `serverKeys` podaje tylko test — w ruchu
 * oba są losowe i jednorazowe, inaczej dwie wiadomości zdradzałyby, że mają tę samą treść.
 */
export async function encryptPayload(
  plaintext: Uint8Array,
  p256dh: string,
  auth: string,
  fixed: { salt?: Uint8Array<ArrayBuffer>; serverKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  const salt = fixed.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const server =
    fixed.serverKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', server.publicKey));

  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, server.privateKey, 256));

  // RFC 8291 §3.4: klucz wejściowy z sekretu ECDH i sekretu uwierzytelnienia przeglądarki.
  const prkKey = await hmac(authSecret, ecdh);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));

  // RFC 8188: klucz treści i nonce z soli.
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);

  // Jeden rekord, więc od razu ostatni: znacznik 0x02, bez dopełnienia.
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))),
  );

  const header = new Uint8Array(16 + 4 + 1);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

/** Klucz prywatny VAPID zapisany jako JWK — w tej postaci trzyma go sekret serwera. */
export const importVapid = (privateJwk: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('jwk', JSON.parse(privateJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

/**
 * Token VAPID dla usługi powiadomień. `aud` to sam początek adresu subskrypcji (np.
 * `https://fcm.googleapis.com`), a ważność 12 godzin — usługi przyjmują najwyżej 24.
 */
export async function vapidToken(endpoint: string, subject: string, key: CryptoKey, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const part = (o: object) => b64u(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: now + 12 * 3600, sub: subject })}`;
  // WebCrypto podpisuje ECDSA od razu w postaci r||s, której wymaga JWT — bez przepakowania z DER.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)));
  return `${unsigned}.${b64u(sig)}`;
}

export interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Vapid {
  /** Klucz publiczny w base64url — ten sam, którym przeglądarka zakłada subskrypcję. */
  publicKey: string;
  privateJwk: string;
  /** Kontakt dla usługi powiadomień: adres strony albo `mailto:`. */
  subject: string;
}

export interface PushOptions {
  /** Ile sekund usługa ma trzymać wiadomość, gdy telefon jest offline. */
  ttl: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  /** Nowsza wiadomość z tym samym tematem zastępuje niedostarczoną starszą. */
  topic?: string;
}

/** Gotowe zapytanie do usługi powiadomień — wysyła je `fetch`, a test może je obejrzeć. */
export async function pushRequest(sub: Subscription, payload: unknown, vapid: Vapid, opts: PushOptions): Promise<Request> {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub.keys.p256dh, sub.keys.auth);
  const token = await vapidToken(sub.endpoint, vapid.subject, await importVapid(vapid.privateJwk));
  const headers = new Headers({
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    TTL: String(opts.ttl),
    Urgency: opts.urgency ?? 'normal',
    Authorization: `vapid t=${token}, k=${vapid.publicKey}`,
  });
  if (opts.topic) headers.set('Topic', opts.topic);
  return new Request(sub.endpoint, { method: 'POST', headers, body });
}
