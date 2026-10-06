import { describe, expect, it } from 'vitest';
import { b64u, encryptPayload, fromB64u, importVapid, pushRequest, vapidToken } from './webpush';

/**
 * Szyfrowanie wiadomości i podpis VAPID robione ręcznie na WebCrypto, bez biblioteki — test
 * sprawdza je na wartościach z samego standardu (RFC 8291, dodatek A), a podpis — kluczem
 * publicznym, tak jak zrobi to serwer powiadomień.
 */

const RFC = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  header:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  body: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
};

/** Para kluczy P-256 z surowego klucza prywatnego i publicznego, jak w wektorze RFC. */
async function keyPair(d: string, pub: string): Promise<CryptoKeyPair> {
  const raw = fromB64u(pub);
  const jwk = { kty: 'EC', crv: 'P-256', d, x: b64u(raw.slice(1, 33)), y: b64u(raw.slice(33, 65)), ext: true };
  const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicKey = await crypto.subtle.importKey('raw', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  return { privateKey, publicKey };
}

async function newVapid() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
  return { pair, jwk: JSON.stringify(jwk), pub };
}

describe('base64url', () => {
  it('koduje i dekoduje bez dopełnienia', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(b64u(bytes)).not.toMatch(/[=+/]/);
    expect([...fromB64u(b64u(bytes))]).toEqual([...bytes]);
    expect(new TextDecoder().decode(fromB64u(RFC.plaintext))).toBe('When I grow up, I want to be a watermelon');
  });
});

describe('szyfrowanie wiadomości (RFC 8291)', () => {
  it('daje dokładnie nagłówek i treść z dodatku A standardu', async () => {
    const out = await encryptPayload(fromB64u(RFC.plaintext), RFC.uaPublic, RFC.auth, {
      salt: fromB64u(RFC.salt),
      serverKeys: await keyPair(RFC.asPrivate, RFC.asPublic),
    });
    // Nagłówek ma 86 bajtów — nie dzieli się przez trzy, więc base64 porównujemy osobno.
    expect(b64u(out.slice(0, 86))).toBe(RFC.header);
    expect(b64u(out.slice(86))).toBe(RFC.body);
  });

  it('bez podanych kluczy losuje sól i klucz — dwie wiadomości nigdy nie są takie same', async () => {
    const a = await encryptPayload(new TextEncoder().encode('x'), RFC.uaPublic, RFC.auth);
    const b = await encryptPayload(new TextEncoder().encode('x'), RFC.uaPublic, RFC.auth);
    expect(b64u(a)).not.toBe(b64u(b));
    // Sól 16, rozmiar rekordu 4, długość klucza 1, klucz 65, szyfrogram z tagiem.
    expect(a.length).toBe(16 + 4 + 1 + 65 + 1 + 1 + 16);
  });
});

describe('VAPID (RFC 8292)', () => {
  it('token jest podpisany kluczem serwera dla adresu usługi powiadomień', async () => {
    const v = await newVapid();
    const key = await importVapid(v.jwk);
    const now = 1_790_000_000;
    const token = await vapidToken('https://fcm.googleapis.com/fcm/send/abc', 'https://example.org/', key, now);
    const [h, p, s] = token.split('.');
    expect(JSON.parse(new TextDecoder().decode(fromB64u(h!)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    const claims = JSON.parse(new TextDecoder().decode(fromB64u(p!)));
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: now + 12 * 3600, sub: 'https://example.org/' });
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      v.pair.publicKey,
      fromB64u(s!),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });

  it('zapytanie do usługi ma nagłówki Web Push i zaszyfrowaną treść', async () => {
    const v = await newVapid();
    const req = await pushRequest(
      { endpoint: 'https://web.push.apple.com/QGuQ', keys: { p256dh: RFC.uaPublic, auth: RFC.auth } },
      { title: 'Dziś trening' },
      { publicKey: v.pub, privateJwk: v.jwk, subject: 'https://example.org/' },
      { ttl: 7200, urgency: 'normal', topic: 'trening' },
    );
    expect(req.url).toBe('https://web.push.apple.com/QGuQ');
    expect(req.method).toBe('POST');
    expect(req.headers.get('Content-Encoding')).toBe('aes128gcm');
    expect(req.headers.get('TTL')).toBe('7200');
    expect(req.headers.get('Urgency')).toBe('normal');
    expect(req.headers.get('Topic')).toBe('trening');
    expect(req.headers.get('Authorization')).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${v.pub}$`));
    const body = new Uint8Array(await req.arrayBuffer());
    // Nagłówek: sól, rozmiar rekordu 4096, klucz serwera — treść nie idzie otwartym tekstem.
    expect(body[16]).toBe(0);
    expect((body[18]! << 8) | body[19]!).toBe(4096);
    expect(new TextDecoder().decode(body)).not.toContain('Dziś trening');
  });
});
