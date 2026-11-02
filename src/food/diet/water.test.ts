import { describe, expect, test } from 'vitest';
import { WATER_ML, defaultWaterMl, waterTargetMl } from './water';

describe('water target (EFSA 2010, drinks ≈ 80 % of total water)', () => {
  test('1.6 l for women, 2.0 l for men', () => {
    expect(defaultWaterMl({ sex: 'K', pregnancy: false })).toBe(1600);
    expect(defaultWaterMl({ sex: 'M', pregnancy: false })).toBe(2000);
  });

  test('pregnancy or breastfeeding adds the lower EFSA addition (0.3 l); a man’s stray flag adds nothing', () => {
    expect(defaultWaterMl({ sex: 'K', pregnancy: true })).toBe(1600 + WATER_ML.pregnancy);
    expect(defaultWaterMl({ sex: 'M', pregnancy: true })).toBe(2000);
  });

  test('the person’s own target wins; null falls back to EFSA', () => {
    expect(waterTargetMl({ sex: 'K', pregnancy: false, waterMl: 2500 })).toBe(2500);
    expect(waterTargetMl({ sex: 'M', pregnancy: false, waterMl: null })).toBe(2000);
  });
});
