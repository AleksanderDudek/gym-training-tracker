import { describe, expect, it } from 'vitest';
import { groupSecret, leftoverFactors, needsCode, normalizeCode, verifiedFactor } from '../src/lib/mfa';

describe('logowanie dwuetapowe — czyste funkcje', () => {
  it('kod: sześć cyfr, spacje i myślniki ignorowane', () => {
    expect(normalizeCode('123456')).toBe('123456');
    expect(normalizeCode(' 123 456 ')).toBe('123456');
    expect(normalizeCode('123-456')).toBe('123456');
    expect(normalizeCode('12345')).toBeNull();
    expect(normalizeCode('1234567')).toBeNull();
    expect(normalizeCode('12a456')).toBeNull();
    expect(normalizeCode('')).toBeNull();
  });

  it('bramka pyta o kod tylko w aal1 z następnym poziomem aal2', () => {
    expect(needsCode({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe(true);
    expect(needsCode({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe(false);
    expect(needsCode({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(false);
    expect(needsCode({ currentLevel: null, nextLevel: null })).toBe(false);
    expect(needsCode(null)).toBe(false);
  });

  it('sekret w grupach po 4', () => {
    expect(groupSecret('abcdefghijkl')).toBe('ABCD EFGH IJKL');
    expect(groupSecret('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
    expect(groupSecret('')).toBe('');
  });

  it('czynniki: potwierdzony i porzucone próby', () => {
    const all = [
      { id: 'a', factor_type: 'totp', status: 'unverified' },
      { id: 'b', factor_type: 'totp', status: 'verified' },
      { id: 'c', factor_type: 'phone', status: 'unverified' },
    ];
    expect(verifiedFactor(all)?.id).toBe('b');
    expect(leftoverFactors(all).map((f) => f.id)).toEqual(['a']);
    expect(verifiedFactor([])).toBeNull();
  });
});
