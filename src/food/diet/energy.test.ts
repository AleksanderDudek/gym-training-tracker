import { describe, expect, test } from 'vitest';
import { bmr, goalDirection } from './energy';

// A made-up person: K, 41 y, 168 cm.
const P = { sex: 'K', age: 41, heightCm: 168 } as const;

// 10·84 + 6.25·168 − 5·41 − 161
const BMR = 1524;

describe('energy', () => {
  test('BMR (Mifflin-St Jeor) at the start weight', () => {
    expect(bmr(P, 84)).toBe(BMR);
    expect(bmr({ ...P, sex: 'M' }, 84)).toBe(BMR + 166);
  });
});

describe('the direction of the goal', () => {
  test('below the start is losing, above it gaining, half a kilo either way keeping', () => {
    expect(goalDirection({ startWeightKg: 84, targetWeightKg: 70 })).toBe('loss');
    expect(goalDirection({ startWeightKg: 70, targetWeightKg: 74 })).toBe('gain');
    expect(goalDirection({ startWeightKg: 70, targetWeightKg: 70.5 })).toBe('keep');
    expect(goalDirection({ startWeightKg: 70, targetWeightKg: 69.5 })).toBe('keep');
  });
});
