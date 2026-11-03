import { gunzipSync, gzipSync } from 'fflate';
import { buf, concat, crockford, fromBase64Url, fromUtf8, groups, normalizeCrockford, randomBytes, toBase64Url, utf8 } from './codec';

/**
 * Szyfrowanie end-to-end na samym WebCrypto, bez zależności.
 *
 * - **Tożsamość prowadzącego**: para ECDH P-256. Klucz publiczny leży na serwerze jawnie, prywatny
 *   tylko zapieczętowany kodem odzyskiwania (PBKDF2-SHA256 → AES-256-GCM).
 * - **Klucz telefonu**: osobna para ECDH na każdą współpracę.
 * - **Klucz współpracy**: ECDH(jeden prywatny, drugi publiczny) → HKDF-SHA256 z numerem zaproszenia
 *   → AES-256-GCM. Obie strony liczą go same; serwer go nie zna i nie może poznać.
 * - **Odcisk klucza**: 16 bajtów SHA-256 z punktu publicznego. Jedzie w linku za `#`, więc nie
 *   trafia na serwer, a telefon sprawdza nim klucz, który od serwera dostał.
 *
 * P-256, a nie X25519: działa w każdej przeglądarce, w której działa GYM TRACKER, z Safari 15 włącznie.
 */

const EC = { name: 'ECDH', namedCurve: 'P-256' } as const;

export type PublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string };

export interface Identity {
  publicJwk: PublicJwk;
  privateKey: CryptoKey;
}

/** Same pola punktu — bez `key_ops` i `ext`, które przeglądarki dopisują różnie. */
export function cleanPublicJwk(v: unknown): PublicJwk | null {
  if (!v || typeof v !== 'object') return null;
  const j = v as Record<string, unknown>;
  if (j.kty !== 'EC' || j.crv !== 'P-256' || typeof j.x !== 'string' || typeof j.y !== 'string') return null;
  const x = fromBase64Url(j.x);
  const y = fromBase64Url(j.y);
  if (x?.length !== 32 || y?.length !== 32) return null;
  return { kty: 'EC', crv: 'P-256', x: j.x, y: j.y };
}

/** Nowa para kluczy. `extractable` tylko tam, gdzie klucz prywatny trzeba zapieczętować albo zapisać. */
export async function generateIdentity(extractable = true): Promise<Identity> {
  const pair = (await crypto.subtle.generateKey(EC, extractable, ['deriveBits'])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { publicJwk: cleanPublicJwk(jwk)!, privateKey: pair.privateKey };
}

export async function fingerprint(jwk: PublicJwk): Promise<string> {
  const point = concat(new Uint8Array([4]), fromBase64Url(jwk.x)!, fromBase64Url(jwk.y)!);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buf(point)));
  return toBase64Url(digest.slice(0, 16));
}

export const exportPrivate = async (key: CryptoKey): Promise<JsonWebKey> => crypto.subtle.exportKey('jwk', key);

export const importPrivate = (jwk: JsonWebKey, extractable = false): Promise<CryptoKey> =>
  crypto.subtle.importKey('jwk', jwk, EC, extractable, ['deriveBits']);

/** Klucz AES-256-GCM jednej współpracy. `inviteId` wiąże go z zaproszeniem, z którego powstała. */
export async function linkKey(myPrivate: CryptoKey, theirPublic: PublicJwk, inviteId: string): Promise<CryptoKey> {
  const pub = await crypto.subtle.importKey('jwk', theirPublic, EC, false, []);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, myPrivate, 256);
  const hkdf = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: buf(utf8('gym-tracker-link')), info: buf(utf8(`v1|${inviteId}`)) },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Szyfrogram: `v1.` + base64url(iv ‖ szyfr z tagiem). `aad` wiąże go z miejscem — paczka jednej
 * współpracy podłożona pod inną albo zalecenie podmienione na inne nie otworzy się.
 */
export async function sealBytes(key: CryptoKey, aad: string, data: Uint8Array): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv), additionalData: buf(utf8(aad)) }, key, buf(data)),
  );
  return `v1.${toBase64Url(concat(iv, ct))}`;
}

/** `null` przy każdej niezgodności: zły klucz, podmienione miejsce, uszkodzony tekst. */
export async function openBytes(key: CryptoKey, aad: string, sealed: string): Promise<Uint8Array | null> {
  if (typeof sealed !== 'string' || !sealed.startsWith('v1.')) return null;
  const raw = fromBase64Url(sealed.slice(3));
  if (!raw || raw.length < 12 + 16) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buf(raw.slice(0, 12)), additionalData: buf(utf8(aad)) },
      key,
      buf(raw.slice(12)),
    );
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

/** JSON spakowany gzipem i zaszyfrowany. Paczka z pół roku treningów i jedzenia kurczy się ok. 8×. */
export const sealJson = (key: CryptoKey, aad: string, value: unknown): Promise<string> =>
  sealBytes(key, aad, gzipSync(utf8(JSON.stringify(value)), { level: 6 }));

export async function openJson(key: CryptoKey, aad: string, sealed: string): Promise<unknown> {
  const bytes = await openBytes(key, aad, sealed);
  if (!bytes) return null;
  try {
    return JSON.parse(fromUtf8(gunzipSync(bytes)));
  } catch {
    return null;
  }
}

/** Miejsca szyfrogramów — `aad` w `sealBytes`. */
export const AAD = {
  snapshot: (connectionId: string) => `snapshot|${connectionId}`,
  assignment: (connectionId: string, assignmentId: string) => `assignment|${connectionId}|${assignmentId}`,
  receipt: (connectionId: string, assignmentId: string) => `receipt|${connectionId}|${assignmentId}`,
  vault: (userId: string) => `vault|${userId}`,
};

/* ── Sejf prowadzącego ─────────────────────────────────────────────────────────────── */

/** 600 tys. rund PBKDF2-SHA256 — zalecenie OWASP na 2023+. Testy podają mniej. */
export const VAULT_ITERATIONS = 600_000;

/** Kod odzyskiwania: 24 znaki Crockforda (120 bitów), w grupach po cztery. */
export const newRecoveryCode = (): string => groups(crockford(randomBytes(16), 24));

/** Kod przepisany z kartki: bez myślników i spacji, w alfabecie. `null` — literówka albo za krótki. */
export function normalizeRecoveryCode(input: string): string | null {
  const s = normalizeCrockford(input.trim());
  return s && s.length === 24 ? s : null;
}

async function vaultKey(code: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const norm = normalizeRecoveryCode(code);
  if (!norm) throw new Error('vault: zły kod');
  const base = await crypto.subtle.importKey('raw', buf(utf8(norm)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: buf(salt), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Klucz prywatny zapieczętowany kodem: `p1.<rundy>.<sól>.<szyfrogram>`. */
export async function sealPrivate(
  privateKey: CryptoKey,
  code: string,
  userId: string,
  iterations = VAULT_ITERATIONS,
): Promise<string> {
  const salt = randomBytes(16);
  const key = await vaultKey(code, salt, iterations);
  const jwk = await exportPrivate(privateKey);
  const sealed = await sealBytes(key, AAD.vault(userId), utf8(JSON.stringify(jwk)));
  return `p1.${iterations}.${toBase64Url(salt)}.${sealed}`;
}

/** Klucz prywatny z sejfu albo `null` przy złym kodzie. `extractable` — do ponownego zapieczętowania. */
export async function openPrivate(
  sealed: string,
  code: string,
  userId: string,
  extractable = false,
): Promise<CryptoKey | null> {
  const m = /^p1\.(\d+)\.([A-Za-z0-9_-]+)\.(v1\.[A-Za-z0-9_-]+)$/.exec(sealed);
  if (!m || !normalizeRecoveryCode(code)) return null;
  const salt = fromBase64Url(m[2]!);
  if (!salt) return null;
  const key = await vaultKey(code, salt, Number(m[1]));
  const bytes = await openBytes(key, AAD.vault(userId), m[3]!);
  if (!bytes) return null;
  try {
    return await importPrivate(JSON.parse(fromUtf8(bytes)) as JsonWebKey, extractable);
  } catch {
    return null;
  }
}

/* ── Token współpracy ──────────────────────────────────────────────────────────────── */

/** Token telefonu: 32 losowe bajty. Serwer zna tylko jego SHA-256 (hex). */
export const newToken = (): string => toBase64Url(randomBytes(32));

export async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf(utf8(text))));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}
