import { expect, test } from 'vitest';
import { compactImagePath, imageUrl } from './images';

const FULL = 'https://images.openfoodfacts.org/images/products/590/123/456/7890/front_pl.12.400.jpg';

test('an Open Food Facts URL is stored without its common prefix', () => {
  expect(compactImagePath(FULL)).toBe('590/123/456/7890/front_pl.12.400.jpg');
});

test('a compact path expands back to the same URL', () => {
  expect(imageUrl(compactImagePath(FULL)!)).toBe(FULL);
});

test('the size is chosen when the URL is built', () => {
  expect(imageUrl('590/x/front_pl.12.400.jpg', 200)).toBe(
    'https://images.openfoodfacts.org/images/products/590/x/front_pl.12.200.jpg',
  );
});

test('another https URL is kept whole and returned as is', () => {
  expect(compactImagePath('https://example.org/a.jpg')).toBe('https://example.org/a.jpg');
  expect(imageUrl('https://example.org/a.jpg', 200)).toBe('https://example.org/a.jpg');
});

test('anything that is not https is refused', () => {
  expect(compactImagePath('javascript:alert(1)')).toBeNull();
  expect(compactImagePath('http://images.openfoodfacts.org/x.jpg')).toBeNull();
  expect(compactImagePath('')).toBeNull();
});
