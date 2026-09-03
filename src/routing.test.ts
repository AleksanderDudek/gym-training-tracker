import { describe, expect, it } from 'vitest';
import { TABS, activeTab, exercisePath, parseHash } from './routing';
import type { TabKey } from './types';

describe('trasy', () => {
  it('każda zakładka ma własną, unikalną ścieżkę', () => {
    expect(new Set(TABS.map((t) => t.key)).size).toBe(TABS.length);
    expect(new Set(TABS.map((t) => t.path)).size).toBe(TABS.length);
  });

  it('ścieżka każdej zakładki wraca do tej samej zakładki', () => {
    TABS.forEach((t) => {
      const route = parseHash(t.path);
      expect(activeTab(route)).toBe(t.key);
    });
  });

  it('osiągnięcia mają własny adres', () => {
    expect(parseHash('#/osiagniecia')).toEqual({ kind: 'tab', tab: 'ach' });
    expect(TABS.find((t) => t.key === 'ach')?.path).toBe('#/osiagniecia');
  });

  it('pusty i nieznany adres lądują na treningu', () => {
    expect(parseHash('')).toEqual({ kind: 'tab', tab: 'train' });
    expect(parseHash('#/')).toEqual({ kind: 'tab', tab: 'train' });
    expect(parseHash('#/cos-czego-nie-ma')).toEqual({ kind: 'tab', tab: 'train' });
  });

  it('atlas ma spis i podstrony ćwiczeń', () => {
    expect(parseHash('#/cwiczenia')).toEqual({ kind: 'atlas' });
    expect(parseHash(exercisePath('swing2'))).toEqual({ kind: 'exercise', id: 'swing2' });
  });

  it('podstrona ćwiczenia podświetla atlas', () => {
    expect(activeTab({ kind: 'exercise', id: 'swing2' })).toBe('atlas' as TabKey);
    expect(activeTab({ kind: 'atlas' })).toBe('atlas' as TabKey);
  });

  it('identyfikator ze znakami specjalnymi przechodzi w obie strony', () => {
    // Ukośnik w identyfikatorze wychodzi jako %2F, więc podział ścieżki go nie rozcina.
    const id = 'ćwiczenie/dziwne';
    expect(parseHash(exercisePath(id))).toEqual({ kind: 'exercise', id });
  });
});
