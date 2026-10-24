// The watch list for „Czy mój zegarek jest obsługiwany?” (spec 2026-10-24 §4.11): builds
// src/watches/garmin.json from garmin/manifest.xml, the Connect IQ SDK device files (compiler.json and
// <id>.api.debug.xml of every device downloaded in SDK Manager) and the trimmed store catalog
// garmin/store-devices.json. The rules live in lib.ts; this file only reads and writes.
// Usage: npm run garmin:watches               (write src/watches/garmin.json)
//        npm run garmin:watches -- --check    (build in memory; exit 1 when the committed list differs — build.sh runs it)
//        npm run garmin:watches -- --store    (refresh garmin/store-devices.json from the store catalog first, then write)
// Devices folder: CIQ_DEVICES, default ~/Library/Application Support/Garmin/ConnectIQ/Devices.
// SDK version: CIQ_SDK (the SDK folder, as in build.sh), else current-sdk.cfg next to the devices folder.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STALE,
  STORE_CATALOG_URL,
  buildList,
  changedIds,
  parseManifest,
  sdkVersion,
  serialize,
  storeOnly,
  trimStore,
  type SdkDevice,
  type StoreDevice,
  type WatchList,
} from './lib';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MANIFEST = join(ROOT, 'garmin/manifest.xml');
const STORE = join(ROOT, 'garmin/store-devices.json');
const OUT = join(ROOT, 'src/watches/garmin.json');
const CIQ_HOME = join(homedir(), 'Library/Application Support/Garmin/ConnectIQ');

const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== '--check' && a !== '--store');
if (unknown.length) fail(`nieznane: ${unknown.join(' ')} — użycie: npm run garmin:watches [-- --check | --store]`);
const check = args.includes('--check');
const refresh = args.includes('--store');
if (check && refresh) fail('--check tylko sprawdza, a --store zapisuje katalog sklepu — jedno albo drugie');

const devDir = process.env.CIQ_DEVICES || join(CIQ_HOME, 'Devices');
if (!existsSync(devDir)) fail(`nie ma katalogu urządzeń Connect IQ: ${devDir} — pobierz urządzenia w SDK Managerze albo ustaw CIQ_DEVICES`);

function readSdk(): string {
  const sources = [process.env.CIQ_SDK ?? '', ...[join(devDir, '..', 'current-sdk.cfg'), join(CIQ_HOME, 'current-sdk.cfg')].filter(existsSync).map((f) => readFileSync(f, 'utf8'))];
  for (const s of sources) {
    const v = sdkVersion(s);
    if (v) return v;
  }
  return fail('nie znam wersji Connect IQ SDK — wybierz SDK w SDK Managerze (current-sdk.cfg) albo ustaw CIQ_SDK');
}

function readDevices(): SdkDevice[] {
  const out: SdkDevice[] = [];
  for (const id of readdirSync(devDir).sort()) {
    const compiler = join(devDir, id, 'compiler.json');
    if (!existsSync(compiler)) continue;
    const j = JSON.parse(readFileSync(compiler, 'utf8')) as Omit<SdkDevice, 'id' | 'api'>;
    const api = join(devDir, id, `${id}.api.debug.xml`);
    out.push({
      id,
      displayName: j.displayName,
      webDocDeviceGroup: j.webDocDeviceGroup,
      appTypes: j.appTypes ?? [],
      partNumbers: j.partNumbers ?? [],
      api: existsSync(api) ? readFileSync(api, 'utf8') : '',
    });
  }
  return out;
}

const readStore = (): StoreDevice[] => (existsSync(STORE) ? trimStore(JSON.parse(readFileSync(STORE, 'utf8'))) : []);

async function fetchStore(): Promise<StoreDevice[]> {
  const res = await fetch(STORE_CATALOG_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) return fail(`katalog sklepu: HTTP ${res.status} (${STORE_CATALOG_URL})`);
  return trimStore(await res.json());
}

const devices = readDevices();
let store = readStore();
if (refresh) {
  const before = new Set(store.map((s) => s.partNumber));
  const next = await fetchStore();
  const after = new Set(next.map((s) => s.partNumber));
  const added = next.filter((s) => !before.has(s.partNumber));
  const removed = store.filter((s) => !after.has(s.partNumber));
  writeFileSync(STORE, serialize(next));
  console.log(`garmin/store-devices.json: ${next.length} urządzeń (nowych ${added.length}, usuniętych ${removed.length})`);
  // A watch the store sells but SDK Manager doesn't have yet: the check should say „jeszcze nie”.
  for (const s of storeOnly(added, devices))
    console.warn(`! nowy w sklepie, a nie ma go w SDK: ${s.name} (${s.partNumber}) — pobierz go w SDK Managerze albo dodaj jako notYet w src/watches/extra.ts`);
  store = next;
}

const { list, warnings } = buildList({ manifest: parseManifest(readFileSync(MANIFEST, 'utf8')), devices, store, sdk: readSdk() });
// The warnings are about the data — what to look at when regenerating, not when checking.
if (!check) for (const w of warnings) console.warn(`! ${w}`);
const text = serialize(list);
const names = list.supported.reduce((n, s) => n + s.names.length + (s.aliases?.length ?? 0), 0);
const summary = `obsługiwane ${list.supported.length} (nazw ${names}), nieobsługiwane z SDK ${list.unsupported.length}, SDK ${list.sdk}`;

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current === text) {
    console.log(`Lista zegarków aktualna: ${summary}`);
  } else {
    let ids: string[] = [];
    try {
      ids = changedIds(JSON.parse(current) as WatchList, list);
    } catch {
      // No file or not JSON: everything changed.
    }
    fail(`${STALE}${ids.length ? ` (zmienione: ${ids.join(', ')})` : ''}`);
  }
} else {
  writeFileSync(OUT, text);
  console.log(`src/watches/garmin.json: ${summary}`);
}
