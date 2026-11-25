import { parsePseudonym } from '@gymtracker/link';

/**
 * Prywatne skróty prowadzącego: „Jan, wtorki 18:00” obok ID podopiecznego.
 *
 * **Tylko w tej przeglądarce, nigdy na serwerze.** Sztab nie przechowuje danych kontaktowych
 * podopiecznych — kto jest kim, prowadzący trzyma u siebie (CRM, arkusz, kartoteka). Skrót jest
 * wygodą na tym komputerze, kluczowaną ID (to samo ID wraca po nowym zaproszeniu), z eksportem
 * i importem do pliku.
 *
 * Tak samo grupy („kolano”, „redukcja wiosna”) — etykiety bywają opisowe, więc też zostają tutaj —
 * i ślad „kiedy ostatnio otwarty z listy” do nowych odpowiedzi w „Do przejrzenia”.
 */

const key = (userId: string) => `sztab-aliases:${userId}`;
const groupsKey = (userId: string) => `sztab-groups:${userId}`;
const seenKey = (userId: string) => `sztab-seen:${userId}`;

const PSEUDONYM = /^[0-9A-HJKMNP-TV-Z]{20}$/;

export type Aliases = Record<string, string>;

function read(k: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(k) ?? '{}') as unknown;
  } catch {
    return {};
  }
}

function write(k: string, v: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    /* Bez pamięci strony zmiana zostaje do zamknięcia karty. */
    return false;
  }
}

export function loadAliases(userId: string): Aliases {
  const raw = read(key(userId));
  return raw && typeof raw === 'object' ? cleanAliases(raw) : {};
}

export function saveAlias(userId: string, pseudonym: string, alias: string): Aliases {
  const all = loadAliases(userId);
  const v = alias.trim().slice(0, 60);
  if (v) all[pseudonym] = v;
  else delete all[pseudonym];
  write(key(userId), all);
  return all;
}

export function cleanAliases(v: unknown): Aliases {
  const out: Aliases = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, a] of Object.entries(v as Record<string, unknown>)) {
    if (PSEUDONYM.test(k) && typeof a === 'string' && a.trim()) out[k] = a.trim().slice(0, 60);
  }
  return out;
}

export function importAliases(userId: string, v: unknown): number {
  const incoming = cleanAliases(v);
  const all = { ...loadAliases(userId), ...incoming };
  return write(key(userId), all) ? Object.keys(incoming).length : 0;
}

/* ── Grupy ─────────────────────────────────────────────────────────────────────────── */

/** ID podopiecznego → jego grupy (prywatne etykiety prowadzącego). */
export type Groups = Record<string, string[]>;

export const GROUP_NAME_MAX = 32;
export const GROUPS_PER_CLIENT = 8;

/** Nazwa grupy: bez średników, przecinków i cudzysłowów (w CSV dzielą listę), jedna spacja, do 32 znaków. */
export const cleanGroupName = (s: string): string =>
  s
    .replace(/[;,"\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, GROUP_NAME_MAX)
    .trim();

/** Lista grup bez pustych i powtórek (wielkość liter się nie liczy — zostaje pierwsza pisownia). */
function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw !== 'string') continue;
    const g = cleanGroupName(raw);
    if (g && !out.some((x) => x.toLocaleLowerCase() === g.toLocaleLowerCase())) out.push(g);
    if (out.length >= GROUPS_PER_CLIENT) break;
  }
  return out;
}

export function cleanGroups(v: unknown): Groups {
  const out: Groups = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, list] of Object.entries(v as Record<string, unknown>)) {
    const g = PSEUDONYM.test(k) ? cleanList(list) : [];
    if (g.length) out[k] = g;
  }
  return out;
}

export const loadGroups = (userId: string): Groups => cleanGroups(read(groupsKey(userId)));

/** Wszystkie grupy prowadzącego, alfabetycznie. */
export function groupNames(all: Groups): string[] {
  const seen = new Map<string, string>();
  for (const list of Object.values(all)) for (const g of list) if (!seen.has(g.toLocaleLowerCase())) seen.set(g.toLocaleLowerCase(), g);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function setGroups(userId: string, pseudonym: string, groups: readonly string[]): Groups {
  const all = loadGroups(userId);
  // Ta sama grupa u kilku podopiecznych ma jedną pisownię: „Kolano” dopisane jako „kolano” trafia do „Kolano”.
  const known = new Map(groupNames(all).map((g) => [g.toLocaleLowerCase(), g]));
  const list = cleanList(groups).map((g) => known.get(g.toLocaleLowerCase()) ?? g);
  if (list.length) all[pseudonym] = list;
  else delete all[pseudonym];
  write(groupsKey(userId), all);
  return all;
}

export const addGroup = (userId: string, pseudonym: string, name: string): Groups =>
  setGroups(userId, pseudonym, [...(loadGroups(userId)[pseudonym] ?? []), name]);

export const removeGroup = (userId: string, pseudonym: string, name: string): Groups =>
  setGroups(
    userId,
    pseudonym,
    (loadGroups(userId)[pseudonym] ?? []).filter((g) => g.toLocaleLowerCase() !== name.toLocaleLowerCase()),
  );

/* ── Ostatnio otwarci ──────────────────────────────────────────────────────────────── */

/** Współpraca → kiedy prowadzący ostatnio otworzył ją z listy (ms). */
export type Seen = Record<string, number>;

const SEEN_MAX = 500;

export function loadSeen(userId: string): Seen {
  const raw = read(seenKey(userId));
  const out: Seen = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, t] of Object.entries(raw as Record<string, unknown>)) {
    if (/^[\w-]{1,64}$/.test(k) && typeof t === 'number' && Number.isFinite(t)) out[k] = t;
  }
  return out;
}

export function markSeen(userId: string, connectionId: string, at: number = Date.now()): void {
  const all = { ...loadSeen(userId), [connectionId]: at };
  // Najstarsze ślady odpadają — zakończone współprace nie rosną bez końca.
  const kept = Object.entries(all)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SEEN_MAX);
  write(seenKey(userId), Object.fromEntries(kept));
}

/* ── Arkusz CSV ────────────────────────────────────────────────────────────────────── */

export interface CrmRow {
  pseudonym: string;
  alias: string;
  areas: string;
  since: string;
  status: string;
  /** Grupy po przecinku. Kolumna „Grupy” jest w arkuszu, gdy ma ją którykolwiek wiersz. */
  groups?: string;
}

// i18n-ignore: nagłówki to format pliku (import rozpoznaje kolumny po nich), nie tekst interfejsu.
const HEAD = ['ID', 'Skrót', 'Obszary', 'Od', 'Stan'];
// i18n-ignore: nagłówek kolumny w pliku, jak wyżej.
const GROUPS_HEAD = 'Grupy';

/** Arkusz do CRM: ID, skrót, obszary, od kiedy, stan (i grupy). Średnik i BOM, jak w GYM TRACKERze — tak otwiera polski Excel. */
export function crmCsv(rows: CrmRow[]): string {
  const esc = (s: string) => (/[;"\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s);
  const withGroups = rows.some((r) => r.groups !== undefined);
  const head = withGroups ? [...HEAD, GROUPS_HEAD] : HEAD;
  const body = rows.map((r) => {
    const cells = [r.pseudonym, r.alias, r.areas, r.since, r.status];
    return withGroups ? [...cells, r.groups ?? ''] : cells;
  });
  return '﻿' + [head, ...body].map((r) => r.map(esc).join(';')).join('\r\n') + '\r\n';
}

/** Wiersze CSV: separator ze średnikiem albo przecinkiem (jak zapisze arkusz), cudzysłowy z `""`. */
export function parseCsv(input: string): string[][] {
  const src = input.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Zabezpieczenie eksportu przed formułą (`'=…`) zdjęte z powrotem. */
const unguard = (s: string) => s.replace(/^'(?=[=+\-@])/, '').trim();

/**
 * Skróty i grupy z arkusza (tego z `crmCsv` albo przerobionego w CRM). Kolumny po nagłówkach:
 * `ID`, `Skrót`/`Alias`, `Grupy`/`Groups` — stary arkusz bez grup też się wczyta.
 */
export function parseCrmCsv(input: string): { aliases: Aliases; groups: Groups; hasGroups: boolean } {
  const [head, ...rows] = parseCsv(input);
  const col = (...names: string[]) => (head ?? []).findIndex((h) => names.includes(unguard(h).toLocaleLowerCase()));
  const idCol = col('id');
  // i18n-ignore: nazwy kolumn w pliku.
  const aliasCol = col('skrót', 'skrot', 'alias');
  const groupsCol = col('grupy', 'groups');
  const aliases: Aliases = {};
  const groups: Groups = {};
  if (idCol < 0) return { aliases, groups, hasGroups: false };
  for (const r of rows) {
    const id = parsePseudonym(unguard(r[idCol] ?? ''));
    if (!id) continue;
    const alias = aliasCol >= 0 ? unguard(r[aliasCol] ?? '').slice(0, 60) : '';
    if (alias) aliases[id] = alias;
    const list = groupsCol >= 0 ? cleanList(unguard(r[groupsCol] ?? '').split(',')) : [];
    if (list.length) groups[id] = list;
  }
  return { aliases, groups, hasGroups: groupsCol >= 0 };
}

/**
 * Wczytanie arkusza: skróty i grupy z pliku zastępują te same ID, pusta komórka niczego nie kasuje,
 * reszta zostaje. Zwraca, ilu podopiecznych dostało skrót i grupy.
 */
export function importCsv(userId: string, input: string): { aliases: number; groups: number } {
  const { aliases, groups } = parseCrmCsv(input);
  const n = importAliases(userId, aliases);
  const all = { ...loadGroups(userId), ...groups };
  const g = write(groupsKey(userId), cleanGroups(all)) ? Object.keys(groups).length : 0;
  return { aliases: n, groups: g };
}
