import { STATS_BATCH_MAX, STATS_EVENTS, validStatsPair } from '../../src/statsCatalog';
import type { StatsEvent } from '../../src/statsCatalog';

/**
 * Anonimowe statystyki aplikacji. Paczka to lista par `[zdarzenie, wartość]` z zamkniętej listy
 * (`src/statsCatalog.ts`); serwer dolicza je do licznika dnia (UTC) i nic więcej nie zapisuje —
 * ani adresu IP, ani nagłówków, ani czasu zdarzenia, ani niczego, co łączy zdarzenia jednej osoby.
 * Para spoza listy psuje całą paczkę (400): aplikacja, która ją wysłała, ma błąd, a nie dane.
 */

export interface StatsCount {
  day: string;
  event: string;
  value: string;
  n: number;
}

/** `{ e: [[zdarzenie, wartość], …] }` → liczniki, albo `null`, gdy paczka jest zła. */
export function parseStats(data: Record<string, unknown>): Map<string, number> | null {
  const list = data.e;
  if (!Array.isArray(list) || list.length === 0 || list.length > STATS_BATCH_MAX) return null;
  const out = new Map<string, number>();
  for (const pair of list) {
    if (!Array.isArray(pair) || pair.length !== 2 || !validStatsPair(pair[0], pair[1])) return null;
    const key = `${pair[0]}\u0000${pair[1]}`;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

export const splitKey = (key: string): [string, string] => key.split('\u0000') as [string, string];

/** `yyyy-mm-dd` dnia w UTC. */
export const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/* ---------------- Pulpit dla autora ---------------- */

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Liczby 1–4 pokazane jako „<5”. Pulpit widzi tylko autor, ale gdyby kiedyś trafił na zrzut ekranu,
 * rzadkie zdarzenie (jedna osoba na rzadkim ekranie) nie wskaże nikogo palcem.
 */
const shown = (n: number): string => (n > 0 && n < 5 ? '&lt;5' : String(n));

const LABEL: Record<StatsEvent, string> = {
  open: 'Aktywne urządzenia (dziennie)',
  lang: 'Język',
  week: 'Dni z aplikacją w tygodniu',
  uses: 'Funkcje w użyciu (urządzenia dziennie)',
  screen: 'Ekrany',
  workout_start: 'Treningi rozpoczęte',
  workout_finish: 'Treningi zamknięte',
  technique: '„Jak to zrobić?” otwarte',
  catalog_view: 'Katalog ćwiczeń otwarty',
  catalog_add: 'Ćwiczenia z katalogu dodane',
};

/** Strona z tabelami: wiersz = wartość, kolumny = ostatnie dni + suma. Bez skryptów. */
export function statsPage(rows: StatsCount[], days: string[]): string {
  const by = new Map<string, number>();
  for (const r of rows) by.set(`${r.event}|${r.value}|${r.day}`, r.n);
  const tables = (Object.keys(STATS_EVENTS) as StatsEvent[]).map((ev) => {
    const values = (STATS_EVENTS[ev] as readonly string[])
      .map((v) => ({ v, cells: days.map((d) => by.get(`${ev}|${v}|${d}`) ?? 0) }))
      .map((r) => ({ ...r, sum: r.cells.reduce((a, b) => a + b, 0) }))
      .filter((r) => r.sum > 0)
      .sort((a, b) => b.sum - a.sum);
    if (!values.length) return `<h2>${esc(LABEL[ev])}</h2><p class="none">brak danych</p>`;
    const max = Math.max(...values.map((r) => r.sum));
    const head = days.map((d) => `<th>${esc(d.slice(5))}</th>`).join('');
    const body = values
      .map(
        (r) =>
          `<tr><th scope="row">${esc(r.v)}</th>${r.cells.map((n) => `<td>${n ? shown(n) : ''}</td>`).join('')}` +
          `<td class="sum"><span class="bar" style="width:${Math.round((r.sum / max) * 100)}%"></span>${shown(r.sum)}</td></tr>`,
      )
      .join('');
    return `<h2>${esc(LABEL[ev])}</h2><div class="scroll"><table><thead><tr><th></th>${head}<th>suma</th></tr></thead><tbody>${body}</tbody></table></div>`;
  });
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Statystyki — GYM TRACKER</title><style>
body{font:14px/1.45 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px;background:#f3f3ef;color:#1e2320}
h1{margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px}p{margin:4px 0}.none{color:#6b7069}
.scroll{overflow-x:auto;background:#fff;border:1px solid #c2c5bd;border-radius:3px}
table{border-collapse:collapse;font-variant-numeric:tabular-nums;width:100%}
th,td{padding:4px 8px;border-bottom:1px solid #e3e5df;text-align:right;white-space:nowrap}
thead th{font-weight:600;color:#4c524b}tbody th{text-align:left;font-weight:500}
td.sum{position:relative;min-width:120px;font-weight:600}
.bar{position:absolute;left:0;top:3px;bottom:3px;background:#d977573d;border-radius:2px;z-index:0}
</style></head><body><h1>Statystyki</h1>
<p>Ostatnie ${days.length} dni (UTC), od najnowszego. Tylko liczniki z zamkniętej listy zdarzeń — bez użytkowników, adresów i treści. Liczby 1–4 jako „&lt;5”.</p>
${tables.join('\n')}</body></html>`;
}

/** Dni od dziś wstecz, najnowszy pierwszy. */
export function lastDays(now: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => utcDay(now - i * 86_400_000));
}
