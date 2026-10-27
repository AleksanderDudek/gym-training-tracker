import { createReadStream, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dane języka polskiego dla OCR (Tesseract, `@tesseract.js-data/pol`, model LSTM „best_int”,
 * 2,6 MB) pod stałym adresem obok aplikacji. Tesseract składa adres sam — katalog plus
 * `pol.traineddata.gz` — więc plik nie może mieć haszu w nazwie, jak zwykłe zasoby Vite'a; wersja
 * jest w ścieżce. Bez CDN: polityka bezpieczeństwa i prywatność (zdjęcie wyników nie wychodzi
 * z telefonu, a żaden obcy serwer nie wie, że ktoś je czytał).
 */

export const OCR_DIR = 'ocr/4.0.0_best_int';
const FILE = 'pol.traineddata.gz';

function source(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('@tesseract.js-data/pol/package.json')), '4.0.0_best_int', FILE);
}

export function ocrData(): Plugin {
  const path = `/${OCR_DIR}/${FILE}`;
  return {
    name: 'gt-ocr-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.split('?')[0]?.endsWith(path)) return next();
        res.setHeader('Content-Type', 'application/octet-stream');
        createReadStream(source()).pipe(res);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: `${OCR_DIR}/${FILE}`, source: readFileSync(source()) });
    },
  };
}
