import { EX } from '../data/exercises';
import { EX_MUSCLES, MUSCLE_NAME } from '../data/muscles';
import { EQUIP_LABEL, heldOf, stationFor } from '../data/stations';
import type { Equip } from '../data/stations';
import { PAIR_REST, orderRank } from './design';
import { profileOf } from './energy';
import { P } from './plan';
import type { AppState, ExerciseId, Workout, WorkoutGear } from '../types';

export { PAIR_REST };

/**
 * Jak przeprowadzić trening: co przygotować, jak się rozgrzać i w jakiej kolejności robić
 * serie — pod rząd czy na zmianę.
 *
 * **Pary na zmianę** (seria A, przerwa, seria B, przerwa…) skracają trening bez straty
 * powtórzeń, gdy ćwiczenia nie męczą tych samych mięśni — najlepiej przeciwstawnych, jak
 * pchanie i ciągnięcie (Robbins i in., 2010; przegląd Weakley i in., 2017). Ta sama partia
 * na zmianę traci powtórzenia, więc takich par nie ma. Ruch wybuchowy i ciężki ruch ze
 * sztangą zostają sami: pierwszy potrzebuje świeżości, drugi — pełnej przerwy 2–3 minut.
 *
 * Na siłowni para trzyma najwyżej jedno stanowisko (maszynę, wyciąg, stojak, drążek):
 * dwa naraz w szczycie to stanowisko, które ktoś zajmie, zanim się wróci.
 */

const name = (id: ExerciseId): string => EX[id]?.name ?? id;

/** Ciężki ruch wielostawowy ze sztangą — tylko serie pod rząd. */
export const isHeavy = (id: ExerciseId): boolean => EX[id]?.gear === 'barbell' && orderRank(id) <= 1;

/** Co jest nie tak z parą — zdaniami do pokazania. Pusta lista: para jest dobra. */
export function pairProblems(a: ExerciseId, b: ExerciseId, gear: WorkoutGear | undefined): string[] {
  const out: string[] = [];
  [a, b].forEach((id) => {
    if (orderRank(id) === 0) out.push(`${name(id)} to ruch wybuchowy — idzie sam, na świeżo.`);
    else if (isHeavy(id)) out.push(`${name(id)} to ciężki ruch ze sztangą — serie pod rząd z pełną przerwą.`);
  });
  const pa = EX_MUSCLES[a]?.p ?? [];
  const shared = (EX_MUSCLES[b]?.p ?? []).filter((m) => pa.includes(m));
  if (shared.length)
    out.push(
      `Oba ćwiczenia męczą tę samą partię (${shared.map((m) => MUSCLE_NAME[m].toLowerCase()).join(', ')}) — na zmianę każde wypadnie słabiej.`,
    );
  if (gear === 'gym') {
    const held = [...new Set([...heldOf(stationFor(a, gear)), ...heldOf(stationFor(b, gear))])];
    if (held.length > 1)
      out.push('Na siłowni to dwa stanowiska naraz — w szczycie ktoś zajmie jedno, zanim do niego wrócisz.');
  }
  return out;
}

/** Przerwa po serii słowami — z typowej przerwy rodzaju pracy (`profileOf`). */
export function restText(secs: number): string {
  if (secs >= 120) return '2–3 min';
  if (secs >= 90) return '1,5–2 min';
  if (secs >= 75) return '60–90 s';
  if (secs >= 60) return 'ok. 1 min';
  return '30–60 s';
}

export const restOf = (id: ExerciseId): string => restText(profileOf(id).rest);
export const PAIR_REST_TEXT = '60–90 s';

/* ---------------- Przygotowanie stanowiska ---------------- */

/** Gryf olimpijski. Lżejszy ciężar niż gryf to już nie sztanga z talerzami. */
export const BAR_KG = 20;

export const platesPerSide = (kg: number): number => Math.max(0, (kg - BAR_KG) / 2);

export interface Setup {
  kettlebells: { kg: number; for: string[] }[];
  barbells: { id: ExerciseId; name: string; kg: number }[];
  dumbbells: { kg: number; for: string[] }[];
  /**
   * Maszyny do znalezienia — ta sama maszyna dla kilku ćwiczeń stoi raz, a każde ćwiczenie
   * ma własne zamienniki: wypychanie na suwnicy zastępuje co innego niż wspięcia na niej.
   */
  machines: { name: string; uses: { id: ExerciseId; name: string; alt: string[] }[] }[];
  /** Reszta: ławka, drążek, krzesło, mata, miejsce — bez powtórzeń. */
  other: string[];
}

/** Ciężary z obecnego poziomu: roboczy i — przy przejściu — ten, na który się wchodzi. */
const weightsOf = (state: AppState, id: ExerciseId): number[] => {
  const p = P(state, id);
  return [p.weight, p.trans?.to].filter((w): w is number => typeof w === 'number' && w > 0);
};

const push = (list: { kg: number; for: string[] }[], kg: number, label: string) => {
  const hit = list.find((x) => x.kg === kg);
  if (hit) hit.for.push(label);
  else list.push({ kg, for: [label] });
};

/**
 * Zamienniki ćwiczenia w tym treningu: z listy stanowiska, bez ćwiczeń, które już w nim są —
 * zamiennik, który i tak za chwilę wypada, nic nie zastępuje.
 */
export function altsFor(id: ExerciseId, w: Workout): ExerciseId[] {
  const inWorkout = new Set(w.items.map((i) => i.ex));
  return (stationFor(id, w.gear).alt ?? []).filter((a) => !inWorkout.has(a) && EX[a]);
}

export function setupFor(state: AppState, w: Workout): Setup {
  const out: Setup = { kettlebells: [], barbells: [], dumbbells: [], machines: [], other: [] };
  const other = new Set<Equip>();

  w.items.forEach(({ ex: id }) => {
    const st = stationFor(id, w.gear);
    const kgs = weightsOf(state, id);
    st.needs.forEach((e) => {
      if (e === 'kb' || e === 'kb2') {
        kgs.forEach((kg) => push(out.kettlebells, kg, e === 'kb2' ? `${name(id)} (dwa po ${kg} kg)` : name(id)));
      } else if (e === 'barbell') {
        kgs.slice(0, 1).forEach((kg) => out.barbells.push({ id, name: name(id), kg }));
      } else if (e === 'dumbbells') {
        kgs.forEach((kg) => push(out.dumbbells, kg, name(id)));
      } else other.add(e);
    });
    if (st.machine) {
      const use = { id, name: name(id), alt: altsFor(id, w).map(name) };
      const hit = out.machines.find((m) => m.name === st.machine);
      if (hit) hit.uses.push(use);
      else out.machines.push({ name: st.machine, uses: [use] });
    }
  });

  out.kettlebells.sort((a, b) => a.kg - b.kg);
  out.dumbbells.sort((a, b) => a.kg - b.kg);
  out.other = [...other].map((e) => EQUIP_LABEL[e]);
  return out;
}

/* ---------------- Rozgrzewka ---------------- */

export interface Ramp {
  id: ExerciseId;
  name: string;
  /** Serie dochodzące z ciężarem — gdy da się je policzyć. */
  sets: { kg: number; reps: number }[];
  /** Słowami, gdy ciężaru nie ma albo to kettlebell. */
  text?: string;
}

export interface Warmup {
  general: string;
  ramps: Ramp[];
  after: string;
}

const roundTo = (kg: number, step: number): number => Math.round(kg / step) * step;

/**
 * Serie dochodzące do ciężkiego ruchu ze sztangą: pusty gryf, ok. 50% i 75% ciężaru
 * roboczego — po kilka powtórzeń, żeby rozgrzać ruch, a nie zmęczyć mięśnie przed seriami.
 */
function barbellRamp(kg: number): { kg: number; reps: number }[] {
  const out = [{ kg: BAR_KG, reps: 10 }];
  [
    [0.5, 5],
    [0.75, 3],
  ].forEach(([f, reps]) => {
    const x = roundTo(kg * f!, 2.5);
    if (x > out[out.length - 1]!.kg && x < kg) out.push({ kg: x, reps: reps! });
  });
  return out;
}

export function warmupFor(state: AppState, w: Workout): Warmup {
  const general =
    w.gear === 'gym'
      ? '5 min na rowerze, bieżni albo ergometrze — w tempie, w którym da się mówić. Potem po 10 krążeń ramion i bioder.'
      : '3–5 min: marsz albo trucht w miejscu, 20 pajacyków, po 10 krążeń ramion i bioder i 5 spokojnych przysiadów.';
  const ramps: Ramp[] = [];
  const seen = new Set<ExerciseId>();
  w.items.forEach(({ ex: id }, i) => {
    const e = EX[id];
    if (!e || seen.has(id)) return;
    const kg = weightsOf(state, id)[0];
    if (isHeavy(id) && kg) {
      seen.add(id);
      ramps.push({ id, name: name(id), sets: barbellRamp(kg) });
      return;
    }
    // Pierwsze ćwiczenie treningu dostaje swoje wejście zawsze — bez niego pierwsza seria
    // robocza jest rozgrzewką, a wynik zapisany w historii nie mówi, ile naprawdę dasz radę.
    if (i !== 0) return;
    seen.add(id);
    if (e.mode === 'ballistic' && (e.gear ?? 'kettlebell') === 'kettlebell')
      ramps.push({ id, name: name(id), sets: [], text: '5 martwych ciągów tym samym kettlebellem, potem 5 swingów na pół siły.' });
    else if ((e.gear === 'dumbbell' || e.gear === 'machine') && kg)
      ramps.push({ id, name: name(id), sets: [{ kg: roundTo(kg / 2, e.gear === 'machine' ? 5 : 2) || kg, reps: 8 }] });
    else if (kg) ramps.push({ id, name: name(id), sets: [], text: 'Jedna seria 5 powtórzeń tym samym ciężarem, spokojnie i pełnym zakresem.' });
    else ramps.push({ id, name: name(id), sets: [], text: 'Jedna seria 5 powtórzeń łatwiejszej wersji albo połowa zakresu.' });
  });
  return {
    general,
    ramps,
    after:
      'Po treningu 3–5 minut spokojnego marszu. Rozciąganie, jeśli lubisz — na przyrost i zakwasy nie wpływa, na zakres ruchu tak.',
  };
}
