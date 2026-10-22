import { STAGES, ex } from '../data/exercises';
import { P, nextWeight, plan, step } from './plan';
import type { AppState, EffortKey, ExerciseId } from '../types';
import { pluralEn, text } from '../i18n';

const T = text({
  pl: {
    reps: 'powt',
    atKg: (kg: number) => ` na <b>${kg} kg</b>`,
    calibBallistic: (target: number, w: string) =>
      `<b>Sesja próbna.</b> Zrób ${target} powtórzeń${w} i oceń, jak było. Z tej oceny bierze się twój ciężar startowy — jeśli poszło lekko, następnym razem próba na cięższym.`,
    calib: (w: string, max: number, min: number) =>
      `<b>Sesja próbna.</b> Jedna seria${w}, tyle powtórzeń, ile dasz radę z zapasem jednego–dwóch. Z wyniku bierze się twój poziom startowy: powyżej ${max} próba wraca na cięższym, poniżej ${min} na lżejszym.`,
    probe: (target: number, u: string) =>
      `<b>Dziś test w ostatniej serii.</b> Wcześniejsze serie normalnie po ${target} ${u}, ostatnia bez sufitu — ile dasz radę z zapasem. Jeśli wyjdzie więcej, poziom przeskoczy od razu tam, gdzie powinien być.`,
    transNext: (kg: number, set: number, left: number) =>
      `Komplet dziś przenosi <b>${kg} kg</b> do ${set}. serii. Do pełnego przejścia ${
        left === 1 ? 'została 1 sesja' : `zostają ${left} sesje`
      }.`,
    transClose: (kg: number) => `Komplet dziś domyka przejście — <b>${kg} kg</b> na wszystkich seriach.`,
    heavier: (kg: number | null) => (kg ? `${kg} kg` : 'cięższe obciążenie'),
    ballisticSet: (sets: number, target: number, maxSets: number, heavier: string) =>
      `Komplet <b>${sets} × ${target}</b> dokłada serię (${sets + 1} × ${target}). Przy ${maxSets} seriach wchodzi <b>${heavier}</b>.`,
    ballisticTrans: (heavier: string) => `Komplet dziś zaczyna przejście na <b>${heavier}</b>.`,
    bodyTarget: (sets: number, target: number, next: number, max: number) =>
      `Komplet <b>${sets} × ${target}</b> podnosi cel do ${next}. Przy ${max} dochodzi kolejna seria.`,
    bodySet: (set: number, min: number) => `Komplet dziś dokłada ${set}. serię, a cel wraca na ${min}.`,
    stageTarget: (sets: number, target: number, next: number, stage: string | null | undefined, left: number) =>
      `Komplet <b>${sets} × ${target}</b> podnosi cel do ${next}.${
        stage ? ` Do etapu „${stage}” zostaje ${left} sesji.` : ''
      }`,
    stageNext: (stage: string) => `Komplet dziś przenosi cię na etap <b>${stage}</b>.`,
    stageTop: 'Najwyższy etap. Utrzymuj.',
    target: (sets: number, target: number, u: string, next: number) =>
      `Komplet <b>${sets} × ${target} ${u}</b> podnosi cel do ${next}.`,
    toWeight: (kg: number, left: number) =>
      ` Do wejścia na <b>${kg} kg</b> ${left === 1 ? 'została 1 sesja' : `zostaje ${left} sesji`}.`,
    weightIn: (kg: number) => `Komplet dziś wprowadza <b>${kg} kg</b> do pierwszej serii.`,
    rangeTop: (kg: number | null) => `Szczyt zakresu przy ${kg} kg.`,
    weak: (set: number, missing: number, u: string) => `seria ${set}: brakuje ${missing} ${u}`,
    toHit: (head: string, weak: string) => `${head}<br>Do zaliczenia — ${weak}.`,
    soFar: (head: string, empty: number) => `${head}<br>Na razie komplet. Serii do wpisania: ${empty}.`,
    noReserve: (head: string) =>
      `${head}<br><b>Cel zaliczony, ale bez zapasu.</b> Poziom zostaje — powtórz go, aż zejdziesz z granicy.`,
    hit: (head: string) => `${head}<br><b>Cel zaliczony z zapasem.</b> Awans naliczy się po zamknięciu treningu.`,
    modes: {
      grind: 'siłowe — rosną powtórzenia, potem ciężar',
      ballistic: 'balistyczne — rosną serie, nie powtórzenia do granicy sił',
      carry: 'na czas — rośnie czas, potem ciężar',
      stage: 'masa ciała — rosną powtórzenia, potem etap trudności',
      body: 'masa ciała — rosną powtórzenia, potem serie',
    } as Record<string, string>,
    type: (mode: string | undefined) => `Typ: ${mode}.`,
    calibPhase: (runs: number) =>
      `Ćwiczenie jest w fazie próbnej (${runs} ${runs === 1 ? 'próba' : 'próby'} za tobą). Poziom startowy bierze się z wyniku, a nie z tabelki.`,
    probeIn: (n: number) => `Test kontrolny za ${n} sesji.`,
    e1rm: (kg: number) =>
      `Szacowane maksimum: <b>${kg} kg</b> na jedno powtórzenie, liczone wzorem Epleya z twoich ostatnich serii z uwzględnieniem zadeklarowanego zapasu.`,
    trans: (to: number, from: number, pct: number) =>
      `Trwa przejście na ${to} kg. Cięższy ciężar wchodzi seria po serii, bo skok z ${from} na ${to} kg to ${pct}% obciążenia — na sztandze odpowiednik dorzucenia kilkunastu kilogramów naraz.`,
    transReps: (reps: number) => `Powtórzenia w ciężkiej serii (${reps}) wynikają z przeliczenia maksimum na nowy ciężar.`,
    stalls: (n: number) => `Nieudane sesje z rzędu: ${n}. Przy dwóch cel schodzi o stopień.`,
    maxHolds: (n: number) => `Sesje zaliczone bez zapasu: ${n}. Przy trzech cel schodzi.`,
    recent: (list: string) => `Ostatnie sesje: ${list}.`,
  },
  en: {
    reps: 'reps',
    atKg: (kg: number) => ` at <b>${kg} kg</b>`,
    calibBallistic: (target: number, w: string) =>
      `<b>Test session.</b> Do ${target} reps${w} and rate how it felt. Your starting weight comes from that rating — if it felt easy, next time you test a heavier one.`,
    calib: (w: string, max: number, min: number) =>
      `<b>Test session.</b> One set${w}, as many reps as you can with one or two to spare. Your starting level comes from the result: above ${max} the test repeats heavier, below ${min} lighter.`,
    probe: (target: number, u: string) =>
      `<b>Test in the last set today.</b> Earlier sets as usual, ${target} ${u} each; the last one has no ceiling — as many as you can with reps to spare. If you get more, your level jumps straight to where it should be.`,
    transNext: (kg: number, set: number, left: number) =>
      `Hit every set today and <b>${kg} kg</b> moves into set ${set}. ${
        left === 1 ? '1 session' : `${left} sessions`
      } left until the switch is complete.`,
    transClose: (kg: number) => `Hit every set today to complete the switch — <b>${kg} kg</b> on all sets.`,
    heavier: (kg: number | null) => (kg ? `${kg} kg` : 'a heavier weight'),
    ballisticSet: (sets: number, target: number, maxSets: number, heavier: string) =>
      `Hit <b>${sets} × ${target}</b> to add a set (${sets + 1} × ${target}). At ${maxSets} sets, <b>${heavier}</b> comes in.`,
    ballisticTrans: (heavier: string) => `Hit every set today to start the switch to <b>${heavier}</b>.`,
    bodyTarget: (sets: number, target: number, next: number, max: number) =>
      `Hit <b>${sets} × ${target}</b> to raise the target to ${next}. At ${max}, another set is added.`,
    bodySet: (set: number, min: number) => `Hit every set today to add set ${set}; the target goes back to ${min}.`,
    stageTarget: (sets: number, target: number, next: number, stage: string | null | undefined, left: number) =>
      `Hit <b>${sets} × ${target}</b> to raise the target to ${next}.${
        stage ? ` ${left} ${pluralEn(left, 'session', 'sessions')} to go until ‘${stage}’.` : ''
      }`,
    stageNext: (stage: string) => `Hit every set today to move up to <b>${stage}</b>.`,
    stageTop: 'Top stage. Hold it.',
    target: (sets: number, target: number, u: string, next: number) =>
      `Hit <b>${sets} × ${target} ${u}</b> to raise the target to ${next}.`,
    toWeight: (kg: number, left: number) =>
      ` ${left === 1 ? '1 session' : `${left} sessions`} to go until <b>${kg} kg</b>.`,
    weightIn: (kg: number) => `Hit every set today to bring <b>${kg} kg</b> into the first set.`,
    rangeTop: (kg: number | null) => `Top of the range at ${kg} kg.`,
    weak: (set: number, missing: number, u: string) => `set ${set}: ${missing} ${u} short`,
    toHit: (head: string, weak: string) => `${head}<br>Still to hit — ${weak}.`,
    soFar: (head: string, empty: number) => `${head}<br>All on target so far. Sets left to log: ${empty}.`,
    noReserve: (head: string) =>
      `${head}<br><b>Target hit, but with nothing in reserve.</b> The level stays — repeat it until it’s no longer your limit.`,
    hit: (head: string) => `${head}<br><b>Target hit with reps to spare.</b> You’ll move up when you finish the workout.`,
    modes: {
      grind: 'strength — reps grow, then weight',
      ballistic: 'ballistic — sets grow, not reps to failure',
      carry: 'timed — time grows, then weight',
      stage: 'bodyweight — reps grow, then the difficulty stage',
      body: 'bodyweight — reps grow, then sets',
    },
    type: (mode: string | undefined) => `Type: ${mode}.`,
    calibPhase: (runs: number) =>
      `This exercise is in its test phase (${runs} ${pluralEn(runs, 'test', 'tests')} done). Your starting level comes from your result, not from a table.`,
    probeIn: (n: number) => `Check-up test in ${n} ${pluralEn(n, 'session', 'sessions')}.`,
    e1rm: (kg: number) =>
      `Estimated max: <b>${kg} kg</b> for one rep, worked out with the Epley formula from your recent sets, taking the reps in reserve you reported into account.`,
    trans: (to: number, from: number, pct: number) =>
      `Switching to ${to} kg. The heavier weight comes in set by set, because jumping from ${from} to ${to} kg is ${pct}% more load — on a barbell, like adding well over ten kilos at once.`,
    transReps: (reps: number) => `Reps in the heavy set (${reps}) come from converting your max to the new weight.`,
    stalls: (n: number) => `Sessions short of target in a row: ${n}. At two, the target drops a step.`,
    maxHolds: (n: number) => `Sessions hit with nothing in reserve: ${n}. At three, the target drops.`,
    recent: (list: string) => `Recent sessions: ${list}.`,
  },
});

export interface Hint {
  html: string;
  hit: boolean;
}

/** Co trzeba zrobić dziś, żeby wskoczyć na kolejny poziom. */
export function levelHint(
  state: AppState,
  id: ExerciseId,
  live: (string | number)[],
  effort: EffortKey,
): Hint {
  const p = P(state, id);
  const m = ex(id);
  const u = m.unit === 'secs' ? 's' : T.reps;
  const rows = plan(state, id);
  const nw = nextWeight(state, id);
  let head: string;

  if (p.phase === 'calib') {
    const w = p.weight ? T.atKg(p.weight) : '';
    return {
      html: m.mode === 'ballistic' ? T.calibBallistic(m.def.target, w) : T.calib(w, p.max, p.min),
      hit: false,
    };
  }

  if (p.probe) {
    head = T.probe(p.target, u);
  } else if (p.trans) {
    const left = p.sets - p.trans.heavySets;
    head = left > 0 ? T.transNext(p.trans.to, p.trans.heavySets + 1, left) : T.transClose(p.trans.to);
  } else if (m.mode === 'ballistic') {
    head =
      p.sets < p.maxSets
        ? T.ballisticSet(p.sets, p.target, p.maxSets, T.heavier(nw))
        : T.ballisticTrans(T.heavier(nw));
  } else if (m.mode === 'body') {
    head =
      p.target < p.max
        ? T.bodyTarget(p.sets, p.target, p.target + step(id), p.max)
        : T.bodySet(p.sets + 1, p.min);
  } else if (m.mode === 'stage' && m.stages) {
    const arr = STAGES[m.stages];
    const nxt = (p.stage ?? 0) < arr.length - 1 ? arr[(p.stage ?? 0) + 1] : null;
    head =
      p.target < p.max
        ? T.stageTarget(p.sets, p.target, p.target + step(id), nxt, p.max - p.target + 1)
        : nxt
          ? T.stageNext(nxt)
          : T.stageTop;
  } else {
    const left = Math.ceil((p.max - p.target) / step(id)) + 1;
    head =
      p.target < p.max
        ? T.target(p.sets, p.target, u, p.target + step(id)) + (nw ? T.toWeight(nw, left) : '')
        : nw
          ? T.weightIn(nw)
          : T.rangeTop(p.weight);
  }

  if (!live.length) return { html: head, hit: false };
  const vals = live.map((v) => Number(v) || 0);
  if (!vals.some((v) => v > 0)) return { html: head, hit: false };

  const weak: string[] = [];
  vals.forEach((v, i) => {
    const target = rows[i]?.reps;
    if (v > 0 && target !== undefined && v < target) weak.push(T.weak(i + 1, target - v, u));
  });
  const empty = vals.filter((v) => !v).length;

  if (weak.length) return { html: T.toHit(head, weak.join(', ')), hit: false };
  if (empty) return { html: T.soFar(head, empty), hit: false };
  if (effort === 'max') return { html: T.noReserve(head), hit: false };
  return { html: T.hit(head), hit: true };
}

export const MODE_NAMES: Record<string, string> = T.modes;

/** Wyjaśnienie, skąd wziął się dzisiejszy cel. */
export function whyText(state: AppState, id: ExerciseId): string {
  const p = P(state, id);
  const m = ex(id);
  const bits: string[] = [T.type(MODE_NAMES[m.mode])];

  if (p.phase === 'calib')
    bits.push(T.calibPhase(p.calibRuns));
  else bits.push(T.probeIn(Math.max(0, 6 - p.sinceProbe)));

  if (p.e1rm && p.weight)
    bits.push(T.e1rm(p.e1rm));
  if (p.trans && p.weight) {
    bits.push(T.trans(p.trans.to, p.weight, Math.round((p.trans.to / p.weight - 1) * 100)));
    if (p.e1rm) bits.push(T.transReps(p.trans.reps));
  }
  if (p.stalls) bits.push(T.stalls(p.stalls));
  if (p.maxHolds) bits.push(T.maxHolds(p.maxHolds));

  const h = p.hist.slice(-3).reverse();
  if (h.length)
    bits.push(T.recent(h.map((x) => `${x.d.slice(5)} — ${x.reps.join('/')}${x.w ? ` @ ${x.w} kg` : ''}`).join(', ')));

  return bits.join(' ');
}
