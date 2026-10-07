import { describe, expect, it } from 'vitest';
import { TRAIL_MAX, createTrail } from './trail';

describe('ślad wizyty', () => {
  it('ekrany i stuknięcia po kolei, z sekundami od otwarcia, bez powtórzeń z rzędu', () => {
    const t0 = 1_000_000;
    const tr = createTrail(t0);
    tr.view('#/sesja · Dziś');
    tr.tap('Zacznij: Trening A');
    tr.tap('Zacznij: Trening A');
    tr.view('#/treningi · Treningi');
    const s = tr.snapshot(t0 + 65_000);
    expect(s.events.map((e) => [e.kind, e.name])).toEqual([
      ['view', '#/sesja · Dziś'],
      ['tap', 'Zacznij: Trening A'],
      ['view', '#/treningi · Treningi'],
    ]);
    expect(s.view).toBe('#/treningi · Treningi');
    expect(s.sessionSec).toBe(65);
  });

  it('liczby w etykietach są zamaskowane — ślad mówi, co ktoś zrobił, a nie ile', () => {
    const tr = createTrail(0);
    tr.tap('Usuń wpis: 8 421 kroków');
    tr.tap('Goblet squat 16 KG próba 12,5 kg');
    expect(tr.snapshot(0).events.map((e) => e.name)).toEqual(['Usuń wpis: # kroków', 'Goblet squat # KG próba # kg']);
  });

  it('trzyma tylko ostatnie zdarzenia', () => {
    const tr = createTrail(0);
    for (let i = 0; i < TRAIL_MAX + 20; i++) tr.tap(i % 2 ? 'a' : 'b');
    expect(tr.snapshot(0).events).toHaveLength(TRAIL_MAX);
  });

  it('czas aktywny nie liczy aplikacji w tle', () => {
    const tr = createTrail(0);
    tr.visible(false, 30_000);
    tr.visible(true, 90_000);
    expect(tr.snapshot(100_000)).toMatchObject({ sessionSec: 100, activeSec: 40 });
  });
});
