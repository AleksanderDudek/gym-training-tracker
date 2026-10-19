import { addDays } from '../diet/model';

/**
 * Cooked food keeps 3–4 days in the fridge (USDA FSIS, "Leftovers and Food Safety"): a dish cooked
 * on the first day of a block is eaten that day and the three after it, never later.
 */
export const BLOCK_DAYS = 4;

export interface Block {
  /** The cooking day: the block's first day. */
  start: string;
  dates: string[];
}

/**
 * The plan's days in cooking blocks of at most four, as even as they can be: seven days are cooked
 * on day 1 and day 5 (4 + 3, the classic Sunday and Wednesday prep), five are 3 + 2, fourteen
 * 4 + 4 + 3 + 3. Longer blocks first, so the first cooking - right after shopping - is the big one.
 */
export function cookingBlocks(start: string, days: number): Block[] {
  const count = Math.ceil(days / BLOCK_DAYS);
  const base = Math.floor(days / count);
  const longer = days % count;
  const blocks: Block[] = [];
  let offset = 0;
  for (let b = 0; b < count; b++) {
    const size = base + (b < longer ? 1 : 0);
    const dates = Array.from({ length: size }, (_, i) => addDays(start, offset + i));
    blocks.push({ start: dates[0]!, dates });
    offset += size;
  }
  return blocks;
}

/** The plan's dates, day by day. */
export function planDates(start: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}
