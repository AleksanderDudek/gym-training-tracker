import type { Source } from './kit';
import * as northWest from './northWest';

/**
 * The regional additions to the photo catalog's sources, one file per region. Each exports
 * `DISHES` (id → source, the same ids as its half in `src/food/photo/catalog/`) and may export
 * `PARTS` (shared sub-recipes). An id in two files stops the build.
 */
const regions: { DISHES: Record<string, Source>; PARTS?: Record<string, Source> }[] = [northWest];

function merged(pick: (r: (typeof regions)[number]) => Record<string, Source> | undefined): Record<string, Source> {
  const out: Record<string, Source> = {};
  for (const r of regions)
    for (const [id, source] of Object.entries(pick(r) ?? {})) {
      if (id in out) throw new Error(`${id} is in two region files`);
      out[id] = source;
    }
  return out;
}

export const REGION_DISHES = merged((r) => r.DISHES);
export const REGION_PARTS = merged((r) => r.PARTS);
