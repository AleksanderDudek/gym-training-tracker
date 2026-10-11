import { expect, test } from 'vitest';
import { makeNamer } from './taxonomy';

const taxonomy = {
  'en:dairies': { name: { en: 'Dairies', pl: 'Nabiał' } },
  'en:yogurts': { name: { en: 'Yogurts' } },
  'en:plain-yogurts': { name: { pl: 'jogurty naturalne' } },
};

test('prefers the Polish name, then English, then the humanised tag', () => {
  const name = makeNamer(taxonomy);
  expect(name('en:dairies')).toBe('Nabiał');
  expect(name('en:yogurts')).toBe('Yogurts');
  expect(name('pl:twarogi')).toBe('Twarogi');
});

test('capitalises lower-case Polish names', () => {
  expect(makeNamer(taxonomy)('en:plain-yogurts')).toBe('Jogurty naturalne');
});

test('works with no taxonomy at all', () => {
  expect(makeNamer(null)('en:no-gluten')).toBe('No gluten');
});

test('decodes entities inside taxonomy names', () => {
  expect(makeNamer({ 'en:x': { name: { pl: 'Ser &amp; szynka' } } })('en:x')).toBe('Ser & szynka');
});
