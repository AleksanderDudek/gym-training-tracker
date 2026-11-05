import type { Gear } from '../../types';
import { fold } from '../../engine/find';
import type { Hit } from '../../engine/find';
import { LANG } from '../../i18n';
import type { MuscleId } from '../muscles';
import { EQ_LABEL, GEAR_OF, musclesOf } from './derive';
import type { CatalogRow } from './derive';
import { TWINS } from './twins';

export interface CatalogFilter {
  query: string;
  muscle: MuscleId | null;
  gear: Gear | null;
}

export interface CatalogHit {
  row: CatalogRow;
  /** Dopasowania w nazwie w języku strony — puste, gdy pasuje druga nazwa, sprzęt albo filtr. */
  hits: Hit[];
}

export const nameOf = (row: CatalogRow): string => (LANG === 'pl' ? row.n[0] : row.n[1]);
export const eqLabel = (row: CatalogRow): string => EQ_LABEL[row.e] ?? row.e;

const starts = (text: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) if (i === 0 || /[\s\-/(:+,.]/.test(text[i - 1]!)) out.push(i);
  return out;
};

const collator = new Intl.Collator(LANG === 'pl' ? 'pl' : 'en', { sensitivity: 'base' });

/**
 * Szukanie w katalogu: każde wpisane słowo musi zaczynać któreś słowo nazwy (w języku strony
 * albo drugim — „bench” znajdzie wyciskanie także po polsku) lub sprzętu. Bliźniaki ćwiczeń
 * z biblioteki odpadają: tamta wersja ma filmy, goryla i dopracowaną progresję.
 */
export function searchCatalog(rows: readonly CatalogRow[], f: CatalogFilter): CatalogHit[] {
  const words = fold(f.query).split(/[\s,]+/).filter(Boolean);
  const out: CatalogHit[] = [];
  for (const row of rows) {
    if (TWINS[row.i]) continue;
    if (f.gear && (GEAR_OF[row.e] ?? 'bodyweight') !== f.gear) continue;
    if (f.muscle) {
      const m = musclesOf(row);
      if (!m.p.includes(f.muscle)) continue;
    }
    const name = fold(nameOf(row));
    const other = fold(`${LANG === 'pl' ? row.n[1] : row.n[0]} ${eqLabel(row)} ${row.e}`);
    const hits: Hit[] = [];
    const ok = words.every((w) => {
      const at = starts(name).find((i) => name.startsWith(w, i));
      if (at !== undefined) {
        hits.push({ start: at, length: w.length });
        return true;
      }
      return starts(other).some((i) => other.startsWith(w, i));
    });
    if (ok) out.push({ row, hits });
  }
  return out.sort((a, b) => collator.compare(nameOf(a.row), nameOf(b.row)));
}
