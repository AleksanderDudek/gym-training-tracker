import { describe, expect, it } from 'vitest';
import { cleanKey, deriveKeys, hexBytes, newKey, open, seal } from './watchseal';

/**
 * Koperta danych z zegarka. Wektor policzony niezależnie przez `node:crypto` i powtórzony
 * w teście aplikacji na zegarek (garmin/source/SealTest.mc): jeśli któryś koniec się rozjedzie,
 * żadna paczka z zegarka się nie otworzy.
 */
const VECTOR = {
  key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  iv: 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
  box: '737a7eb70569826b3e8462ab4ac24904',
  blob: 'AaChoqOkpaanqKmqq6ytrq9nI0xALzFgri8DBZAN/yhxd7AY60ot2CVM9j2Gz9jgGIqwuDTJGghOUyekfekvvks=',
};

const flip = (b64: string, at: number): string => {
  const b = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  b[at] = b[at]! ^ 1;
  return btoa(String.fromCharCode(...b));
};

describe('koperta zegarka', () => {
  it('wyprowadza skrzynkę i pieczętuje bajt w bajt jak zegarek', async () => {
    const keys = (await deriveKeys(VECTOR.key))!;
    expect(keys.box).toBe(VECTOR.box);
    expect(await seal(keys, '{"v":1}', hexBytes(VECTOR.iv)!)).toBe(VECTOR.blob);
    expect(await open(keys, VECTOR.blob)).toBe('{"v":1}');
  });

  it('otwiera to, co zapieczętował, także z polskimi znakami i dłuższą treścią', async () => {
    const keys = (await deriveKeys(newKey()))!;
    const text = JSON.stringify({ v: 1, note: 'zażółć gęślą jaźń', d: Array.from({ length: 40 }, (_, i) => i) });
    expect(await open(keys, await seal(keys, text))).toBe(text);
  });

  it('odrzuca zmieniony bajt, obcy klucz, złą wersję i śmieci', async () => {
    const keys = (await deriveKeys(VECTOR.key))!;
    const other = (await deriveKeys(newKey()))!;
    expect(await open(keys, flip(VECTOR.blob, 20))).toBeNull(); // szyfrogram
    expect(await open(keys, flip(VECTOR.blob, 60))).toBeNull(); // znacznik
    expect(await open(keys, flip(VECTOR.blob, 0))).toBeNull(); // wersja
    expect(await open(other, VECTOR.blob)).toBeNull();
    expect(await open(keys, 'nie-base64!')).toBeNull();
    expect(await open(keys, btoa('za krótkie'))).toBeNull();
  });

  it('klucz to 64 znaki hex — spacje, łączniki i wielkość liter bez znaczenia', () => {
    expect(cleanKey(`  ${VECTOR.key.toUpperCase().match(/.{8}/g)!.join(' ')}\n`)).toBe(VECTOR.key);
    expect(cleanKey('00010203 04050607-08090A0B 0C0D0E0F 10111213 14151617 18191A1B 1C1D1E1F')).toBe(VECTOR.key);
    expect(cleanKey(VECTOR.key.slice(2))).toBeNull();
    expect(cleanKey(`zz${VECTOR.key.slice(2)}`)).toBeNull();
    expect(cleanKey(`Klucz: ${VECTOR.key}`)).toBeNull();
  });

  it('nowy klucz jest losowy i od razu poprawny', async () => {
    const a = newKey();
    expect(cleanKey(a)).toBe(a);
    expect(a).not.toBe(newKey());
    expect(await deriveKeys('za-krótki')).toBeNull();
  });
});
