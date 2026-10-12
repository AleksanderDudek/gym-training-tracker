/**
 * The size of one pack from "150 g", "0,5 l", "4 x 125 g" or "330ml": one
 * piece of a multipack, millilitres as grams. Anything over 600 g (a family
 * pack, a litre of milk) or unreadable is null - nobody eats a kilo of twaróg
 * as "one portion".
 */
export function packGrams(quantity: string | null): number | null {
  if (!quantity) return null;
  const text = quantity.toLowerCase().replace(',', '.');
  const multi = text.match(/\d+\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|ml)\b/);
  const single = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  let grams: number | null = null;
  if (multi) grams = Number(multi[1]);
  else if (single) grams = Number(single[1]) * (single[2] === 'kg' || single[2] === 'l' ? 1000 : 1);
  return grams && grams > 0 && grams <= 600 ? Math.round(grams) : null;
}
