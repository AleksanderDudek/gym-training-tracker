import type { ReactNode } from 'react';
import type { Adjustment, DayStatus, DayTotals, Status } from '../../diet/day';
import type { MacroTargets } from '../../diet/profiles';
import { formatNumber } from '../../lib/format';

/**
 * Pasek postępu dnia. Kolor idzie za stanem (brak — złoto, w normie — zieleń, nadmiar —
 * pomarańcz), ale nigdy nie mówi sam: obok zawsze stoi zdanie, czego brakuje albo ile za dużo.
 */
export function Bar({
  value,
  target,
  status,
  label,
}: {
  value: number;
  target: number;
  status: Status;
  label: string;
}) {
  const share = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  return (
    <div
      className={`fd-diet-bar fd-diet-${status}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(target)}
      aria-valuenow={Math.round(Math.min(value, target))}
      aria-valuetext={`${formatNumber(value, 0)} z ${formatNumber(target, 0)}`}
    >
      <i style={{ width: `${share * 100}%` }} />
    </div>
  );
}

interface Props {
  targets: MacroTargets;
  eaten: DayTotals;
  status: DayStatus;
  adjustment: Adjustment | null;
  plannedKcal: number | null;
  /** Główna akcja dnia pod liczbami — „Dodaj zjedzone”. */
  children?: ReactNode;
}

/** Dzień wobec celu dnia: najpierw kalorie, potem trzy makroskładniki i co znaczy każdy stan. */
export function MacroBars({ targets, eaten, status, adjustment, plannedKcal, children }: Props) {
  const rows = [
    { key: 'protein' as const, label: 'Białko', value: eaten.protein, target: targets.protein.target },
    {
      key: 'carbs' as const,
      label: 'Węglowodany',
      value: eaten.carbs,
      target: targets.carbs.max ?? targets.carbs.target,
    },
    { key: 'fat' as const, label: 'Tłuszcz', value: eaten.fat, target: targets.fat.target },
  ];
  return (
    <section className="grp fd-diet-balance" aria-label="Bilans dnia">
      <div className="fd-diet-balance-top">
        <p className="fd-diet-kcal">
          {formatNumber(eaten.kcal, 0)} <small>/ {formatNumber(targets.kcal, 0)} kcal</small>
        </p>
        <p className={`fd-diet-note fd-diet-${status.kcal.status}`}>{status.kcal.note}</p>
      </div>
      <Bar value={eaten.kcal} target={targets.kcal} status={status.kcal.status} label="Kalorie" />
      {adjustment && adjustment.delta !== 0 && (
        <p className="tight">
          Cel na dziś {adjustment.delta > 0 ? 'podniesiony' : 'obniżony'} o{' '}
          {formatNumber(Math.abs(adjustment.delta), 0)} kcal. {adjustment.explanation}
        </p>
      )}
      {plannedKcal !== null && <p className="tight">Plan na dziś: {formatNumber(plannedKcal, 0)} kcal.</p>}
      <div className="fd-diet-macros">
        {rows.map((row) => (
          <div key={row.key} className="fd-diet-macro">
            <div className="fd-diet-macro-head">
              <span>{row.label}</span>
              <span className="fd-diet-nums">
                {formatNumber(row.value, 0)} / {formatNumber(row.target, 0)} g
              </span>
            </div>
            <Bar value={row.value} target={row.target} status={status[row.key].status} label={row.label} />
            <span className={`fd-diet-note fd-diet-${status[row.key].status}`}>{status[row.key].note}</span>
          </div>
        ))}
      </div>
      {eaten.unknownMacros > 0 && (
        <p className="tight">
          {eaten.unknownMacros} {eaten.unknownMacros === 1 ? 'wpis ma' : 'wpisy mają'} tylko kalorie – sumy
          makroskładników są zaniżone.
        </p>
      )}
      {children}
    </section>
  );
}
