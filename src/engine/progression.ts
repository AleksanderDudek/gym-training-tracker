import { ALL, STAGES, WEIGHTED, ex } from '../data/exercises';
import { e1rmFromSession, epley, repsAt, round1 } from './math';
import {
  EASY_RUN_PROBE,
  MAX_CALIB_RUNS,
  P,
  PROBE_EVERY,
  floorReps,
  nextWeight,
  plan,
  prevWeight,
  step,
} from './plan';
import type {
  AppState,
  Change,
  EffortKey,
  ExerciseId,
  Notice,
  SetResult,
} from '../types';

export type Verdict = 'up' | 'hold' | 'hold-max' | 'down' | 'none';

/**
 * Ocena jednego ćwiczenia w sesji.
 * Kluczowy warunek: cel zaliczony bez zapasu powtórzeń nie daje awansu.
 */
export function judge(
  state: AppState,
  id: ExerciseId,
  rows: SetResult[],
  effort: EffortKey,
): Verdict {
  const prescribed = plan(state, id);
  const done = rows.filter((r) => r.reps > 0);
  if (!done.length) return 'none';

  const met =
    done.length >= prescribed.length &&
    done.every((r, i) => r.reps >= (prescribed[i]?.reps ?? 0));
  const short = done.some((r, i) => {
    const target = prescribed[i]?.reps;
    return target !== undefined && r.reps <= target - 2 * step(id);
  });
  const reserve = effort !== 'max';

  if (met && reserve) return 'up';
  if (met && !reserve) return 'hold-max';
  if (short) return 'down';
  return 'hold';
}

/** Ile powtórzeń na nowym ciężarze — z szacowanego maksimum wzorem Epleya. */
export function transReps(state: AppState, id: ExerciseId, w: number): number {
  const p = P(state, id);
  const m = ex(id);
  if (m.unit === 'secs' && p.weight)
    return Math.max(10, Math.round((p.target * p.weight) / w / 5) * 5);
  // Balistyka: te same powtórzenia, po prostu mniej ciężkich serii na start.
  if (m.mode === 'ballistic') return p.target;
  if (!p.e1rm) return p.min;
  // Podłoga z połowy dolnej granicy zakresu. Szacowane maksimum bywa zaniżone —
  // seria na jedno powtórzenie nie jest wtedy przepisem na trening, tylko skutkiem błędu wzoru.
  return Math.max(floorReps(state, id), Math.min(p.max, repsAt(p.e1rm, w)));
}

/**
 * Start przejścia. Skok o jeden rozmiar kettlebell to 16–33% obciążenia,
 * więc cięższy bell wchodzi najpierw do jednej serii, a nie do wszystkich naraz.
 */
function startTransition(state: AppState, id: ExerciseId, blockJump: boolean): Change {
  const p = P(state, id);
  const m = ex(id);
  const nxt = nextWeight(state, id);

  if (p.weight === null || !nxt)
    return { type: 'cap', text: `${m.name}: szczyt zakresu. Brak cięższego kettlebell na liście.` };
  if (blockJump)
    return { type: 'held', text: `${m.name}: gotowe do wejścia na ${nxt} kg, skok wstrzymany do następnej sesji.` };

  const reps = transReps(state, id, nxt);
  p.trans = { to: nxt, heavySets: 1, reps };
  return {
    type: 'level',
    text: `${m.name}: ${nxt} kg wchodzi do pierwszej serii — 1 × ${reps}, reszta dalej na ${p.weight} kg.`,
  };
}

/** Kolejna udana sesja w trakcie przejścia dokłada jedną ciężką serię. */
function advanceTransition(state: AppState, id: ExerciseId, blockJump: boolean): Change {
  const p = P(state, id);
  const m = ex(id);
  const t = p.trans!;

  if (blockJump)
    return { type: 'held', text: `${m.name}: kolejna ciężka seria wstrzymana do następnej sesji.` };

  t.reps = Math.max(t.reps, transReps(state, id, t.to));
  t.heavySets++;

  if (t.heavySets < p.sets)
    return { type: 'reps', text: `${m.name}: ${t.to} kg już w ${t.heavySets} seriach z ${p.sets}` };

  const old = p.weight;
  p.weight = t.to;
  p.target =
    m.mode === 'ballistic' ? p.target : Math.max(floorReps(state, id), Math.min(p.max, t.reps));
  if (m.mode === 'ballistic') p.sets = p.minSets;
  p.trans = null;

  return {
    type: 'level',
    text: `${m.name}: przejście domknięte — ${old} → ${p.weight} kg na wszystkich seriach, cel ${p.target}. Stąd powtórzenia znów rosną do ${p.max}.`,
  };
}

/** Cofnięcie po dwóch słabych sesjach z rzędu. */
function regress(state: AppState, id: ExerciseId): Change | null {
  const p = P(state, id);
  const m = ex(id);

  if (p.trans) {
    if (p.trans.heavySets > 1) {
      p.trans.heavySets--;
      return { type: 'down', text: `${m.name}: ciężkich serii z powrotem ${p.trans.heavySets}` };
    }
    p.trans = null;
    return { type: 'down', text: `${m.name}: przejście wstrzymane, wracasz na ${p.weight} kg` };
  }
  if (m.mode === 'ballistic' && p.sets > p.minSets) {
    p.sets--;
    return { type: 'down', text: `${m.name}: ${p.sets + 1} → ${p.sets} serie` };
  }
  const floor = floorReps(state, id);
  if (p.target > floor) {
    p.target = Math.max(floor, p.target - step(id));
    return { type: 'down', text: `${m.name}: cel schodzi na ${p.target}` };
  }
  if (m.mode === 'stage' && m.stages && (p.stage ?? 0) > 0) {
    p.stage = (p.stage ?? 0) - 1;
    p.target = p.max;
    return { type: 'down', text: `${m.name}: etap niżej — ${STAGES[m.stages][p.stage]}` };
  }
  const pw = prevWeight(state, id);
  if (p.weight !== null && pw) {
    p.weight = pw;
    p.target = p.max;
    return { type: 'down', text: `${m.name}: ciężar w dół na ${pw} kg` };
  }
  return null;
}

/**
 * Wynik serii próbnej przełożony na poziom. Celowo nie liczy tu nic wzorem Epleya:
 * przy kilkunastu powtórzeniach z lekkim ciężarem szacowanie maksimum przestaje mieć
 * sens — ogranicznikiem jest wtedy wytrzymałość, nie siła. Prostsza reguła jest
 * uczciwsza: powyżej zakresu ćwiczenie idzie o stopień w górę, poniżej o stopień w dół,
 * a w zakresie wynik po prostu staje się celem.
 */
function placeFromTest(
  state: AppState,
  id: ExerciseId,
  achieved: number,
  effort: EffortKey,
  allowLevelMove: boolean,
): { retry: boolean; text: string } {
  const p = P(state, id);
  const m = ex(id);
  const st = step(id);
  const u = m.unit === 'secs' ? ' s' : '';
  // Wynik bez zapasu zawyża możliwości, więc do poziomu wchodzi o stopień niżej.
  const usable = effort === 'max' ? Math.max(p.min, achieved - st) : achieved;

  if (usable > p.max && allowLevelMove) {
    const nxt = nextWeight(state, id);
    if (p.weight !== null && nxt) {
      p.weight = nxt;
      return { retry: true, text: `${m.name}: ${usable}${u} to za lekko — próba jeszcze raz na ${nxt} kg.` };
    }
    if (m.mode === 'stage' && m.stages) {
      const arr = STAGES[m.stages];
      if ((p.stage ?? 0) < arr.length - 1) {
        p.stage = (p.stage ?? 0) + 1;
        return { retry: true, text: `${m.name}: ${usable} powtórzeń to za łatwy etap — próba na „${arr[p.stage]}”.` };
      }
    }
    if (m.mode === 'body' && p.sets < p.maxSets) {
      p.sets++;
      p.target = p.max;
      return { retry: true, text: `${m.name}: ${usable} powtórzeń w serii — próba jeszcze raz przy ${p.sets} seriach.` };
    }
  }

  if (usable < p.min && allowLevelMove) {
    const pw = prevWeight(state, id);
    if (p.weight !== null && pw) {
      p.weight = pw;
      return { retry: true, text: `${m.name}: ${usable}${u} to za dużo na start — próba jeszcze raz na ${pw} kg.` };
    }
    if (m.mode === 'stage' && m.stages && (p.stage ?? 0) > 0) {
      p.stage = (p.stage ?? 0) - 1;
      const arr = STAGES[m.stages];
      return { retry: true, text: `${m.name}: za trudny etap — próba na „${arr[p.stage]}”.` };
    }
  }

  p.target = Math.max(p.min, Math.min(p.max, usable));
  return { retry: false, text: '' };
}

/**
 * Sesja kalibracyjna. Zamiast zgadywać poziom startowy z tabelki, ćwiczenie zaczyna od
 * jednej serii próbnej na najlżejszym ciężarze i wchodzi po drabinie w górę, aż wynik
 * wpadnie w zakres powtórzeń. Dzięki temu ktoś, kto nigdy nie ćwiczył, nie dostaje od razu
 * 16 kg, a ktoś zaawansowany nie spędza dwudziestu sesji na dochodzeniu do swojego poziomu.
 */
function calibrate(
  state: AppState,
  id: ExerciseId,
  done: SetResult[],
  effort: EffortKey,
): Change {
  const p = P(state, id);
  const m = ex(id);
  p.calibRuns++;

  // Balistyka nie schodzi na maksa — swing na wyczerpanie psuje technikę i przestaje być
  // ruchem o prędkość. Drabina idzie tu po ocenie wysiłku, nie po liczbie powtórzeń.
  if (m.mode === 'ballistic') {
    const nxt = nextWeight(state, id);
    if (effort === 'easy' && nxt && p.calibRuns < MAX_CALIB_RUNS) {
      p.weight = nxt;
      return { type: 'level', text: `${m.name}: lekko poszło — próba jeszcze raz na ${nxt} kg.` };
    }
    if (effort === 'max') {
      const pw = prevWeight(state, id);
      if (pw && p.calibRuns < MAX_CALIB_RUNS) {
        p.weight = pw;
        return { type: 'down', text: `${m.name}: za ciężko na start — próba jeszcze raz na ${pw} kg.` };
      }
    }
    p.phase = 'work';
    p.sets = p.minSets;
    p.target = m.def.target;
    p.e1rm = p.weight ? round1(epley(p.weight, p.target)) : null;
    return {
      type: 'level',
      text: `${m.name}: poziom startowy ustawiony — ${p.sets} × ${p.target} na ${p.weight} kg. Stąd rosną serie.`,
    };
  }

  const achieved = Math.max(...done.map((r) => r.reps));
  const tested = done[0]?.w ?? p.weight;
  if (tested !== null && tested !== undefined) p.weight = tested;

  const res = placeFromTest(state, id, achieved, effort, p.calibRuns < MAX_CALIB_RUNS);
  if (res.retry) return { type: 'level', text: res.text };

  p.phase = 'work';
  // Punkt wyjścia dla szacowanego maksimum bierze się z ustalonego poziomu, a nie
  // z liczby powtórzeń na próbie.
  p.e1rm = p.weight && m.unit === 'reps' ? round1(epley(p.weight, p.target)) : null;
  const u = m.unit === 'secs' ? ' s' : '';
  const where = p.weight ? ` na ${p.weight} kg` : '';
  return {
    type: 'level',
    text: `${m.name}: poziom startowy ustawiony — ${p.sets} × ${p.target}${u}${where}. Stąd cel rośnie do ${p.max}${u}.`,
  };
}

/**
 * Przelicza jedno ćwiczenie po zamkniętym treningu. Mutuje przekazany stan,
 * więc wywołuj na kopii.
 */
export function applyResult(
  state: AppState,
  id: ExerciseId,
  rows: SetResult[],
  effort: EffortKey,
  blockJump: boolean,
  today: string = new Date().toISOString().slice(0, 10),
): Change | null {
  const p = P(state, id);
  const m = ex(id);
  // Ocena musi powstać przed jakąkolwiek zmianą stanu — bierze receptę z bieżącego poziomu.
  const verdict = judge(state, id, rows, effort);
  const wasProbe = p.probe;
  const done = rows.filter((r) => r.reps > 0);

  // Szacowane maksimum liczone z najcięższej serii, wygładzane, żeby jeden dzień
  // nie wywracał całego obrazu. Seria próbna jest z tego wyłączona: kilkanaście powtórzeń
  // na najlżejszym kettlebellu daje wzorem Epleya liczbę bez sensu — tam ogranicznikiem
  // jest wytrzymałość, nie siła — a wygładzanie przeniosłoby ten błąd na kolejne sesje.
  if (p.phase === 'work' && p.weight !== null && done.length && m.unit === 'reps') {
    const heaviest = Math.max(...done.map((r) => r.w ?? 0));
    const repsAtHeaviest = done.filter((r) => (r.w ?? 0) === heaviest).map((r) => r.reps);
    if (heaviest > 0 && repsAtHeaviest.length) {
      const fresh = e1rmFromSession(heaviest, repsAtHeaviest, effort);
      p.e1rm = p.e1rm ? round1(p.e1rm * 0.6 + fresh * 0.4) : fresh;
    }
  }

  p.hist.push({ d: today, w: p.weight, reps: done.map((r) => r.reps), eff: effort, e1rm: p.e1rm });
  if (p.hist.length > 80) p.hist = p.hist.slice(-80);

  if (verdict === 'none') return null;

  if (p.phase === 'calib') return calibrate(state, id, done, effort);

  const change = work(state, id, done, effort, verdict, blockJump, wasProbe);
  scheduleProbe(state, id, effort, wasProbe);
  return change;
}

/**
 * Kiedy ćwiczenie dostanie serię testową. Co kilka sesji rutynowo, a wcześniej, gdy dwa
 * razy z rzędu padło „Łatwo” — to znaczy, że obciążenie jest wyraźnie poniżej możliwości
 * i progresja po jednym powtórzeniu na sesję nigdy tego nie dogoni.
 */
function scheduleProbe(state: AppState, id: ExerciseId, effort: EffortKey, wasProbe: boolean): void {
  const p = P(state, id);
  if (wasProbe) {
    p.probe = false;
    p.sinceProbe = 0;
    p.easyRun = 0;
    return;
  }
  p.sinceProbe++;
  p.easyRun = effort === 'easy' ? p.easyRun + 1 : 0;
  // W trakcie przejścia na cięższy kettlebell obraz zmienia się i tak co sesję — test tylko miesza.
  p.probe = !p.trans && (p.sinceProbe >= PROBE_EVERY || p.easyRun >= EASY_RUN_PROBE);
}

/** Normalna progresja, już po kalibracji. */
function work(
  state: AppState,
  id: ExerciseId,
  done: SetResult[],
  effort: EffortKey,
  verdict: Verdict,
  blockJump: boolean,
  wasProbe: boolean,
): Change | null {
  const p = P(state, id);
  const m = ex(id);
  const st = step(id);
  const u = m.unit === 'secs' ? ' s' : '';

  if (verdict === 'hold-max') {
    p.stalls = 0;
    p.maxHolds++;
    if (p.maxHolds >= 3) {
      p.maxHolds = 0;
      const floor = floorReps(state, id);
      if (p.target > floor) {
        p.target = Math.max(floor, p.target - step(id));
        return {
          type: 'down',
          text: `${m.name}: trzeci raz z rzędu na granicy sił, więc cel schodzi na ${p.target}. Zapas jest warunkiem awansu — z niego bierze się jakość ruchu.`,
        };
      }
    }
    return {
      type: 'hold',
      text: `${m.name}: cel zaliczony bez zapasu, więc poziom zostaje. Awans wymaga tego samego wyniku z jednym–dwoma powtórzeniami w zapasie.`,
    };
  }

  if (verdict === 'down') {
    p.stalls++;
    if (p.stalls >= 2) {
      p.stalls = 0;
      return regress(state, id);
    }
    return null;
  }

  if (verdict === 'hold') {
    p.stalls = 0;
    p.maxHolds = 0;
    return null;
  }

  // verdict === 'up'
  p.stalls = 0;
  p.maxHolds = 0;

  if (p.trans) return advanceTransition(state, id, blockJump);

  /**
   * Ile ćwiczący realnie wyciągnął. W sesji z serią testową liczy się ta seria, w zwykłej
   * najsłabsza — bo awans wymaga kompletu na każdej serii. „Łatwo” to zadeklarowane trzy
   * powtórzenia zapasu, więc wynik jest w rzeczywistości o stopień wyższy niż zapisany.
   */
  const reached = wasProbe
    ? (done[done.length - 1]?.reps ?? 0)
    : Math.min(...done.map((r) => r.reps));
  const usable = effort === 'easy' ? reached + st : reached;

  if (m.mode === 'ballistic') {
    if (p.sets < p.maxSets) {
      const before = p.sets;
      // Balistyka nie mierzy nadwyżki powtórzeniami, więc szybszą ścieżkę otwiera sam zapas.
      p.sets = Math.min(p.maxSets, p.sets + (effort === 'easy' ? 2 : 1));
      return {
        type: 'reps',
        text: `${m.name}: ${before} → ${p.sets} serie (${p.sets * p.target} powtórzeń łącznie)`,
      };
    }
    return startTransition(state, id, blockJump);
  }

  /**
   * Nadwyżka nie idzie do kosza. Wynik wyższy od celu podnosi cel od razu do tego wyniku,
   * zamiast o jedno powtórzenie — inaczej ktoś, kto zaczyna kilka poziomów poniżej swoich
   * możliwości, spędza kilkanaście sesji na dochodzeniu do miejsca, w którym powinien zacząć.
   */
  if (p.target < p.max && usable < p.max) {
    const before = p.target;
    p.target = Math.min(p.max, Math.max(p.target + st, usable));
    const leap = p.target - before > st ? ` — wynik ${reached}${u} przeskoczył kilka stopni` : '';
    return { type: 'reps', text: `${m.name}: cel ${before} → ${p.target}${u}${leap}` };
  }

  // Wynik sięga szczytu zakresu: cel ląduje na maksimum i od razu idzie krok poziomu wyżej.
  p.target = p.max;

  if (m.mode === 'body') {
    if (p.sets < p.maxSets) {
      p.sets++;
      p.target = p.min;
      return {
        type: 'level',
        text: `${m.name}: ${p.sets - 1} → ${p.sets} serie, cel wraca na ${p.min}`,
      };
    }
    return { type: 'cap', text: `${m.name}: szczyt zakresu. Dołóż obciążenie albo trudniejszy wariant.` };
  }

  if (m.mode === 'stage' && m.stages) {
    const arr = STAGES[m.stages];
    if ((p.stage ?? 0) < arr.length - 1) {
      p.stage = (p.stage ?? 0) + 1;
      p.target = p.min;
      return { type: 'level', text: `${m.name}: ${arr[p.stage]}, cel wraca na ${p.min}` };
    }
    return { type: 'cap', text: `${m.name}: najwyższy etap opanowany.` };
  }

  // grind i carry
  return startTransition(state, id, blockJump);
}

/**
 * Korekta po przerwie. Badania nad roztrenowaniem pokazują, że nawet po
 * dwunastu tygodniach przerwy siła spada tylko o 5–15% i wraca szybko,
 * dlatego najpierw cofają się cele powtórzeń, a ciężar dopiero po miesiącach.
 */
export function applyLayoff(state: AppState, days: number | null): Notice | null {
  if (days === null || days < 11) return null;

  if (days < 21) {
    return {
      level: 'warn',
      title: `Przerwa ${days} dni`,
      text: 'Cele powtórzeń zostają, ale skoki na cięższy kettlebell są wstrzymane na jedną sesję. Wróć do rytmu, potem ruszaj dalej.',
    };
  }

  let n = 0;
  ALL.forEach((id) => {
    const p = P(state, id);
    if (p.target > p.min) {
      p.target = p.min;
      n++;
    }
    if (p.trans && p.trans.heavySets > 1) p.trans.heavySets = 1;
    p.stalls = 0;
    p.maxHolds = 0;
  });

  if (days < 43) {
    return {
      level: 'warn',
      title: `Przerwa ${days} dni`,
      text: `Cele powtórzeń wróciły do dolnej granicy zakresu w ${n} ćwiczeniach. Ciężary zostają bez zmian — po kilku tygodniach przerwy siła spada niewiele i wraca szybko.`,
    };
  }

  let w = 0;
  WEIGHTED.forEach((id) => {
    const p = P(state, id);
    if (p.e1rm) p.e1rm = round1(p.e1rm * 0.9);
    p.trans = null;
    if (p.e1rm && p.weight && repsAt(p.e1rm, p.weight) < p.min) {
      const pw = prevWeight(state, id);
      if (pw) {
        p.weight = pw;
        w++;
      }
    }
  });

  return {
    level: 'warn',
    title: `Przerwa ${Math.round(days / 7)} tygodni`,
    text: `Szacowane maksima obniżone o 10%, cele wróciły na dolną granicę. Ciężar zszedł o rozmiar w ${w} ćwiczeniach — tylko tam, gdzie po korekcie nie dało się utrzymać dolnej granicy zakresu.`,
  };
}
