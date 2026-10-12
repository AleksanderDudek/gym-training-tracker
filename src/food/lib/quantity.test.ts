import { describe, expect, test } from 'vitest';
import { packGrams } from './quantity';

describe('packGrams', () => {
  test('one piece of a pack, millilitres as grams', () => {
    expect(['150 g', '0,5 l', '4 x 125 g', '10 × 45 g', '330ml', '50 g'].map(packGrams)).toEqual([
      150, 500, 125, 45, 330, 50,
    ]);
  });

  test('family packs, bare numbers and words are unknown', () => {
    expect(['1 kg', '50', 'duże', '', null].map(packGrams)).toEqual([null, null, null, null, null]);
  });
});
