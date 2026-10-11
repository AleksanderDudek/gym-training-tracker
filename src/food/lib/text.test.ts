import { describe, expect, test } from 'vitest';
import { capitalize, decodeEntities, foldDiacritics, humanizeTag, normalizeForSearch, tokenize } from './text';

describe('foldDiacritics', () => {
  test('folds Polish letters, including ł, which NFD does not decompose', () => {
    expect(foldDiacritics('Żółta łódź ĄĘ Łódź')).toBe('Zolta lodz AE Lodz');
  });
});

describe('normalizeForSearch', () => {
  test('lower-cases, folds and trims', () => {
    expect(normalizeForSearch('  Masło ŚMIETANKOWE ')).toBe('maslo smietankowe');
  });
});

describe('tokenize', () => {
  test('splits on whitespace and drops empty pieces', () => {
    expect(tokenize('  żółty   ser ')).toEqual(['zolty', 'ser']);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('decodeEntities', () => {
  test('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('M&amp;M&#39;s &quot;x&quot; &lt;3 &#x41;')).toBe(`M&M's "x" <3 A`);
  });
  test('leaves unknown entities and plain text alone', () => {
    expect(decodeEntities('a &bogus; b & c')).toBe('a &bogus; b & c');
  });
});

describe('humanizeTag', () => {
  test('strips the language prefix, turns dashes into spaces and capitalises', () => {
    expect(humanizeTag('pl:twarogi-polskie')).toBe('Twarogi polskie');
    expect(humanizeTag('no-gluten')).toBe('No gluten');
  });
  test('an empty tag gives an empty string', () => {
    expect(humanizeTag('en:')).toBe('');
  });
});

describe('capitalize', () => {
  test('upper-cases the first letter only', () => {
    expect(capitalize('jogurty naturalne')).toBe('Jogurty naturalne');
    expect(capitalize('')).toBe('');
  });
});
