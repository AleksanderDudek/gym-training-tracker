import { ENTRIES as americas } from './americas';
import { ENTRIES as cee } from './cee';
import { ENTRIES as eastAsia } from './eastAsia';
import { ENTRIES as everyday } from './everyday';
import { ENTRIES as generic } from './generic';
import { ENTRIES as meaCaucasus } from './meaCaucasus';
import { ENTRIES as med } from './med';
import { ENTRIES as northWest } from './northWest';
import { ENTRIES as southAsiaSea } from './southAsiaSea';
import type { Entry } from './kit';

/**
 * The regional additions to the photo catalog, one file per region, each exporting `ENTRIES`.
 * Their values come from `scripts/food/dish-sources/` under the same ids (`npm run food:dishes`).
 */
const regions: (readonly Entry[])[] = [americas, cee, eastAsia, everyday, generic, meaCaucasus, med, northWest, southAsiaSea];

export const REGION_ENTRIES: readonly Entry[] = regions.flat();
