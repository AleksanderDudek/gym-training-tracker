import { csvFormat, toCsv } from '../engine/csv';
import type { Cell, CsvFormat } from '../engine/csv';
import { text } from '../i18n';
import { db as defaultDb } from './diet/db';
import type { DietDb, Entry } from './diet/db';

/**
 * Jedzenie do arkusza: wiersz na wpis w dzienniku. Moduł ładuje się dynamicznie z ustawień,
 * razem z Dexie — kto tylko trenuje, nie wczytuje bazy jedzenia.
 *
 * Wpis nie zapisuje pory posiłku — tylko godzinę, i ta idzie do pliku; arkusz pogrupuje sam.
 * Błonnik, cukry, sól (`fiber`, `sugars`, `salt`, g) czytane luźno, bo dokłada je dziennik
 * (wersja 6 bazy). Ich kolumny są w pliku tylko wtedy, gdy choć jeden wpis je zna; wpis bez
 * danych ma pustą komórkę — brak to nie zero.
 */

type LooseEntry = Entry & { fiber?: unknown; sugars?: unknown; salt?: unknown };

const EXTRA = ['fiber', 'sugars', 'salt'] as const;

const T = text({
  pl: {
    header: ['Data', 'Godzina', 'Nazwa', 'Ilość', 'kcal', 'Białko (g)', 'Węglowodany (g)', 'Tłuszcz (g)'],
    extra: { fiber: 'Błonnik (g)', sugars: 'Cukry (g)', salt: 'Sól (g)' },
  },
  en: {
    header: ['Date', 'Time', 'Name', 'Amount', 'kcal', 'Protein (g)', 'Carbs (g)', 'Fat (g)'],
    extra: { fiber: 'Fibre (g)', sugars: 'Sugars (g)', salt: 'Salt (g)' },
  },
});

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function foodCsv(entries: readonly Entry[], f: CsvFormat = csvFormat()): { text: string; rows: number } {
  const list = (entries as readonly LooseEntry[])
    .slice()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const extra = EXTRA.filter((k) => list.some((e) => numOrNull(e[k]) !== null));
  const rows: Cell[][] = list.map((e) => [
    e.date,
    e.time,
    e.name,
    e.amountLabel,
    numOrNull(e.kcal),
    numOrNull(e.protein),
    numOrNull(e.carbs),
    numOrNull(e.fat),
    ...extra.map((k) => numOrNull(e[k])),
  ]);
  return { text: toCsv([...T.header, ...extra.map((k) => T.extra[k])], rows, f), rows: rows.length };
}

/** Cały dziennik jedzenia z bazy. Rzuca, gdy bazy nie da się odczytać — ekran mówi o tym wprost. */
export async function foodCsvFromDb(database: DietDb = defaultDb, f: CsvFormat = csvFormat()) {
  return foodCsv(await database.entries.toArray(), f);
}
