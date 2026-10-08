/**
 * Koperta danych z zegarka Garmin — wspólny format zegarka i aplikacji.
 *
 * Klucz (32 losowe bajty) powstaje w przeglądarce i trafia na zegarek przez schowek. Serwer
 * go nie zna. Z klucza wychodzą trzy klucze pochodne, jak w HKDF-Expand z jednym blokiem
 * (RFC 5869 pozwala pominąć Extract, gdy klucz jest już losowy, a Connect IQ ma HMAC, ale
 * nie ma HKDF):
 *
 * - skrzynka = pierwsze 16 bajtów HMAC(klucz, "gt-box" ‖ 0x01) — adres paczki na serwerze;
 * - szyfr    = HMAC(klucz, "gt-enc" ‖ 0x01) — AES-256;
 * - podpis   = HMAC(klucz, "gt-mac" ‖ 0x01) — HMAC-SHA256.
 *
 * Koperta: 0x01 ‖ IV(16) ‖ AES-256-CBC(PKCS#7) ‖ HMAC-SHA256(podpis, wszystko przed nim),
 * w base64. Najpierw szyfr, potem podpis, a przy otwieraniu odwrotnie: niepodpisany bajt nie
 * dochodzi do deszyfrowania. `seal` jest tu wzorcem tego, co robi zegarek (garmin/source/Seal.mc)
 * — aplikacja sama niczego nie pieczętuje.
 */

const VERSION = 1;
const TAG = 32;
const IV = 16;
const enc = new TextEncoder();

type Bytes = Uint8Array<ArrayBuffer>;

export interface WatchKeys {
  /** Identyfikator skrzynki na serwerze, 32 znaki hex. */
  box: string;
  enc: Bytes;
  mac: Bytes;
}

export function hexBytes(hex: string): Bytes | null {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

const bytesHex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Klucz z pola albo ze schowka: 64 znaki hex. Spacje, łączniki, nowe linie i wielkość liter
 * nie mają znaczenia — tak samo czyta go zegarek. Inne znaki to nie klucz, tylko coś
 * wklejonego razem z nim.
 */
export function cleanKey(s: string): string | null {
  const k = s.replace(/[\s-]+/g, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(k) ? k : null;
}

export function newKey(): string {
  return bytesHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function hmac(key: Bytes, msg: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
}

const label = (s: string): Bytes => {
  const t = enc.encode(s);
  const out = new Uint8Array(t.length + 1);
  out.set(t);
  out[t.length] = 1;
  return out;
};

export async function deriveKeys(keyHex: string): Promise<WatchKeys | null> {
  const k = cleanKey(keyHex);
  const s = k ? hexBytes(k) : null;
  if (!s) return null;
  const [box, e, m] = await Promise.all([hmac(s, label('gt-box')), hmac(s, label('gt-enc')), hmac(s, label('gt-mac'))]);
  return { box: bytesHex(box.subarray(0, 16)), enc: e, mac: m };
}

const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  parts.forEach((p) => {
    out.set(p, at);
    at += p.length;
  });
  return out;
};

const toB64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b));

const fromB64 = (s: string): Bytes | null => {
  try {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

/** Pieczętowanie jak na zegarku. IV podaje tylko test — inaczej losowy. */
export async function seal(
  keys: WatchKeys,
  text: string,
  iv: Bytes = crypto.getRandomValues(new Uint8Array(IV)),
): Promise<string> {
  const k = await crypto.subtle.importKey('raw', keys.enc, 'AES-CBC', false, ['encrypt']);
  // WebCrypto dopełnia PKCS#7 samo — zegarek robi to ręcznie, wynik jest ten sam.
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, k, enc.encode(text)));
  const head = concat(Uint8Array.of(VERSION), iv, ct);
  return toB64(concat(head, await hmac(keys.mac, head)));
}

/** Treść koperty albo `null`, gdy podpis się nie zgadza, wersja jest obca albo to nie koperta. */
export async function open(keys: WatchKeys, blob: string): Promise<string | null> {
  const env = fromB64(blob);
  if (!env || env.length < 1 + IV + 16 + TAG || env[0] !== VERSION || (env.length - 1 - IV - TAG) % 16 !== 0)
    return null;
  const head = env.subarray(0, env.length - TAG);
  const mk = await crypto.subtle.importKey('raw', keys.mac, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  // `verify` porównuje w stałym czasie — czas odpowiedzi nie zdradza, ile bajtów się zgadza.
  if (!(await crypto.subtle.verify('HMAC', mk, env.subarray(env.length - TAG), head))) return null;
  try {
    const k = await crypto.subtle.importKey('raw', keys.enc, 'AES-CBC', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: head.subarray(1, 1 + IV) }, k, head.subarray(1 + IV));
    return new TextDecoder('utf-8', { fatal: true }).decode(pt);
  } catch {
    return null;
  }
}
