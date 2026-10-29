import { ENTRIES as eastAsia } from './eastAsia';
import type { Entry } from './kit';

/**
 * The regional additions to the photo catalog, one file per region, each exporting `ENTRIES`.
 * Their values come from `scripts/food/dish-sources/` under the same ids (`npm run food:dishes`).
 */
const regions: (readonly Entry[])[] = [eastAsia];

export const REGION_ENTRIES: readonly Entry[] = regions.flat();
