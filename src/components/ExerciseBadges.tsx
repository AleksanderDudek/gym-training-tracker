import { BadgeMedal, bandFor } from './BadgeArt';
import { formatTier, formatValue } from '../engine/badges';
import type { AchProgress } from '../engine/badges';
import { KIND_NOW, KIND_TITLE } from '../engine/exbadges';
import type { ExFamily } from '../engine/exbadges';

const shortDate = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return `${dd}.${mm}`;
};

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Jedna rodzina odznak ćwiczenia. Przy rekordzie okresu najważniejsza jest liczba z bieżącego
 * dnia, tygodnia albo miesiąca — to ją da się jeszcze dziś podnieść przekąską. Rekord stoi
 * obok, bo to on mówi, ile progów już jest.
 */
export function ExerciseBadgeRow({ r }: { r: AchProgress }) {
  const fam = r.ach as ExFamily;
  const done = r.next === null;
  const now = r.current;
  const meta =
    fam.kind === 'lacznie'
      ? done
        ? `komplet · ${formatTier(r.ach, r.value)}`
        : `${formatValue(r.ach, r.value)} z ${formatTier(r.ach, r.next!)}`
      : done
        ? `komplet · rekord ${formatTier(r.ach, r.value)}`
        : `${KIND_NOW[fam.kind]} ${formatValue(r.ach, now ?? 0)} z ${formatTier(r.ach, r.next!)}${
            r.value > 0 ? ` · rekord ${formatValue(r.ach, r.value)}` : ''
          }`;

  return (
    <div className={`ach${r.tier ? ' on' : ''}${done ? ' full' : ''}`}>
      <BadgeMedal
        art={r.ach.art}
        mark={r.ach.mark}
        band={bandFor(r.tier, r.ach.tiers.length)}
        title={`${r.ach.name} — ${r.tier} z ${r.ach.tiers.length}`}
      />
      <div className="ach-body">
        <div className="ach-head">
          <b>{cap(KIND_TITLE[fam.kind])}</b>
          <span className="ach-pips">
            {r.ach.tiers.map((t, i) => (
              <i key={t} className={i < r.tier ? 'on' : ''} />
            ))}
          </span>
        </div>
        <div className="ach-bar">
          <i style={{ width: `${Math.max(2, Math.round(r.progress * 100))}%` }} />
        </div>
        <div className="ach-meta">
          {meta}
          {r.at ? ` · ostatni próg ${shortDate(r.at)}` : ''}
        </div>
      </div>
    </div>
  );
}

/** Ile progów zdobytych z ilu — do nagłówka ćwiczenia. */
export const badgeTally = (rows: AchProgress[]): string =>
  `${rows.reduce((n, r) => n + r.tier, 0)}/${rows.reduce((n, r) => n + r.ach.tiers.length, 0)}`;
