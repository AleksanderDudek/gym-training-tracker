// The app's own copy of the OpenStreetMap places „W pobliżu” shows in Poland — places to eat, grocery
// shops, bakeries and the Selgros and Makro halls — cut out of Geofabrik's extract of Poland with
// osmium-tool and written as data/osm/places-pl.tsv (one object per line, sorted by id) and
// data/osm/meta.json (where the data came from, its counts and the polygon it covers). The build
// cuts the TSV into small leaves, so the app reads the ones around the position instead of asking
// the public Overpass servers. A new copy replaces the committed one only when it passes the checks
// (`gates` in lib/osm.ts), and the same extract always gives the same bytes.
// Big files go to OSM_CACHE_DIR (default ~/.cache/gym-tracker/osm), outside the repository.
// Usage: npm run food:osm                       (download the extract, 2.1 GB, filter, export, write)
//        npm run food:osm -- --pbf <file>       (a poland-latest.osm.pbf on disk; <file>.md5 checked when there)
//        npm run food:osm -- --filtered <file>  (an extract already cut with the same osmium tags-filter)
//        npm run food:osm -- --poly <file>      (a poland.poly on disk instead of downloading it)
//        --keep-pbf  keep the downloaded extract in the cache for the next run
//        --force     write even when the checks fail (they are printed first)
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, statfs, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { formatTsv, parseTsv, type OsmRow } from '../../src/food/nearby/osmFormat.ts';
import { OSM_COLUMNS, osmiumFilterExpressions } from '../../src/food/nearby/osmTags.ts';
import {
  POLY_URL,
  SOURCE_URL,
  buildMeta,
  diffRows,
  gates,
  geometryErrors,
  parsePoly,
  readFeatures,
  simplifyCoverage,
  splitRecords,
  type Meta,
} from './lib/osm.ts';

/**
 * Geofabrik asks downloaders to say who they are. ASCII only: a header value is bytes, and fetch
 * refuses the „ż” of „W pobliżu” outright.
 */
const USER_AGENT = 'gym-tracker (+https://github.com/AleksanderDudek/gym-training-tracker; W poblizu OSM data)';
/** The download and its filtered copy need about this much room: below it, a warning. */
const MIN_FREE_BYTES = 3e9;
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT_DIR = join(ROOT, 'data/osm');
const TSV_FILE = join(OUT_DIR, 'places-pl.tsv');
const META_FILE = join(OUT_DIR, 'meta.json');
const CACHE = resolve(process.env.OSM_CACHE_DIR || join(homedir(), '.cache/gym-tracker/osm'));
/** More osmium geometry errors than this stop the refresh (a few broken areas in OSM are normal). */
const MAX_GEOMETRY_ERRORS = 50;
const USAGE = 'usage: npm run food:osm -- [--pbf <file> | --filtered <file>] [--poly <file>] [--keep-pbf] [--force]';

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function size(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1e3).toFixed(1)} kB`;
}

/** A step that throws on bad input (a cut-off poly, a broken export) stops with its message, not a stack. */
function orFail<T>(what: string, work: () => T): T {
  try {
    return work();
  } catch (error) {
    return fail(`${what}: ${(error as Error).message}`);
  }
}

const flags = (() => {
  try {
    return parseArgs({
      options: {
        pbf: { type: 'string' },
        filtered: { type: 'string' },
        poly: { type: 'string' },
        'keep-pbf': { type: 'boolean', default: false },
        force: { type: 'boolean', default: false },
      },
    }).values;
  } catch (error) {
    return fail(`${(error as Error).message}\n${USAGE}`);
  }
})();
/** A path as typed: npm runs the script from the repository root, the shell may have been elsewhere. */
const userPath = (file: string) => resolve(process.env.INIT_CWD ?? process.cwd(), file);
const shown = (file: string) => (file.startsWith(ROOT) ? relative(ROOT, file) : file);

const osmium = osmiumVersion();
await warnIfLowOnDisk(CACHE);

// The polygon first: it is small, and a bad one should stop the run before the long steps.
const polyText = flags.poly
  ? await readFile(userPath(flags.poly), 'utf8').catch((error: Error) => fail(`${flags.poly}: ${error.message}`))
  : await (await get(POLY_URL)).text();
const poly = orFail(flags.poly ? userPath(flags.poly) : POLY_URL, () => parsePoly(polyText));

let pbf: string | null = null;
let sourceMd5: string | null = null;
let fromCache = false;
if (flags.pbf) {
  pbf = userPath(flags.pbf);
  sourceMd5 = await localPbfMd5(pbf);
} else if (!flags.filtered) {
  ({ file: pbf, md5: sourceMd5 } = await cachedOrDownloadedPbf());
  fromCache = true;
}

let filtered: string;
if (flags.filtered) {
  filtered = userPath(flags.filtered);
  if (!existsSync(filtered)) fail(`${filtered}: no such file`);
} else {
  await mkdir(CACHE, { recursive: true });
  filtered = join(CACHE, 'poland-food.osm.pbf');
  console.log(`osmium tags-filter → ${filtered}`);
  run(['tags-filter', '-O', '-o', filtered, pbf!, ...osmiumFilterExpressions()]);
  if (fromCache && !flags['keep-pbf']) await rm(pbf!, { force: true });
}
const dataAsOf = replicationTimestamp(filtered);
if (flags.filtered && pbf && replicationTimestamp(pbf) !== dataAsOf) {
  fail(`${filtered} is not cut from ${pbf}: their data is of different moments`);
}
if (!sourceMd5) console.log('source md5 unknown: the run starts from a filtered extract (add --pbf <source> to record it)');

console.log(`osmium export ${filtered}`);
const exported = await exportLines(filtered);
const { rows, stats } = orFail(filtered, () => readFeatures(exported.lines));
if (exported.errors.length) {
  console.warn(`! osmium could not build ${exported.errors.length} object(s) — missing from the copy:`);
  for (const error of exported.errors.slice(0, 10)) console.warn(`    ${error}`);
}
const coverage = simplifyCoverage(poly);
const meta = buildMeta({ dataAsOf, sourceMd5, osmium, rows, stats, coverage });

const failures = gates(await readPreviousMeta(), meta, rows);
// A few broken areas in OSM are normal; many mean the export itself went wrong.
if (exported.errors.length > MAX_GEOMETRY_ERRORS)
  failures.push(`osmium geometry errors: ${exported.errors.length}, at most ${MAX_GEOMETRY_ERRORS} expected`);
if (failures.length) {
  console.error(`checks failed:\n${failures.map((failure) => `  ✗ ${failure}`).join('\n')}`);
  // The filtered extract stays in the cache: a rerun can start from it, without downloading or filtering again.
  const rerun = flags.filtered ? '' : `; --filtered ${filtered} reruns from the filtered extract`;
  if (!flags.force) fail(`nothing written (--force writes anyway${rerun})`);
  console.warn('! --force: writing anyway');
} else console.log('checks passed');

const previousRows = await readPreviousRows();
const tsv = formatTsv(rows, OSM_COLUMNS);
const metaText = `${JSON.stringify(meta, null, 2)}\n`;
await writeAll([
  [TSV_FILE, tsv],
  [META_FILE, metaText],
]);

const count = (n: number) => n.toLocaleString('en-US');
const points = (rings: readonly unknown[][]) => rings.reduce((sum, ring) => sum + ring.length, 0);
console.log(`
${shown(TSV_FILE)}: ${count(meta.rows)} rows (${count(meta.types.node)} nodes, ${count(meta.types.way)} ways, ${count(meta.types.relation)} relations)
  ${size(Buffer.byteLength(tsv))}, ${size(gzipSync(tsv, { level: 9 }).length)} gzipped; ${shown(META_FILE)} ${size(Buffer.byteLength(metaText))}
data as of ${dataAsOf}, osmium ${osmium}, source md5 ${sourceMd5 ?? 'unknown'}
kinds: ${Object.entries(meta.kinds)
  .map(([kind, n]) => `${kind} ${count(n)}`)
  .join(', ')}
dropped: ${count(stats.duplicates)} areas of closed ways (read as the way), ${count(stats.notMatching)} not asked for, ${count(stats.unnamed)} without a brand or a name
Warsaw bbox: ${count(meta.warsaw)} rows; Selgros/Makro halls: ${count(meta.halls)}
coverage: ${coverage.rings.length} ring(s), ${coverage.holes.length} hole(s), ${points([...coverage.rings, ...coverage.holes])} points of ${points([...poly.rings, ...poly.holes])} (within ${coverage.eps} m)`);
if (previousRows) {
  const diff = diffRows(previousRows, rows);
  console.log(`against the previous copy: ${count(diff.added)} added, ${count(diff.removed)} removed, ${count(diff.changed)} changed`);
} else console.log('no previous copy to compare with');

function osmiumVersion(): string {
  const result = spawnSync('osmium', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) fail('osmium-tool is needed: brew install osmium-tool / apt-get install osmium-tool');
  const first = result.stdout.split('\n')[0]!.trim();
  return first.match(/^osmium version (\S+)/)?.[1] ?? first;
}

/** One osmium command; its progress and errors go straight to the terminal. */
function run(args: string[]): string {
  const result = spawnSync('osmium', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (result.error || result.status !== 0) fail(`osmium ${args[0]} failed (${result.error?.message ?? `exit ${result.status}`})`);
  return result.stdout;
}

/** The extract's data moment, from its header — the filter copies the header into its output. */
function replicationTimestamp(file: string): string {
  const value = run(['fileinfo', '-g', 'header.option.osmosis_replication_timestamp', file]).trim();
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value)) fail(`${file}: no replication timestamp in the header ("${value}")`);
  return value;
}

async function warnIfLowOnDisk(dir: string) {
  let probe = dir;
  while (!existsSync(probe) && dirname(probe) !== probe) probe = dirname(probe);
  try {
    const { bavail, bsize } = await statfs(probe);
    const free = bavail * bsize;
    if (free < MIN_FREE_BYTES) console.warn(`! ${size(free)} free for ${dir}: the extract and its filtered copy need about ${size(MIN_FREE_BYTES)}`);
  } catch {
    // No free-space figure on this system: nothing to warn about.
  }
}

async function get(url: string): Promise<Response> {
  // No connection is a sentence, not a stack trace.
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } }).catch((error: Error) =>
    fail(`${url}: ${error.message}`),
  );
  if (!response.ok) fail(`${url}: ${response.status} ${response.statusText}`);
  return response;
}

function parseMd5(text: string, where: string): string {
  const md5 = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (!/^[0-9a-f]{32}$/.test(md5)) fail(`${where}: not an md5 file`);
  return md5;
}

async function md5Of(file: string): Promise<string> {
  const hash = createHash('md5');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** A local extract (`--pbf`), checked against its `.md5` when one lies beside it; never deleted. */
async function localPbfMd5(file: string): Promise<string> {
  if (!existsSync(file)) fail(`${file}: no such file`);
  console.log(`md5 of ${file}`);
  const md5 = await md5Of(file);
  if (existsSync(`${file}.md5`)) {
    const expected = parseMd5(await readFile(`${file}.md5`, 'utf8'), `${file}.md5`);
    if (md5 !== expected) fail(`${file}: md5 ${md5}, but ${file}.md5 says ${expected} (a broken or partial file?)`);
  }
  return md5;
}

/**
 * The current extract: the cached one when its md5 is Geofabrik's, else one download, hashed as it
 * streams to a `.part` file that becomes the extract only when the md5 matches. A failed download
 * is not retried: the run stops and says so.
 */
async function cachedOrDownloadedPbf(): Promise<{ file: string; md5: string }> {
  const expected = parseMd5(await (await get(`${SOURCE_URL}.md5`)).text(), `${SOURCE_URL}.md5`);
  await mkdir(CACHE, { recursive: true });
  const file = join(CACHE, 'poland-latest.osm.pbf');
  if (existsSync(file)) {
    console.log(`checking the cached ${file}`);
    if ((await md5Of(file)) === expected) return { file, md5: expected };
    console.log('the cached extract is not the current one');
  }
  const part = `${file}.part`;
  const response = await get(SOURCE_URL);
  if (!response.body) fail(`${SOURCE_URL}: an empty answer`);
  const total = Number(response.headers.get('content-length')) || 0;
  console.log(`downloading ${SOURCE_URL} (${total ? size(total) : 'size unknown'})`);
  const hash = createHash('md5');
  let received = 0;
  let reported = 0;
  const tap = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      hash.update(chunk);
      received += chunk.length;
      if (total && received - reported >= total / 10) {
        reported = received;
        console.log(`  ${Math.round((received / total) * 100)} %`);
      }
      done(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body), tap, createWriteStream(part));
  } catch (error) {
    await rm(part, { force: true });
    fail(`download of ${SOURCE_URL} broke off: ${(error as Error).message}`);
  }
  const md5 = hash.digest('hex');
  if (md5 !== expected) {
    await rm(part, { force: true });
    fail(`downloaded extract: md5 ${md5}, Geofabrik says ${expected} (replaced during the download? try again later)`);
  }
  await rename(part, file);
  return { file, md5 };
}

/**
 * osmium's GeoJSON export of the filtered extract, as records, and the geometry errors it reported:
 * the export goes to a file in the cache, so osmium's own output (`-e`) holds only the errors.
 */
async function exportLines(file: string): Promise<{ lines: string[]; errors: string[] }> {
  await mkdir(CACHE, { recursive: true });
  const out = join(CACHE, 'poland-food.geojsonseq');
  const result = spawnSync('osmium', ['export', file, '-f', 'geojsonseq', '-u', 'type_id', '-e', '-O', '-o', out], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(`osmium export: ${result.error.message}`);
  if (result.status !== 0) fail(`osmium export ended with exit code ${result.status}: ${result.stderr.trim()}`);
  const lines = splitRecords(await readFile(out, 'utf8'));
  await rm(out, { force: true });
  return { lines, errors: geometryErrors(`${result.stdout}\n${result.stderr}`) };
}

/** The committed meta file the new copy is checked against; `null` when there is none (a first copy). */
async function readPreviousMeta(): Promise<Meta | null> {
  if (!existsSync(META_FILE)) return null;
  try {
    const previous = JSON.parse(await readFile(META_FILE, 'utf8')) as Meta;
    if (previous.format === 1 && Number.isFinite(previous.rows) && typeof previous.dataAsOf === 'string' && previous.kinds) return previous;
  } catch {
    // Not JSON: the warning below.
  }
  console.warn(`! ${shown(META_FILE)} is not a meta file this script wrote: checking the new copy as a first one`);
  return null;
}

async function readPreviousRows(): Promise<OsmRow[] | null> {
  if (!existsSync(TSV_FILE)) return null;
  try {
    return parseTsv(await readFile(TSV_FILE, 'utf8')).rows;
  } catch (error) {
    console.warn(`! the previous ${shown(TSV_FILE)} does not read (${(error as Error).message}): no comparison`);
    return null;
  }
}

/** Every file to a `.tmp` beside it first, renamed only when all are written: no half-written copy. */
async function writeAll(files: [string, string][]) {
  await mkdir(OUT_DIR, { recursive: true });
  try {
    for (const [file, text] of files) await writeFile(`${file}.tmp`, text);
    for (const [file] of files) await rename(`${file}.tmp`, file);
  } finally {
    for (const [file] of files) await rm(`${file}.tmp`, { force: true });
  }
}
