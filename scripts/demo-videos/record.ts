// Records the demo videos: one take per need, 25–45 s each, into demo-videos/ with a description
// (.md) and a contact sheet (.jpg) per video for post-production.
// Usage: npm run demo:videos [-- <slug-prefix>…] [--skip-build] [--describe-only]
// --describe-only rewrites the descriptions and contact sheets from the last takes (after a change
// to a scenario's copy) without recording again.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { contactSheet, timeline, writeDescription } from './lib/describe';
import { CACHE_DIR } from './lib/netcache';
import { probeDuration, SCALE, Take, VIEWPORT, type TakeResult } from './lib/recorder';
import { cacheOutsideRequests } from './lib/netcache';
import { installTouchMarks, Scene } from './lib/scene';
import { seed } from './lib/seed';
import type { Scenario } from './lib/types';
import { SCENARIOS } from './scenarios';

const OUT = 'demo-videos';
const PORT = 4327;
const BASE = `http://localhost:${PORT}/`;
/** The hard limits for every video, in seconds. */
const MIN = 25;
const MAX = 45;

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const chosen = SCENARIOS.filter((s) => !only.length || only.some((o) => s.slug.startsWith(o)));
if (!chosen.length) throw new Error(`No scenario matches ${only.join(', ')}`);
for (const s of chosen) checkCopy(s);

const TAKES = join(CACHE_DIR, 'takes');
const describeOnly = args.includes('--describe-only');
if (!describeOnly && !args.includes('--skip-build')) run('npm', ['run', 'build']);
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
const results: { slug: string; title: string; duration: number }[] = [];
let failed = false;
let server: ChildProcess | null = null;
let browser: Browser | null = null;
// The preview server must not outlive the run, whatever ends it.
process.on('exit', () => server?.kill());

try {
  if (!describeOnly) server = await startPreview();
  browser = await chromium.launch({ args: [`--force-device-scale-factor=${SCALE}`] });
  await mkdir(OUT, { recursive: true });
  await mkdir(TAKES, { recursive: true });
  for (const scenario of chosen) {
    try {
      const duration = describeOnly ? await redescribe(browser, scenario) : await record(browser, scenario);
      results.push({ slug: scenario.slug, title: scenario.title, duration });
    } catch (e) {
      failed = true;
      console.error(`✗ ${scenario.slug}: ${(e as Error).message}`);
    }
  }
} finally {
  await browser?.close();
  server?.kill();
}
await updateIndex(results);
if (failed) process.exit(1);

interface SavedTake {
  result: TakeResult;
  duration: number;
  commit: string;
  recordedAt: string;
}

/** Description and contact sheet of a take, from the take's own timing. */
async function describe(browser: Browser, scenario: Scenario, take: SavedTake) {
  const video = `${scenario.slug}.mp4`;
  const sheet = `${scenario.slug}.jpg`;
  const work = await mkdtemp(join(tmpdir(), 'demo-sheet-'));
  try {
    await contactSheet(browser, join(OUT, video), scenario, timeline(take.result, take.duration), join(OUT, sheet), work);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  await writeDescription(join(OUT, `${scenario.slug}.md`), scenario, take.result, take.duration, {
    video,
    sheet,
    commit: take.commit,
    recordedAt: take.recordedAt,
  });
}

async function redescribe(browser: Browser, scenario: Scenario): Promise<number> {
  const take = JSON.parse(await readFile(join(TAKES, `${scenario.slug}.json`), 'utf8')) as SavedTake;
  const marked = new Set(take.result.beats.map((b) => b.id));
  const missing = Object.keys(scenario.beats).filter((id) => !marked.has(id));
  const gone = [...marked].filter((id) => !scenario.beats[id]);
  if (missing.length || gone.length)
    throw new Error(`the last take does not match the scenario's beats [${[...missing, ...gone].join(', ')}] — record it again`);
  const onDisk = await probeDuration(join(OUT, `${scenario.slug}.mp4`));
  if (Math.abs(onDisk - take.duration) > 0.2)
    throw new Error(`${scenario.slug}.mp4 is ${onDisk.toFixed(2)} s, the saved take ${take.duration.toFixed(2)} s — record it again`);
  await describe(browser, scenario, take);
  console.log(`✓ ${scenario.slug}: description rewritten (${take.duration.toFixed(1)} s take)`);
  return take.duration;
}

async function record(browser: Browser, scenario: Scenario): Promise<number> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    colorScheme: 'light',
    // Na nagraniu zawsze świeża wersja z `vite preview`, bez pamięci podręcznej service workera.
    serviceWorkers: 'block',
    baseURL: BASE,
    ...(scenario.geolocation ? { geolocation: scenario.geolocation, permissions: ['geolocation'] } : {}),
  });
  await installTouchMarks(context);
  await cacheOutsideRequests(context);
  const page = await context.newPage();
  // Every take lives at its own moment of the day, on the same date as the demo data.
  await page.clock.install({ time: new Date(scenario.clock) });
  const take = new Take(page);
  // A rejected take must not replace the good one: it is checked under another name first.
  const part = join(OUT, `${scenario.slug}.part.mp4`);
  try {
    await seed(page, scenario);
    await scenario.setup(page);
    await take.start();
    const scene = new Scene(page, take);
    await scenario.run(scene);
    scene.log('end of run');
    const result = await take.stop(part);
    const duration = await probeDuration(part);
    if (Math.abs(duration - result.duration) > 0.2)
      throw new Error(`the file is ${duration.toFixed(2)} s, the take ${result.duration.toFixed(2)} s`);
    if (duration < MIN || duration > MAX)
      throw new Error(`${duration.toFixed(1)} s is outside ${MIN}–${MAX} s — retime the scenario`);
    await rename(part, join(OUT, `${scenario.slug}.mp4`));
    const saved: SavedTake = { result, duration, commit, recordedAt: localDate() };
    await writeFile(join(TAKES, `${scenario.slug}.json`), JSON.stringify(saved));
    await describe(browser, scenario, saved);
    console.log(`✓ ${scenario.slug}: ${duration.toFixed(1)} s, ${result.frames} frames, ${result.beats.length} beats`);
    return duration;
  } finally {
    await take.dispose();
    await rm(part, { force: true });
    await close(context);
  }
}

/** Closes a context without its routes failing on requests still in flight. */
async function close(context: BrowserContext) {
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await context.close();
}

/** Today's date where the recording is made (not UTC). */
function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Every beat the scenario marks needs its copy; every copy needs its beat. */
function checkCopy(s: Scenario) {
  const source = s.run.toString();
  const marked = [...source.matchAll(/beat\(\s*['"]([\w-]+)['"]/g)].map((m) => m[1]!);
  const missing = marked.filter((id) => !s.beats[id]);
  const unused = Object.keys(s.beats).filter((id) => !marked.includes(id));
  if (missing.length || unused.length)
    throw new Error(`${s.slug}: beats without copy [${missing.join(', ')}], copy without beats [${unused.join(', ')}]`);
}

function run(cmd: string, argv: string[]) {
  execFileSync(cmd, argv, { stdio: 'inherit' });
}

async function startPreview(): Promise<ChildProcess> {
  // Something already answering on the port would be recorded instead of this build.
  if (await answers()) throw new Error(`port ${PORT} is busy — stop the server running there`);
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let errors = '';
  child.stderr?.on('data', (d: Buffer) => (errors += d.toString()));
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error(`vite preview exited: ${errors.slice(-400)}`);
    if (await answers()) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error('vite preview did not start');
}

async function answers(): Promise<boolean> {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

/** The table of videos in demo-videos/README.md, between its markers. */
async function updateIndex(done: { slug: string; title: string; duration: number }[]) {
  const file = join(OUT, 'README.md');
  const readme = await readFile(file, 'utf8').catch(() => null);
  if (readme === null || !done.length) return;
  const start = '<!-- videos:start -->';
  const end = '<!-- videos:end -->';
  const [head, rest] = readme.split(start);
  const tail = rest?.split(end)[1];
  if (tail === undefined) return;
  // Rows of videos not recorded this time stay as they were.
  const old = new Map(
    [...(rest!.split(end)[0] ?? '').matchAll(/^\| \[(\d\d-[\w-]+)\]\([^)]*\) \| (.*) \| ([\d.]+) s \|$/gm)].map((m) => [
      m[1]!,
      { slug: m[1]!, title: m[2]!, duration: Number(m[3]) },
    ]),
  );
  for (const d of done) old.set(d.slug, d);
  const rows = [...old.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((d) => `| [${d.slug}](${d.slug}.md) | ${d.title} | ${d.duration.toFixed(1)} s |`);
  const table = ['| Video | Need | Length |', '| --- | --- | --- |', ...rows].join('\n');
  await writeFile(file, `${head}${start}\n${table}\n${end}${tail}`);
}
