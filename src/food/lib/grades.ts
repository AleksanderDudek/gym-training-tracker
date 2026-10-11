import type { EcoGrade, NovaGroup, NutriGrade } from './types';

// The official palettes, so a badge reads the way it does on the pack.
export const NUTRI_COLORS: Record<NutriGrade, { bg: string; fg: string }> = {
  a: { bg: '#038141', fg: '#ffffff' },
  b: { bg: '#85bb2f', fg: '#ffffff' },
  c: { bg: '#fecb02', fg: '#3b2f00' },
  d: { bg: '#ee8100', fg: '#ffffff' },
  e: { bg: '#e63e11', fg: '#ffffff' },
};

export const ECO_COLORS: Record<EcoGrade, { bg: string; fg: string }> = {
  'a-plus': { bg: '#00704a', fg: '#ffffff' },
  a: { bg: '#1e8f4e', fg: '#ffffff' },
  b: { bg: '#60ac0e', fg: '#ffffff' },
  c: { bg: '#eeae0e', fg: '#3b2f00' },
  d: { bg: '#ff6f1e', fg: '#ffffff' },
  e: { bg: '#df1f1f', fg: '#ffffff' },
  f: { bg: '#9b1c1c', fg: '#ffffff' },
};

export const NOVA_COLORS: Record<NovaGroup, { bg: string; fg: string }> = {
  1: { bg: '#00aa00', fg: '#ffffff' },
  2: { bg: '#ffcc00', fg: '#3b2f00' },
  3: { bg: '#ff6600', fg: '#ffffff' },
  4: { bg: '#e60000', fg: '#ffffff' },
};
