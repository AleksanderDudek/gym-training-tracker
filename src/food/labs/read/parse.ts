import { ALIASES, toCanonical, type Marker, type Range, type Specimen } from '../markers';
import { fold, foldUnit, parsePrinted } from '../units';

/**
 * Lab printouts → results, without a model: a row is a name the catalog knows, then a value,
 * a unit and the lab's range, in that order or close to it. Rows come from a PDF's text layer,
 * from OCR or from pasted text (`pdf.ts`, `ocr.ts`); the parser does not care which.
 *
 * What it does not know it does not guess: a row whose name is not in the catalog goes to
 * `unknown`, a unit it cannot convert keeps the value unconverted and says so. The review screen
 * shows both before anything is saved.
 */

export type Qual = 'neg' | 'trace' | 'pos';

export interface ReadRow {
  marker: Marker;
  /** The row as read, for the review screen. */
  line: string;
  /** In the marker's canonical unit; null for a strip result without a number. */
  value: number | null;
  /** The value as printed: "32,5", "<0,5", "ujemny", "0-2". */
  printed: string;
  /** "<" or ">": a detection limit. */
  cmp: '<' | '>' | null;
  qual: Qual | null;
  /** The unit as printed ("" when none was found). */
  unit: string;
  /** The unit was missing or unknown: the value is taken as canonical and must be checked. */
  unitGuessed: boolean;
  /** The lab's own range, converted. */
  ref: Range | null;
  /** The lab's high/low mark, when it printed one. */
  flag: 'H' | 'L' | null;
  /** A second row for a marker already read: shown, not selected by default. */
  duplicate: boolean;
  /**
   * The value does not fit its own range: most often a decimal comma OCR lost ("4,01" read as
   * "401"). Not selected by default; `suggest` is the value with the comma put back, canonical.
   */
  suspect: { suggest: number | null } | null;
}

export interface ReadOptions {
  /** Text from OCR: misread digits ("S8", "O,9") are repaired and names may have a typo. */
  ocr?: boolean;
}

export interface ReadResult {
  rows: ReadRow[];
  /** Rows with a number whose name the catalog does not know. */
  unknown: string[];
  /** YYYY-MM-DD of collection, when the document says it. */
  date: string | null;
  lab: string | null;
  /** From the header ("Płeć: Żeńska", "Data ur.: 1990-05-02"), for the ranges when nothing else gives them. */
  sex: 'M' | 'K' | null;
  birthYear: number | null;
}

/** Rows a printout has that matter neither for diet nor for the doctor flags: read and dropped. */
const IGNORED = {
  blood: [
    'neutrofile',
    'neutrocyty',
    'limfocyty',
    'monocyty',
    'eozynofile',
    'eozynocyty',
    'bazofile',
    'bazocyty',
    'granulocyty',
    'niedojrzale granulocyty',
    'ig',
    'neu',
    'lym',
    'lymph',
    'mono',
    'mon',
    'eos',
    'eo',
    'baso',
    'bas',
    'pdw',
    'mpv',
    'p-lcr',
    'pct',
    'nrbc',
    'rdw-sd',
    'retikulocyty',
    'ob',
    'odczyn biernackiego',
    // The active hormone, not the vitamin D store: often high-normal in deficiency.
    'witamina d3 metabolit 1,25(oh)2',
    'witamina d metabolit 1,25(oh)2',
    'witamina d 1,25(oh)2',
    '1,25(oh)2d',
    '1,25-dihydroksywitamina d',
    // Other tests whose name starts with a tracked one.
    'wapn zjonizowany',
    'bilirubina bezposrednia',
    'bilirubina posrednia',
    'kwas foliowy w erytrocytach',
    'glukoza po',
    'insulina po',
    'albumina w moczu',
    'kreatynina w moczu',
    'wskaznik albumina/kreatynina',
    'rozpuszczalny receptor transferyny',
    'test obciazenia glukoza',
  ],
  urine: [
    'barwa',
    'kolor',
    'przejrzystosc',
    'klarownosc',
    'urobilinogen',
    'bilirubina',
    'nablonki plaskie',
    'nablonki okragle',
    'nablonki',
    'walecki',
    'walki',
    'bakterie',
    'krysztaly',
    'szczawiany',
    'moczany',
    'fosforany',
    'sluz',
    'pasma sluzu',
    'drozdzaki',
    'grzyby',
    'plemniki',
  ],
} as const;

const URINE_HEADER = /\b(badanie ogolne moczu|mocz\b|moczu\b|osad moczu|cechy fizyczne|badanie chemiczne)/;
const BLOOD_HEADER = /\b(morfologia|lipidogram|surowic\w*|osocz\w*|krew zylna|krew pelna|biochemi\w*|jonogram|proby watrobowe|hormony tarczycy)\b/;

const QUAL_WORDS: readonly [RegExp, Qual][] = [
  [/^(nie wykryto|nie stwierdzono|nie stwierdza sie|nieobecn\w*|ujemn\w*|negatywn\w*|negative|neg\.?|brak|w normie|norm\w*|-)$/, 'neg'],
  [/^(slad\w*|sladow\w*|trace|\+-|\+\/-)$/, 'trace'],
  [/^(obecn\w*|dodatni\w*|pozytywn\w*|positive|pos\.?|\+{1,4}|[1-4]\+|liczne|bardzo liczne)$/, 'pos'],
];

/** Two-word strip results first: "nie wykryto", "nie stwierdzono". */
function qualAt(tokens: readonly string[], i: number): { qual: Qual; used: number; printed: string } | null {
  for (const used of [3, 2, 1]) {
    if (i + used > tokens.length) continue;
    const printed = tokens.slice(i, i + used).join(' ');
    for (const [re, qual] of QUAL_WORDS) if (re.test(printed)) return { qual, used, printed };
  }
  return null;
}

const FLAGS: Record<string, 'H' | 'L'> = {
  h: 'H',
  '(h)': 'H',
  '↑': 'H',
  '(+)': 'H',
  l: 'L',
  '(l)': 'L',
  '↓': 'L',
  '(-)': 'L',
};

/** "32,5ng/ml" → ["32,5", "ng/ml"]: some PDFs set the unit right against the number. */
const GLUED = /^([<>≤≥]?\d+(?:[.,]\d+)?)([a-z%/][\w%/^.,]*)$/;

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const BETWEEN = new RegExp(String.raw`${NUM}\s*(?:-|÷|do|\.\.)\s*${NUM}`);
const BELOW = new RegExp(String.raw`(?:<=|<|≤|ponizej|mniej niz|do)\s*${NUM}`);
const ABOVE = new RegExp(String.raw`(?:>=|>|≥|powyzej|wiecej niz|od)\s*${NUM}`);

const n = (s: string) => Number(s.replace(',', '.'));

/** The lab's range, in the printed unit. */
function rangeIn(text: string): Range | null {
  const between = text.match(BETWEEN);
  if (between) return [n(between[1]!), n(between[2]!)];
  const below = text.match(BELOW);
  if (below) return [null, n(below[1]!)];
  const above = text.match(ABOVE);
  if (above) return [n(above[1]!), null];
  return null;
}

interface Match {
  alias: string;
  markers: Marker[];
}

/** Edit distance, for OCR's misspelt names ("Ferytyna", "Tńglicerydy"); stops early past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...row) > max) return max + 1;
    prev = row;
  }
  return prev[b.length]!;
}

/** A name with a typo: the row's first words against every alias of 6 letters or more (1 edit, 2 from 10 letters). */
function fuzzyNameAt(folded: string): Match | null {
  const words = folded.split(' ');
  let best: { match: Match; d: number } | null = null;
  for (const { alias, marker } of ALIASES) {
    if (alias.length < 6) continue;
    const n = alias.split(' ').length;
    const head = words.slice(0, n).join(' ');
    const max = alias.length >= 10 ? 2 : 1;
    const d = distance(head, alias, max);
    if (d > max || (best && best.d < d)) continue;
    if (best && best.d === d && best.match.alias.length === head.length) best.match.markers.push(marker);
    else if (!best || d < best.d || head.length > best.match.alias.length) best = { match: { alias: head, markers: [marker] }, d };
  }
  return best?.match ?? null;
}

/** Longest alias (or ignored name) at the start of a folded row, ending at a word boundary. */
function nameAt(folded: string, section: Specimen, options: ReadOptions = {}): Match | 'ignored' | null {
  const ignored = IGNORED[section].find((name) => startsWord(folded, name));
  let best: Match | null = null;
  for (const { alias, marker } of ALIASES) {
    if (best && alias.length < best.alias.length) break;
    if (!startsWord(folded, alias)) continue;
    if (best) best.markers.push(marker);
    else best = { alias, markers: [marker] };
  }
  if (ignored && (!best || ignored.length >= best.alias.length)) return 'ignored';
  return best ?? (options.ocr ? fuzzyNameAt(folded) : null);
}

/** OCR's usual digit mix-ups inside a number: O→0, S→5, l/I/|→1, B→8 ("S8", "O,78"). */
function repairDigits(token: string): string {
  if (!/\d/.test(token) || !/^[<>]?[\doslib|]+(?:[.,][\doslib|]+)?$/.test(token)) return token;
  return token.replace(/o/g, '0').replace(/s/g, '5').replace(/[li|]/g, '1').replace(/b/g, '8');
}

/**
 * A value far outside its own printed range, when the range has decimals and the value has none:
 * likely a lost comma. The suggestion is the value divided by 10 or 100 that lands near the range.
 */
function suspicion(printed: string, value: number | null, range: Range | null, rangeText: string): ReadRow['suspect'] {
  if (value === null || !range || /[.,]/.test(printed)) return null;
  const lo = range[0] ?? range[1]!;
  const hi = range[1] ?? range[0]!;
  if (value <= hi * 3) return null;
  const decimals = /\d[.,]\d/.test(rangeText);
  for (const k of [10, 100]) {
    const v = value / k;
    if (decimals && v >= lo / 4 && v <= hi * 4) return { suggest: v };
  }
  return null;
}

function startsWord(folded: string, word: string): boolean {
  if (!folded.startsWith(word)) return false;
  const next = folded[word.length];
  return next === undefined || !/[a-z0-9]/.test(next) || /[^a-z0-9]$/.test(word);
}

/** Which of several markers with the same name: the one whose unit is on the row, then the section's. */
function choose(markers: Marker[], tokens: readonly string[], section: Specimen): Marker {
  if (markers.length === 1) return markers[0]!;
  const units = new Set(tokens.map(foldUnit));
  const byUnit = markers.filter((m) => Object.keys(m.units).some((u) => u !== '' && units.has(u)));
  const pool = byUnit.length ? byUnit : markers;
  return pool.find((m) => m.specimen === section) ?? pool[0]!;
}

/** The unit among the row's tokens (one token or two, "tys. /µl"), with where it was. */
function unitIn(marker: Marker, tokens: readonly string[], from: number): { unit: string; at: number; used: number } | null {
  for (let i = from; i < tokens.length; i++) {
    const clean = tokens[i]!.replace(/^[[(]|[\])]$/g, '');
    if (clean && Object.hasOwn(marker.units, foldUnit(clean)) && foldUnit(clean) !== '') return { unit: clean, at: i, used: 1 };
    const pair = tokens[i + 1] === undefined ? '' : clean + tokens[i + 1];
    if (pair && Object.hasOwn(marker.units, foldUnit(pair))) return { unit: pair, at: i, used: 2 };
  }
  return null;
}

/** One row → a result, or null when no value follows the name. */
function readRow(line: string, folded: string, match: Match, section: Specimen, options: ReadOptions): ReadRow | null {
  const rest = folded.slice(match.alias.length).replace(/^[\s:.-]+/, ' ');
  const tokens: string[] = [];
  for (const raw of rest.split(' ')) {
    const cut = raw.replace(/[;:]$/, '');
    const t = options.ocr ? repairDigits(cut) : cut;
    if (!t) continue;
    const glued = t.match(GLUED);
    if (glued) tokens.push(glued[1]!, glued[2]!);
    else tokens.push(t);
  }
  const marker = choose(match.markers, tokens, section);

  let at = -1;
  let printed = '';
  let value: number | null = null;
  let cmp: '<' | '>' | null = null;
  let qual: Qual | null = null;
  let flag: 'H' | 'L' | null = null;
  let used = 1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (FLAGS[t] && at === -1 && i > 0) {
      flag = FLAGS[t]!;
      continue;
    }
    const number = parsePrinted(t);
    if (number) {
      at = i;
      printed = t;
      value = number.value;
      cmp = number.cmp;
      break;
    }
    // Urine sediment: "0-2" cells per field. The upper end is what is compared.
    const span = marker.specimen === 'urine' ? t.match(/^(\d+)-(\d+)$/) : null;
    if (span) {
      at = i;
      printed = t;
      value = Number(span[2]);
      break;
    }
    const q = marker.qualitative || marker.specimen === 'urine' ? qualAt(tokens, i) : null;
    if (q) {
      at = i;
      printed = q.printed;
      qual = q.qual;
      used = q.used;
      break;
    }
  }
  if (at === -1) return null;

  // A strip result often comes with a number too: "ujemny <15 mg/dl", "(+) 30 mg/dl" — or the word after it.
  let after = at + used;
  // Only right after the number or its unit: words further on are the reference column („Norma: ujemny”).
  if (qual === null && marker.qualitative) {
    const next = tokens[after] !== undefined && Object.hasOwn(marker.units, foldUnit(tokens[after]!)) ? after + 1 : after;
    const word = tokens[next] === undefined || tokens[next] === '-' ? null : qualAt(tokens, next);
    if (word && !/^norm/.test(word.printed)) qual = word.qual;
  }
  if (qual !== null) {
    const number = tokens[after] === undefined ? null : parsePrinted(tokens[after]!);
    if (number) {
      value = number.value;
      cmp = number.cmp;
      after += 1;
    }
  }

  const unit = unitIn(marker, tokens, after) ?? unitIn(marker, tokens.slice(0, at), 0);
  const left = tokens.filter((_, i) => i >= after && (!unit || i < unit.at || i >= unit.at + unit.used));
  for (const t of left) if (FLAGS[t] && !flag) flag = FLAGS[t]!;
  // Two-letter names ("K", "Na", "Fe", "TG") are too easy to meet by chance: only with their unit.
  if (match.alias.length <= 2 && !unit && marker.unit !== '') return null;
  const printedUnit = unit?.unit ?? '';
  const convert = (v: number) => toCanonical(marker, v, printedUnit) ?? v;
  const known = toCanonical(marker, 1, printedUnit) !== null;
  const rangeText = left.filter((t) => !FLAGS[t]).join(' ');
  const rawRange = rangeIn(rangeText);
  // Only OCR loses commas; a PDF or pasted text says exactly what the lab printed.
  const suspect = options.ocr && qual === null ? suspicion(printed, value, rawRange, rangeText) : null;

  return {
    marker,
    line: line.trim(),
    value: value === null ? null : convert(value),
    printed,
    cmp,
    qual,
    unit: printedUnit,
    unitGuessed: !known && marker.unit !== '',
    ref: rawRange ? [rawRange[0] === null ? null : convert(rawRange[0]), rawRange[1] === null ? null : convert(rawRange[1])] : null,
    flag,
    duplicate: false,
    suspect: suspect && { suggest: suspect.suggest === null ? null : convert(suspect.suggest) },
  };
}

/** A row worth showing as "not recognised": a name and a number, not a date, an address or an ID. */
function looksLikeResult(folded: string): boolean {
  if (folded.length > 120 || !/[a-z]{3}/.test(folded) || !/\d/.test(folded)) return false;
  if (/\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4}|\d{2}:\d{2}|pesel|\bul\.|tel\.|nip|regon|\d{2}-\d{3}|strona|str\./.test(folded)) return false;
  return /^[a-z(]/.test(folded);
}

/** Rows whose name stands alone and whose value is on the next row: some PDFs break the table that way. */
function joinBroken(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const next = lines[i + 1];
    if (next !== undefined) {
      const folded = fold(line);
      const match = nameAt(folded, 'blood') ?? nameAt(folded, 'urine');
      const nameOnly = match && match !== 'ignored' && !/\d/.test(folded.slice(match.alias.length).replace(/\([^)]*\)/g, ''));
      if (nameOnly && /^[<>]?\d/.test(fold(next))) {
        out.push(`${line} ${next}`);
        i += 1;
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

export function readLines(input: readonly string[], options: ReadOptions = {}): ReadResult {
  const lines = joinBroken(input.map((l) => l.trim()).filter(Boolean));
  const rows: ReadRow[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  let section: Specimen = 'blood';
  for (const line of lines) {
    const folded = fold(line);
    const match = nameAt(folded, section, options);
    if (match === 'ignored') continue;
    // A strip test read twice is a blood test after the urine part ("Glukoza" in both).
    if (match && section === 'urine' && match.markers.some((m) => m.specimen === 'urine' && seen.has(m.id))) {
      if (match.markers.some((m) => m.specimen === 'blood')) section = 'blood';
    }
    const row = match ? readRow(line, folded, match, section, options) : null;
    if (!row) {
      // A heading switches the section; a heading names the test, so it carries no value.
      if (URINE_HEADER.test(folded)) section = 'urine';
      else if (BLOOD_HEADER.test(folded)) section = 'blood';
      else if (match && match.markers.every((m) => m.specimen === 'blood')) section = 'blood';
      else if (!match && looksLikeResult(folded)) unknown.push(line.trim());
      continue;
    }
    // A blood-only test after the urine part: the urine part is over.
    if (row.marker.specimen === 'blood' && section === 'urine' && match!.markers.every((m) => m.specimen === 'blood')) {
      section = 'blood';
    }
    if (row.marker.specimen === 'urine') section = 'urine';
    row.duplicate = seen.has(row.marker.id);
    seen.add(row.marker.id);
    rows.push(row);
  }
  const text = lines.join('\n');
  const folded = fold(text);
  const sex = folded.match(/\bplec\s*:?\s*(zenska|kobieta|k\b|meska|mezczyzna|m\b)/)?.[1];
  const born = folded.match(/\bdata\s+ur(?:\.|odzenia)\s*:?\s*(?:(\d{4})-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-](\d{4}))/);
  return {
    rows,
    unknown: unknown.slice(0, 40),
    date: collectionDate(text),
    lab: labOf(text),
    sex: sex ? (sex.startsWith('m') ? 'M' : 'K') : null,
    birthYear: born ? Number(born[1] ?? born[2]) : null,
  };
}

export function readText(text: string, options: ReadOptions = {}): ReadResult {
  return readLines(text.split(/\r?\n/), options);
}

const DATE = String.raw`(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[./-](\d{1,2})[./-](\d{4})`;
// "Data pobrania", "Data i godzina pobrania", Diagnostyka's "Data/godz. pobrania:".
const WHEN = String.raw`data(?:\s*\/\s*godz\.?|\s+i\s+(?:godz\.?|godzina))?\s+`;
const COLLECTED = new RegExp(String.raw`${WHEN}(?:pobrania|pobr\.)[^0-9]{0,30}(?:${DATE})`);
const OTHER = new RegExp(String.raw`${WHEN}(?:przyjecia|rejestracji|rej\.|wykonania|wydania|zlecenia|wyniku|badania)[^0-9]{0,30}(?:${DATE})`);

/** The date of collection, else of registration or of the result; null when none is printed. */
export function collectionDate(text: string): string | null {
  const folded = fold(text);
  const m = folded.match(COLLECTED) ?? folded.match(OTHER);
  if (!m) return null;
  const [y, mo, d] = m[1] ? [m[1], m[2]!, m[3]!] : [m[6]!, m[5]!, m[4]!];
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

const LABS: readonly [RegExp, string][] = [
  [/diagnostyka|diag\.pl/, 'Diagnostyka'],
  [/\balab\b|alab laboratoria/, 'ALAB'],
  [/synevo/, 'Synevo'],
  [/lux ?med/, 'LUX MED'],
  [/medicover/, 'Medicover'],
  [/cortex/, 'Cortex'],
];

export function labOf(text: string): string | null {
  const folded = fold(text);
  return LABS.find(([re]) => re.test(folded))?.[1] ?? null;
}
