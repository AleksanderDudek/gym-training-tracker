import { useState } from 'react';
import { BOM, bodyCsv, csvFormat, csvName, workoutsCsv } from '../engine/csv';
import { pluralEn, text } from '../i18n';
import { plural } from '../engine/quips';
import type { AppState } from '../types';

/**
 * Ustawienia → dane → „Eksport do arkusza (CSV)”: trzy pliki do wyboru. Plik powstaje
 * w przeglądarce. Kopia zapasowa (JSON) zostaje jedyną drogą z powrotem — CSV jest do czytania
 * w arkuszu, nie do importu.
 */

const T = text({
  pl: {
    title: 'Eksport do arkusza (CSV)',
    lead: 'Pliki do otwarcia w Excelu, Numbers albo Arkuszach Google: treningi (wiersz na serię), ciało (ważenia i obwody) i jedzenie (wiersz na wpis). Separator średnik, liczby z przecinkiem — tak otwiera je polski arkusz. Do kopii zapasowej służy plik wyżej; tego się nie wczytuje z powrotem.',
    workouts: 'Treningi',
    body: 'Ciało',
    food: 'Jedzenie',
    group: 'Pliki CSV do pobrania',
    file: { workouts: 'treningi', body: 'cialo', food: 'jedzenie' },
    empty: {
      workouts: 'W zapisie nie ma jeszcze treningów — plik byłby pusty.',
      body: 'W zapisie nie ma jeszcze ważeń ani obwodów — plik byłby pusty.',
      food: 'Dziennik jedzenia jest pusty — plik byłby pusty.',
    },
    foodFailed: 'Nie udało się odczytać dziennika jedzenia w tej przeglądarce.',
    saved: (n: number) => `Plik gotowy: ${n} ${plural(n, ['wiersz', 'wiersze', 'wierszy'])}.`,
  },
  en: {
    title: 'Export to a spreadsheet (CSV)',
    lead: 'Files to open in Excel, Numbers or Google Sheets: workouts (a row per set), body (weigh-ins and measurements) and food (a row per entry). Comma-separated, with decimal points — the way an English spreadsheet opens them. The backup file above is for restoring; these aren’t read back in.',
    workouts: 'Workouts',
    body: 'Body',
    food: 'Food',
    group: 'CSV files to download',
    file: { workouts: 'workouts', body: 'body', food: 'food' },
    empty: {
      workouts: 'There are no workouts saved yet — the file would be empty.',
      body: 'There are no weigh-ins or measurements saved yet — the file would be empty.',
      food: 'The food diary is empty — the file would be empty.',
    },
    foodFailed: 'Couldn’t read the food diary in this browser.',
    saved: (n: number) => `File ready: ${n} ${pluralEn(n, 'row', 'rows')}.`,
  },
});

type Kind = 'workouts' | 'body' | 'food';

/** Pobranie tekstu jako pliku CSV w UTF-8 z BOM — inaczej Excel czyta polskie litery jako krzaki. */
export function downloadCsv(name: string, csv: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  // Chwila zwłoki: Safari potrafi zgubić pobranie, gdy adres zniknie w tym samym zadaniu.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function CsvExportCard({ state, onToast }: { state: AppState; onToast: (m: string) => void }) {
  const [busy, setBusy] = useState(false);

  const run = async (kind: Kind) => {
    setBusy(true);
    try {
      const f = csvFormat();
      let out: { text: string; rows: number };
      if (kind === 'workouts') out = workoutsCsv(state, f);
      else if (kind === 'body') out = bodyCsv(state, f);
      else {
        try {
          out = await import('../food/csv').then((m) => m.foodCsvFromDb(undefined, f));
        } catch {
          onToast(T.foodFailed);
          return;
        }
      }
      if (!out.rows) {
        onToast(T.empty[kind]);
        return;
      }
      downloadCsv(csvName(T.file[kind]), out.text);
      onToast(T.saved(out.rows));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grp">
      <h2>{T.title}</h2>
      <p>{T.lead}</p>
      <div className="btnrow" role="group" aria-label={T.group}>
        {(['workouts', 'body', 'food'] as const).map((k) => (
          <button key={k} className="btn ghost" disabled={busy} onClick={() => void run(k)}>
            {T[k]}
          </button>
        ))}
      </div>
    </div>
  );
}
