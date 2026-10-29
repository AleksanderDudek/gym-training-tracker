import { ENTRIES as generic } from './generic';
import { ENTRIES as med } from './med';
import { ENTRIES as northWest } from './northWest';
import type { Entry } from './kit';

/**
 * The regional additions to the photo catalog, one file per region, each exporting `ENTRIES`.
 * Their values come from `scripts/food/dish-sources/` under the same ids (`npm run food:dishes`).
 */
const regions: (readonly Entry[])[] = [generic, med, northWest];

export const REGION_ENTRIES: readonly Entry[] = regions.flat();
