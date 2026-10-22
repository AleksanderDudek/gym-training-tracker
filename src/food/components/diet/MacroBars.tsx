import type { ReactNode } from 'react';
import { text } from '../../../i18n';
import type { Adjustment, DayStatus, DayTotals, Status } from '../../diet/day';
import type { MacroTargets } from '../../diet/profiles';
import { formatNumber } from '../../lib/format';
import { DT } from './dietText';

const T = text({
  pl: {
    of: (value: string, target: string) => `${value} z ${target}`,
    balance: 'Bilans dnia',
    kcal: 'Kalorie',
    goalMoved: (up: boolean, kcal: string) => `Cel na dziś ${up ? 'podniesiony' : 'obniżony'} o ${kcal} kcal.`,
    plan: (kcal: string) => `Plan na dziś: ${kcal} kcal.`,
    unknown: (n: number) =>
      `${n} ${n === 1 ? 'wpis ma' : 'wpisy mają'} tylko kalorie – sumy makroskładników są zaniżone.`,
  },
  en: {
    of: (value: string, target: string) => `${value} of ${target}`,
    balance: 'Day balance',
    kcal: 'Calories',
    goalMoved: (up: boolean, kcal: string) => `Today’s goal ${up ? 'raised' : 'lowered'} by ${kcal} kcal.`,
    plan: (kcal: string) => `Plan for today: ${kcal} kcal.`,
    unknown: (n: number) =>
      `${n} ${n === 1 ? 'entry has' : 'entries have'} calories only – the macro totals are understated.`,
  },
});

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
      aria-valuetext={T.of(formatNumber(value, 0), formatNumber(target, 0))}
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
  /** Zdanie o ruchu wobec planu (`activityLine`): co zmienił w celu i co może jeszcze ubyć. */
  activity?: string | null;
  plannedKcal: number | null;
  /** Główna akcja dnia pod liczbami — „Dodaj zjedzone”. */
  children?: ReactNode;
}

/** Dzień wobec celu dnia: najpierw kalorie, potem trzy makroskładniki i co znaczy każdy stan. */
export function MacroBars({ targets, eaten, status, adjustment, activity, plannedKcal, children }: Props) {
  const rows = [
    { key: 'protein' as const, label: DT.protein, value: eaten.protein, target: targets.protein.target },
    {
      key: 'carbs' as const,
      label: DT.carbs,
      value: eaten.carbs,
      target: targets.carbs.max ?? targets.carbs.target,
    },
    { key: 'fat' as const, label: DT.fat, value: eaten.fat, target: targets.fat.target },
  ];
  return (
    <section className="grp fd-diet-balance" aria-label={T.balance}>
      <div className="fd-diet-balance-top">
        <p className="fd-diet-kcal">
          {formatNumber(eaten.kcal, 0)} <small>/ {formatNumber(targets.kcal, 0)} kcal</small>
        </p>
        <p className={`fd-diet-note fd-diet-${status.kcal.status}`}>{status.kcal.note}</p>
      </div>
      <Bar value={eaten.kcal} target={targets.kcal} status={status.kcal.status} label={T.kcal} />
      {adjustment && adjustment.delta !== 0 && (
        <p className="tight">
          {T.goalMoved(adjustment.delta > 0, formatNumber(Math.abs(adjustment.delta), 0))} {adjustment.explanation}
        </p>
      )}
      {activity && <p className="tight">{activity}</p>}
      {plannedKcal !== null && <p className="tight">{T.plan(formatNumber(plannedKcal, 0))}</p>}
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
        <p className="tight">{T.unknown(eaten.unknownMacros)}</p>
      )}
      {children}
    </section>
  );
}
