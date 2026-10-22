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
  shiftWeight,
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
import { pluralEn, text } from '../i18n';

const T = text({
  pl: {
    capLadder: (name: string) => `${name}: szczyt zakresu. Brak cięższego obciążenia na drabinie.`,
    jumpHeld: (name: string, kg: number) => `${name}: gotowe do wejścia na ${kg} kg, skok wstrzymany do następnej sesji.`,
    transStart: (name: string, kg: number, reps: number, rest: number | null) =>
      `${name}: ${kg} kg wchodzi do pierwszej serii — 1 × ${reps}, reszta dalej na ${rest} kg.`,
    heavyHeld: (name: string) => `${name}: kolejna ciężka seria wstrzymana do następnej sesji.`,
    transStep: (name: string, kg: number, heavy: number, sets: number) => `${name}: ${kg} kg już w ${heavy} seriach z ${sets}`,
    transDone: (name: string, old: number | null, kg: number | null, target: number, max: number) =>
      `${name}: przejście domknięte — ${old} → ${kg} kg na wszystkich seriach, cel ${target}. Stąd powtórzenia znów rosną do ${max}.`,
    heavyBack: (name: string, heavy: number) => `${name}: ciężkich serii z powrotem ${heavy}`,
    transPaused: (name: string, kg: number | null) => `${name}: przejście wstrzymane, wracasz na ${kg} kg`,
    setsDown: (name: string, from: number, to: number) => `${name}: ${from} → ${to} serie`,
    targetDown: (name: string, target: number) => `${name}: cel schodzi na ${target}`,
    stageDown: (name: string, stage: string | undefined) => `${name}: etap niżej — ${stage}`,
    weightDown: (name: string, kg: number) => `${name}: ciężar w dół na ${kg} kg`,
    testTooLight: (name: string, result: string, kg: number) => `${name}: ${result} to za lekko — próba jeszcze raz na ${kg} kg.`,
    testStageEasy: (name: string, reps: number, stage: string | undefined) =>
      `${name}: ${reps} powtórzeń to za łatwy etap — próba na „${stage}”.`,
    testMoreSets: (name: string, reps: number, sets: number) =>
      `${name}: ${reps} powtórzeń w serii — próba jeszcze raz przy ${sets} seriach.`,
    testTooHeavy: (name: string, result: string, kg: number) =>
      `${name}: ${result} to za dużo na start — próba jeszcze raz na ${kg} kg.`,
    testStageHard: (name: string, stage: string | undefined) => `${name}: za trudny etap — próba na „${stage}”.`,
    calibEasy: (name: string, kg: number) => `${name}: lekko poszło — próba jeszcze raz na ${kg} kg.`,
    calibHeavy: (name: string, kg: number) => `${name}: za ciężko na start — próba jeszcze raz na ${kg} kg.`,
    calibBallistic: (name: string, sets: number, target: number, kg: number | null) =>
      `${name}: poziom startowy ustawiony — ${sets} × ${target} na ${kg} kg. Stąd rosną serie.`,
    at: (kg: number) => ` na ${kg} kg`,
    calibDone: (name: string, dose: string, where: string, max: string) =>
      `${name}: poziom startowy ustawiony — ${dose}${where}. Stąd cel rośnie do ${max}.`,
    thirdAtLimit: (name: string, target: number) =>
      `${name}: trzeci raz z rzędu na granicy sił, więc cel schodzi na ${target}. Zapas jest warunkiem awansu — z niego bierze się jakość ruchu.`,
    noReserve: (name: string) =>
      `${name}: cel zaliczony bez zapasu, więc poziom zostaje. Awans wymaga tego samego wyniku z jednym–dwoma powtórzeniami w zapasie.`,
    setsUp: (name: string, from: number, to: number, total: number) => `${name}: ${from} → ${to} serie (${total} powtórzeń łącznie)`,
    leap: (result: string) => ` — wynik ${result} przeskoczył kilka stopni`,
    targetUp: (name: string, from: number, to: string, leap: string) => `${name}: cel ${from} → ${to}${leap}`,
    setUpReset: (name: string, from: number, to: number, min: number) => `${name}: ${from} → ${to} serie, cel wraca na ${min}`,
    capBody: (name: string) => `${name}: szczyt zakresu. Dołóż obciążenie albo trudniejszy wariant.`,
    stageUp: (name: string, stage: string | undefined, min: number) => `${name}: ${stage}, cel wraca na ${min}`,
    capStage: (name: string) => `${name}: najwyższy etap opanowany.`,
    breakDays: (days: number) => `Przerwa ${days} dni`,
    breakShort:
      'Cele powtórzeń zostają, ale skoki na cięższe obciążenie są wstrzymane na jedną sesję. Wróć do rytmu, potem ruszaj dalej.',
    breakMid: (n: number) =>
      `Cele powtórzeń wróciły do dolnej granicy zakresu w ${n} ćwiczeniach. Ciężary zostają bez zmian — po kilku tygodniach przerwy siła spada niewiele i wraca szybko.`,
    breakWeeks: (weeks: number) => `Przerwa ${weeks} tygodni`,
    breakLong: (n: number) =>
      `Szacowane maksima obniżone o 10%, cele wróciły na dolną granicę. Ciężar zszedł o rozmiar w ${n} ćwiczeniach — tylko tam, gdzie po korekcie nie dało się utrzymać dolnej granicy zakresu.`,
  },
  en: {
    capLadder: (name: string) => `${name}: top of the range. There’s no heavier weight on the ladder.`,
    jumpHeld: (name: string, kg: number) => `${name}: ready to move up to ${kg} kg; the jump waits until next session.`,
    transStart: (name: string, kg: number, reps: number, rest: number | null) =>
      `${name}: ${kg} kg comes into the first set — 1 × ${reps}, the rest stay at ${rest} kg.`,
    heavyHeld: (name: string) => `${name}: the next heavy set waits until next session.`,
    transStep: (name: string, kg: number, heavy: number, sets: number) => `${name}: ${kg} kg now in ${heavy} of ${sets} sets`,
    transDone: (name: string, old: number | null, kg: number | null, target: number, max: number) =>
      `${name}: switch complete — ${old} → ${kg} kg on every set, target ${target}. From here reps climb again to ${max}.`,
    heavyBack: (name: string, heavy: number) => `${name}: back to ${heavy} heavy ${pluralEn(heavy, 'set', 'sets')}`,
    transPaused: (name: string, kg: number | null) => `${name}: switch paused, back to ${kg} kg`,
    setsDown: (name: string, from: number, to: number) => `${name}: ${from} → ${to} sets`,
    targetDown: (name: string, target: number) => `${name}: target drops to ${target}`,
    stageDown: (name: string, stage: string | undefined) => `${name}: one stage down — ${stage}`,
    weightDown: (name: string, kg: number) => `${name}: weight down to ${kg} kg`,
    testTooLight: (name: string, result: string, kg: number) => `${name}: ${result} is too light — testing again at ${kg} kg.`,
    testStageEasy: (name: string, reps: number, stage: string | undefined) =>
      `${name}: ${reps} reps means this stage is too easy — testing ‘${stage}’.`,
    testMoreSets: (name: string, reps: number, sets: number) =>
      `${name}: ${reps} reps in a set — testing again with ${sets} sets.`,
    testTooHeavy: (name: string, result: string, kg: number) =>
      `${name}: ${result} is too heavy to start with — testing again at ${kg} kg.`,
    testStageHard: (name: string, stage: string | undefined) => `${name}: stage too hard — testing ‘${stage}’.`,
    calibEasy: (name: string, kg: number) => `${name}: that felt easy — testing again at ${kg} kg.`,
    calibHeavy: (name: string, kg: number) => `${name}: too heavy to start with — testing again at ${kg} kg.`,
    calibBallistic: (name: string, sets: number, target: number, kg: number | null) =>
      `${name}: starting level set — ${sets} × ${target} at ${kg} kg. Sets grow from here.`,
    at: (kg: number) => ` at ${kg} kg`,
    calibDone: (name: string, dose: string, where: string, max: string) =>
      `${name}: starting level set — ${dose}${where}. The target grows from here to ${max}.`,
    thirdAtLimit: (name: string, target: number) =>
      `${name}: third time in a row at your limit, so the target drops to ${target}. Reps in reserve are the condition for moving up — that’s where good form comes from.`,
    noReserve: (name: string) =>
      `${name}: target hit with nothing in reserve, so the level stays. To move up, hit the same result with one or two reps to spare.`,
    setsUp: (name: string, from: number, to: number, total: number) => `${name}: ${from} → ${to} sets (${total} reps in total)`,
    leap: (result: string) => ` — your ${result} jumped several steps`,
    targetUp: (name: string, from: number, to: string, leap: string) => `${name}: target ${from} → ${to}${leap}`,
    setUpReset: (name: string, from: number, to: number, min: number) => `${name}: ${from} → ${to} sets, target back to ${min}`,
    capBody: (name: string) => `${name}: top of the range. Add load or a harder variation.`,
    stageUp: (name: string, stage: string | undefined, min: number) => `${name}: ${stage}, target back to ${min}`,
    capStage: (name: string) => `${name}: top stage mastered.`,
    breakDays: (days: number) => `${days}-day break`,
    breakShort:
      'Rep targets stay, but jumps to heavier weights are paused for one session. Get back into your rhythm, then push on.',
    breakMid: (n: number) =>
      `Rep targets are back at the bottom of the range in ${n} ${pluralEn(n, 'exercise', 'exercises')}. Weights stay the same — after a few weeks off, strength drops only a little and comes back quickly.`,
    breakWeeks: (weeks: number) => `${weeks}-week break`,
    breakLong: (n: number) =>
      `Estimated maxes lowered by 10%, targets back at the bottom of the range. The weight went down a size in ${n} ${pluralEn(n, 'exercise', 'exercises')} — only where the bottom of the range couldn’t be held after the adjustment.`,
  },
});

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
    return { type: 'cap', text: T.capLadder(m.name) };
  if (blockJump)
    return { type: 'held', text: T.jumpHeld(m.name, nxt) };

  const reps = transReps(state, id, nxt);
  p.trans = { to: nxt, heavySets: 1, reps };
  return {
    type: 'level',
    text: T.transStart(m.name, nxt, reps, p.weight),
  };
}

/** Kolejna udana sesja w trakcie przejścia dokłada jedną ciężką serię. */
function advanceTransition(state: AppState, id: ExerciseId, blockJump: boolean): Change {
  const p = P(state, id);
  const m = ex(id);
  const t = p.trans!;

  if (blockJump)
    return { type: 'held', text: T.heavyHeld(m.name) };

  t.reps = Math.max(t.reps, transReps(state, id, t.to));
  t.heavySets++;

  if (t.heavySets < p.sets)
    return { type: 'reps', text: T.transStep(m.name, t.to, t.heavySets, p.sets) };

  const old = p.weight;
  p.weight = t.to;
  p.target =
    m.mode === 'ballistic' ? p.target : Math.max(floorReps(state, id), Math.min(p.max, t.reps));
  if (m.mode === 'ballistic') p.sets = p.minSets;
  p.trans = null;

  return {
    type: 'level',
    text: T.transDone(m.name, old, p.weight, p.target, p.max),
  };
}

/** Cofnięcie po dwóch słabych sesjach z rzędu. */
function regress(state: AppState, id: ExerciseId): Change | null {
  const p = P(state, id);
  const m = ex(id);

  if (p.trans) {
    if (p.trans.heavySets > 1) {
      p.trans.heavySets--;
      return { type: 'down', text: T.heavyBack(m.name, p.trans.heavySets) };
    }
    p.trans = null;
    return { type: 'down', text: T.transPaused(m.name, p.weight) };
  }
  if (m.mode === 'ballistic' && p.sets > p.minSets) {
    p.sets--;
    return { type: 'down', text: T.setsDown(m.name, p.sets + 1, p.sets) };
  }
  const floor = floorReps(state, id);
  if (p.target > floor) {
    p.target = Math.max(floor, p.target - step(id));
    return { type: 'down', text: T.targetDown(m.name, p.target) };
  }
  if (m.mode === 'stage' && m.stages && (p.stage ?? 0) > 0) {
    p.stage = (p.stage ?? 0) - 1;
    p.target = p.max;
    return { type: 'down', text: T.stageDown(m.name, STAGES[m.stages][p.stage]) };
  }
  const pw = prevWeight(state, id);
  if (p.weight !== null && pw) {
    p.weight = pw;
    p.target = p.max;
    return { type: 'down', text: T.weightDown(m.name, pw) };
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
    // Skala skoku bierze się z tego, jak bardzo wynik przebił zakres. Dwa razy ponad szczyt
    // to dwa rozmiary w górę, nie jeden — ale nie więcej niż trzy, żeby pomyłka we wpisie
    // nie wyrzuciła nikogo od razu na najcięższy kettlebell.
    const sizes = Math.min(3, 1 + Math.floor((usable - p.max) / Math.max(1, p.max)));
    const nxt = shiftWeight(state, id, sizes);
    if (p.weight !== null && nxt) {
      p.weight = nxt;
      return { retry: true, text: T.testTooLight(m.name, `${usable}${u}`, nxt) };
    }
    if (m.mode === 'stage' && m.stages) {
      const arr = STAGES[m.stages];
      if ((p.stage ?? 0) < arr.length - 1) {
        p.stage = (p.stage ?? 0) + 1;
        return { retry: true, text: T.testStageEasy(m.name, usable, arr[p.stage]) };
      }
    }
    if (m.mode === 'body' && p.sets < p.maxSets) {
      p.sets++;
      p.target = p.max;
      return { retry: true, text: T.testMoreSets(m.name, usable, p.sets) };
    }
  }

  if (usable < p.min && allowLevelMove) {
    const pw = prevWeight(state, id);
    if (p.weight !== null && pw) {
      p.weight = pw;
      return { retry: true, text: T.testTooHeavy(m.name, `${usable}${u}`, pw) };
    }
    if (m.mode === 'stage' && m.stages && (p.stage ?? 0) > 0) {
      p.stage = (p.stage ?? 0) - 1;
      const arr = STAGES[m.stages];
      return { retry: true, text: T.testStageHard(m.name, arr[p.stage]) };
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
      return { type: 'level', text: T.calibEasy(m.name, nxt) };
    }
    if (effort === 'max') {
      const pw = prevWeight(state, id);
      if (pw && p.calibRuns < MAX_CALIB_RUNS) {
        p.weight = pw;
        return { type: 'down', text: T.calibHeavy(m.name, pw) };
      }
    }
    p.phase = 'work';
    p.sets = p.minSets;
    p.target = m.def.target;
    p.e1rm = p.weight ? round1(epley(p.weight, p.target)) : null;
    return {
      type: 'level',
      text: T.calibBallistic(m.name, p.sets, p.target, p.weight),
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
  const where = p.weight ? T.at(p.weight) : '';
  return {
    type: 'level',
    text: T.calibDone(m.name, `${p.sets} × ${p.target}${u}`, where, `${p.max}${u}`),
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
          text: T.thirdAtLimit(m.name, p.target),
        };
      }
    }
    return {
      type: 'hold',
      text: T.noReserve(m.name),
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
        text: T.setsUp(m.name, before, p.sets, p.sets * p.target),
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
    const leap = p.target - before > st ? T.leap(`${reached}${u}`) : '';
    return { type: 'reps', text: T.targetUp(m.name, before, `${p.target}${u}`, leap) };
  }

  // Wynik sięga szczytu zakresu: cel ląduje na maksimum i od razu idzie krok poziomu wyżej.
  p.target = p.max;

  if (m.mode === 'body') {
    if (p.sets < p.maxSets) {
      p.sets++;
      p.target = p.min;
      return {
        type: 'level',
        text: T.setUpReset(m.name, p.sets - 1, p.sets, p.min),
      };
    }
    return { type: 'cap', text: T.capBody(m.name) };
  }

  if (m.mode === 'stage' && m.stages) {
    const arr = STAGES[m.stages];
    if ((p.stage ?? 0) < arr.length - 1) {
      p.stage = (p.stage ?? 0) + 1;
      p.target = p.min;
      return { type: 'level', text: T.stageUp(m.name, arr[p.stage], p.min) };
    }
    return { type: 'cap', text: T.capStage(m.name) };
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
      title: T.breakDays(days),
      text: T.breakShort,
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
      title: T.breakDays(days),
      text: T.breakMid(n),
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
    title: T.breakWeeks(Math.round(days / 7)),
    text: T.breakLong(w),
  };
}
