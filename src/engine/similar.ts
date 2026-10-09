import { EX, NO_EQUIPMENT, gearOf } from '../data/exercises';
import { EX_MUSCLES } from '../data/muscles';
import { stationFor } from '../data/stations';
import type { ExerciseId, WorkoutGear } from '../types';

/**
 * Podobne ćwiczenia i sprzęt treningu — do układania własnej wersji gotowego treningu.
 *
 * Najczęstsza zmiana w cudzym treningu to zamiana jednego ruchu na inny: nie ma sztangi, kolano
 * nie lubi wykroków, maszyna stoi w innym kącie siłowni. Zamiennik ma robić tę samą robotę —
 * ten sam wzorzec ruchu albo te same mięśnie — i dać się zrobić tym, co jest pod ręką.
 */

/** Czy ćwiczenie da się zrobić w tym zestawie sprzętu. Bez zestawu — każde. */
export function fitsGear(id: ExerciseId, gear: WorkoutGear | undefined): boolean {
  if (!EX[id]) return false;
  if (gear === 'none') return NO_EQUIPMENT.has(id);
  if (gear === 'kb') {
    const g = gearOf(id);
    return g === 'kettlebell' || g === 'bodyweight';
  }
  return true;
}

/**
 * Sprzęt treningu z jego ćwiczeń: bez sprzętu, gdy żadne go nie wymaga; kettlebell, gdy
 * wystarczy kettlebell i ciężar ciała; inaczej siłownia. Z tego biorą się stanowiska
 * i filtr w bibliotece, więc własna wersja treningu nie musi o nim pamiętać.
 */
export function workoutGear(ids: readonly ExerciseId[]): WorkoutGear {
  const known = ids.filter((id) => EX[id]);
  if (known.every((id) => NO_EQUIPMENT.has(id))) return 'none';
  if (known.every((id) => fitsGear(id, 'kb'))) return 'kb';
  return 'gym';
}

/**
 * Zamienniki ćwiczenia, najlepsze najpierw. Kolejność: zamiennik stanowiska (maszyna zajęta),
 * ten sam wzorzec ruchu (grupa w atlasie), wspólne mięśnie główne, potem pomocnicze i ten sam
 * sprzęt. Ćwiczenie musi pasować do sprzętu treningu i nie może już w nim być. Bez wspólnego
 * wzorca ani mięśnia głównego to nie zamiennik, tylko inne ćwiczenie — takie do listy nie trafia.
 */
export function similarTo(
  id: ExerciseId,
  { exclude = [], gear, limit = 6 }: { exclude?: readonly ExerciseId[]; gear?: WorkoutGear | undefined; limit?: number } = {},
): ExerciseId[] {
  const e = EX[id];
  if (!e) return [];
  const skip = new Set([id, ...exclude]);
  const mine = EX_MUSCLES[id] ?? { p: [], s: [] };
  const alts = new Set(stationFor(id, gear).alt ?? []);
  const score = (x: ExerciseId): number => {
    const m = EX_MUSCLES[x] ?? { p: [], s: [] };
    const sharedP = m.p.filter((v) => mine.p.includes(v)).length;
    const sharedS = m.s.filter((v) => mine.s.includes(v)).length;
    const core = (EX[x]!.group === e.group ? 10 : 0) + sharedP * 4;
    // Przy remisie ten sam sprzęt: przysiad ze sztangą najpierw zamienia się na inny ze sztangą.
    return core ? (alts.has(x) ? 100 : 0) + core + sharedS + (gearOf(x) === gearOf(id) ? 2 : 0) : 0;
  };
  return Object.keys(EX)
    .filter((x) => !skip.has(x) && fitsGear(x, gear))
    .map((x) => ({ x, s: score(x) }))
    .filter((c) => c.s > 0)
    .sort((a, b) => b.s - a.s || EX[a.x]!.name.localeCompare(EX[b.x]!.name, 'pl'))
    .slice(0, limit)
    .map((c) => c.x);
}
