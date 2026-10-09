import { describe, expect, it } from 'vitest';
import { ALL, BUILTIN, EX } from '../data/exercises';
import { STATIONS, stationFor } from '../data/stations';
import { blocksOf, tagOf } from './blocks';
import { reviewWorkout } from './design';
import { freshState } from './plan';
import { PAIR_REST, isHeavy, pairProblems, platesPerSide, restText, setupFor, warmupFor } from './structure';
import type { Workout } from '../types';

/**
 * Kolejność i pary w gotowych treningach. Każdy trening był przejrzany ręcznie; test pilnuje
 * zasad, na których stoi ten przegląd, żeby następna zmiana w bibliotece ich nie złamała.
 */

const byId = (id: string): Workout => BUILTIN.find((w) => w.id === id)!;

describe('bloki: serie pod rząd i pary na zmianę', () => {
  it('para to dwa sąsiednie ćwiczenia, a pierwsze ćwiczenie nie może być „z poprzednim”', () => {
    const b = blocksOf([{ ex: 'swing2' }, { ex: 'goblet' }, { ex: 'row', pair: true }, { ex: 'carry' }]);
    expect(b.map((x) => [x.n, x.kind, x.ids])).toEqual([
      [1, 'straight', ['swing2']],
      [2, 'pair', ['goblet', 'row']],
      [3, 'straight', ['carry']],
    ]);
    expect(blocksOf([{ ex: 'goblet', pair: true }])[0]!.kind).toBe('straight');
    // Trzecie z rzędu nie dokleja się do pary — para ma dwa ćwiczenia.
    const three = blocksOf([{ ex: 'a' }, { ex: 'b', pair: true }, { ex: 'c', pair: true }]);
    expect(three.map((x) => x.ids.length)).toEqual([2, 1]);
  });

  it('obwód to sąsiednie stacje z `circuit` — bez limitu dwóch, z własnymi oznaczeniami', () => {
    const b = blocksOf([
      { ex: 'a' },
      { ex: 'b', circuit: true },
      { ex: 'c', circuit: true },
      { ex: 'd', circuit: true, pair: true },
      { ex: 'e' },
      { ex: 'f', pair: true },
    ]);
    expect(b.map((x) => [x.n, x.kind, x.ids])).toEqual([
      [1, 'straight', ['a']],
      [2, 'circuit', ['b', 'c', 'd']],
      [3, 'pair', ['e', 'f']],
    ]);
    expect(tagOf(b[1]!, 2)).toBe('2C');
    // Para nie dokleja się do obwodu ani obwód do pary.
    const mixed = blocksOf([{ ex: 'a', circuit: true }, { ex: 'b', pair: true }, { ex: 'c', circuit: true }]);
    expect(mixed.map((x) => x.kind)).toEqual(['circuit', 'straight', 'circuit']);
  });

  it('żaden gotowy trening nie ma złej pary', () => {
    const bad = BUILTIN.flatMap((w) =>
      blocksOf(w.items)
        .filter((b) => b.kind === 'pair')
        .map((b) => ({ w: w.id, pair: b.ids.join('+'), why: pairProblems(b.ids[0]!, b.ids[1]!, w.gear) }))
        .filter((x) => x.why.length),
    );
    expect(bad).toEqual([]);
  });

  it('ruchy wybuchowe i ciężkie ze sztangą idą zawsze same, serie pod rząd', () => {
    expect(pairProblems('swing2', 'row', 'kb').length).toBeGreaterThan(0);
    expect(pairProblems('squat_back', 'row_cable', 'gym').length).toBeGreaterThan(0);
    expect(isHeavy('deadlift')).toBe(true);
    expect(isHeavy('curl_bb')).toBe(false);
  });

  it('para nie męczy tej samej partii i na siłowni nie trzyma dwóch stanowisk', () => {
    expect(pairProblems('curl_db', 'curl_hammer', 'gym').join(' ')).toMatch(/biceps/i);
    expect(pairProblems('legext', 'calf_seated', 'gym').join(' ')).toMatch(/stanowisk/);
    // Ten sam wyciąg albo ta sama suwnica — jedno stanowisko.
    expect(pairProblems('fly_cable', 'pushdown', 'gym')).toEqual([]);
    expect(pairProblems('legpress', 'calf_press', 'gym')).toEqual([]);
    // W domu stół i drążek należą do ciebie — nikt ich nie zajmie.
    expect(pairProblems('floor', 'pullup', 'kb')).toEqual([]);
  });

  it('gotowe treningi mają pary tam, gdzie to się opłaca, i przechodzą doradcę', () => {
    const pairs = BUILTIN.reduce((n, w) => n + blocksOf(w.items).filter((b) => b.kind === 'pair').length, 0);
    expect(pairs).toBeGreaterThanOrEqual(30);
    const s = freshState();
    BUILTIN.forEach((w) => {
      const r = reviewWorkout(s, w.items.map((i) => i.ex), w.kind, w.items.map((i) => !!i.pair));
      expect({ id: w.id, order: r.orderOk }).toEqual({ id: w.id, order: true });
    });
  });

  it('para skraca trening — przerwa jednego ćwiczenia to czas pracy drugiego', () => {
    const s = freshState();
    const ids = ['goblet', 'row'];
    const straight = reviewWorkout(s, ids, undefined, [false, false]).secs;
    const paired = reviewWorkout(s, ids, undefined, [false, true]).secs;
    expect(paired).toBeLessThan(straight);
    expect(PAIR_REST).toBeGreaterThanOrEqual(60);
  });

  it('przerwa słowami: ciężkie dłużej, lekkie krócej', () => {
    expect(restText(120)).toBe('2–3 min');
    expect(restText(75)).toBe('60–90 s');
    expect(restText(45)).toBe('30–60 s');
  });
});

describe('przygotowanie stanowiska', () => {
  it('każde ćwiczenie z biblioteki ma opisane stanowisko', () => {
    expect(ALL.filter((id) => !STATIONS[id])).toEqual([]);
    // Maszyna bez zamiennika zostawia kogoś pod zajętą maszyną bez planu B.
    ALL.forEach((id) => {
      const st = STATIONS[id]!;
      if (st.machine) expect({ id, alt: (st.alt ?? []).length > 0 }).toEqual({ id, alt: true });
      (st.alt ?? []).forEach((a) => expect({ id, a, ok: !!EX[a] }).toEqual({ id, a, ok: true }));
    });
  });

  it('siłownia: maszyny do znalezienia z zamiennikami spoza treningu, jedna suwnica na dwa ćwiczenia', () => {
    const setup = setupFor(freshState(), byId('legs-gym'));
    const suwnica = setup.machines.find((m) => m.name === 'suwnica')!;
    expect(suwnica.uses.map((u) => u.name)).toEqual(['Wypychanie na suwnicy', 'Wspięcia na suwnicy']);
    // Każde ćwiczenie na tej samej maszynie ma swoje zamienniki.
    expect(suwnica.uses[0]!.alt).toContain('Hack squat');
    expect(suwnica.uses[1]!.alt).not.toContain('Hack squat');
    const curl = setup.machines.find((m) => m.name === 'maszyna do uginania nóg')!;
    expect(curl.uses[0]!.alt).toContain('Nordic curl');
    expect(setup.barbells.map((b) => b.name)).toEqual(['Przysiad ze sztangą z tyłu', 'RDL ze sztangą']);
  });

  it('kettlebell: konkretne wagi z poziomu i dwa odważniki do spaceru farmera', () => {
    const s = freshState();
    const setup = setupFor(s, byId('B'));
    const all = setup.kettlebells.flatMap((k) => k.for);
    expect(all).toContain('Swing jednorącz');
    expect(setup.kettlebells.every((k) => k.kg > 0)).toBe(true);
    expect(setup.kettlebells.some((k) => k.for.some((f) => f.startsWith('Farmer carry (dwa')))).toBe(true);
  });

  it('dom bez sprzętu: krzesło, stół i mata zamiast maszyn', () => {
    const setup = setupFor(freshState(), byId('full-none-c'));
    expect(setup.machines).toEqual([]);
    expect(setup.other.join(' ')).toMatch(/krzesło/);
    expect(setup.other.join(' ')).toMatch(/stół/);
  });

  it('to samo ćwiczenie ma inne stanowisko w domu i na siłowni', () => {
    expect(stationFor('row_inverted', 'none').needs).toEqual(['table']);
    expect(stationFor('row_inverted', 'gym').needs).toEqual(['rack']);
    expect(stationFor('hyper', 'gym').machine).toBeDefined();
  });

  it('talerze na stronę: gryf 20 kg, reszta po równo', () => {
    expect(platesPerSide(60)).toBe(20);
    expect(platesPerSide(20)).toBe(0);
    expect(platesPerSide(15)).toBe(0);
  });
});

describe('rozgrzewka', () => {
  it('ciężki ruch ze sztangą dostaje serie dochodzące od pustego gryfu, co 2,5 kg, poniżej ciężaru roboczego', () => {
    const s = freshState();
    s.prog.squat_back!.weight = 80;
    const w = warmupFor(s, byId('legs-gym'));
    const ramp = w.ramps.find((r) => r.id === 'squat_back')!;
    expect(ramp.sets[0]).toEqual({ kg: 20, reps: 10 });
    ramp.sets.forEach((x) => {
      expect(x.kg % 2.5).toBe(0);
      expect(x.kg).toBeLessThan(80);
    });
    expect(w.general).toMatch(/5 min/);
  });

  it('w domu rozgrzewka bez sprzętu cardio, a pierwszy ruch zaczyna się spokojnie', () => {
    const w = warmupFor(freshState(), byId('A'));
    expect(w.general).not.toMatch(/bieżn|ergometr/);
    expect(w.ramps[0]!.id).toBe('swing2');
  });
});

describe('zamiana ćwiczenia w sesji', () => {
  it('zamienniki to ćwiczenia spoza treningu — nie podsuwa tego, co i tak za chwilę wypada', async () => {
    const { altsFor } = await import('./structure');
    const legs = byId('legs-gym');
    expect(altsFor('legpress', legs)).toEqual(['hacksquat', 'bulgarian']);
    // Wspięcia na suwnicy w treningu z wspięciami siedząc dostałyby siebie nawzajem.
    const w: Workout = { id: 'x', name: 'x', gear: 'gym', items: [{ ex: 'calf_press' }, { ex: 'calf_seated' }] };
    expect(altsFor('calf_press', w)).toEqual(['calf1']);
  });
});
