import { pluralEn, text } from '../../../i18n';
import { addDays, daysBetween, shortDay } from '../../diet/model';
import type { WeighIn } from '../../diet/trend';
import { formatNumber, plural } from '../../lib/format';

const T = text({
  pl: {
    label: (n: number, projection: boolean, target: string) =>
      `Wykres wagi: ${n} ${plural(n, 'pomiar', 'pomiary', 'pomiarów')}, trend${projection ? ', prognoza' : ''} i waga docelowa ${target} kg.`,
    measured: 'pomiary',
    trend: 'trend',
    projection: 'prognoza',
    target: 'waga docelowa',
  },
  en: {
    label: (n: number, projection: boolean, target: string) =>
      `Weight chart: ${n} ${pluralEn(n, 'weigh-in', 'weigh-ins')}, the trend${projection ? ', a forecast' : ''} and the target weight ${target} kg.`,
    measured: 'weigh-ins',
    trend: 'trend',
    projection: 'forecast',
    target: 'target weight',
  },
});

interface Props {
  /** The first day on the chart. */
  start: string;
  today: string;
  /** Raw weigh-ins on the chart, oldest first: faint dots. */
  measured: readonly WeighIn[];
  /** The display trend (`trendSeries`) on the chart, oldest first: the line. */
  trend: readonly WeighIn[];
  /** A dashed straight line from today's trend at the pace of the reach sentence; empty without one. */
  projection: readonly WeighIn[];
  target: number;
}

// Rysunek w skali telefonu (kolumna ~360 px): napisy osi w 12 jednostkach zostają czytelne także na
// 320 px. Przy 640 px rośnie razem z kolumną.
const W = 360;
const H = 220;
const PAD = { left: 30, right: 8, top: 10, bottom: 24 };
/** Room after the last weigh-in when there is no forecast: today is not glued to the edge. */
const AFTER_DAYS = 7;

/**
 * Waga w czasie: pomiary jako blade kropki, trend wagi (średnia krocząca, która nie skacze z wodą)
 * jako linia, prognoza od dzisiejszego trendu przerywaną kreską i waga docelowa. Zwykłe SVG bez
 * biblioteki; każda linia ma też własny wzór kreski — kolor nie jest jedynym znakiem.
 */
export function WeightChart({ start, today, measured, trend, projection, target }: Props) {
  if (!measured.length && !trend.length) return null;
  const last = [today, ...trend.map((p) => p.day), ...projection.map((p) => p.day)].sort().at(-1)!;
  const end = projection.length ? last : addDays(last, AFTER_DAYS);
  const span = Math.max(1, daysBetween(start, end));
  const values = [target, ...measured.map((m) => m.kg), ...trend.map((p) => p.kg), ...projection.map((p) => p.kg)];
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const x = (day: string) => PAD.left + (daysBetween(start, day) / span) * (W - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + ((hi - kg) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const path = (pts: readonly WeighIn[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');

  const step = hi - lo > 20 ? 5 : hi - lo > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let kg = Math.ceil(lo / step) * step; kg <= hi; kg += step) ticks.push(kg);
  const forecast = projection.length > 1;

  return (
    <figure className="fd-diet-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T.label(measured.length, forecast, formatNumber(target, 1))}>
        {ticks.map((kg) => (
          <g key={kg}>
            <line className="fd-diet-grid" x1={PAD.left} x2={W - PAD.right} y1={y(kg)} y2={y(kg)} />
            <text className="tick" x={PAD.left - 5} y={y(kg) + 4} textAnchor="end">
              {kg}
            </text>
          </g>
        ))}
        <line className="fd-diet-goal" x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} />
        {today >= start && today <= end && <line className="now" x1={x(today)} x2={x(today)} y1={PAD.top} y2={H - PAD.bottom} />}
        {measured.map((m) => (
          <circle key={m.day} className="fd-diet-raw" cx={x(m.day)} cy={y(m.kg)} r={2.4}>
            <title>
              {shortDay(m.day)}: {formatNumber(m.kg, 1)} kg
            </title>
          </circle>
        ))}
        {trend.length > 1 && <path className="fd-diet-trend" d={path(trend)} />}
        {forecast && <path className="fd-diet-proj" d={path(projection)} />}
        <text className="tick" x={PAD.left} y={H - 6}>
          {shortDay(start)}
        </text>
        <text className="tick" x={W - PAD.right} y={H - 6} textAnchor="end">
          {shortDay(end)}
        </text>
      </svg>
      <figcaption className="fd-diet-legend">
        <span>
          <i className="fd-diet-raw" aria-hidden /> {T.measured}
        </span>
        <span>
          <i className="fd-diet-trend" aria-hidden /> {T.trend}
        </span>
        {forecast && (
          <span>
            <i className="fd-diet-proj" aria-hidden /> {T.projection}
          </span>
        )}
        <span>
          <i className="fd-diet-goal" aria-hidden /> {T.target}
        </span>
      </figcaption>
    </figure>
  );
}
