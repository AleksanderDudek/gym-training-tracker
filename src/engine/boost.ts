import { BUILTIN, EX, NO_EQUIPMENT } from '../data/exercises';
import { EX_MUSCLES, MUSCLE_NAME } from '../data/muscles';
import type { MuscleId } from '../data/muscles';
import { PROFILES } from '../data/profiles';
import type { AppState, ExerciseId, WorkoutGear } from '../types';
import { RULES, reviewPlan } from './design';
import { acwr } from './math';
import { P } from './plan';
import { dayKey, daysBetween, planWeekdays } from './schedule';
import type { Snapshot } from './snapshot';

/**
 * Co dorzucić w dzień bez terminu, żeby postęp szedł dalej — przekąskę ruchową albo
 * lżejszy trening dodatkowy.
 *
 * Zasady są ostrożne, bo dodatkowy ruch łatwo zamienia się w dodatkowe zmęczenie:
 *
 * - w dzień terminu i w dzień z zaległym terminem nic — wtedy liczy się termin;
 * - po zrobionym dziś treningu nic — dziś już było;
 * - przekąska to 1–3 serie z zapasem, rozłożone w ciągu dnia: częstszy bodziec bez zmęczenia
 *   (wyższa częstotliwość przy tej samej objętości pomaga sile, Grgic i in., 2018). Najpierw
 *   przekąska profilu, potem ćwiczenie, które stoi w miejscu, potem partia z małą liczbą serii;
 * - trening dodatkowy tylko z zapasem: termin najwcześniej pojutrze, obciążenie ostatnich
 *   tygodni w normie (stosunek tygodnia do miesiąca do 1,3) i realizacja planu od 70%.
 *   To zawsze lekki trening — dzień lekki albo brzuch — a nie kolejny ciężki.
 */

export interface Boost {
  kind: 'snack' | 'extra';
  title: string;
  text: string;
  /** Ćwiczenie przekąski. */
  ex?: ExerciseId;
  /** Trening dodatkowy. */
  workout?: string;
}

/** Lekki trening dodatkowy według sprzętu planu. */
const LIGHT: Record<WorkoutGear, string> = { kb: 'D', none: 'core-none', gym: 'core-gym' };

/** Drążek ma prawie każdy, kto trenuje z kettlebell albo na siłowni. */
const BAR = new Set<ExerciseId>(['pullup', 'chinup', 'dead_hang']);

/** Duże partie, których za mało w tygodniu warto dołożyć przekąską. */
const MAIN: MuscleId[] = ['klatka', 'najszersze', 'plecy-gora', 'czworoglowe', 'posladki', 'dwuglowe'];

const snackable = (id: ExerciseId, gear: WorkoutGear): boolean =>
  !!EX[id] &&
  (NO_EQUIPMENT.has(id) || (BAR.has(id) && gear !== 'none') || (gear === 'kb' && (EX[id]!.gear ?? 'kettlebell') === 'kettlebell'));

/** Ile zrobić: ok. 60% dzisiejszego celu, w paru seriach — z zapasem, nie do upadku. */
function doseText(state: AppState, id: ExerciseId): string {
  const secs = EX[id]!.unit === 'secs';
  const n = Math.max(secs ? 10 : 2, Math.round(P(state, id).target * 0.6));
  return `1–3 serie po ${n} ${secs ? 's' : 'powt.'}, rozłożone w ciągu dnia, z zapasem 2–3 powtórzeń.`;
}

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

export function boost(state: AppState, snap: Snapshot, today: string): Boost[] {
  const { stats, template, plan } = snap;
  if (stats.due || !stats.next) return [];
  if (state.log.some((e) => dayKey(e.date) === today)) return [];

  const gear: WorkoutGear = template.gear ?? 'kb';
  const workouts = [...BUILTIN, ...state.workouts];
  const seed = daysBetween('2026-01-01', today);
  const out: Boost[] = [];
  const seen = new Set<ExerciseId>();
  const snack = (id: ExerciseId, title: string, why: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ kind: 'snack', ex: id, title, text: `${why} ${doseText(state, id)}` });
  };

  if (template.profile) {
    const spec = PROFILES[template.profile];
    const list = spec.snacks.filter((x) => snackable(x, gear));
    const id = list[seed % Math.max(1, list.length)];
    if (id) snack(id, `Przekąska profilu: ${lower(EX[id]!.name)}`, `Akcent planu „${spec.name}” rośnie też między treningami.`);
  }

  const inPlan = [
    ...new Set(template.cycle.flatMap((c) => workouts.find((w) => w.id === c)?.items.map((i) => i.ex) ?? [])),
  ];
  const stalled = inPlan
    .filter((id) => (state.prog[id]?.stalls ?? 0) >= 2 && snackable(id, gear))
    .sort((a, b) => (state.prog[b]?.stalls ?? 0) - (state.prog[a]?.stalls ?? 0));
  if (stalled[0])
    snack(
      stalled[0],
      `${EX[stalled[0]]!.name} stoi w miejscu`,
      `Od ${state.prog[stalled[0]]!.stalls} sesji bez postępu. Krótka, lżejsza seria w dzień wolny to częstszy bodziec bez zmęczenia przed terminem.`,
    );

  if (out.length < 2) {
    const weekly = reviewPlan(state, { ...template, weekdays: planWeekdays(template, plan) }, workouts).weekly;
    const lag = weekly
      .filter((x) => MAIN.includes(x.muscle) && x.sets < RULES.weeklyTarget)
      .sort((a, b) => a.sets - b.sets);
    for (const m of lag) {
      const id = [...NO_EQUIPMENT].find((x) => EX_MUSCLES[x]?.p.includes(m.muscle) && !seen.has(x));
      if (!id) continue;
      snack(
        id,
        `Partia do dołożenia: ${lower(MUSCLE_NAME[m.muscle])}`,
        `W planie ${m.sets.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} serii tygodniowo — mniej niż ${RULES.weeklyTarget}, od których przyrost opłaca się najbardziej.`,
      );
      break;
    }
  }

  const result = out.slice(0, 2);

  const wait = daysBetween(today, stats.next.date);
  const ratio = acwr(state);
  const light = workouts.find((w) => w.id === LIGHT[gear]);
  if (wait >= 2 && (ratio === null || ratio <= 1.3) && (stats.adherence ?? 100) >= 70 && light && !template.cycle.includes(light.id))
    result.push({
      kind: 'extra',
      workout: light.id,
      title: 'Masz zapas: trening dodatkowy',
      text: `Następny termin za ${wait} dni, a obciążenie z ostatnich tygodni jest w normie. ${light.name} doda ruchu bez zabierania sił na termin — liczy się do doświadczenia i odznak, kalendarza planu nie rusza.`,
    });

  return result;
}
