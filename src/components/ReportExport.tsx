import { useEffect, useRef, useState } from 'react';
import { hashQuery } from '../food/hash';
import { SETTINGS_PATH } from '../routing';
import { num, pluralEn, text } from '../i18n';
import { plural } from '../engine/quips';
import type { AppState } from '../types';
import { Segmented } from './ui';

/**
 * Ustawienia → dane → „Raport dla dietetyka lub lekarza (Excel)”: jeden plik .xlsx z całym
 * zapisem — arkusz na każdy rodzaj danych (`food/report.ts`). Moduł raportu i zapis .xlsx ładują
 * się dopiero po stuknięciu, razem z Dexie: kto tylko trenuje, nie płaci za nie przy starcie.
 * Raport powstaje też bez profilu diety (treningi, ruch, pomiary, badania).
 */

type Range = '30' | '90' | 'all';

/** Kotwica karty: `#/ustawienia?karta=raport` — tak prowadzi do niej strona badań. */
const CARD = 'raport';
export const REPORT_CARD_PATH = `${SETTINGS_PATH}?karta=${CARD}`;

const T = text({
  pl: {
    title: 'Raport dla dietetyka lub lekarza (Excel)',
    lead: 'Jeden plik .xlsx z arkuszami: dzień po dniu (kcal i cel, makro, błonnik, cukry, sól, napoje, kofeina, godzina pierwszego i ostatniego posiłku), każdy wpis jedzenia z godziną i składnikami, napoje, treningi z godziną i czasem, każda seria, ruch, waga i obwody oraz wyniki badań z zakresami. Same zapisane dane, bez zaleceń — pusta komórka znaczy „nie zapisano”.',
    privacy: 'Plik powstaje na tym urządzeniu i nigdzie nie jest wysyłany. Są w nim dane o zdrowiu — przekaż go tylko osobie, której ufasz.',
    range: 'Zakres',
    ranges: { '30': '30 dni', '90': '90 dni', all: 'Wszystko' } as Record<Range, string>,
    download: 'Pobierz plik .xlsx',
    busy: 'Przygotowuję plik…',
    failed: 'Nie udało się przygotować raportu w tej przeglądarce.',
    saved: (sheets: number, rows: number) =>
      `Raport gotowy: ${sheets} ${plural(sheets, ['arkusz', 'arkusze', 'arkuszy'])}, ${num(rows)} ${plural(rows, ['wiersz', 'wiersze', 'wierszy'])} danych.`,
    empty: 'W tym zakresie nie ma jeszcze żadnych zapisanych danych — plik miałby tylko arkusz z informacjami.',
  },
  en: {
    title: 'Report for a dietitian or doctor (Excel)',
    lead: 'One .xlsx file with sheets: day by day (kcal and target, macros, fibre, sugars, salt, drinks, caffeine, the time of the first and last meal), every food entry with its time and ingredients, drinks, workouts with start time and duration, every set, activity, weight and measurements, and lab results with their ranges. Only the saved data, no advice — an empty cell means “not logged”.',
    privacy: 'The file is made on this device and isn’t sent anywhere. It holds health data — give it only to someone you trust.',
    range: 'Range',
    ranges: { '30': '30 days', '90': '90 days', all: 'Everything' },
    download: 'Download the .xlsx file',
    busy: 'Preparing the file…',
    failed: 'Couldn’t prepare the report in this browser.',
    saved: (sheets: number, rows: number) =>
      `Report ready: ${sheets} ${pluralEn(sheets, 'sheet', 'sheets')}, ${num(rows)} ${pluralEn(rows, 'row', 'rows')} of data.`,
    empty: 'There’s no saved data in this range yet — the file would only have the information sheet.',
  },
});

/** Pobranie bajtów jako pliku. Adres znika chwilę później — Safari potrafi zgubić pobranie od razu. */
function download(name: string, bytes: Uint8Array, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function ReportExportCard({ state, onToast }: { state: AppState; onToast: (m: string) => void }) {
  const [range, setRange] = useState<Range>('all');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Jak karty urządzeń: z opóźnieniem, bo router po zmianie ekranu sam przewija na górę.
  useEffect(() => {
    if (hashQuery(window.location.hash).get('karta') !== CARD) return;
    const t = window.setTimeout(() => ref.current?.scrollIntoView?.({ block: 'start' }), 150);
    return () => window.clearTimeout(t);
  }, []);

  const run = async () => {
    setBusy(true);
    try {
      let out: Awaited<ReturnType<typeof import('../food/report').reportFromDb>>;
      let mime: string;
      try {
        const m = await import('../food/report');
        out = await m.reportFromDb(state, range);
        mime = m.XLSX_MIME;
      } catch (e) {
        console.error(e);
        onToast(T.failed);
        return;
      }
      if (!out.summary.rows) {
        onToast(T.empty);
        return;
      }
      download(out.name, out.bytes, mime);
      onToast(T.saved(out.summary.sheets.length, out.summary.rows));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grp" id={CARD} ref={ref}>
      <h2>{T.title}</h2>
      <p>{T.lead}</p>
      <p>{T.privacy}</p>
      <div className="seg-label">{T.range}</div>
      <Segmented<Range>
        label={T.range}
        value={range}
        options={(['30', '90', 'all'] as const).map((key) => ({ key, label: T.ranges[key] }))}
        onChange={setRange}
      />
      <div className="btnrow" style={{ marginTop: 10 }}>
        <button className="btn" disabled={busy} onClick={() => void run()}>
          {busy ? T.busy : T.download}
        </button>
      </div>
    </div>
  );
}
