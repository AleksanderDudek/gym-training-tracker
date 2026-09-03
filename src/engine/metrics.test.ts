import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import {
  bestE1rm,
  bestSingleSet,
  comebacksHeld,
  dailyTotals,
  dayStreak,
  heaviestBell,
  heldForm,
  metrics,
  noDropDays,
  repsByGroup,
  stageSum,
  steadyWeeks,
  wentHeavier,
  windowMax,
} from './metrics';
import type { AppState, LogEntry, LogItem } from '../types';

const item = (id: string, reps: number[], w: number | null = 16): LogItem => ({
  id,
  sets: reps.map((r) => ({ reps: r, w })),
  effort: 'solid',
});

const entry = (date: string, items: LogItem[], hour = 18): LogEntry => ({
  date: `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`,
  workout: 'Trening A',
  ready: 'ok',
  items,
});

const stateWith = (log: LogEntry[]): AppState => {
  const s = freshState();
  s.log = log;
  return s;
};

describe('sumy dobowe', () => {
  it('liczy serie, powtórzenia i wpisy ćwiczeń', () => {
    const [d] = dailyTotals([entry('2026-08-31', [item('swing2', [10, 10]), item('goblet', [8])])]);
    expect(d!.workouts).toBe(1);
    expect(d!.sets).toBe(3);
    expect(d!.exercises).toBe(2);
    expect(d!.reps).toBe(28);
  });

  it('ćwiczenie na stronę liczy się dwa razy', () => {
    // `swing1` to swing jednorącz — powtórzenia zapisuje się na stronę.
    const [d] = dailyTotals([entry('2026-08-31', [item('swing1', [10])])]);
    expect(d!.reps).toBe(20);
  });

  it('sekundy nie mieszają się z powtórzeniami', () => {
    // `carry` liczy się na czas i na stronę.
    const [d] = dailyTotals([entry('2026-08-31', [item('carry', [30]), item('swing2', [10])])]);
    expect(d!.secs).toBe(60);
    expect(d!.reps).toBe(10);
  });

  it('pomija serie bez wyniku', () => {
    const [d] = dailyTotals([entry('2026-08-31', [item('swing2', [0, 0])])]);
    expect(d!.sets).toBe(0);
    expect(d!.exercises).toBe(0);
  });

  it('dwa treningi tego samego dnia to jeden dzień i dwie sesje', () => {
    const days = dailyTotals([
      entry('2026-08-31', [item('swing2', [10])]),
      entry('2026-08-31', [item('swing2', [10])], 20),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]!.workouts).toBe(2);
    expect(days[0]!.reps).toBe(20);
  });

  it('nieznane ćwiczenie z importu nie wysadza liczenia', () => {
    const [d] = dailyTotals([entry('2026-08-31', [item('cos-usunietego', [10])])]);
    expect(d!.reps).toBe(10);
    expect(d!.sets).toBe(1);
  });
});

describe('rekord z okna czasu', () => {
  const days = dailyTotals([
    entry('2026-08-01', [item('swing2', [10])]),
    entry('2026-08-02', [item('swing2', [10])]),
    entry('2026-08-03', [item('swing2', [10])]),
    // Przerwa, a potem gęstszy blok.
    entry('2026-08-20', [item('swing2', [20])]),
    entry('2026-08-21', [item('swing2', [20])]),
    entry('2026-08-22', [item('swing2', [20])]),
    entry('2026-08-23', [item('swing2', [20])]),
  ]);

  it('bierze najlepsze okno, nie ostatnie', () => {
    expect(windowMax(days, 7, (d) => d.workouts)).toBe(4);
    expect(windowMax(days, 7, (d) => d.reps)).toBe(80);
  });

  it('okno jednodniowe to najlepszy pojedynczy dzień', () => {
    expect(windowMax(days, 1, (d) => d.reps)).toBe(20);
  });

  it('okno dłuższe niż historia obejmuje całość', () => {
    expect(windowMax(days, 365, (d) => d.workouts)).toBe(7);
  });

  it('okno przesuwa się po dniach kalendarza, nie po sesjach', () => {
    // Cztery sesje mieszczą się w 14 dniach dopiero przy oknie sięgającym obu bloków.
    expect(windowMax(days, 30, (d) => d.workouts)).toBe(7);
    expect(windowMax(days, 3, (d) => d.workouts)).toBe(3);
  });

  it('pusta historia daje zero', () => {
    expect(windowMax([], 7, (d) => d.workouts)).toBe(0);
  });
});

describe('utrzymany rytm', () => {
  const week = (monday: string, n: number): LogEntry[] =>
    Array.from({ length: n }, (_, i) =>
      entry(
        new Date(Date.parse(`${monday}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
        [item('swing2', [10])],
      ),
    );

  it('liczy kolejne tygodnie z dwoma treningami', () => {
    const log = [...week('2026-08-03', 2), ...week('2026-08-10', 3), ...week('2026-08-17', 2)];
    expect(steadyWeeks(dailyTotals(log))).toBe(3);
  });

  it('chudy tydzień przerywa ciąg', () => {
    const log = [...week('2026-08-03', 2), ...week('2026-08-10', 1), ...week('2026-08-17', 2)];
    expect(steadyWeeks(dailyTotals(log))).toBe(1);
  });

  it('pusty tydzień też przerywa ciąg', () => {
    const log = [...week('2026-08-03', 2), ...week('2026-08-17', 2)];
    expect(steadyWeeks(dailyTotals(log))).toBe(1);
  });
});

describe('utrzymanie poziomu', () => {
  const hist = (points: { d: string; w: number | null; e1rm: number | null }[]) =>
    points.map((p) => ({ d: p.d, w: p.w, reps: [10], eff: 'solid' as const, e1rm: p.e1rm }));

  it('liczy dni bez zejścia z ciężaru do ostatniego treningu', () => {
    const s = stateWith([
      entry('2026-06-01', [item('swing2', [10])]),
      entry('2026-08-31', [item('swing2', [10])]),
    ]);
    s.prog['swing2']!.hist = hist([
      { d: '2026-06-01', w: 16, e1rm: 20 },
      { d: '2026-08-31', w: 16, e1rm: 20 },
    ]);
    expect(noDropDays(s, dailyTotals(s.log))).toBe(91);
  });

  it('zejście z ciężaru zeruje licznik do dnia zejścia', () => {
    const s = stateWith([
      entry('2026-06-01', [item('swing2', [10])]),
      entry('2026-08-01', [item('swing2', [10])]),
      entry('2026-08-31', [item('swing2', [10])]),
    ]);
    s.prog['swing2']!.hist = hist([
      { d: '2026-06-01', w: 20, e1rm: 25 },
      { d: '2026-08-01', w: 16, e1rm: 20 },
      { d: '2026-08-31', w: 16, e1rm: 20 },
    ]);
    expect(noDropDays(s, dailyTotals(s.log))).toBe(30);
  });

  it('zaprzestanie treningów nie nabija passy', () => {
    const s = stateWith([entry('2026-06-01', [item('swing2', [10])])]);
    s.prog['swing2']!.hist = hist([{ d: '2026-06-01', w: 16, e1rm: 20 }]);
    expect(noDropDays(s, dailyTotals(s.log))).toBe(0);
  });

  it('trzymana forma to stanie blisko własnego szczytu', () => {
    const s = stateWith([]);
    const p = s.prog['swing2']!;
    p.hist = hist([
      { d: '2026-06-01', w: 16, e1rm: 20 },
      { d: '2026-06-05', w: 16, e1rm: 24 },
      { d: '2026-06-09', w: 16, e1rm: 25 },
      { d: '2026-06-13', w: 16, e1rm: 25 },
      { d: '2026-06-17', w: 16, e1rm: 24.5 },
      { d: '2026-06-21', w: 16, e1rm: 24.5 },
    ]);
    p.e1rm = 24.5;
    expect(heldForm(s)).toBe(1);

    // Zjazd o piętnaście procent od szczytu to już nie jest trzymanie poziomu.
    p.e1rm = 21;
    expect(heldForm(s)).toBe(0);
  });

  it('krótka historia nie liczy się jako trzymanie poziomu', () => {
    const s = stateWith([]);
    s.prog['swing2']!.hist = hist([
      { d: '2026-06-01', w: 16, e1rm: 25 },
      { d: '2026-06-05', w: 16, e1rm: 25 },
    ]);
    s.prog['swing2']!.e1rm = 25;
    expect(heldForm(s)).toBe(0);
  });

  it('cięższy kettlebell niż na starcie liczy się jako awans', () => {
    const s = stateWith([]);
    s.prog['swing2']!.hist = hist([
      { d: '2026-06-01', w: 16, e1rm: 20 },
      { d: '2026-06-09', w: 20, e1rm: 25 },
    ]);
    expect(wentHeavier(s)).toBe(1);
  });
});

describe('powrót do poziomu', () => {
  it('liczy powrót po przerwie, gdy ciężar wrócił na swoje', () => {
    const log = [
      entry('2026-06-01', [item('swing2', [10], 20)]),
      entry('2026-07-01', [item('swing2', [10], 16)]),
      entry('2026-07-05', [item('swing2', [10], 20)]),
    ];
    expect(comebacksHeld(log)).toBe(1);
  });

  it('nie liczy powrotu, który skończył się na lżejszym ciężarze', () => {
    const log = [
      entry('2026-06-01', [item('swing2', [10], 24)]),
      entry('2026-07-01', [item('swing2', [10], 16)]),
      entry('2026-07-05', [item('swing2', [10], 16)]),
    ];
    expect(comebacksHeld(log)).toBe(0);
  });

  it('nie liczy zwykłej przerwy krótszej niż dwa tygodnie', () => {
    const log = [
      entry('2026-06-01', [item('swing2', [10], 20)]),
      entry('2026-06-08', [item('swing2', [10], 20)]),
    ];
    expect(comebacksHeld(log)).toBe(0);
  });
});

describe('rekordy pojedynczych podejść', () => {
  it('najdłuższa seria liczy stronę osobno i nie miesza się z czasem', () => {
    const log = [
      entry('2026-08-31', [item('swing2', [30, 20]), item('swing1', [18]), item('carry', [45])]),
    ];
    const best = bestSingleSet(log);
    // Swing jednorącz 18 na stronę to 36 powtórzeń — więcej niż trzydzieści obunóż.
    expect(best.reps).toBe(36);
    // Spacer na stronę: czterdzieści pięć sekund na rękę to dziewięćdziesiąt sekund pracy.
    expect(best.secs).toBe(90);
  });

  it('najcięższy kettlebell bierze maksimum z całej historii', () => {
    const log = [
      entry('2026-08-31', [item('swing2', [10], 16)]),
      entry('2026-09-02', [item('swing2', [10], 24), item('goblet', [8], 16)]),
    ];
    expect(heaviestBell(log)).toBe(24);
    expect(heaviestBell([])).toBe(0);
  });

  it('najwyższe maksimum bierze też punkty z historii, nie tylko stan bieżący', () => {
    const s = stateWith([]);
    const p = s.prog['swing2']!;
    p.hist = [
      { d: '2026-06-01', w: 16, reps: [10], eff: 'solid', e1rm: 28 },
      { d: '2026-06-09', w: 16, reps: [10], eff: 'solid', e1rm: 22 },
    ];
    p.e1rm = 22;
    expect(bestE1rm(s)).toBe(28);
  });
});

describe('dni z rzędu', () => {
  it('liczy najdłuższy ciąg kolejnych dni z treningiem', () => {
    const log = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-10', '2026-08-11'].map((d) =>
      entry(d, [item('swing2', [10])]),
    );
    expect(dayStreak(dailyTotals(log))).toBe(3);
  });

  it('dwa treningi jednego dnia to wciąż jeden dzień', () => {
    const log = [
      entry('2026-08-01', [item('swing2', [10])]),
      entry('2026-08-01', [item('swing2', [10])], 20),
    ];
    expect(dayStreak(dailyTotals(log))).toBe(1);
  });

  it('pusta historia daje zero', () => {
    expect(dayStreak([])).toBe(0);
  });
});

describe('objętość partiami', () => {
  it('rozdziela powtórzenia na wzorce ruchowe', () => {
    const log = [
      entry('2026-08-31', [item('swing2', [10]), item('goblet', [8]), item('press', [5])]),
    ];
    const g = repsByGroup(log);
    expect(g['Zawias biodrowy']).toBe(10);
    expect(g['Przysiad']).toBe(8);
    // Wyciskanie jest na stronę.
    expect(g['Pchanie']).toBe(10);
  });

  it('ćwiczenia liczone na czas nie wchodzą do objętości partii', () => {
    const g = repsByGroup([entry('2026-08-31', [item('carry', [40]), item('core', [12])])]);
    expect(g['Core i carry']).toBe(12);
  });

  it('każda partia z biblioteki ma swój licznik, choćby zerowy', () => {
    const g = repsByGroup([]);
    expect(g['Zawias biodrowy']).toBe(0);
    expect(Object.keys(g).length).toBeGreaterThanOrEqual(7);
  });
});

describe('etapy z masą ciała', () => {
  it('sumuje etapy tylko z ćwiczeń, które je mają', () => {
    const s = stateWith([]);
    // Świeży stan: pompki startują od pierwszego etapu, reszta od zerowego.
    expect(stageSum(s)).toBe(1);
    s.prog['pullup']!.stage = 2;
    s.prog['core']!.stage = 3;
    expect(stageSum(s)).toBe(6);
  });
});

describe('zestaw metryk', () => {
  it('pusta historia daje same zera bez wyjątków', () => {
    const m = metrics(freshState());
    expect(m.workouts).toBe(0);
    expect(m.reps).toBe(0);
    expect(m.tonnage).toBe(0);
    expect(m.best.weekWorkouts).toBe(0);
    expect(m.steadyWeeks).toBe(0);
    expect(m.noDropDays).toBe(0);
  });

  it('spina sumy, rekordy i różnorodność ćwiczeń', () => {
    const s = stateWith([
      entry('2026-08-31', [item('swing2', [10, 10]), item('goblet', [8])]),
      entry('2026-09-02', [item('swing2', [12])]),
    ]);
    const m = metrics(s);
    expect(m.workouts).toBe(2);
    expect(m.sets).toBe(4);
    expect(m.exercises).toBe(3);
    expect(m.distinct).toBe(2);
    expect(m.reps).toBe(40);
    expect(m.tonnage).toBe(40 * 16);
    expect(m.best.dayReps).toBe(28);
    expect(m.best.weekWorkouts).toBe(2);
  });

  it('dłuższe okna obejmują co najmniej tyle, co krótsze', () => {
    const log = Array.from({ length: 40 }, (_, i) =>
      entry(new Date(Date.parse('2026-01-05T18:00:00Z') + i * 5 * 86_400_000).toISOString().slice(0, 10), [
        item('swing2', [10, 10]),
      ]),
    );
    const b = metrics(stateWith(log)).best;
    expect(b.weekWorkouts).toBeLessThanOrEqual(b.twoWeekWorkouts);
    expect(b.twoWeekWorkouts).toBeLessThanOrEqual(b.threeWeekWorkouts);
    expect(b.threeWeekWorkouts).toBeLessThanOrEqual(b.monthWorkouts);
    expect(b.monthWorkouts).toBeLessThanOrEqual(b.quarterWorkouts);
    expect(b.quarterWorkouts).toBeLessThanOrEqual(b.halfYearWorkouts);
    expect(b.halfYearWorkouts).toBeLessThanOrEqual(b.yearWorkouts);
    expect(b.weekReps).toBeLessThanOrEqual(b.yearReps);
  });

  it('najcięższa sesja nie liczy sekund jako kilogramów', () => {
    const s = stateWith([entry('2026-08-31', [item('swing2', [10], 20), item('carry', [40], 20)])]);
    expect(metrics(s).best.sessionTonnage).toBe(200);
  });

  it('tonaż dorobku nie liczy sekund jako kilogramów', () => {
    // Czterdzieści sekund marszu z dwudziestką to nie jest osiemset kilogramów podniesionych.
    const s = stateWith([entry('2026-08-31', [item('swing2', [10], 20), item('carry', [40], 20)])]);
    expect(metrics(s).tonnage).toBe(200);
    expect(metrics(s).secs).toBe(80);
  });

  it('tonaż liczy stronę osobno, tak samo jak powtórzenia', () => {
    const s = stateWith([entry('2026-08-31', [item('swing1', [10], 16)])]);
    expect(metrics(s).reps).toBe(20);
    expect(metrics(s).tonnage).toBe(320);
  });

  it('rozpoznaje trening zamknięty przed ósmą rano', () => {
    const early = new Date('2026-08-31T06:30:00.000Z').getHours() < 8;
    const s = stateWith([entry('2026-08-31', [item('swing2', [10])], 6)]);
    expect(metrics(s).early).toBe(early);
  });
});
