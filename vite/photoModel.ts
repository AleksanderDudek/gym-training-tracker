import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Plugin } from 'vite';
import { PHOTO_MODEL } from '../src/food/photo/model.ts';

/**
 * Model rozpoznawania dań ze zdjęcia (SigLIP 2, 54,6 MB) pod stałym adresem obok aplikacji:
 * `models/<wersja>/vision.onnx` i licencja Apache-2.0 obok. Plik nie trafia do gita — za duży, a
 * jego zawartość wyznacza przypięta rewizja z Hugging Face. Build pobiera go raz do
 * `~/.cache/gym-tracker` (albo `PHOTO_MODEL_CACHE`), sprawdza SHA-256 i rozmiar, a potem bierze
 * z tej kopii. Telefon nigdy nie pyta Hugging Face — tylko serwer aplikacji, jak przy danych OCR.
 */

export const MODEL_FILE = `${PHOTO_MODEL.dir}/vision.onnx`;
export const LICENSE_FILE = `${PHOTO_MODEL.dir}/LICENSE.txt`;

const url = `https://huggingface.co/${PHOTO_MODEL.repo}/resolve/${PHOTO_MODEL.revision}/${PHOTO_MODEL.file}`;

export function cachePath(): string {
  return join(process.env.PHOTO_MODEL_CACHE ?? join(homedir(), '.cache', 'gym-tracker'), `${PHOTO_MODEL.sha256}.onnx`);
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

let pending: Promise<string> | null = null;

/** The verified local copy, downloaded first if missing. A wrong download is deleted, never used. */
export function ensureModel(fetchImpl: typeof fetch = fetch): Promise<string> {
  pending ??= (async () => {
    const path = cachePath();
    if (existsSync(path)) {
      if (statSync(path).size === PHOTO_MODEL.bytes && (await sha256(path)) === PHOTO_MODEL.sha256) return path;
      rmSync(path, { force: true });
    }
    mkdirSync(dirname(path), { recursive: true });
    const part = `${path}.part`;
    const res = await fetchImpl(url);
    if (!res.ok || !res.body) throw new Error(`Model zdjęć: HTTP ${res.status} z ${url}`);
    await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(part));
    const got = await sha256(part);
    if (got !== PHOTO_MODEL.sha256 || statSync(part).size !== PHOTO_MODEL.bytes) {
      rmSync(part, { force: true });
      throw new Error(`Model zdjęć: zły plik z ${url} (sha256 ${got})`);
    }
    renameSync(part, path);
    return path;
  })().catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}

const license = () => readFileSync(new URL('./photoModel.LICENSE.txt', import.meta.url));

export function photoModel(): Plugin {
  return {
    name: 'gt-photo-model',
    configureServer(server) {
      // W trybie deweloperskim plik pobiera dopiero pierwsze zdjęcie, nie każdy start serwera.
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        if (path.endsWith(`/${LICENSE_FILE}`)) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(license());
          return;
        }
        if (!path.endsWith(`/${MODEL_FILE}`)) return next();
        ensureModel().then(
          (file) => {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', String(PHOTO_MODEL.bytes));
            createReadStream(file).pipe(res);
          },
          (e: unknown) => next(e),
        );
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: MODEL_FILE, source: readFileSync(await ensureModel()) });
      this.emitFile({ type: 'asset', fileName: LICENSE_FILE, source: license() });
    },
  };
}
