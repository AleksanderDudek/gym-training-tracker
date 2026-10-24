import { afterEach, describe, expect, test, vi } from 'vitest';
import { forgetWatchModel, rememberWatch, rememberedWatch, type RememberedWatch } from './remember';

const KEY = 'gt-garmin-model';

/** A working storage in memory. */
function memory(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

/** Private mode, blocked site data: every call throws. */
const blocked = (): Storage =>
  new Proxy({} as Storage, {
    get: () => () => {
      throw new DOMException('blocked', 'SecurityError');
    },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

const fr265: RememberedWatch = { key: 'fr265', name: 'Forerunner® 265', v: 'ok', bg: 64 };

describe('the remembered watch model', () => {
  test('round trip: what was remembered comes back, and „Zmień model” forgets it', () => {
    vi.stubGlobal('localStorage', memory());
    expect(rememberedWatch()).toBeNull();
    rememberWatch(fr265);
    expect(rememberedWatch()).toEqual(fr265);
    const f5 = { key: 'fenix5plus', name: 'fēnix® 5 Plus', v: 'part', lacks: ['bodyBattery'], newest: ['stress', 'rides'], bg: 32 } as const;
    rememberWatch({ ...f5, lacks: [...f5.lacks], newest: [...f5.newest] });
    expect(rememberedWatch()).toEqual(f5);
    forgetWatchModel();
    expect(rememberedWatch()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test('storage that throws: nothing remembered, nothing thrown', () => {
    vi.stubGlobal('localStorage', blocked());
    expect(() => rememberWatch(fr265)).not.toThrow();
    expect(rememberedWatch()).toBeNull();
    expect(() => forgetWatchModel()).not.toThrow();
  });

  test('no storage at all (a worker, an old browser): null', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(rememberedWatch()).toBeNull();
    expect(() => rememberWatch(fr265)).not.toThrow();
  });

  test.each([
    ['not JSON', '{fr265'],
    ['a string', '"fr265"'],
    ['a number', '265'],
    ['null', 'null'],
    ['an array', '["fr265"]'],
    ['no key', '{"name":"Forerunner® 265","v":"ok"}'],
    ['an empty key', '{"key":"","name":"Forerunner® 265","v":"ok"}'],
    ['a key that is not text', '{"key":265,"name":"Forerunner® 265","v":"ok"}'],
    ['no name', '{"key":"fr265","v":"ok"}'],
    ['an empty name', '{"key":"fr265","name":"","v":"ok"}'],
    ['an unknown short answer', '{"key":"fr265","name":"Forerunner® 265","v":"update"}'],
    ['no short answer', '{"key":"fr265","name":"Forerunner® 265"}'],
  ])('a stored value that is not a model (%s) reads as null', (_, raw) => {
    vi.stubGlobal('localStorage', memory());
    localStorage.setItem(KEY, raw);
    expect(rememberedWatch()).toBeNull();
  });

  test('a bad optional field is dropped, the model stays', () => {
    vi.stubGlobal('localStorage', memory());
    localStorage.setItem(
      KEY,
      JSON.stringify({ key: 'fr265', name: 'Forerunner® 265', v: 'ok', lacks: ['sleep'], newest: 'stress', bg: 128, extra: 1 }),
    );
    expect(rememberedWatch()).toEqual({ key: 'fr265', name: 'Forerunner® 265', v: 'ok' });
    // Empty lists are no information either.
    localStorage.setItem(KEY, JSON.stringify({ key: 'fr265', name: 'Forerunner® 265', v: 'ok', lacks: [], newest: [] }));
    expect(rememberedWatch()).toEqual({ key: 'fr265', name: 'Forerunner® 265', v: 'ok' });
  });
});
