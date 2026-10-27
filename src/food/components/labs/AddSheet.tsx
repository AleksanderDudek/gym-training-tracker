import { Camera, ClipboardPaste, FileText, Keyboard, Plus, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { num, text } from '../../../i18n';
import { plural } from '../../lib/format';
import { GROUP_LABELS, MARKER_LIST, MARKERS, toCanonical, type Marker, type MarkerGroup } from '../../labs/markers';
import { readText, type Qual, type ReadResult } from '../../labs/read/parse';
import { replaceReport, saveReport } from '../../labs/store';
import type { LabReport, LabResult, LabSource } from '../../labs/types';
import { foldUnit, parsePrinted } from '../../labs/units';
import { judge } from '../../labs/verdict';
import type { Sex } from '../../diet/types';
import { Sheet } from '../common/Sheet';
import { formatValue, inputValue, prettyUnit, QUAL_WORDS, rangeText, verdictWord } from './labsFormat';

const T = text({
  pl: {
    title: 'Dodaj wyniki',
    editTitle: 'Popraw wyniki',
    lead: 'Plik i zdjęcie czyta ten telefon — nic nie wychodzi do internetu. Zapisuję tylko wartości, które zatwierdzisz.',
    pdf: 'PDF z laboratorium',
    pdfSub: 'np. z konta pacjenta Diagnostyki',
    photo: 'Zdjęcie lub zrzut ekranu',
    photoSub: 'wydruk z przychodni (NFZ)',
    paste: 'Wklej tekst',
    pasteSub: 'skopiowany z portalu lub IKP',
    manual: 'Wpisz ręcznie',
    manualSub: 'z kartki, wynik po wyniku',
    pasteLabel: 'Tekst z wynikami',
    pasteGo: 'Odczytaj',
    reading: 'Czytam…',
    loadingOcr: 'Pobieram czytnik zdjęć (ok. 7 MB, tylko za pierwszym razem)…',
    ocr: (page: number, pages: number, pct: number) => `Odczytuję zdjęcie${pages > 1 ? ` ${page} z ${pages}` : ''}: ${pct}%`,
    pdfReading: (pct: number) => `Czytam PDF: ${pct}%`,
    failed: 'Nie udało się odczytać pliku. Spróbuj zdjęcia albo wpisz wyniki ręcznie.',
    nothing: 'Nie znalazłem tu żadnego wyniku, który znam. Sprawdź, czy to wyniki badań krwi lub moczu — albo wpisz je ręcznie.',
    found: (n: number) => `Rozpoznane: ${n} ${plural(n, 'wynik', 'wyniki', 'wyników')}. Sprawdź je z kartką — zwłaszcza po zdjęciu.`,
    date: 'Data pobrania',
    noDate: 'Nie znalazłem daty pobrania — wpisz ją.',
    lab: 'Laboratorium',
    labPlaceholder: 'np. Diagnostyka, przychodnia',
    value: (name: string) => `Wynik: ${name}`,
    unit: (name: string) => `Jednostka: ${name}`,
    use: (name: string) => `Zapisz ${name}`,
    remove: (name: string) => `Usuń ${name}`,
    labRange: (r: string) => `zakres lab.: ${r}`,
    appRange: (r: string) => `zakres: ${r}`,
    guessed: 'Nie rozpoznałem jednostki — sprawdź, czy wynik jest w tej.',
    suspect: 'Ten wynik nie pasuje do zakresu z wydruku — sprawdź go z kartką.',
    comma: (v: string) => `Wygląda na zgubiony przecinek — może ${v}?`,
    fix: (v: string) => `Popraw na ${v}`,
    dup: 'drugi raz w dokumencie',
    unknown: (n: number) => `Nie rozpoznałem ${n} ${plural(n, 'wiersza', 'wierszy', 'wierszy')}`,
    unknownHint: 'To badania spoza listy aplikacji albo wiersze, których nie umiem przeczytać. Ważny wynik dodaj niżej ręcznie.',
    addRow: 'Dodaj badanie',
    pick: 'Wybierz badanie…',
    qualPick: (name: string) => `Wynik paskowy: ${name}`,
    save: (n: number) => (n ? `Zapisz ${n} ${plural(n, 'wynik', 'wyniki', 'wyników')}` : 'Zapisz'),
    saveFailed: 'Nie udało się zapisać.',
    badValue: 'To nie jest liczba',
    back: 'Wróć',
    empty: 'Dodaj pierwsze badanie przyciskiem niżej.',
  },
  en: {
    title: 'Add results',
    editTitle: 'Correct results',
    lead: 'This phone reads the file and the photo — nothing goes online. Only the values you confirm are saved.',
    pdf: 'PDF from the lab',
    pdfSub: 'e.g. from a Diagnostyka patient account',
    photo: 'Photo or screenshot',
    photoSub: 'a clinic printout (NFZ)',
    paste: 'Paste text',
    pasteSub: 'copied from a portal or IKP',
    manual: 'Type them in',
    manualSub: 'from paper, one by one',
    pasteLabel: 'Text with results',
    pasteGo: 'Read',
    reading: 'Reading…',
    loadingOcr: 'Getting the photo reader (about 7 MB, first time only)…',
    ocr: (page: number, pages: number, pct: number) => `Reading the photo${pages > 1 ? ` ${page} of ${pages}` : ''}: ${pct}%`,
    pdfReading: (pct: number) => `Reading the PDF: ${pct}%`,
    failed: 'Could not read the file. Try a photo or type the results in.',
    nothing: 'I found no result I know here. Check that these are blood or urine results — or type them in.',
    found: (n: number) => `Recognised: ${n} ${n === 1 ? 'result' : 'results'}. Check them against the paper — after a photo especially.`,
    date: 'Date of collection',
    noDate: 'I found no collection date — enter it.',
    lab: 'Lab',
    labPlaceholder: 'e.g. Diagnostyka, clinic',
    value: (name: string) => `Result: ${name}`,
    unit: (name: string) => `Unit: ${name}`,
    use: (name: string) => `Save ${name}`,
    remove: (name: string) => `Remove ${name}`,
    labRange: (r: string) => `lab range: ${r}`,
    appRange: (r: string) => `range: ${r}`,
    guessed: 'I did not recognise the unit — check the result is in this one.',
    suspect: 'This result does not fit the printed range — check it against the paper.',
    comma: (v: string) => `Looks like a lost decimal comma — maybe ${v}?`,
    fix: (v: string) => `Change to ${v}`,
    dup: 'second time in the document',
    unknown: (n: number) => `${n} ${n === 1 ? 'row' : 'rows'} not recognised`,
    unknownHint: 'Tests outside the app’s list, or rows I cannot read. Add an important one by hand below.',
    addRow: 'Add a test',
    pick: 'Choose a test…',
    qualPick: (name: string) => `Strip result: ${name}`,
    save: (n: number) => (n ? `Save ${n} ${n === 1 ? 'result' : 'results'}` : 'Save'),
    saveFailed: 'Could not save.',
    badValue: 'Not a number',
    back: 'Back',
    empty: 'Add the first test with the button below.',
  },
});

/** A row on the review screen: everything as text, so a half-typed number stays as typed. */
interface Row {
  key: number;
  marker: string;
  value: string;
  /** Folded unit key of the marker (`foldUnit`). */
  unit: string;
  cmp: '<' | '>' | null;
  qual: Qual | null;
  printed: string;
  ref: LabResult['ref'];
  use: boolean;
  guessed: boolean;
  duplicate: boolean;
  /** Canonical value the comma may have been lost from, or null when only implausible. */
  suspect: { suggest: number | null } | null;
}

interface Draft {
  date: string;
  dateFound: boolean;
  lab: string;
  source: LabSource;
  rows: Row[];
  unknown: string[];
  id?: number;
  addedAt?: string;
}

type Stage = { kind: 'choose' } | { kind: 'paste' } | { kind: 'reading'; status: string } | { kind: 'review'; draft: Draft; note: string | null };

let nextKey = 1;

const nowIso = () => new Date().toISOString();

const canonicalKey = (m: Marker) => foldUnit(m.unit);

function fromRead(read: ReadResult, source: LabSource, today: string): Draft {
  return {
    date: read.date ?? today,
    dateFound: read.date !== null,
    lab: read.lab ?? '',
    source,
    unknown: read.unknown,
    rows: read.rows.map((r) => ({
      key: nextKey++,
      marker: r.marker.id,
      value: r.value === null ? '' : `${r.cmp ?? ''}${inputValue(r.marker, r.value)}`,
      unit: canonicalKey(r.marker),
      cmp: r.cmp,
      qual: r.qual,
      printed: [r.printed, r.unit].filter(Boolean).join(' '),
      ref: r.ref,
      use: !r.duplicate,
      guessed: r.unitGuessed,
      duplicate: r.duplicate,
      suspect: r.suspect,
    })),
  };
}

export function draftOf(report: LabReport): Draft {
  return {
    id: report.id,
    addedAt: report.addedAt,
    date: report.date,
    dateFound: true,
    lab: report.lab ?? '',
    source: report.source,
    unknown: [],
    rows: report.results.map((r) => {
      const marker = MARKERS[r.marker]!;
      return {
        key: nextKey++,
        marker: r.marker,
        value: r.value === null ? '' : `${r.cmp ?? ''}${inputValue(marker, r.value)}`,
        unit: canonicalKey(marker),
        cmp: r.cmp,
        qual: r.qual,
        printed: r.printed,
        ref: r.ref,
        use: true,
        guessed: false,
        duplicate: false,
        suspect: null,
      };
    }),
  };
}

/** A row → a result in canonical units, or null when its value is not readable. */
function resultOf(row: Row): LabResult | null {
  const marker = MARKERS[row.marker];
  if (!marker) return null;
  const typed = row.value.trim() === '' ? null : parsePrinted(row.value);
  if (typed === null && row.qual === null) return null;
  const value = typed ? toCanonical(marker, typed.value, row.unit) : null;
  if (typed && value === null) return null;
  const f = 10 ** (marker.digits + 2);
  return {
    marker: row.marker,
    value: value === null ? null : Math.round(value * f) / f,
    cmp: typed ? typed.cmp : null,
    qual: row.qual,
    printed: row.printed || [row.value.trim(), prettyUnit(row.unit)].filter(Boolean).join(' '),
    ref: row.ref,
  };
}

const GROUPS = Object.keys(GROUP_LABELS) as MarkerGroup[];

export function AddSheet({
  open,
  onClose,
  today,
  sex,
  edit,
  onSaved,
  onPerson,
}: {
  open: boolean;
  onClose: () => void;
  today: string;
  /** Unknown until set: sex-specific ranges are then not judged in the review. */
  sex: Sex | null;
  edit: LabReport | null;
  onSaved: (date: string) => void;
  /** Sex and year of birth from the document's header, for the ranges when the app has neither. */
  onPerson?: (found: { sex: Sex | null; birthYear: number | null }) => void;
}) {
  const [stage, setStage] = useState<Stage>(() => (edit ? { kind: 'review', draft: draftOf(edit), note: null } : { kind: 'choose' }));
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const ids = useId();

  const review = (read: ReadResult, source: LabSource) => {
    if (read.sex || read.birthYear) onPerson?.({ sex: read.sex, birthYear: read.birthYear });
    setError(read.rows.length ? null : T.nothing);
    setStage(read.rows.length ? { kind: 'review', draft: fromRead(read, source, today), note: T.found(read.rows.filter((r) => !r.duplicate).length) } : { kind: 'choose' });
  };

  const photos = async (files: readonly Blob[], source: LabSource, before: readonly string[] = []) => {
    setStage({ kind: 'reading', status: T.loadingOcr });
    const { readImages } = await import('../../labs/read/ocr');
    const lines = await readImages(files, (p) =>
      setStage({ kind: 'reading', status: p.step === 'load' ? T.loadingOcr : T.ocr(p.page, p.pages, Math.round(p.share * 100)) }),
    );
    review(readText([...before, ...lines].join('\n'), { ocr: before.length === 0 }), source);
  };

  const onPdf = async (file: File) => {
    setError(null);
    setStage({ kind: 'reading', status: T.reading });
    try {
      const { readPdf } = await import('../../labs/read/pdf');
      const pdf = await readPdf(file, (share) => setStage({ kind: 'reading', status: T.pdfReading(Math.round(share * 100)) }));
      // Scanned pages go through OCR, also next to pages with text (a scan stapled to a printout).
      if (pdf.scans.length) await photos(pdf.scans, 'pdf', pdf.lines);
      else review(readText(pdf.lines.join('\n')), 'pdf');
    } catch (e) {
      console.error(e);
      setError(T.failed);
      setStage({ kind: 'choose' });
    }
  };

  const onPhotos = async (files: File[]) => {
    setError(null);
    try {
      await photos(files, 'photo');
    } catch (e) {
      console.error(e);
      setError(T.failed);
      setStage({ kind: 'choose' });
    }
  };

  const draft = stage.kind === 'review' ? stage.draft : null;
  const setDraft = (patch: Partial<Draft>) =>
    setStage((s) => (s.kind === 'review' ? { ...s, draft: { ...s.draft, ...patch } } : s));
  const setRow = (key: number, patch: Partial<Row>) =>
    setStage((s) => (s.kind === 'review' ? { ...s, draft: { ...s.draft, rows: s.draft.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) } } : s));

  const ready = draft ? draft.rows.filter((r) => r.use).map(resultOf) : [];
  const good = ready.filter((r): r is LabResult => r !== null);
  const canSave = !!draft && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && draft.date <= today && good.length > 0 && good.length === ready.length;

  const save = async () => {
    if (!draft || !canSave) return;
    setSaving(true);
    try {
      const report = { date: draft.date, lab: draft.lab.trim() || null, source: draft.source, results: good, addedAt: draft.addedAt ?? nowIso() };
      if (draft.id !== undefined) await replaceReport({ ...report, id: draft.id });
      else await saveReport(report);
      onSaved(draft.date);
    } catch (e) {
      console.error(e);
      setError(T.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const addRow = (marker: string) => {
    const m = MARKERS[marker];
    if (!draft || !m) return;
    setDraft({
      rows: [
        ...draft.rows,
        { key: nextKey++, marker, value: '', unit: canonicalKey(m), cmp: null, qual: null, printed: '', ref: null, use: true, guessed: false, duplicate: false, suspect: null },
      ],
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={edit ? T.editTitle : T.title}
      full={stage.kind === 'review'}
      footer={
        draft ? (
          <button type="button" className="btn wide" disabled={!canSave || saving} onClick={() => void save()}>
            {T.save(good.length)}
          </button>
        ) : undefined
      }
    >
      {stage.kind === 'choose' && (
        <div className="fd-lab-add">
          <p className="hint">{T.lead}</p>
          {error && (
            <p className="fd-lab-error" role="alert">
              {error}
            </p>
          )}
          <div className="fd-lab-ways">
            <button type="button" className="fd-lab-way" onClick={() => pdfInput.current?.click()}>
              <FileText aria-hidden="true" size={22} />
              <span className="fd-lab-way-name">{T.pdf}</span>
              <span className="fd-lab-way-sub">{T.pdfSub}</span>
            </button>
            <button type="button" className="fd-lab-way" onClick={() => photoInput.current?.click()}>
              <Camera aria-hidden="true" size={22} />
              <span className="fd-lab-way-name">{T.photo}</span>
              <span className="fd-lab-way-sub">{T.photoSub}</span>
            </button>
            <button type="button" className="fd-lab-way" onClick={() => setStage({ kind: 'paste' })}>
              <ClipboardPaste aria-hidden="true" size={22} />
              <span className="fd-lab-way-name">{T.paste}</span>
              <span className="fd-lab-way-sub">{T.pasteSub}</span>
            </button>
            <button
              type="button"
              className="fd-lab-way"
              onClick={() => setStage({ kind: 'review', note: null, draft: { date: today, dateFound: true, lab: '', source: 'manual', rows: [], unknown: [] } })}
            >
              <Keyboard aria-hidden="true" size={22} />
              <span className="fd-lab-way-name">{T.manual}</span>
              <span className="fd-lab-way-sub">{T.manualSub}</span>
            </button>
          </div>
          <input
            ref={pdfInput}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) void onPdf(file);
            }}
          />
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.currentTarget.files ?? [])];
              e.currentTarget.value = '';
              if (files.length) void onPhotos(files.slice(0, 6));
            }}
          />
        </div>
      )}

      {stage.kind === 'paste' && (
        <div className="fd-lab-add">
          <label className="fd-lab-field" htmlFor={`${ids}-paste`}>
            {T.pasteLabel}
          </label>
          <textarea id={`${ids}-paste`} className="fd-lab-paste" rows={10} value={pasted} onChange={(e) => setPasted(e.target.value)} />
          <div className="btnrow">
            <button type="button" className="btn" disabled={!pasted.trim()} onClick={() => review(readText(pasted), 'text')}>
              {T.pasteGo}
            </button>
            <button type="button" className="btn ghost" onClick={() => setStage({ kind: 'choose' })}>
              {T.back}
            </button>
          </div>
        </div>
      )}

      {stage.kind === 'reading' && (
        <p className="fd-lab-reading" role="status">
          {stage.status}
        </p>
      )}

      {draft && (
        <div className="fd-lab-review">
          {stage.kind === 'review' && stage.note && (
            <p className="hint" role="status">
              {stage.note}
            </p>
          )}
          {error && (
            <p className="fd-lab-error" role="alert">
              {error}
            </p>
          )}
          <div className="fd-lab-meta">
            <div>
              <label className="fd-lab-field" htmlFor={`${ids}-date`}>
                {T.date}
              </label>
              <input
                id={`${ids}-date`}
                type="date"
                className="fd-lab-input"
                value={draft.date}
                max={today}
                onChange={(e) => setDraft({ date: e.target.value, dateFound: true })}
                aria-describedby={draft.dateFound ? undefined : `${ids}-nodate`}
              />
              {!draft.dateFound && (
                <p className="fd-lab-warn" id={`${ids}-nodate`}>
                  {T.noDate}
                </p>
              )}
            </div>
            <div>
              <label className="fd-lab-field" htmlFor={`${ids}-lab`}>
                {T.lab}
              </label>
              <input
                id={`${ids}-lab`}
                className="fd-lab-input"
                value={draft.lab}
                placeholder={T.labPlaceholder}
                maxLength={60}
                onChange={(e) => setDraft({ lab: e.target.value })}
              />
            </div>
          </div>

          {draft.rows.length === 0 && <p className="hint">{T.empty}</p>}
          <ul className="fd-lab-rows">
            {draft.rows.map((row) => (
              <ReviewRow key={row.key} row={row} sex={sex} manual={draft.source === 'manual'} onChange={(p) => setRow(row.key, p)} onRemove={() => setDraft({ rows: draft.rows.filter((r) => r.key !== row.key) })} />
            ))}
          </ul>

          <label className="fd-lab-field" htmlFor={`${ids}-add`}>
            <Plus aria-hidden="true" size={16} /> {T.addRow}
          </label>
          <select
            id={`${ids}-add`}
            className="fd-lab-input"
            value=""
            onChange={(e) => {
              addRow(e.target.value);
              e.currentTarget.value = '';
            }}
          >
            <option value="">{T.pick}</option>
            {GROUPS.map((g) => (
              <optgroup key={g} label={GROUP_LABELS[g]}>
                {MARKER_LIST.filter((m) => m.group === g).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {draft.unknown.length > 0 && (
            <details className="fd-lab-unknown">
              <summary>{T.unknown(draft.unknown.length)}</summary>
              <p className="hint">{T.unknownHint}</p>
              <ul>
                {draft.unknown.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ReviewRow({ row, sex, manual, onChange, onRemove }: { row: Row; sex: Sex | null; manual: boolean; onChange: (p: Partial<Row>) => void; onRemove: () => void }) {
  const id = useId();
  const marker = MARKERS[row.marker]!;
  const result = resultOf(row);
  const bad = row.value.trim() !== '' && parsePrinted(row.value) === null;
  // Without the person's sex only the lab's own range or a range shared by both sexes can judge.
  const sexless = !marker.ref || JSON.stringify(marker.ref.M) === JSON.stringify(marker.ref.K);
  const verdict = result && (sex || row.ref || sexless) ? judge(marker, result, sex ?? 'K') : null;
  const word = verdict ? verdictWord(marker, verdict, result!.qual) : null;
  const units = Object.keys(marker.units);
  const range = row.ref ? T.labRange(rangeText(marker, row.ref)!) : verdict?.range ? T.appRange(rangeText(marker, verdict.range)!) : null;
  return (
    <li className={`fd-lab-row${row.use ? '' : ' fd-lab-row-off'}`}>
      <div className="fd-lab-row-head">
        <label className="fd-lab-check">
          <input type="checkbox" checked={row.use} onChange={(e) => onChange({ use: e.target.checked })} aria-label={T.use(marker.name)} />
          <span className="fd-lab-row-name">{marker.name}</span>
        </label>
        {word && <span className={`fd-lab-badge fd-lab-tone-${word.tone}`}>{word.word}</span>}
        <button type="button" className="fd-lab-icon" onClick={onRemove} aria-label={T.remove(marker.name)}>
          <Trash2 aria-hidden="true" size={16} />
        </button>
      </div>
      <div className="fd-lab-row-fields">
        {marker.qualitative && (
          <select
            className="fd-lab-input fd-lab-qual"
            aria-label={T.qualPick(marker.name)}
            value={row.qual ?? ''}
            onChange={(e) => onChange({ qual: (e.target.value || null) as Qual | null })}
          >
            <option value="">—</option>
            {(['neg', 'trace', 'pos'] as const).map((q) => (
              <option key={q} value={q}>
                {QUAL_WORDS[q]}
              </option>
            ))}
          </select>
        )}
        <input
          className="fd-lab-input fd-lab-value"
          inputMode="decimal"
          value={row.value}
          aria-label={T.value(marker.name)}
          aria-invalid={bad || undefined}
          aria-describedby={bad || row.guessed ? `${id}-warn` : undefined}
          onChange={(e) => onChange({ value: e.target.value, guessed: false, suspect: null })}
        />
        {manual || row.guessed ? (
          units.length > 1 ? (
            <select className="fd-lab-input fd-lab-unit" aria-label={T.unit(marker.name)} value={row.unit} onChange={(e) => onChange({ unit: e.target.value, guessed: false })}>
              {units.map((u) => (
                <option key={u} value={u}>
                  {prettyUnit(u) || '—'}
                </option>
              ))}
            </select>
          ) : (
            <span className="fd-lab-unit-text">{marker.unit}</span>
          )
        ) : (
          <span className="fd-lab-unit-text">{marker.unit}</span>
        )}
      </div>
      {(bad || row.guessed) && (
        <p className="fd-lab-warn" id={`${id}-warn`}>
          {bad ? T.badValue : T.guessed}
        </p>
      )}
      {row.suspect && !bad && (
        <p className="fd-lab-warn" role="note">
          {row.suspect.suggest === null ? T.suspect : T.comma(formatValue(marker, row.suspect.suggest))}{' '}
          {row.suspect.suggest !== null && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => onChange({ value: inputValue(marker, row.suspect!.suggest!), suspect: null, use: true })}
            >
              {T.fix(formatValue(marker, row.suspect.suggest))}
            </button>
          )}
        </p>
      )}
      <p className="fd-lab-row-meta">
        {[range, row.duplicate ? T.dup : null, row.printed && !manual ? `„${row.printed}”` : null].filter(Boolean).join(' · ')}
        {result?.value !== null && result?.value !== undefined && row.unit !== canonicalKey(marker) && ` → ${num(result.value, marker.digits)} ${marker.unit}`}
      </p>
    </li>
  );
}
