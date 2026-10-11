import { describe, expect, test } from 'vitest';
import { PRIVATE_LABELS, parseStores, storeKey, storesFromBrands } from './stores';

describe('storeKey', () => {
  test('folds the spellings of one chain into one key with a proper label', () => {
    expect(storeKey('biedronka')).toEqual({ key: 'biedronka', label: 'Biedronka' });
    expect(storeKey(' Biedronka ')).toEqual({ key: 'biedronka', label: 'Biedronka' });
    expect(storeKey('carrefour.fr')?.key).toBe('carrefour');
    expect(storeKey('Carrefour Market')?.key).toBe('carrefour');
    expect(storeKey('zabka')).toEqual({ key: 'zabka', label: 'Żabka' });
    expect(storeKey('Żabka')?.key).toBe('zabka');
    expect(storeKey('Intermarche')).toEqual({ key: 'intermarche', label: 'Intermarché' });
    expect(storeKey('E.Leclerc')?.key).toBe('leclerc');
  });

  test('does not fold a store that merely starts with a chain-like word', () => {
    expect(storeKey('Dinozaur')?.key).toBe('dinozaur');
  });

  test('keeps an unknown store under a slug with its own spelling', () => {
    expect(storeKey('Sklep u Ani')).toEqual({ key: 'sklep-u-ani', label: 'Sklep u Ani' });
  });

  test('rejects empty and junk-long values', () => {
    expect(storeKey('  ')).toBeNull();
    expect(storeKey('x'.repeat(61))).toBeNull();
  });
});

describe('parseStores', () => {
  test('splits on commas, normalises and de-duplicates in order', () => {
    expect(parseStores('Lidl, lidl,Auchan').map((s) => s.key)).toEqual(['lidl', 'auchan']);
  });

  test('an empty field gives no stores', () => {
    expect(parseStores('')).toEqual([]);
  });
});

describe('storesFromBrands', () => {
  test('a private-label brand gives its chain', () => {
    expect(storesFromBrands(['pilos'])).toEqual(['lidl']);
    expect(storesFromBrands(['go-active', 'delikate'])).toEqual(['biedronka']);
  });

  test('a national brand gives nothing: the data cannot say where it is sold', () => {
    expect(storesFromBrands(['piatnica', 'mlekovita'])).toEqual([]);
  });

  test('every chain a private label points at is a chain storeKey knows, so it has a label', () => {
    for (const chain of new Set(Object.values(PRIVATE_LABELS))) {
      expect(storeKey(chain)?.key).toBe(chain);
    }
  });
});
