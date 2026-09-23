import { useState } from 'react';
import {
  GROUPS,
  GROUP_LABEL,
  GROUP_NOTE,
  achCtx,
  achievementProgress,
  formatTier,
  formatValue,
} from '../engine/badges';
import type { AchProgress } from '../engine/badges';
import type { Metrics } from '../engine/metrics';
import { snapshot } from '../engine/snapshot';
import { dayKey } from '../engine/schedule';
import type { AppState } from '../types';

const shortDate = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return `${dd}.${mm}`;
};

const num = (n: number): string => Math.round(n).toLocaleString('pl-PL');

/** Ile progów zdobytych w całej aplikacji — jedna liczba na nagłówek. */
export function achievementCount(state: AppState): { have: number; total: number } {
  const snap = snapshot(state);
  const rows = achievementProgress(
    achCtx(state, snap?.schedule ?? null, snap?.stats ?? null, snap?.today ?? dayKey(Date.now())),
  );
  return {
    have: rows.reduce((n, r) => n + r.tier, 0),
    total: rows.reduce((n, r) => n + r.ach.tiers.length, 0),
  };
}

/**
 * Jedna rodzina odznak: kropki za zdobyte progi, wartość teraz i ile brakuje do następnego.
 * Pasek postępu jest tu ważniejszy od samej odznaki — pokazuje, że następny próg istnieje
 * i jest w zasięgu, zamiast stawiać ścianę „zablokowane”.
 */
function Row({ r }: { r: AchProgress }) {
  const done = r.next === null;
  // Odznaka zerojedynkowa nie ma czego odmierzać — jedna kropka i pasek postępu tylko myliłyby.
  const single = r.ach.tiers.length === 1;

  const meta = single
    ? done
      ? `zdobyta${r.at ? ` ${shortDate(r.at)}` : ''}`
      : 'jeszcze nie'
    : `${done ? `komplet · ${formatTier(r.ach, r.value)}` : `${formatValue(r.ach, r.value)} z ${formatTier(r.ach, r.next!)}`}${
        r.at ? ` · ostatni próg ${shortDate(r.at)}` : ''
      }`;

  return (
    <div className={`ach${r.tier ? ' on' : ''}${done ? ' full' : ''}`}>
      <span className="ach-mark">{r.ach.mark}</span>
      <div className="ach-body">
        <div className="ach-head">
          <b>{r.ach.name}</b>
          {!single && (
            <span className="ach-pips">
              {r.ach.tiers.map((t, i) => (
                <i key={t} className={i < r.tier ? 'on' : ''} />
              ))}
            </span>
          )}
        </div>
        {!single && (
          <div className="ach-bar">
            <i style={{ width: `${Math.max(2, Math.round(r.progress * 100))}%` }} />
          </div>
        )}
        <div className="ach-meta">{meta}</div>
        <div className="ach-desc">{r.ach.desc}</div>
      </div>
    </div>
  );
}

/**
 * Sumy z całej historii jednym rzutem oka — to samo, z czego liczą się odznaki z grupy
 * „Dorobek”. Nagłówek celowo inny niż nazwa grupy, żeby dwie rzeczy nie nazywały się tak samo.
 */
function Totals({ m }: { m: Metrics }) {
  const tiles: [string, string][] = [
    [num(m.workouts), 'treningów'],
    [num(m.reps), 'powtórzeń'],
    [num(m.sets), 'serii'],
    [m.tonnage >= 1000 ? `${Math.round(m.tonnage / 100) / 10} t` : `${num(m.tonnage)} kg`, 'tonaż'],
  ];

  return (
    <div className="grp">
      <h3>W liczbach</h3>
      <div className="tiles">
        {tiles.map(([v, l]) => (
          <div className="tile" key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <p className="tight" style={{ marginTop: 10 }}>
        Wykonane ćwiczenia: {num(m.exercises)} · różne ruchy: {m.distinct} · czas pod obciążeniem:{' '}
        {m.secs >= 120 ? `${Math.round(m.secs / 60)} min` : `${m.secs} s`}
      </p>
    </div>
  );
}

/**
 * Progi najbliższe zdobycia. Przy dwustu siedemdziesięciu progach sama lista przestaje
 * odpowiadać na pytanie „co mogę zrobić teraz” — ta sekcja odpowiada, biorąc pięć rodzin
 * z najdalej posuniętym paskiem spośród tych, które jeszcze czegoś potrzebują.
 */
function Closest({ rows }: { rows: AchProgress[] }) {
  const near = rows
    .filter((r) => r.next !== null && r.value > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  if (!near.length) return null;

  return (
    <div className="grp">
      <h3>Najbliżej zdobycia</h3>
      <p className="tight">Pięć progów, do których brakuje najmniej.</p>
      <div className="near">
        {near.map((r) => (
          <div className="near-row" key={r.ach.id}>
            <span className="near-name">{r.ach.name}</span>
            <span className="near-left">
              brakuje {formatValue(r.ach, Math.max(0, r.next! - r.value))}
            </span>
            <span className="near-bar">
              <i style={{ width: `${Math.max(3, Math.round(r.progress * 100))}%` }} />
            </span>
            <span className="near-meta">
              {formatValue(r.ach, r.value)} z {formatTier(r.ach, r.next!)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Achievements({ state }: { state: AppState }) {
  const snap = snapshot(state);
  // Metryki liczone raz i podane dalej — to samo wyliczenie karmi kafelki i wszystkie progi.
  const ctx = achCtx(state, snap?.schedule ?? null, snap?.stats ?? null, snap?.today ?? dayKey(Date.now()));
  const rows = achievementProgress(ctx);
  const have = rows.reduce((n, r) => n + r.tier, 0);
  const total = rows.reduce((n, r) => n + r.ach.tiers.length, 0);
  const [open, setOpen] = useState<string | null>('dorobek');

  return (
    <>
      <div className="wrap">
        <h2>Osiągnięcia</h2>
        <p className="lead">
          Każda rodzina odznak ma kilka progów, więc zdobyta odznaka nie kończy tematu, tylko
          pokazuje następny krok. Nic tu nie zależy od tego, jak ciężko trenujesz —
          liczy się to, ile i jak regularnie.
        </p>
      </div>

      <Totals m={ctx.metrics} />
      <Closest rows={rows} />

      <div className="sect-label">
        Odznaki {have}/{total}
      </div>

      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.ach.group === g);
        const got = list.reduce((n, r) => n + r.tier, 0);
        const all = list.reduce((n, r) => n + r.ach.tiers.length, 0);
        return (
          <div key={g}>
            <button
              className="wk-head"
              aria-expanded={open === g}
              onClick={() => setOpen(open === g ? null : g)}
            >
              <span>{GROUP_LABEL[g]}</span>
              <span className="wk-sum">
                {got}/{all}
              </span>
            </button>
            {open === g && (
              <div className="wk-body">
                <p className="ach-note">{GROUP_NOTE[g]}</p>
                {list.map((r) => (
                  <Row key={r.ach.id} r={r} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
