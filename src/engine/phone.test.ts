import { describe, expect, it } from 'vitest';
import vector from '../../health/vectors.json';
import { setBodyWeight } from './body';
import { addCardio, cardioOf, deviceStepsOn, minutesByDay, removeCardio, stepsOn } from './cardio';
import { freshState } from './plan';
import { mergePhone, parsePhonePayload, phoneEntries, phoneWeightOffer, restorePhone } from './phone';
import { SPORT_CYCLING, mergeWatch, parsePayload } from './watch';

/**
 * Dane z telefonu (Apple Zdrowie, Health Connect): paczka przesiana pole po polu, scalona po
 * czasie wysłania, kroki i przejazdy jako wpisy w locie — razem z zegarkiem, bez podwójnego liczenia.
 */

const NOW = Date.parse('2026-10-20T18:00:00Z');
const T = NOW / 1000 - 600;
// Południe czasu lokalnego — dzień przejazdu wychodzi ten sam w każdej strefie testu.
const noon = (day: string) => new Date(`${day}T12:00:00`).getTime() / 1000;

const payload = (over: Record<string, unknown> = {}) => ({
  v: 1,
  k: 'phone',
  os: 'ios',
  t: T,
  d: [
    { day: '2026-10-19', steps: 4210, m: 3120, floors: 3, rhr: 55, hrMin: 50, hrAvg: 74, hrMax: 131, sleep: 401 },
    { day: '2026-10-20', steps: 9120, m: 7340, floors: 12, active: 35, rhr: 52, sleep: 432, kg: 82.43 },
  ],
  a: [{ start: noon('2026-10-19'), sport: SPORT_CYCLING, sec: 3600, m: 25000 }],
  ...over,
});

const day = (over: Record<string, unknown>) => ({
  steps: null,
  m: null,
  floors: null,
  active: null,
  rhr: null,
  hrMin: null,
  hrAvg: null,
  hrMax: null,
  sleep: null,
  kg: null,
  ...over,
});

describe('paczka z telefonu', () => {
  it('czyta dni i przejazdy; brak pola to null, waga z jedną cyfrą po przecinku', () => {
    const p = parsePhonePayload(payload(), NOW)!;
    expect(p.t).toBe(T);
    expect(p.os).toBe('ios');
    expect(p.days).toEqual([
      day({ day: '2026-10-19', steps: 4210, m: 3120, floors: 3, rhr: 55, hrMin: 50, hrAvg: 74, hrMax: 131, sleep: 401 }),
      day({ day: '2026-10-20', steps: 9120, m: 7340, floors: 12, active: 35, rhr: 52, sleep: 432, kg: 82.4 }),
    ]);
    expect(p.acts).toEqual([{ start: noon('2026-10-19'), sport: 2, sec: 3600, m: 25000 }]);
  });

  it('wspólny wektor — ta sama paczka, którą pieczętują aplikacje na telefon', () => {
    const p = parsePhonePayload(JSON.parse(vector.plaintext), Date.parse('2026-10-22T00:00:00Z'))!;
    expect(p.os).toBe('android');
    expect(p.days.map((d) => [d.day, d.steps, d.sleep, d.kg])).toEqual([
      ['2026-10-19', 4210, 401, null],
      ['2026-10-20', 9120, 432, 82.4],
    ]);
    expect(p.acts).toHaveLength(1);
  });

  it('liczba spoza zakresu odpada sama, dzień bez żadnej liczby odpada cały', () => {
    const p = parsePhonePayload(
      payload({
        d: [
          { day: '2026-10-18', steps: 120_000, rhr: 300, sleep: 2000, kg: 12, hrAvg: 70 },
          { day: '2026-10-17', steps: -1, kg: 'dużo' },
          { day: '2026-13-01', steps: 5000 },
          'śmieci',
          { day: '2026-10-16', kg: 81 },
        ],
        a: [{ start: 100, sport: 2, sec: 3600, m: 1000 }, { start: noon('2026-10-19'), sport: 2, sec: 30, m: 1000 }],
      }),
      NOW,
    )!;
    expect(p.days).toEqual([day({ day: '2026-10-16', kg: 81 }), day({ day: '2026-10-18', hrAvg: 70 })]);
    expect(p.acts).toEqual([]);
  });

  it('nie przyjmuje paczki zegarka, obcej wersji, systemu ani czasu z przyszłości', () => {
    expect(parsePhonePayload(payload({ k: undefined }), NOW)).toBeNull();
    expect(parsePhonePayload(payload({ v: 2 }), NOW)).toBeNull();
    expect(parsePhonePayload(payload({ os: 'windows' }), NOW)).toBeNull();
    expect(parsePhonePayload(payload({ t: NOW / 1000 + 2 * 86_400 }), NOW)).toBeNull();
    expect(parsePhonePayload(null, NOW)).toBeNull();
  });

  it('zegarek nie przyjmie paczki telefonu — klucz wklejony nie tam, gdzie trzeba', () => {
    expect(parsePayload({ ...payload(), h: [] }, NOW)).toBeNull();
  });
});

describe('scalanie', () => {
  const p = (t: number, d: unknown[]) => parsePhonePayload(payload({ t, d, a: [] }), NOW)!;

  it('nowsza paczka zastępuje dzień, starsza nic nie zmienia, starsze dni zostają', () => {
    const s = freshState();
    expect(mergePhone(s, p(T - 100, [{ day: '2026-10-01', steps: 6000 }, { day: '2026-10-20', steps: 5000 }]), new Date(NOW))).toBe(true);
    expect(mergePhone(s, p(T, [{ day: '2026-10-20', steps: 9000 }]), new Date(NOW))).toBe(true);
    expect(mergePhone(s, p(T - 50, [{ day: '2026-10-20', steps: 7000 }]))).toBe(false);
    expect(s.phone!.days.map((d) => [d.day, d.steps])).toEqual([
      ['2026-10-01', 6000],
      ['2026-10-20', 9000],
    ]);
    expect(s.phone!.got).toBe(new Date(NOW).toISOString());
  });
});

describe('wpisy z telefonu', () => {
  it('kroki dnia i przejazd rowerem, oznaczone jako z telefonu', () => {
    const s = freshState();
    mergePhone(s, parsePhonePayload(payload(), NOW)!);
    const e = phoneEntries(s.phone);
    expect(e.filter((c) => c.kind === 'steps').map((c) => c.key)).toEqual(['phone-steps-2026-10-19', 'phone-steps-2026-10-20']);
    expect(e.find((c) => c.kind === 'bike')).toMatchObject({ kmh: 25, min: 60, day: '2026-10-19', src: 'phone' });
    expect(phoneEntries(undefined)).toEqual([]);
  });

  it('dzień bez kroków (sama waga) nie daje wpisu', () => {
    const s = freshState();
    mergePhone(s, parsePhonePayload(payload({ d: [{ day: '2026-10-20', kg: 80 }], a: [] }), NOW)!);
    expect(phoneEntries(s.phone)).toEqual([]);
  });
});

describe('ruch z telefonem, zegarkiem i wpisem', () => {
  const d = '2026-10-20';
  const setup = ({ watch, phone }: { watch?: number; phone?: number }) => {
    const s = freshState();
    if (watch !== undefined) mergeWatch(s, parsePayload({ v: 1, t: T, d: [[d, watch]], a: [], h: [] }, NOW)!);
    if (phone !== undefined) mergePhone(s, parsePhonePayload(payload({ d: [{ day: d, steps: phone }], a: [] }), NOW)!);
    return s;
  };
  const stepEntries = (s: ReturnType<typeof freshState>) => cardioOf(s).filter((c) => c.kind === 'steps' && c.day === d);

  it('z trzech liczb zostaje najwyższa, nigdy suma', () => {
    const s = setup({ watch: 8000, phone: 9500 });
    expect(stepsOn(s, d)).toBe(9500);
    expect(stepEntries(s)).toHaveLength(1);
    expect(stepEntries(s)[0]!.src).toBe('phone');
    expect(deviceStepsOn(s, d)).toEqual({ steps: 9500, src: 'phone' });
    addCardio(s, { kind: 'steps', steps: 10_000 }, d);
    expect(stepsOn(s, d)).toBe(10_000);
    expect(stepEntries(s)[0]!.src).toBeUndefined();
  });

  it('remis: wpis ręczny, potem zegarek, potem telefon', () => {
    const s = setup({ watch: 9000, phone: 9000 });
    expect(stepEntries(s)[0]!.src).toBe('watch');
    expect(deviceStepsOn(s, d)).toEqual({ steps: 9000, src: 'watch' });
    addCardio(s, { kind: 'steps', steps: 9000 }, d);
    expect(stepEntries(s)).toHaveLength(1);
    expect(stepEntries(s)[0]!.src).toBeUndefined();
  });

  it('wpisu z telefonu nie da się usunąć, a usunięcie ręcznego oddaje dzień telefonowi', () => {
    const s = setup({ phone: 9000 });
    const { entry } = addCardio(s, { kind: 'steps', steps: 12_000 }, d);
    expect(removeCardio(s, `phone-steps-${d}`)).toBe(false);
    expect(removeCardio(s, entry.key)).toBe(true);
    expect(stepsOn(s, d)).toBe(9000);
  });

  it('kroki z telefonu dają minuty ruchu', () => {
    const s = setup({ phone: 10_000 });
    expect(Math.round(minutesByDay(s)[d]!)).toBe(50);
    expect(deviceStepsOn(s, '2026-10-01')).toBeNull();
  });

  it('ten sam przejazd z zegarka i z telefonu liczy się raz; inny przejazd tego dnia osobno', () => {
    const s = freshState();
    const start = noon(d);
    mergeWatch(s, parsePayload({ v: 1, t: T, d: [], a: [[start, SPORT_CYCLING, 3600, 22000]], h: [] }, NOW)!);
    mergePhone(
      s,
      parsePhonePayload(
        payload({
          d: [],
          a: [
            { start: start + 45, sport: 2, sec: 3590, m: 22100 },
            { start: start + 4 * 3600, sport: 2, sec: 1800, m: 9000 },
          ],
        }),
        NOW,
      )!,
    );
    expect(cardioOf(s).filter((c) => c.kind === 'bike').map((c) => c.key)).toEqual([
      `watch-ride-${start}`,
      `phone-ride-${start + 4 * 3600}`,
    ]);
  });
});

describe('zapis i import', () => {
  it('przesiewa dane z pliku tak samo jak paczkę', () => {
    const s = freshState();
    mergePhone(s, parsePhonePayload(payload(), NOW)!, new Date(NOW));
    expect(restorePhone(JSON.parse(JSON.stringify(s.phone)))).toEqual(s.phone);
    const broken = restorePhone({ ...s.phone, days: [{ day: 'wczoraj', steps: 5 }, ...s.phone!.days] });
    expect(broken!.days).toEqual(s.phone!.days);
    const twice = restorePhone({ ...s.phone, days: [...s.phone!.days, { ...s.phone!.days[0], steps: 1 }] });
    expect(twice!.days).toHaveLength(s.phone!.days.length);
    expect(restorePhone({ ...s.phone, os: 'symbian' })).toBeUndefined();
    // Czas z przyszłości zablokowałby każdą następną paczkę, a start poza kalendarzem wywróciłby ekran.
    expect(restorePhone({ ...s.phone, t: 9e15 }, NOW)).toBeUndefined();
    const far = restorePhone({ ...s.phone, acts: [...s.phone!.acts, { start: 9e12, sport: 2, sec: 3600, m: 9000 }] }, NOW)!;
    expect(far.acts).toEqual(s.phone!.acts);
    expect(() => phoneEntries(far)).not.toThrow();
    expect(restorePhone({ t: 'x' })).toBeUndefined();
    expect(restorePhone(undefined)).toBeUndefined();
  });
});

describe('ważenie z telefonu', () => {
  const withKg = (days: { day: string; kg: number }[]) => {
    const s = freshState();
    mergePhone(s, parsePhonePayload(payload({ d: days, a: [] }), NOW)!);
    return s;
  };

  it('proponuje najnowsze ważenie, gdy dziennik go jeszcze nie ma', () => {
    const s = withKg([
      { day: '2026-10-18', kg: 83 },
      { day: '2026-10-20', kg: 82.4 },
    ]);
    expect(phoneWeightOffer(s, '2026-10-20')).toEqual({ day: '2026-10-20', kg: 82.4 });
    setBodyWeight(s, 82, '2026-10-19');
    expect(phoneWeightOffer(s, '2026-10-20')).toEqual({ day: '2026-10-20', kg: 82.4 });
  });

  it('poranne ważenie po polskiej północy — dzień telefonu jest już o jeden dalej niż UTC', () => {
    const s = withKg([{ day: '2026-10-21', kg: 82.1 }]);
    expect(phoneWeightOffer(s, '2026-10-20')).toEqual({ day: '2026-10-21', kg: 82.1 });
  });

  it('nic, gdy dziennik ma ten sam albo późniejszy dzień, a ważenie jest stare', () => {
    const s = withKg([{ day: '2026-10-20', kg: 82.4 }]);
    setBodyWeight(s, 82.4, '2026-10-20');
    expect(phoneWeightOffer(s, '2026-10-20')).toBeNull();
    expect(phoneWeightOffer(withKg([{ day: '2026-10-01', kg: 84 }]), '2026-10-20')).toBeNull();
    expect(phoneWeightOffer(freshState(), '2026-10-20')).toBeNull();
  });
});
