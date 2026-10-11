// Photos stay on the Open Food Facts CDN. Every one of them shares this prefix
// and differs between sizes only in its suffix (`.400.jpg` / `.200.jpg`), so
// the dataset stores the path alone and the size is chosen here — that took
// 7 MB of repeated text out of products.json.

export const OFF_IMAGE_BASE = 'https://images.openfoodfacts.org/images/products/';

export type ImageSize = 100 | 200 | 400;

/** Full URL -> compact path; a foreign https URL is kept whole; else null. */
export function compactImagePath(url: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed?.startsWith('https://')) return null;
  return trimmed.startsWith(OFF_IMAGE_BASE) ? trimmed.slice(OFF_IMAGE_BASE.length) : trimmed;
}

export function imageUrl(path: string, size: ImageSize = 400): string {
  if (path.startsWith('https://')) return path;
  return OFF_IMAGE_BASE + path.replace(/\.(100|200|400)\.jpg$/, `.${size}.jpg`);
}
