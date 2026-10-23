/**
 * What reads barcodes from the camera: the browser's own `BarcodeDetector` where it reads shop
 * codes (Chrome on Android, Chrome and Safari on macOS), otherwise the same API built on zxing-cpp
 * compiled to WebAssembly (`barcode-detector`), loaded only then. Its WASM file comes from the
 * app's own server, never a CDN: the content security policy allows nothing else, and the service
 * worker keeps it for a shop without signal.
 */

/** Shop barcodes only: QR codes and the like on a pack are not product codes. */
export const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

export interface Detected {
  rawValue: string;
  format: string;
}

export interface Detector {
  detect(source: HTMLVideoElement): Promise<Detected[]>;
}

/** The browser's detector, as far as this code needs it (TypeScript's DOM types do not have it yet). */
interface NativeDetectorClass {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

async function native(): Promise<Detector | null> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (!Native) return null;
  try {
    const supported = await Native.getSupportedFormats();
    const formats = FORMATS.filter((f) => supported.includes(f));
    return formats.includes('ean_13') ? new Native({ formats }) : null;
  } catch {
    return null;
  }
}

async function zxing(): Promise<Detector> {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  // Fetched and compiled now, while the camera starts: a failure (offline before the first scan)
  // says so at once instead of a scanner that silently reads nothing.
  await prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
    fireImmediately: true,
  });
  return new BarcodeDetector({ formats: [...FORMATS] });
}

let detector: Promise<Detector> | null = null;

/** One detector per page; a failed load (offline before the first scan) is tried again next time. */
export function getDetector(): Promise<Detector> {
  detector ??= native()
    .then((found) => found ?? zxing())
    .catch((error: unknown) => {
      detector = null;
      throw error;
    });
  return detector;
}
