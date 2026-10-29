import { say } from '../../../i18n';
import type { Dish, FatScale, SauceKind, SauceLevel, SauceScale, SweetLevel, SweetScale } from '../dishes';

/**
 * The building blocks of a catalog entry: portions with their household names, the scale steps
 * shared by many dishes. The first 351 dishes are in `../dishes.ts`, the rest in one file per
 * region here; each region's USDA sources are in `scripts/food/dish-sources/` under the same ids.
 */

/** A portion: its household name (`say`) with the grams after it, „1 talerz (350 g)”. */
export const p = (g: number, label: string) => ({ g, label: `${label} (${g} g)` });
/** A drink's portion in ml; 1 ml is taken as 1 g (milk 1.03, wine 0.99 - within the range). */
export const ml = (g: number, label: string) => ({ g, label: `${label} (${g} ml)` });

export const PLATE = say('1 talerz', '1 plate');
export const SOUP = say('1 talerz', '1 bowl');
export const BOWL = say('1 miska', '1 bowl');
export const SMALL_BOWL = say('1 miseczka', '1 small bowl');
export const SERVING = say('1 porcja', '1 serving');
export const PIECE = say('1 sztuka', '1 piece');
export const SLICE = say('1 kawałek', '1 slice');
export const SANDWICH = say('1 kanapka', '1 sandwich');
export const HALF_PIZZA = say('½ pizzy 32 cm', '½ of a 32 cm pizza');
export const CUTLET = say('1 kotlet', '1 cutlet');
export const MUG = say('1 kubek', '1 mug');
export const CUP = say('1 filiżanka', '1 cup');
export const GLASS = say('1 szklanka', '1 glass');
export const BIG_GLASS = say('1 duża szklanka', '1 large glass');
export const CAN = say('1 puszka', '1 can');
export const WINE_GLASS = say('1 kieliszek', '1 glass');
export const PIECES = (count: number) => `${count} ${say('sztuk', 'pieces')}`;
export const PIECES_FEW = (count: number) => `${count} ${say('sztuki', 'pieces')}`;

export const FAT_FRIED: FatScale = { step: 4 };
export const FAT_RICH: FatScale = { step: 3 };
export const FAT_COOKED: FatScale = { step: 2 };
export const FAT_LIGHT: FatScale = { step: 1 };
export const sweet = (step: number, base: SweetLevel = 'usual'): SweetScale => ({ step, base });
export const sauce = (kind: SauceKind, step: number, base: SauceLevel = 'usual'): SauceScale => ({ kind, step, base });

export type Entry = Omit<Dish, 'per100'>;

