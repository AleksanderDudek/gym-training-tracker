import { expect, test } from 'vitest';
import { formatDate, formatGrams, formatKcal, formatNumber, formatPrice, plural } from './format';

// Intl inserts non-breaking spaces; compare with ordinary ones.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

test('numbers use a decimal comma and drop trailing zeros', () => {
  expect(formatNumber(1.5)).toBe('1,5');
  expect(formatNumber(11)).toBe('11');
  expect(formatNumber(0.123, 2)).toBe('0,12');
});

test('grams and kcal carry their unit; unknown is a dash', () => {
  expect(plain(formatGrams(10.6))).toBe('10,6 g');
  expect(plain(formatKcal(63))).toBe('63 kcal');
  expect(formatGrams(null)).toBe('–');
  expect(formatKcal(null)).toBe('–');
});

test('prices in złoty', () => {
  expect(plain(formatPrice(4.29))).toBe('4,29 zł');
  expect(plain(formatPrice(10))).toBe('10,00 zł');
});

test('dates in Polish', () => {
  expect(formatDate('2026-10-08')).toBe('8 paź 2026');
});

test('Polish plurals: 1 sklep, 2-4 sklepy (but 12-14 sklepów), otherwise sklepów', () => {
  const shops = (n: number) => plural(n, 'sklep', 'sklepy', 'sklepów');
  expect([1, 2, 4, 5, 12, 14, 22, 25, 34, 111, 0].map(shops)).toEqual([
    'sklep',
    'sklepy',
    'sklepy',
    'sklepów',
    'sklepów',
    'sklepów',
    'sklepy',
    'sklepów',
    'sklepy',
    'sklepów',
    'sklepów',
  ]);
});
