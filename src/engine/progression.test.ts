import { describe, expect, it } from 'vitest';
import { freshState, P, plan, planLabel } from './plan';
import { applyLayoff, applyResult, judge } from './progression';
import { acwr, epley, repsAt, round1 } from './math';
import { ALL, EX } from '../data/exercises';
import type { AppState, EffortKey, LogEntry, SetResult } from '../types';

/**
 * Stan po kalibracji — poziomy takie, jakie ćwiczenia miały zanim doszła faza próbna.
 * Testy progresji dotyczą tego, co dzieje się PO ustaleniu poziomu, więc startują stąd.
 */
const calibrated = (): AppState => {
  const s = freshState();
  ALL.forEach((id) => {
    const p = P(s, id);
    const d = EX[id]!.def;
    p.phase = 'work';
    p.weight = d.w ?? null;
    p.target = d.target;
    p.e1rm = d.w ? round1(epley(d.w, d.target)) : null;
  });
  return s;
};

const session = (s: AppState): AppState => {
  s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
  return s;
};

const perfect = (s: AppState, id: string): SetResult[] =>
  plan(s, id).map((r) => ({ reps: r.reps, w: r.w }));

const runSession = (s: AppState, id: string, effort: EffortKey = 'solid') =>
  applyResult(s, id, perfect(s, id), effort, false);

describe('wzory obciążenia', () => {
  it('Epley liczy maksimum i odwrotność', () => {
    expect(epley(100, 5)).toBeCloseTo(116.67, 1);
    expect(repsAt(116.67, 100)).toBe(5);
  });
});

describe('podwójna progresja grindu', () => {
  it('podnosi powtórzenia do szczytu zakresu, potem zaczyna przejście ciężaru', () => {
    const s = session(calibrated());
    const p = P(s, 'goblet');
    expect(p.target).toBe(8);

    for (let i = 8; i < 12; i++) {
      runSession(s, 'goblet');
      expect(P(s, 'goblet').target).toBe(i + 1);
    }
    expect(P(s, 'goblet').trans).toBeNull();

    const change = runSession(s, 'goblet');
    expect(change?.type).toBe('level');
    expect(P(s, 'goblet').trans).not.toBeNull();
    expect(P(s, 'goblet').trans!.to).toBe(20);
    expect(P(s, 'goblet').trans!.heavySets).toBe(1);
  });

  it('cel zaliczony bez zapasu nie daje awansu', () => {
    const s = session(calibrated());
    const before = P(s, 'goblet').target;
    const c = runSession(s, 'goblet', 'max');
    expect(c?.type).toBe('hold');
    expect(P(s, 'goblet').target).toBe(before);
  });

  it('trzy sesje bez zapasu z rzędu obniżają cel', () => {
    const s = session(calibrated());
    P(s, 'goblet').target = 11;
    runSession(s, 'goblet', 'max');
    runSession(s, 'goblet', 'max');
    const c = runSession(s, 'goblet', 'max');
    expect(c?.type).toBe('down');
    expect(P(s, 'goblet').target).toBe(10);
  });
});

describe('przejście na cięższy kettlebell', () => {
  it('dokłada ciężką serię co sesję i domyka się na ostatniej', () => {
    const s = session(calibrated());
    const p = P(s, 'goblet');
    p.target = 12;
    p.e1rm = 23;

    runSession(s, 'goblet');
    expect(p.trans!.heavySets).toBe(1);
    expect(planLabel(s, 'goblet')).toContain('20 kg');
    expect(planLabel(s, 'goblet')).toContain('16 kg');

    runSession(s, 'goblet');
    expect(p.trans!.heavySets).toBe(2);

    const c = runSession(s, 'goblet');
    expect(c?.type).toBe('level');
    expect(p.trans).toBeNull();
    expect(p.weight).toBe(20);
    expect(p.target).toBeLessThan(12);
    expect(p.target).toBeGreaterThanOrEqual(4);
  });

  it('mieszane obciążenie ma osobny ciężar w każdej serii', () => {
    const s = session(calibrated());
    P(s, 'goblet').trans = { to: 20, heavySets: 1, reps: 4 };
    P(s, 'goblet').target = 12;
    const rows = plan(s, 'goblet');
    expect(rows[0]).toMatchObject({ w: 20, reps: 4, heavy: true });
    expect(rows[1]).toMatchObject({ w: 16, reps: 12 });
    expect(rows).toHaveLength(3);
  });
});

describe('balistyka', () => {
  it('rośnie seriami, nie powtórzeniami', () => {
    const s = session(calibrated());
    const p = P(s, 'swing2');
    expect(p.sets).toBe(4);
    runSession(s, 'swing2');
    expect(p.sets).toBe(5);
    expect(p.target).toBe(10);
  });

  it('po ośmiu seriach zaczyna przejście ciężaru', () => {
    const s = session(calibrated());
    const p = P(s, 'swing2');
    p.sets = 8;
    runSession(s, 'swing2');
    expect(p.trans?.to).toBe(24);
  });
});

describe('regres', () => {
  it('wymaga dwóch słabych sesji z rzędu', () => {
    const s = session(calibrated());
    P(s, 'goblet').target = 11;
    const weak = (): SetResult[] => plan(s, 'goblet').map((r) => ({ reps: r.reps - 3, w: r.w }));

    expect(applyResult(s, 'goblet', weak(), 'max', false)).toBeNull();
    const c = applyResult(s, 'goblet', weak(), 'max', false);
    expect(c?.type).toBe('down');
    expect(P(s, 'goblet').target).toBe(10);
  });
});

describe('ocena sesji', () => {
  it('niepełna liczba serii nie daje awansu', () => {
    const s = session(calibrated());
    expect(judge(s, 'goblet', [{ reps: 8, w: 16 }, { reps: 8, w: 16 }], 'solid')).toBe('hold');
  });
});

describe('gorszy dzień', () => {
  it('obniża dzisiejszy cel bez ruszania poziomu', () => {
    const s = session(calibrated());
    expect(plan(s, 'goblet')[0]!.reps).toBe(8);
    s.session!.ready = 'low';
    expect(plan(s, 'goblet')[0]!.reps).toBe(7);
    expect(P(s, 'goblet').target).toBe(8);
  });
});

describe('przerwa w treningach', () => {
  const setup = () => {
    const s = calibrated();
    P(s, 'goblet').target = 12;
    P(s, 'goblet').e1rm = 23;
    return s;
  };

  it('do 10 dni nic nie zmienia', () => {
    expect(applyLayoff(setup(), 9)).toBeNull();
  });

  it('11–20 dni tylko ostrzega', () => {
    const s = setup();
    const n = applyLayoff(s, 14);
    expect(n).not.toBeNull();
    expect(P(s, 'goblet').target).toBe(12);
  });

  it('21–42 dni cofa cele, ale zostawia ciężar', () => {
    const s = setup();
    applyLayoff(s, 30);
    expect(P(s, 'goblet').target).toBe(8);
    expect(P(s, 'goblet').weight).toBe(16);
  });

  it('powyżej sześciu tygodni obniża szacowane maksimum', () => {
    const s = setup();
    applyLayoff(s, 70);
    expect(P(s, 'goblet').e1rm).toBeCloseTo(20.7, 1);
  });
});

describe('obciążenie w czasie', () => {
  it('wykrywa skok tygodniowego tonażu', () => {
    const s = freshState();
    const now = Date.now();
    const at = (days: number, tonnage: number): LogEntry => ({
      date: new Date(now - days * 86_400_000).toISOString(),
      workout: 'X',
      ready: 'ok',
      items: [{ id: 'goblet', sets: [{ reps: 10, w: tonnage / 10 }], effort: 'solid' }],
    });
    s.log = [26, 23, 19, 16, 12, 9, 5, 2].map((d) => at(d, 1000));
    expect(acwr(s, now)).toBeCloseTo(1, 1);

    s.log.push(at(1, 3000), at(0, 3000));
    expect(acwr(s, now)!).toBeGreaterThan(1.5);
  });

  it('nie liczy wskaźnika przy zbyt krótkiej historii', () => {
    const s = freshState();
    expect(acwr(s)).toBeNull();
  });
});

describe('kalibracja poziomu startowego', () => {
  const testSet = (s: AppState, id: string, reps: number): SetResult[] => [
    { reps, w: P(s, id).weight },
  ];

  it('zaczyna od połowy domyślnego obciążenia i jednej serii próbnej', () => {
    const s = session(freshState());
    expect(P(s, 'goblet').phase).toBe('calib');
    expect(P(s, 'goblet').weight).toBe(8);
    const rows = plan(s, 'goblet');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amrap).toBe(true);
    expect(planLabel(s, 'goblet')).toContain('próba');
  });

  it('nie zgaduje maksimum, dopóki nie ma żadnego wyniku', () => {
    expect(P(freshState(), 'goblet').e1rm).toBeNull();
  });

  it('początkującemu, dla którego start jest za ciężki, schodzi ciężar', () => {
    const s = session(freshState());
    // 6 powtórzeń przy dolnej granicy 8 — próba wraca na lżejszym kettlebellu.
    applyResult(s, 'goblet', testSet(s, 'goblet', 6), 'solid', false);
    expect(P(s, 'goblet').phase).toBe('calib');
    expect(P(s, 'goblet').weight).toBe(6);

    applyResult(s, 'goblet', testSet(s, 'goblet', 9), 'solid', false);
    const p = P(s, 'goblet');
    expect(p.phase).toBe('work');
    expect(p.weight).toBe(6);
    expect(p.target).toBe(9);
  });

  it('lżejsze kettlebelle dają dokąd zejść poniżej ośmiu kilogramów', () => {
    const s = session(freshState());
    expect(s.cfg.weights.slice(0, 3)).toEqual([4, 6, 8]);
  });

  it('duża nadwyżka przeskakuje więcej niż jeden rozmiar', () => {
    const s = session(freshState());
    // Dwa razy ponad szczyt zakresu (12) to dwa rozmiary w górę: 8 -> 16.
    applyResult(s, 'goblet', testSet(s, 'goblet', 26), 'solid', false);
    expect(P(s, 'goblet').weight).toBe(16);
  });

  it('zaawansowany wchodzi po drabinie w górę, aż wynik wpadnie w zakres', () => {
    const s = session(freshState());

    applyResult(s, 'goblet', testSet(s, 'goblet', 20), 'solid', false);
    expect(P(s, 'goblet').phase).toBe('calib');
    expect(P(s, 'goblet').weight).toBe(12);

    applyResult(s, 'goblet', testSet(s, 'goblet', 14), 'solid', false);
    expect(P(s, 'goblet').weight).toBe(16);

    applyResult(s, 'goblet', testSet(s, 'goblet', 10), 'solid', false);
    const p = P(s, 'goblet');
    expect(p.phase).toBe('work');
    expect(p.weight).toBe(16);
    expect(p.target).toBe(10);
  });

  it('wynik bez zapasu liczy się o stopień niżej', () => {
    const s = session(freshState());
    applyResult(s, 'goblet', testSet(s, 'goblet', 10), 'max', false);
    expect(P(s, 'goblet').target).toBe(9);
  });

  it('drabina nie kręci się w nieskończoność', () => {
    const s = session(freshState());
    for (let i = 0; i < 6; i++) applyResult(s, 'goblet', testSet(s, 'goblet', 30), 'solid', false);
    expect(P(s, 'goblet').phase).toBe('work');
  });

  it('balistyka kalibruje się oceną wysiłku, nie serią na maksa', () => {
    const s = session(freshState());
    expect(plan(s, 'swing2')[0]!.amrap).toBeUndefined();

    applyResult(s, 'swing2', [{ reps: 10, w: 8 }], 'easy', false);
    expect(P(s, 'swing2').phase).toBe('calib');
    expect(P(s, 'swing2').weight).toBe(12);

    applyResult(s, 'swing2', [{ reps: 10, w: 12 }], 'solid', false);
    const p = P(s, 'swing2');
    expect(p.phase).toBe('work');
    expect(p.sets).toBe(p.minSets);
    expect(p.target).toBe(10);
  });
});

describe('nadwyżka nad celem', () => {
  const sets = (n: number, reps: number, w: number | null): SetResult[] =>
    Array.from({ length: n }, () => ({ reps, w }));

  it('podnosi cel do osiągniętego wyniku, a nie o jedno powtórzenie', () => {
    const s = session(calibrated());
    expect(P(s, 'goblet').target).toBe(8);
    const c = applyResult(s, 'goblet', sets(3, 11, 16), 'solid', false);
    expect(P(s, 'goblet').target).toBe(11);
    expect(c?.text).toContain('przeskoczył');
  });

  it('liczy najsłabszą serię, bo awans wymaga kompletu', () => {
    const s = session(calibrated());
    applyResult(s, 'goblet', [{ reps: 12, w: 16 }, { reps: 9, w: 16 }, { reps: 12, w: 16 }], 'solid', false);
    expect(P(s, 'goblet').target).toBe(9);
  });

  it('wynik sięgający szczytu zakresu od razu otwiera przejście ciężaru', () => {
    const s = session(calibrated());
    applyResult(s, 'goblet', sets(3, 13, 16), 'solid', false);
    expect(P(s, 'goblet').trans?.to).toBe(20);
  });

  it('zapas „Łatwo” dokłada stopień ponad zapisany wynik', () => {
    const s = session(calibrated());
    applyResult(s, 'goblet', sets(3, 9, 16), 'easy', false);
    expect(P(s, 'goblet').target).toBe(10);
  });

  it('balistyka z zapasem dokłada dwie serie zamiast jednej', () => {
    const s = session(calibrated());
    expect(P(s, 'swing2').sets).toBe(4);
    applyResult(s, 'swing2', sets(4, 10, 20), 'easy', false);
    expect(P(s, 'swing2').sets).toBe(6);
  });
});

describe('test kontrolny', () => {
  const sets = (n: number, reps: number, w: number | null): SetResult[] =>
    Array.from({ length: n }, () => ({ reps, w }));

  it('włącza się po dwóch sesjach z rzędu na „Łatwo”', () => {
    const s = session(calibrated());
    applyResult(s, 'goblet', sets(3, 8, 16), 'easy', false);
    expect(P(s, 'goblet').probe).toBe(false);
    applyResult(s, 'goblet', sets(3, 9, 16), 'easy', false);
    expect(P(s, 'goblet').probe).toBe(true);
  });

  it('włącza się rutynowo co kilka sesji', () => {
    const s = session(calibrated());
    for (let i = 0; i < 6; i++) applyResult(s, 'goblet', sets(3, 8, 16), 'solid', false);
    expect(P(s, 'goblet').probe).toBe(true);
  });

  it('zdejmuje sufit z ostatniej serii', () => {
    const s = session(calibrated());
    P(s, 'goblet').probe = true;
    const rows = plan(s, 'goblet');
    expect(rows[0]!.amrap).toBeUndefined();
    expect(rows[rows.length - 1]!.amrap).toBe(true);
    expect(planLabel(s, 'goblet')).toContain('test');
  });

  it('wynik testu przestawia poziom i gaśnie do następnego razu', () => {
    const s = session(calibrated());
    const p = P(s, 'goblet');
    p.probe = true;
    applyResult(s, 'goblet', [{ reps: 8, w: 16 }, { reps: 8, w: 16 }, { reps: 14, w: 16 }], 'solid', false);
    expect(p.trans?.to).toBe(20);
    expect(p.probe).toBe(false);
    expect(p.sinceProbe).toBe(0);
  });

  it('nie przeszkadza w trakcie przejścia na cięższy kettlebell', () => {
    const s = session(calibrated());
    const p = P(s, 'goblet');
    p.trans = { to: 20, heavySets: 1, reps: 5 };
    p.easyRun = 5;
    applyResult(s, 'goblet', [{ reps: 5, w: 20 }, { reps: 8, w: 16 }, { reps: 8, w: 16 }], 'easy', false);
    expect(p.probe).toBe(false);
  });
});

describe('szacowane maksimum a seria próbna', () => {
  const testSet = (s: AppState, id: string, reps: number): SetResult[] => [
    { reps, w: P(s, id).weight },
  ];

  it('próba nie liczy maksimum, bo Epley kłamie przy kilkunastu powtórzeniach', () => {
    const s = session(freshState());
    applyResult(s, 'goblet', testSet(s, 'goblet', 20), 'solid', false);
    // Wciąż faza próbna: żadnego maksimum jeszcze nie ma.
    expect(P(s, 'goblet').phase).toBe('calib');
    expect(P(s, 'goblet').e1rm).toBeNull();
  });

  it('maksimum pojawia się dopiero z ustalonego poziomu', () => {
    const s = session(freshState());
    applyResult(s, 'goblet', testSet(s, 'goblet', 10), 'solid', false);
    const p = P(s, 'goblet');
    expect(p.phase).toBe('work');
    expect(p.e1rm).toBeCloseTo(epley(p.weight!, p.target), 1);
  });

  it('przejście nigdy nie przepisuje jednego powtórzenia', () => {
    const s = session(calibrated());
    const p = P(s, 'goblet');
    p.target = 12;
    // Zaniżone maksimum: bez podłogi odwrócony Epley wychodzi tu ujemny.
    p.e1rm = 17.9;
    applyResult(s, 'goblet', [{ reps: 12, w: 16 }, { reps: 12, w: 16 }, { reps: 12, w: 16 }], 'solid', false);
    expect(p.trans!.to).toBe(20);
    expect(p.trans!.reps).toBeGreaterThanOrEqual(4);
  });

  it('pełna ścieżka: próba, awans z nadwyżki, test kontrolny, przejście', () => {
    const s = session(freshState());
    // Próba wskazuje 16 kg jako poziom startowy.
    applyResult(s, 'goblet', testSet(s, 'goblet', 20), 'solid', false);
    applyResult(s, 'goblet', testSet(s, 'goblet', 14), 'solid', false);
    applyResult(s, 'goblet', testSet(s, 'goblet', 9), 'solid', false);
    const p = P(s, 'goblet');
    expect(p.phase).toBe('work');
    expect(p.weight).toBe(16);
    expect(p.target).toBe(9);

    // Test kontrolny pokazuje wynik ponad zakresem — przejście rusza z sensowną liczbą powtórzeń.
    p.probe = true;
    applyResult(s, 'goblet', [{ reps: 9, w: 16 }, { reps: 9, w: 16 }, { reps: 15, w: 16 }], 'solid', false);
    expect(p.trans!.to).toBe(20);
    expect(p.trans!.reps).toBeGreaterThanOrEqual(4);
    expect(p.trans!.reps).toBeLessThanOrEqual(12);
  });
});
