import type { ExerciseId } from '../types';

/**
 * Bloki treningu: ćwiczenie robione seriami pod rząd, para robiona na zmianę albo obwód.
 *
 * W zapisie treningu para to dwa sąsiednie ćwiczenia, z których drugie ma `pair: true`
 * („na zmianę z poprzednim”). Para ma najwyżej dwa ćwiczenia — przerwa jednego jest pracą
 * drugiego, a każda seria wciąż idzie na pełnej sile.
 *
 * Obwód to sąsiednie ćwiczenia z `circuit: true` — stacje robione po kolei, runda po rundzie.
 * Między stacjami tylko przejście, pełna przerwa dopiero po rundzie. To inny cel niż para:
 * gęstość pracy i kondycja zamiast pełnej siły w każdej serii, więc stacje mają zmieniać partie.
 */

export interface Block {
  /** Numer bloku od jedynki — tak stoi w sesji: „2A”, „2B”. */
  n: number;
  kind: 'straight' | 'pair' | 'circuit';
  ids: ExerciseId[];
}

export function blocksOf(
  items: readonly { ex: ExerciseId; pair?: boolean | undefined; circuit?: boolean | undefined }[],
): Block[] {
  const out: Block[] = [];
  items.forEach((it, i) => {
    const last = out[out.length - 1];
    if (it.circuit) {
      if (last?.kind === 'circuit') last.ids.push(it.ex);
      else out.push({ n: out.length + 1, kind: 'circuit', ids: [it.ex] });
      return;
    }
    if (it.pair && i > 0 && last && last.kind === 'straight' && last.ids.length === 1) {
      last.kind = 'pair';
      last.ids.push(it.ex);
      return;
    }
    out.push({ n: out.length + 1, kind: 'straight', ids: [it.ex] });
  });
  return out;
}

const LETTERS = 'ABCDEFGHIJKL';

/** Oznaczenie ćwiczenia w bloku: „3”, w parze „2A”, „2B”, w obwodzie „4A” … „4G”. */
export const tagOf = (b: Block, i: number): string => (b.kind === 'straight' ? String(b.n) : `${b.n}${LETTERS[i] ?? ''}`);
