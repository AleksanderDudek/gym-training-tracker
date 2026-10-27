import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../recipes/ingredients';
import nutrients from './data/nutrients.json';
import { LAB_FOODS } from './foods';

const rows = nutrients.foods as Record<string, Record<string, number | null>>;
const keys = Object.keys(nutrients.units);

describe('LAB_FOODS', () => {
  it('has unique ids and FDC ids', () => {
    expect(new Set(LAB_FOODS.map((f) => f.id)).size).toBe(LAB_FOODS.length);
    expect(new Set(LAB_FOODS.map((f) => f.fdc)).size).toBe(LAB_FOODS.length);
  });

  it('has a nutrients row for every food, and no row without a food', () => {
    expect(Object.keys(rows).sort()).toEqual(LAB_FOODS.map((f) => f.id).sort());
  });

  it('gives every row every nutrient, as a number or null', () => {
    for (const [id, row] of Object.entries(rows)) {
      expect(Object.keys(row), id).toEqual(keys);
      for (const v of Object.values(row)) expect(v === null || (typeof v === 'number' && v >= 0), id).toBe(true);
    }
  });

  it('keeps energy within 0-900 kcal per 100 g', () => {
    for (const f of LAB_FOODS) {
      const kcal = rows[f.id]!.kcal;
      expect(kcal, f.id).not.toBeNull();
      expect(kcal!, f.id).toBeGreaterThanOrEqual(0);
      expect(kcal!, f.id).toBeLessThanOrEqual(900);
    }
  });

  it('has positive portions and labels', () => {
    for (const f of LAB_FOODS) {
      expect(f.portion.g, f.id).toBeGreaterThan(0);
      expect(f.portion.label, f.id).not.toBe('');
      expect(f.label, f.id).not.toBe('');
    }
  });

  it('maps only existing recipe ingredients, each to one food', () => {
    const mapped = LAB_FOODS.flatMap((f) => f.ingredient ?? []);
    for (const id of mapped) expect(INGREDIENTS, id).toHaveProperty(id);
    expect(new Set(mapped).size).toBe(mapped.length);
  });

  it('flags organ meat in its group', () => {
    for (const f of LAB_FOODS) expect(f.organ === true, f.id).toBe(f.group === 'organ');
  });
});
