import { describe, expect, it } from 'vitest';
import {
  SETTINGS_PATH,
  TABS,
  activeTab,
  exercisePath,
  isTabRoot,
  parseHash,
  screenOf,
  snackAddPath,
  snacksPath,
  statsPath,
} from './routing';
import type { Route } from './types';
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

  it('dolny pasek ma od trzech do pięciu pozycji, jak w Material 3 i Apple HIG', () => {
    expect(TABS.length).toBeGreaterThanOrEqual(3);
    expect(TABS.length).toBeLessThanOrEqual(5);
    TABS.forEach((t) => expect(t.icon.length).toBeGreaterThan(2));
  });

  it('etykiety zakładek to jedno słowo — dwa łamałyby się pod ikoną', () => {
    TABS.forEach((t) => expect(t.label).not.toMatch(/\s/));
  });

  it('treningi są podstroną ekranu Dziś: mają adres, nie mają zakładki', () => {
    expect(TABS.some((t) => t.key === 'work')).toBe(false);
    expect(parseHash('#/treningi')).toEqual({ kind: 'tab', tab: 'work' });
    expect(activeTab({ kind: 'tab', tab: 'work' })).toBe('train' as TabKey);
    expect(screenOf({ kind: 'tab', tab: 'work' }).parent).toBe('#/sesja');
  });

  it('korzenie zakładek nie mają strzałki wstecz, podstrony mają', () => {
    TABS.forEach((t) => expect(screenOf(parseHash(t.path)).parent, t.path).toBeNull());
    const subpages: Route[] = [
      { kind: 'exercise', id: 'swing2' },
      { kind: 'exstats', id: 'swing2' },
      { kind: 'snacks' },
      { kind: 'snackAdd', id: 'swing2' },
      { kind: 'tab', tab: 'set' },
    ];
    subpages.forEach((r) => {
      const s = screenOf(r);
      expect(s.parent, r.kind).toBeTruthy();
      expect(s.title.length, r.kind).toBeGreaterThan(2);
    });
  });

  it('przewinięcie pamięta się na korzeniach zakładek, a pusty adres to ekran Dziś', () => {
    expect(isTabRoot('#/cwiczenia')).toBe(true);
    expect(isTabRoot('')).toBe(true);
    expect(isTabRoot('#/')).toBe(true);
    expect(isTabRoot(exercisePath('swing2'))).toBe(false);
    expect(isTabRoot(snackAddPath())).toBe(false);
  });

  it('ustawienia są poza paskiem, ale wciąż mają działający adres', () => {
    expect(TABS.some((t) => t.key === 'set')).toBe(false);
    expect(parseHash(SETTINGS_PATH)).toEqual({ kind: 'tab', tab: 'set' });
  });

  it('sesja ma własny adres, a stary link do treningu dalej działa', () => {
    expect(parseHash('#/sesja')).toEqual({ kind: 'tab', tab: 'train' });
    expect(parseHash('#/trening')).toEqual({ kind: 'tab', tab: 'train' });
    expect(TABS.find((t) => t.key === 'train')?.path).toBe('#/sesja');
    expect(TABS.find((t) => t.key === 'train')?.label).toBe('Dziś');
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

  it('profil ma zakładkę, podstrony ćwiczeń i stary adres poziomów', () => {
    expect(parseHash('#/profil')).toEqual({ kind: 'tab', tab: 'prog' });
    expect(parseHash('#/poziomy')).toEqual({ kind: 'tab', tab: 'prog' });
    expect(parseHash(statsPath('swing2'))).toEqual({ kind: 'exstats', id: 'swing2' });
    expect(TABS.find((t) => t.key === 'prog')?.label).toBe('Profil');
  });

  it('historia ćwiczenia podświetla profil, a nie atlas', () => {
    // Ten sam ruch ma dwie podstrony: w atlasie technikę, w profilu własną przeszłość.
    expect(activeTab({ kind: 'exstats', id: 'swing2' })).toBe('prog' as TabKey);
    expect(statsPath('swing2')).not.toBe(exercisePath('swing2'));
  });

  it('przekąski mają adres bez zakładki i podświetlają sesję', () => {
    // Siódma pozycja w pasku zeszłaby poniżej celu dotykowego — przekąski wchodzą adresem.
    expect(TABS.some((t) => t.path.includes('przekaski'))).toBe(false);
    expect(parseHash(snacksPath())).toEqual({ kind: 'snacks' });
    expect(activeTab({ kind: 'snacks' })).toBe('train' as TabKey);
  });

  it('zapis przekąski ma własny widok, z ćwiczeniem albo bez', () => {
    expect(parseHash(snackAddPath())).toEqual({ kind: 'snackAdd' });
    expect(parseHash(snackAddPath('squat_air'))).toEqual({ kind: 'snackAdd', id: 'squat_air' });
    // Dawne linki `#/przekaski/<id>` prowadziły do formularza z tym ćwiczeniem — dalej prowadzą.
    expect(parseHash('#/przekaski/squat_air')).toEqual({ kind: 'snackAdd', id: 'squat_air' });
    expect(activeTab({ kind: 'snackAdd' })).toBe('train' as TabKey);
  });

  it('identyfikator ze znakami specjalnymi przechodzi w obie strony', () => {
    // Ukośnik w identyfikatorze wychodzi jako %2F, więc podział ścieżki go nie rozcina.
    const id = 'ćwiczenie/dziwne';
    expect(parseHash(exercisePath(id))).toEqual({ kind: 'exercise', id });
    expect(parseHash(statsPath(id))).toEqual({ kind: 'exstats', id });
    expect(parseHash(snackAddPath(id))).toEqual({ kind: 'snackAdd', id });
  });
});
