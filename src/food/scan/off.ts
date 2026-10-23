import { LANG, text } from '../../i18n';
import { compactImagePath } from '../lib/images';
import type { NutriGrade } from '../lib/types';

/**
 * A code the app's own dataset does not know, asked of Open Food Facts - the open database the
 * dataset is built from, with every product in it, not only the ones sold in Poland with complete
 * labels. Only the code is sent; the answer comes back with CORS open to everyone, as a plain GET.
 */
export const OFF_API = 'https://world.openfoodfacts.org/api/v2/product/';

const FIELDS = [
  'code',
  'product_name',
  'product_name_pl',
  'product_name_en',
  'brands',
  'quantity',
  'serving_size',
  'nutriments',
  'image_front_small_url',
  'nutriscore_grade',
].join(',');

const TIMEOUT_MS = 10_000;

export class OffUnavailable extends Error {
  constructor() {
    super(text({ pl: 'Open Food Facts nie odpowiada.', en: 'Open Food Facts isn’t answering.' }));
    this.name = 'OffUnavailable';
  }
}

/** Per 100 g (or 100 ml), as the label gives it; `null` where it gives nothing. */
export interface Per100 {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  sugars: number | null;
  fat: number | null;
  saturatedFat: number | null;
  fiber: number | null;
  salt: number | null;
}

export interface OffProduct {
  code: string;
  name: string;
  brands: string | null;
  quantity: string | null;
  /** The compact image path the app's `ProductImage` takes. */
  image: string | null;
  nutriscore: NutriGrade | null;
  per100: Per100;
}

const GRADES = new Set(['a', 'b', 'c', 'd', 'e']);

function number(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** The product from an API answer; `null` when Open Food Facts does not know the code. */
export function parseOff(json: unknown): OffProduct | null {
  const answer = json as { status?: unknown; code?: unknown; product?: Record<string, unknown> } | null;
  const p = answer?.product;
  if (answer?.status !== 1 || !p) return null;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kj = number(n['energy-kj_100g']) ?? number(n['energy_100g']);
  const kcal = number(n['energy-kcal_100g']) ?? (kj === null ? null : kj / 4.184);
  const name = [LANG === 'en' ? p.product_name_en : p.product_name_pl, p.product_name].find(
    (v): v is string => typeof v === 'string' && v.trim() !== '',
  );
  const grade = typeof p.nutriscore_grade === 'string' ? p.nutriscore_grade.toLowerCase() : '';
  return {
    code: String(p.code ?? answer.code ?? ''),
    name: name?.trim() ?? '',
    brands: typeof p.brands === 'string' && p.brands.trim() ? p.brands.split(',')[0]!.trim() : null,
    quantity: typeof p.quantity === 'string' && p.quantity.trim() ? p.quantity.trim() : null,
    image: compactImagePath(typeof p.image_front_small_url === 'string' ? p.image_front_small_url : undefined),
    nutriscore: GRADES.has(grade) ? (grade as NutriGrade) : null,
    per100: {
      kcal: kcal === null ? null : Math.round(kcal),
      protein: round1(number(n.proteins_100g)),
      carbs: round1(number(n.carbohydrates_100g)),
      sugars: round1(number(n.sugars_100g)),
      fat: round1(number(n.fat_100g)),
      saturatedFat: round1(number(n['saturated-fat_100g'])),
      fiber: round1(number(n.fiber_100g)),
      salt: round1(number(n.salt_100g)),
    },
  };
}

interface Options {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/** One product by its code; `null` when unknown (404 or `status: 0`), `OffUnavailable` when the server fails. */
export async function fetchOff(code: string, { signal, fetchImpl = fetch }: Options = {}): Promise<OffProduct | null> {
  // The caller's abort or the timeout, whichever comes first (no `AbortSignal.any` before Safari 17.4).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetchImpl(`${OFF_API}${encodeURIComponent(code)}?fields=${FIELDS}`, { signal: controller.signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new OffUnavailable();
    return parseOff(await response.json());
  } catch (error) {
    if (signal?.aborted || error instanceof OffUnavailable) throw error;
    throw new OffUnavailable();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
