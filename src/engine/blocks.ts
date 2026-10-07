import type { ExerciseId } from '../types';

/**
 * Bloki treningu: ćwiczenie robione seriami pod rząd albo para robiona na zmianę.
 *
 * W zapisie treningu para to dwa sąsiednie ćwiczenia, z których drugie ma `pair: true`
 * („na zmianę z poprzednim”). Para ma najwyżej dwa ćwiczenia — trzy i więcej to już obwód,
 * a w obwodzie trudno utrzymać przerwę, która pozwala zrobić każdą serię na pełnej sile.
 */

export interface Block {
  /** Numer bloku od jedynki — tak stoi w sesji: „2A”, „2B”. */
  n: number;
  kind: 'straight' | 'pair';
  ids: ExerciseId[];
}

export function blocksOf(items: readonly { ex: ExerciseId; pair?: boolean | undefined }[]): Block[] {
  const out: Block[] = [];
  items.forEach((it, i) => {
    const last = out[out.length - 1];
    if (it.pair && i > 0 && last && last.ids.length === 1) {
      last.kind = 'pair';
      last.ids.push(it.ex);
      return;
    }
    out.push({ n: out.length + 1, kind: 'straight', ids: [it.ex] });
  });
  return out;
}

/** Oznaczenie ćwiczenia w bloku: „3” albo „2A”, „2B”. */
export const tagOf = (b: Block, i: number): string => (b.kind === 'pair' ? `${b.n}${'AB'[i] ?? ''}` : String(b.n));
