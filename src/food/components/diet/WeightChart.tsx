import { daysBetween, shortDay } from '../../diet/model';
import { formatNumber } from '../../lib/format';

export interface ChartPoint {
  date: string;
  plan: number;
  /** Dokąd zmierza waga od ostatniego ważenia (`null` przed nim). */
  projection: number | null;
}

interface Props {
  start: string;
  today: string;
  points: ChartPoint[];
  measured: { date: string; kg: number }[];
  target: number;
}

// Rysunek w skali telefonu (kolumna ~360 px): napisy osi w 12 jednostkach zostają czytelne także na
// 320 px. Przy 640 px rośnie razem z kolumną, jak wykres trendu w profilu.
const W = 360;
const H = 220;
const PAD = { left: 30, right: 8, top: 10, bottom: 24 };

/**
 * Waga w czasie: plan, pomiary, prognoza od ostatniego ważenia i cel. Zwykłe SVG bez biblioteki,
 * w kolorach aplikacji: pomiary jak linia wagi w profilu (zieleń), plan stalowy, prognoza
 * niebieska, cel złoty. Każda linia ma też własny wzór kreski — kolor nie jest jedynym znakiem.
 */
export function WeightChart({ start, today, points, measured, target }: Props) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  const end = last.date;
  const span = Math.max(1, daysBetween(start, end));
  const values = [
    target,
    ...points.map((p) => p.plan),
    ...points.flatMap((p) => (p.projection === null ? [] : [p.projection])),
    ...measured.map((m) => m.kg),
  ];
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const x = (date: string) => PAD.left + (daysBetween(start, date) / span) * (W - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + ((hi - kg) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const path = (pts: { date: string; kg: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');

  const step = hi - lo > 20 ? 5 : hi - lo > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let kg = Math.ceil(lo / step) * step; kg <= hi; kg += step) ticks.push(kg);
  const visibleMeasured = measured.filter((m) => m.date >= start && m.date <= end);
  const projection = points.flatMap((p) => (p.projection === null ? [] : [{ date: p.date, kg: p.projection }]));
  const lastMeasured = visibleMeasured[visibleMeasured.length - 1];

  return (
    <figure className="fd-diet-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Wykres wagi od ${shortDay(start)} do ${shortDay(end)}: plan, ${visibleMeasured.length} pomiarów${
          lastMeasured ? ` (ostatni ${formatNumber(lastMeasured.kg, 1)} kg)` : ''
        }, prognoza i cel ${formatNumber(target, 1)} kg.`}
      >
        {ticks.map((kg) => (
          <g key={kg}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(kg)} y2={y(kg)} />
            <text className="tick" x={PAD.left - 5} y={y(kg) + 4} textAnchor="end">
              {kg}
            </text>
          </g>
        ))}
        <line className="goal" x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} />
        {today >= start && today <= end && (
          <line className="now" x1={x(today)} x2={x(today)} y1={PAD.top} y2={H - PAD.bottom} />
        )}
        <path className="plan" d={path(points.map((p) => ({ date: p.date, kg: p.plan })))} />
        {projection.length > 1 && <path className="proj" d={path(projection)} />}
        {visibleMeasured.length > 1 && <path className="real" d={path(visibleMeasured)} />}
        {visibleMeasured.map((m) => (
          <circle key={m.date} className="dot" cx={x(m.date)} cy={y(m.kg)} r={2.6}>
            <title>
              {shortDay(m.date)}: {formatNumber(m.kg, 1)} kg
            </title>
          </circle>
        ))}
        <text className="tick" x={PAD.left} y={H - 6}>
          {shortDay(start)}
        </text>
        <text className="tick" x={W - PAD.right} y={H - 6} textAnchor="end">
          {shortDay(end)}
        </text>
      </svg>
      <figcaption className="fd-diet-legend">
        <span>
          <i className="real" aria-hidden /> pomiary
        </span>
        <span>
          <i className="plan" aria-hidden /> plan
        </span>
        <span>
          <i className="proj" aria-hidden /> prognoza od ostatniego ważenia
        </span>
        <span>
          <i className="goal" aria-hidden /> cel {formatNumber(target, 1)} kg
        </span>
      </figcaption>
    </figure>
  );
}
