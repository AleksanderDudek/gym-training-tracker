/**
 * Builds the exercise catalog (`src/data/catalog/`) from the MIT-licensed exercise dataset
 * hasaneyldrm/exercises-dataset (ExerciseDB v1 text), pinned to one commit and checked by SHA-256.
 *
 * Only text and facts are taken: names, body part, equipment, target and secondary muscles, and
 * the step-by-step instructions in English and Polish. The dataset's media (Gym visual) is NOT
 * covered by its MIT licence and is never downloaded. Polish names are our own translation
 * (`scripts/catalog/names-pl.json`) — the dataset has none.
 *
 *   npm run catalog:build
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE = {
  repo: 'hasaneyldrm/exercises-dataset',
  commit: '7455efae41b330c265e7cd4b78dfa848e7ce5ebd',
  file: 'data/exercises.json',
  sha256: '656634224b8977b99a6d765470ee123260d4979715eaa4e7c0b7c8bb0d79f93d',
};

interface Raw {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  target: string;
  secondary_muscles: string[];
  instruction_steps: { en: string[]; pl: string[] };
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'src', 'data', 'catalog');

async function source(): Promise<Buffer> {
  const cache = join(homedir(), '.cache', 'gym-tracker', 'exercises-dataset', SOURCE.commit, 'exercises.json');
  if (!existsSync(cache)) {
    const url = `https://raw.githubusercontent.com/${SOURCE.repo}/${SOURCE.commit}/${SOURCE.file}`;
    console.log(`Downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
  }
  const buf = readFileSync(cache);
  const sum = createHash('sha256').update(buf).digest('hex');
  if (sum !== SOURCE.sha256) throw new Error(`SHA-256 mismatch: ${sum} (expected ${SOURCE.sha256})`);
  return buf;
}

/** Collapses whitespace and strips the stray quotes some steps carry. */
const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

async function main(): Promise<void> {
  const raw = JSON.parse((await source()).toString('utf8')) as Raw[];
  const namesPl = JSON.parse(readFileSync(join(root, 'scripts', 'catalog', 'names-pl.json'), 'utf8')) as Record<
    string,
    string
  >;
  const list = [...raw].sort((a, b) => a.id.localeCompare(b.id));
  const missing = list.filter((e) => !namesPl[e.id]?.trim()).map((e) => e.id);
  if (missing.length) throw new Error(`Missing Polish names: ${missing.slice(0, 20).join(', ')}…`);

  const index = list.map((e) => ({
    i: e.id,
    n: [clean(namesPl[e.id]!), clean(e.name)] as [string, string],
    e: e.equipment,
    b: e.body_part,
    t: e.target,
    s: [...new Set(e.secondary_muscles.map((m) => m.toLowerCase().trim()))].filter((m) => m && m !== e.target),
  }));
  const steps = (lang: 'pl' | 'en') =>
    Object.fromEntries(list.map((e) => [e.id, e.instruction_steps[lang].map(clean).filter(Boolean)]));

  mkdirSync(out, { recursive: true });
  // One entry per line: small diffs when the dataset or a name changes.
  const lines = (rows: unknown[]) => `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`;
  const obj = (o: Record<string, unknown>) =>
    `{\n${Object.entries(o)
      .map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`)
      .join(',\n')}\n}\n`;
  writeFileSync(join(out, 'index.json'), lines(index));
  writeFileSync(join(out, 'steps.pl.json'), obj(steps('pl')));
  writeFileSync(join(out, 'steps.en.json'), obj(steps('en')));
  console.log(`Catalog: ${index.length} exercises → ${out}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main();
