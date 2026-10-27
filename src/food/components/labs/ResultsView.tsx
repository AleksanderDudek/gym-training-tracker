import { Pencil, Trash2 } from 'lucide-react';
import { text } from '../../../i18n';
import type { Sex } from '../../diet/types';
import { formatDate, plural } from '../../lib/format';
import { GROUP_LABELS, MARKERS, type Marker, type MarkerGroup } from '../../labs/markers';
import type { LabReport } from '../../labs/types';
import { historyOf, judge, type Latest } from '../../labs/verdict';
import { rangeText, resultText, verdictWord } from './labsFormat';

const T = text({
  pl: {
    reports: 'Zapisane badania',
    results: (n: number) => `${n} ${plural(n, 'wynik', 'wyniki', 'wyników')}`,
    source: { pdf: 'PDF', photo: 'zdjęcie', text: 'tekst', manual: 'wpisane' } as Record<LabReport['source'], string>,
    edit: (date: string) => `Popraw badanie z ${date}`,
    remove: (date: string) => `Usuń badanie z ${date}`,
    confirm: (date: string) => `Usunąć badanie z ${date}? Tego nie da się cofnąć.`,
    derived: 'wyliczone z innych wyników',
    history: 'Historia',
    chart: (name: string) => `Wykres: ${name}`,
    range: (r: string, lab: boolean) => `${lab ? 'zakres laboratorium' : 'zakres'}: ${r}`,
    target: (r: string, source: string) => `cel: ${r} (${source})`,
  },
  en: {
    reports: 'Saved tests',
    results: (n: number) => `${n} ${n === 1 ? 'result' : 'results'}`,
    source: { pdf: 'PDF', photo: 'photo', text: 'text', manual: 'typed' } as Record<LabReport['source'], string>,
    edit: (date: string) => `Correct the test of ${date}`,
    remove: (date: string) => `Delete the test of ${date}`,
    confirm: (date: string) => `Delete the test of ${date}? This cannot be undone.`,
    derived: 'calculated from other results',
    history: 'History',
    chart: (name: string) => `Chart: ${name}`,
    range: (r: string, lab: boolean) => `${lab ? 'lab range' : 'range'}: ${r}`,
    target: (r: string, source: string) => `target: ${r} (${source})`,
  },
});

const GROUPS = Object.keys(GROUP_LABELS) as MarkerGroup[];

export function ResultsView({
  reports,
  latest,
  sex,
  open,
  onOpen,
  onEdit,
  onDelete,
}: {
  reports: LabReport[];
  latest: Map<string, Latest>;
  sex: Sex;
  open: string | null;
  onOpen: (marker: string | null) => void;
  onEdit: (report: LabReport) => void;
  onDelete: (report: LabReport) => void;
}) {
  return (
    <>
      {GROUPS.map((g) => {
        const rows = [...latest.entries()].filter(([id]) => MARKERS[id]?.group === g);
        if (!rows.length) return null;
        return (
          <section key={g} className="grp" aria-labelledby={`fd-lab-g-${g}`}>
            <h2 id={`fd-lab-g-${g}`}>{GROUP_LABELS[g]}</h2>
            <ul className="fd-lab-results">
              {rows.map(([id, value]) => (
                <ResultRow key={id} marker={MARKERS[id]!} latest={value} sex={sex} reports={reports} open={open === id} onToggle={() => onOpen(open === id ? null : id)} />
              ))}
            </ul>
          </section>
        );
      })}
      <section className="grp" aria-labelledby="fd-lab-reports">
        <h2 id="fd-lab-reports">{T.reports}</h2>
        <ul className="fd-lab-reports">
          {reports.map((r) => (
            <li key={r.id}>
              <span className="fd-lab-report-name">
                {formatDate(r.date)}
                {r.lab ? ` · ${r.lab}` : ''}
              </span>
              <span className="fd-lab-food-meta">
                {T.results(r.results.length)} · {T.source[r.source]}
              </span>
              <span className="fd-lab-habit-btns">
                <button type="button" className="fd-lab-icon" onClick={() => onEdit(r)} aria-label={T.edit(formatDate(r.date))}>
                  <Pencil aria-hidden="true" size={16} />
                </button>
                <button
                  type="button"
                  className="fd-lab-icon"
                  onClick={() => window.confirm(T.confirm(formatDate(r.date))) && onDelete(r)}
                  aria-label={T.remove(formatDate(r.date))}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function ResultRow({
  marker,
  latest,
  sex,
  reports,
  open,
  onToggle,
}: {
  marker: Marker;
  latest: Latest;
  sex: Sex;
  reports: LabReport[];
  open: boolean;
  onToggle: () => void;
}) {
  const verdict = judge(marker, latest, sex);
  const word = verdictWord(marker, verdict, latest.qual);
  const history = latest.derived ? [] : historyOf(reports, marker.id);
  const range = rangeText(marker, verdict.range);
  return (
    <li className="fd-lab-result">
      <button type="button" className="fd-lab-result-head" aria-expanded={open} onClick={onToggle}>
        <span className="fd-lab-mname">{marker.name}</span>
        <span className="fd-lab-result-value">{resultText(marker, latest)}</span>
        <span className={`fd-lab-badge fd-lab-tone-${word.tone}`}>{word.word}</span>
      </button>
      {open && (
        <div className="fd-lab-result-body">
          <p className="hint">{marker.about}</p>
          <p className="fd-lab-food-meta">
            {[range && T.range(range, verdict.from === 'lab'), marker.target && T.target(rangeText(marker, marker.target.range)!, marker.target.source), latest.derived && T.derived]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {history.length > 1 && <Spark marker={marker} history={history} sex={sex} />}
          {history.length > 0 && (
            <ul className="fd-lab-history" aria-label={T.history}>
              {[...history].reverse().map((h, i) => (
                <li key={`${h.date}-${i}`}>
                  {formatDate(h.date)} — <b>{resultText(marker, h)}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** A small line of the values over time, with the range as a band. Decorative: the list says the same. */
function Spark({ marker, history, sex }: { marker: Marker; history: Latest[]; sex: Sex }) {
  const points = history.filter((h) => h.value !== null);
  if (points.length < 2) return null;
  const range = history[history.length - 1]!.ref ?? marker.ref?.[sex] ?? null;
  const values = points.map((p) => p.value!);
  const lo = Math.min(...values, range?.[0] ?? Infinity);
  const hi = Math.max(...values, range?.[1] ?? -Infinity);
  const pad = (hi - lo) * 0.15 || 1;
  const [min, max] = [lo - pad, hi + pad];
  const t0 = Date.parse(points[0]!.date);
  const span = Date.parse(points[points.length - 1]!.date) - t0 || 1;
  const W = 300;
  const H = 70;
  const x = (d: string) => 6 + ((Date.parse(d) - t0) / span) * (W - 12);
  const y = (v: number) => H - 6 - ((v - min) / (max - min)) * (H - 12);
  const band = range ? { top: y(range[1] ?? max), bottom: y(range[0] ?? min) } : null;
  return (
    <svg className="fd-lab-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.chart(marker.name)}>
      {band && <rect x="0" y={band.top} width={W} height={Math.max(1, band.bottom - band.top)} className="fd-lab-spark-band" />}
      <polyline className="fd-lab-spark-line" points={points.map((p) => `${x(p.date)},${y(p.value!)}`).join(' ')} />
      {points.map((p, i) => (
        <circle key={i} className="fd-lab-spark-dot" cx={x(p.date)} cy={y(p.value!)} r="3.5" />
      ))}
    </svg>
  );
}
