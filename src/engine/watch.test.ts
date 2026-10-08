import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import { addCardio, cardioOf, cardioStats, minutesByDay, removeCardio, stepsOn, typedStepsOn } from './cardio';
import { SPORT_CYCLING, mergeWatch, parsePayload, restoreWatch, watchEntries, watchStepsOn } from './watch';

/**
 * Dane z zegarka: paczka przesiana wiersz po wierszu, scalona po czasie wysłania, a z kroków
 * i przejazdów powstają wpisy ruchu — w locie, nie w zapisie.
 */

const NOW = Date.parse('2026-10-08T18:00:00Z');
const T = NOW / 1000 - 600;
// Południe czasu lokalnego — dzień przejazdu wychodzi ten sam w każdej strefie testu.
const noon = (day: string) => new Date(`${day}T12:00:00`).getTime() / 1000;

const payload = (over: Record<string, unknown> = {}) => ({
  v: 1,
  t: T,
  d: [
    ['2026-10-07', 11200, 8400, 9, 40],
    ['2026-10-08', 9120, 7340, null, 35],
  ],
  a: [
    [noon('2026-10-07'), SPORT_CYCLING, 3600, 22000],
    [noon('2026-10-08'), 1, 1800, 5000],
  ],
  h: [['2026-10-08', 52, 48, 71, 142, 31, 25, 88, 82]],
  ...over,
});

describe('paczka z zegarka', () => {
  it('czyta dni, aktywności i zdrowie', () => {
    const p = parsePayload(payload(), NOW)!;
    expect(p.t).toBe(T);
    expect(p.days).toEqual([
      { day: '2026-10-07', steps: 11200, m: 8400, floors: 9, active: 40 },
      { day: '2026-10-08', steps: 9120, m: 7340, floors: null, active: 35 },
    ]);
    expect(p.acts[0]).toEqual({ start: noon('2026-10-07'), sport: 2, sec: 3600, m: 22000 });
    expect(p.health[0]).toEqual({
      day: '2026-10-08',
      rhr: 52,
      hrMin: 48,
      hrAvg: 71,
      hrMax: 142,
      stress: 31,
      bbMin: 25,
      bbMax: 88,
      sleep: 82,
    });
  });

  it('zepsuty wiersz odpada, reszta zostaje', () => {
    const p = parsePayload(
      payload({
        d: [['2026-13-01', 5000], ['2026-10-08', -5], ['2026-10-08', 120_000], ['2026-10-06', 7000, 'x', 1e9]],
        a: [[100, 2, 3600, 1000], [noon('2026-10-08'), 2, 30, 1000], 'śmieci'],
        h: [
          ['2026-10-08', 300, 10, null, null, 150, null, null, null],
          ['2026-10-07', null, null, null, null, null, null, null, null],
        ],
      }),
      NOW,
    )!;
    expect(p.days).toEqual([{ day: '2026-10-06', steps: 7000, m: null, floors: null, active: null }]);
    expect(p.acts).toEqual([]);
    // Tętno spoza ludzkiego zakresu i stres ponad 100 to błąd czujnika; dzień bez jednej liczby odpada.
    expect(p.health).toEqual([]);
  });

  it('nie przyjmuje obcej wersji ani czasu z przyszłości', () => {
    expect(parsePayload(payload({ v: 2 }), NOW)).toBeNull();
    expect(parsePayload(payload({ t: NOW / 1000 + 2 * 86_400 }), NOW)).toBeNull();
    expect(parsePayload('tekst', NOW)).toBeNull();
    expect(parsePayload(null, NOW)).toBeNull();
  });
});

describe('scalanie', () => {
  const p = (t: number, d: unknown[]) => parsePayload(payload({ t, d, a: [], h: [] }), NOW)!;

  it('nowsza paczka zastępuje dzień, starsza nic nie zmienia, dni sprzed tygodnia zostają', () => {
    const s = freshState();
    expect(mergeWatch(s, p(T - 100, [['2026-09-20', 6000], ['2026-10-08', 5000]]), new Date(NOW))).toBe(true);
    expect(mergeWatch(s, p(T, [['2026-10-08', 9000]]), new Date(NOW))).toBe(true);
    expect(mergeWatch(s, p(T - 50, [['2026-10-08', 7000]]), new Date(NOW))).toBe(false);
    expect(mergeWatch(s, p(T, [['2026-10-08', 7000]]), new Date(NOW))).toBe(false);
    expect(s.watch!.days.map((d) => [d.day, d.steps])).toEqual([
      ['2026-09-20', 6000],
      ['2026-10-08', 9000],
    ]);
    expect(s.watch!.t).toBe(T);
    expect(s.watch!.got).toBe(new Date(NOW).toISOString());
    expect(watchStepsOn(s, '2026-10-08')).toBe(9000);
    expect(watchStepsOn(s, '2026-10-01')).toBeNull();
  });

  it('licznik dnia może spaść — zegarek wie lepiej', () => {
    const s = freshState();
    mergeWatch(s, p(T - 100, [['2026-10-08', 9000]]));
    mergeWatch(s, p(T, [['2026-10-08', 8000]]));
    expect(watchStepsOn(s, '2026-10-08')).toBe(8000);
  });

  it('aktywności po starcie i zdrowie po dniu, bez powtórzeń', () => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload({ t: T - 100 }), NOW)!);
    mergeWatch(s, parsePayload(payload(), NOW)!);
    expect(s.watch!.acts).toHaveLength(2);
    expect(s.watch!.health).toHaveLength(1);
  });
});

describe('wpisy z zegarka', () => {
  it('kroki dnia i przejazdy rowerem; bieg nie, bo jego kroki już są w krokach', () => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload(), NOW)!);
    const e = watchEntries(s.watch);
    expect(e.filter((c) => c.kind === 'steps').map((c) => c.day)).toEqual(['2026-10-07', '2026-10-08']);
    expect(e.filter((c) => c.kind === 'bike')).toEqual([
      {
        kind: 'bike',
        kmh: 22,
        min: 60,
        key: `watch-ride-${noon('2026-10-07')}`,
        day: '2026-10-07',
        at: new Date(noon('2026-10-07') * 1000).toISOString(),
        src: 'watch',
      },
    ]);
    expect(e.every((c) => c.src === 'watch')).toBe(true);
  });

  it('dzień z zerem kroków i rower bez drogi nie dają wpisu', () => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload({ d: [['2026-10-08', 0]], a: [[noon('2026-10-08'), 2, 3600, null]] }), NOW)!);
    expect(watchEntries(s.watch)).toEqual([]);
    expect(watchEntries(undefined)).toEqual([]);
  });
});

describe('zapis i import', () => {
  it('przesiewa dane z pliku tak samo jak paczkę', () => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload(), NOW)!, new Date(NOW));
    expect(restoreWatch(JSON.parse(JSON.stringify(s.watch)))).toEqual(s.watch);
    const broken = restoreWatch({ ...s.watch, days: [{ day: 'wczoraj', steps: 5 }, ...s.watch!.days] });
    expect(broken!.days).toEqual(s.watch!.days);
    const twice = restoreWatch({ ...s.watch, days: [...s.watch!.days, { ...s.watch!.days[0], steps: 1 }] });
    expect(twice!.days).toHaveLength(s.watch!.days.length);
    expect(restoreWatch({ t: 'x' })).toBeUndefined();
    expect(restoreWatch(undefined)).toBeUndefined();
  });
});

describe('ruch razem z zegarkiem', () => {
  const day = '2026-10-08';
  const withWatch = (steps: number) => {
    const s = freshState();
    mergeWatch(s, parsePayload(payload({ d: [[day, steps]], a: [], h: [] }), NOW)!);
    return s;
  };

  it('wyższa liczba kroków wygrywa — zegarek albo wpis', () => {
    const s = withWatch(9000);
    addCardio(s, { kind: 'steps', steps: 6000 }, day);
    expect(stepsOn(s, day)).toBe(9000);
    expect(cardioOf(s).filter((c) => c.kind === 'steps' && c.day === day)).toHaveLength(1);
    addCardio(s, { kind: 'steps', steps: 12000 }, day);
    expect(stepsOn(s, day)).toBe(12000);
    expect(cardioOf(s).find((c) => c.day === day)!.src).toBeUndefined();
    expect(typedStepsOn(s, day)).toBe(12000);
  });

  it('przy remisie zostaje wpis ręczny — ten da się usunąć', () => {
    const s = withWatch(8000);
    addCardio(s, { kind: 'steps', steps: 8000 }, day);
    expect(cardioOf(s).find((c) => c.day === day)!.src).toBeUndefined();
  });

  it('wpisu z zegarka nie da się usunąć, a usunięcie ręcznego oddaje dzień zegarkowi', () => {
    const s = withWatch(9000);
    const { entry } = addCardio(s, { kind: 'steps', steps: 12000 }, day);
    expect(removeCardio(s, `watch-steps-${day}`)).toBe(false);
    expect(removeCardio(s, entry.key)).toBe(true);
    expect(stepsOn(s, day)).toBe(9000);
    expect(typedStepsOn(s, day)).toBe(0);
  });

  it('kroki z zegarka dają minuty ruchu i liczą się w statystykach odznak', () => {
    const s = withWatch(10000);
    expect(Math.round(minutesByDay(s)[day]!)).toBe(50);
    expect(cardioStats(s)).toMatchObject({ steps: 10000, bestDaySteps: 10000, goalDays: 1 });
  });

  it('bez zegarka lista to dokładnie wpisy ręczne', () => {
    const s = freshState();
    addCardio(s, { kind: 'steps', steps: 5000 }, day);
    expect(cardioOf(s)).toBe(s.cardio);
  });
});
