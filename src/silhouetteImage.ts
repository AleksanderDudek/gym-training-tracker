/**
 * Zdjęcie sylwetki z aparatu albo z galerii, zmniejszone w przeglądarce: dłuższy bok do 1080 px
 * (do porównania na ekranie telefonu więcej nie trzeba, a 12 MP zjadałoby miejsce i pamięć)
 * i miniatura do listy. Oba jako JPEG. Plik nigdzie nie wychodzi.
 *
 * `createImageBitmap` obraca zdjęcie według EXIF (domyślne `imageOrientation: 'from-image'`);
 * gdzie go nie ma, zostaje zwykły `<img>`, który też czyta orientację.
 */

export const LONG_SIDE = 1080;
export const THUMB_SIDE = 320;

export interface PreparedPhoto {
  full: Blob;
  thumb: Blob;
  w: number;
  h: number;
}

type Source = { image: CanvasImageSource; w: number; h: number; close: () => void };

async function decode(file: Blob): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, w: bitmap.width, h: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Niektóre przeglądarki nie dekodują tak wszystkiego — spróbuj przez <img>.
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { image: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

function draw(src: Source, side: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const f = Math.min(1, side / Math.max(src.w, src.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(src.w * f));
  canvas.height = Math.max(1, Math.round(src.h * f));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no 2d context'));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.image, 0, 0, canvas.width, canvas.height);
  const { width: w, height: h } = canvas;
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        // Płótno oddaje pamięć od razu, a nie przy sprzątaniu.
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve({ blob, w, h });
        else reject(new Error('no jpeg'));
      },
      'image/jpeg',
      quality,
    ),
  );
}

/** Zdjęcie gotowe do zapisu. Odrzuca, gdy przeglądarka nie umie go odczytać (np. HEIC na komputerze). */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const src = await decode(file);
  try {
    if (!src.w || !src.h) throw new Error('empty image');
    const full = await draw(src, LONG_SIDE, 0.85);
    const thumb = await draw(src, THUMB_SIDE, 0.75);
    return { full: full.blob, thumb: thumb.blob, w: full.w, h: full.h };
  } finally {
    src.close();
  }
}
