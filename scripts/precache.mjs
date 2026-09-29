/**
 * Wpisuje do `dist/sw.js` wersję buildu i listę plików do zapisania przy instalacji.
 *
 * Bez tego service worker zapisywał skrypt i style dopiero przy drugiej wizycie, więc pierwsze
 * uruchomienie bez zasięgu kończyło się pustą stroną. Wersja z czasu budowania zmienia się przy
 * każdym wdrożeniu, więc aktywacja kasuje stare kopie — także ikon i manifestu, które nie mają
 * hasza w nazwie. Uruchamiany przez `npm run build`, po `vite build`.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const files = readdirSync(join(dist, 'assets'))
  .filter((f) => /\.(js|css)$/.test(f))
  .sort()
  .map((f) => `./assets/${f}`);

const sw = join(dist, 'sw.js');
const src = readFileSync(sw, 'utf8');
if (!src.includes("const VERSION = 'dev';") || !src.includes('const BUILD_FILES = [];')) {
  throw new Error('sw.js: brak znaczników wersji albo listy plików — czy ktoś zmienił ich zapis?');
}
const version = Date.now().toString(36);
writeFileSync(
  sw,
  src
    .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
    .replace('const BUILD_FILES = [];', `const BUILD_FILES = ${JSON.stringify(files)};`),
);
const n = files.length;
const forms = n === 1 ? 'plik' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'pliki' : 'plików';
console.log(`sw.js: wersja ${version}, ${n} ${forms} do zapisania przy instalacji`);
