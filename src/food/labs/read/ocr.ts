/**
 * Text from a photo of a printout, on the device: Tesseract (WebAssembly) with Polish data. The
 * worker, the core (3.9 MB) and the language data (2.6 MB) come from the app's own server the
 * first time someone reads a photo, and from the service worker's copy afterwards. The photo
 * never leaves the phone.
 */

export interface OcrProgress {
  /** 0–1 of the current step. */
  share: number;
  step: 'load' | 'read';
  /** Which picture, from 1. */
  page: number;
  pages: number;
}

/**
 * Tesseract reads best with letters about 30 px tall: a screenshot or a scan is enlarged (up to 3×),
 * a 12-megapixel photo stays as it is. Tested on a printout at 1600 px: lost decimal commas and
 * misread names at 1×, the same rows exact at 2×. Capped at 12 megapixels, under the canvas limit
 * of iPhones. Grey with a little more contrast.
 */
async function prepare(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(3, 3600 / Math.max(bitmap.width, bitmap.height), Math.sqrt(12e6 / (bitmap.width * bitmap.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  ctx.filter = 'grayscale(1) contrast(1.2)';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? image), 'image/png'));
}

export async function readImages(images: readonly Blob[], onProgress?: (p: OcrProgress) => void): Promise<string[]> {
  const [{ createWorker }, { default: workerPath }, { default: corePath }] = await Promise.all([
    import('tesseract.js'),
    import('tesseract.js/dist/worker.min.js?url'),
    import('tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'),
  ]);
  let page = 1;
  const worker = await createWorker('pol', 1, {
    workerPath: new URL(workerPath, document.baseURI).href,
    corePath: new URL(corePath, document.baseURI).href,
    langPath: new URL('ocr/4.0.0_best_int', document.baseURI).href,
    // A blob worker is refused by the policy (`worker-src 'self'`); the file itself is the app's.
    workerBlobURL: false,
    // The service worker keeps the copy; Tesseract's own IndexedDB cache would be a second one.
    cacheMethod: 'none',
    logger: (m: { status: string; progress: number }) =>
      onProgress?.({ share: m.progress, step: m.status.startsWith('recognizing') ? 'read' : 'load', page, pages: images.length }),
  });
  try {
    const lines: string[] = [];
    for (const image of images) {
      const { data } = await worker.recognize(await prepare(image));
      lines.push(...data.text.split('\n'));
      page += 1;
    }
    return lines;
  } finally {
    void worker.terminate();
  }
}
