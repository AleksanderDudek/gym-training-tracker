/**
 * Zapis bajtów tekstem: Crockford base32 dla rzeczy, które ktoś czyta albo przepisuje (ID
 * podopiecznego, kod odzyskiwania), base64url dla rzeczy, które jadą tylko w sieci (szyfrogram,
 * klucze, token).
 *
 * Crockford, bo nie ma w nim I, L, O ani U: nikt nie pomyli jedynki z „l”, zera z „O”, a słowa
 * nie złożą się przypadkiem w nic nieprzyzwoitego. Przy odczycie I i L czytają się jako 1, O jako 0.
 */

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Pierwsze `chars` znaków base32 z bajtów (5 bitów na znak). */
export function crockford(bytes: Uint8Array, chars: number): string {
  if (chars * 5 > bytes.length * 8) throw new Error(`crockford: ${chars} znaków to więcej niż ${bytes.length} bajtów`);
  let out = '';
  let acc = 0;
  let bits = 0;
  let i = 0;
  while (out.length < chars) {
    if (bits < 5) {
      acc = (acc << 8) | (bytes[i++] ?? 0);
      bits += 8;
    }
    bits -= 5;
    out += CROCKFORD[(acc >> bits) & 31];
    acc &= (1 << bits) - 1;
  }
  return out;
}

/**
 * Tekst wpisany ręcznie zamieniony na znaki alfabetu: wielkie litery, bez spacji i myślników,
 * I/L → 1, O → 0. Znak spoza alfabetu (także U) daje `null` — to literówka, nie ID.
 */
export function normalizeCrockford(input: string): string | null {
  const s = input
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  return /^[0-9A-HJKMNP-TV-Z]*$/.test(s) ? s : null;
}

/** Grupy po cztery znaki, rozdzielone myślnikiem — tak ID i kod czyta się na głos. */
export const groups = (s: string, size = 4): string => (s.match(new RegExp(`.{1,${size}}`, 'g')) ?? []).join('-');

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** `null`, gdy to nie jest base64url — szyfrogram z sieci bywa uszkodzony albo podrobiony. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Bufor dla WebCrypto — TS 6 rozróżnia `Uint8Array<ArrayBuffer>` od widoku na dowolnym buforze. */
export const buf = (b: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(b);
