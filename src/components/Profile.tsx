import { useState } from 'react';
import { EX, GEAR_LABEL, ex, gearOf } from '../data/exercises';
import { EX_JOKES } from '../data/exjokes';
import { doneExercises, exerciseRows, trend, weeksBetween } from '../engine/history';
import type { ExerciseRow, ExerciseSummary, Trend } from '../engine/history';
import { sessionTonnage } from '../engine/math';
import { metrics } from '../engine/metrics';
import { P, planLabel } from '../engine/plan';
import { exercisePath, go, statsPath } from '../routing';
import { Chip, EmptyState, Sparkline, Trendline } from './ui';
import { LoadGauge } from './views';
import { SupportLine } from './Support';
import type { AppState, ExerciseId } from '../types';

/**
 * Profil: historia bez konta.
 *
 * Aplikacja nie zna maila, nazwiska ani hasła i nie ma zamiaru poznać — wszystko siedzi
 * w tej przeglądarce. „Profil” znaczy tu więc coś innego niż zwykle: nie tożsamość,
 * tylko jedno miejsce, z którego widać przeszłość. Co się robiło, jak często, z jakim
 * skutkiem — i osobna podstrona dla każdego ruchu, który kiedykolwiek wszedł do dziennika.
 */

const num = (n: number): string => Math.round(n).toLocaleString('pl-PL');

const tons = (kg: number): string =>
  kg >= 1000
    ? `${(kg / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} t`
    : `${num(kg)} kg`;

const dmy = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const dm = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const daysAgo = (iso: string): number =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

const agoLabel = (iso: string): string => {
  const d = daysAgo(iso);
  return d <= 0 ? 'dzisiaj' : d === 1 ? 'wczoraj' : `${d} dni temu`;
};

const unitOf = (id: ExerciseId): string => (ex(id).unit === 'secs' ? 's' : 'powt.');

/* ---------------- Zakładka profilu ---------------- */

export function ProfileView({ state }: { state: AppState }) {
  const m = metrics(state);
  const done = doneExercises(state);
  const [allHistory, setAllHistory] = useState(false);
  const [allExercises, setAllExercises] = useState(false);

  const first = state.log.length ? [...state.log].sort((a, b) => a.date.localeCompare(b.date))[0]! : null;
  const weeks = first ? weeksBetween(first.date, new Date().toISOString()) : 0;

  const tiles: [string, string][] = [
    [num(m.workouts), m.workouts === 1 ? 'trening' : 'treningów'],
    [num(m.reps), 'powtórzeń'],
    [tons(m.tonnage), 'tonaż'],
    [weeks ? `${weeks} tyg.` : '—', 'staż'],
  ];

  const shownExercises = allExercises ? done : done.slice(0, 12);
  const history = [...state.log].sort((a, b) => b.date.localeCompare(a.date));
  const shownHistory = allHistory ? history : history.slice(0, 20);

  return (
    <>
      <div className="wrap">
        <h2>Profil</h2>
        <p className="lead">
          Wszystko, co zrobiłeś, policzone w jednym miejscu. Bez konta, bez maila i bez
          wysyłania czegokolwiek na zewnątrz — te liczby nie opuszczają tej przeglądarki.
        </p>
        <div className="tiles">
          {tiles.map(([v, l]) => (
            <div className="tile" key={l}>
              <b>{v}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
        {first && (
          <p className="tight" style={{ marginTop: 10 }}>
            Pierwszy zapisany trening: {dmy(first.date)}. Ostatni: {agoLabel(history[0]!.date)}.
            Różnych ruchów w historii: {done.length}.
          </p>
        )}
      </div>

      <LoadGauge state={state} />

      <div className="sect-label">Twoje ćwiczenia</div>
      {!done.length ? (
        <EmptyState
          title="Jeszcze nic tu nie ma"
          text="Ta lista bierze się z historii, więc pierwszy zamknięty trening ją zakłada — pojawią się na niej ćwiczenia zrobione, nie zaplanowane."
        />
      ) : (
        <>
          <p className="ach-note">
            Lista bierze się z historii, więc rośnie sama. Kliknij dowolne ćwiczenie, żeby
            zobaczyć, co się z nim działo w czasie.
          </p>
          {shownExercises.map((s) => (
            <ExerciseRowLink key={s.id} state={state} sum={s} />
          ))}
          {done.length > shownExercises.length && (
            <div className="wrap">
              <button
                className="btn ghost sm"
                style={{ marginTop: 10 }}
                onClick={() => setAllExercises(true)}
              >
                Pokaż wszystkie ({done.length})
              </button>
            </div>
          )}
        </>
      )}

      <div className="sect-label">Historia treningów</div>
      {!history.length ? (
        <EmptyState
          title="Historia pusta"
          text="Pierwszy zamknięty trening zajmie tu miejsce na zawsze."
          cast={{ who: 'gosia', mood: 'longing' }}
        />
      ) : (
        <>
          {shownHistory.map((e, idx) => (
            <div className="h-item" key={`${e.date}-${idx}`}>
              <div className="h-date">{dm(e.date)}</div>
              <div>
                <div>
                  <b>{e.workout}</b>
                </div>
                <div className="h-detail">
                  {e.items
                    .map((i) => `${EX[i.id]?.name ?? i.id} ${i.sets.map((s) => s.reps).join('/')}`)
                    .join(' · ')}
                </div>
              </div>
              <div className="streak">{num(sessionTonnage(e))} kg·p</div>
            </div>
          ))}
          {history.length > shownHistory.length && (
            <div className="wrap">
              <button
                className="btn ghost sm"
                style={{ marginTop: 10 }}
                onClick={() => setAllHistory(true)}
              >
                Pokaż całą historię ({history.length})
              </button>
            </div>
          )}
        </>
      )}

      <div className="wrap">
        <SupportLine seed={m.workouts + 1} />
      </div>
    </>
  );
}

/** Wiersz listy ćwiczeń: ile razy, kiedy ostatnio i dokąd to zmierza. */
function ExerciseRowLink({ state, sum }: { state: AppState; sum: ExerciseSummary }) {
  const t = trend(exerciseRows(state, sum.id), sum.id);
  const p = P(state, sum.id);

  return (
    <button className="atlas-row" onClick={() => go(statsPath(sum.id))}>
      <Chip state={state} id={sum.id} />
      <div>
        <div className="ex-name">{ex(sum.id).name}</div>
        <div className="ex-target">
          {sum.sessions} {sum.sessions === 1 ? 'sesja' : sum.sessions < 5 ? 'sesje' : 'sesji'}
          {' · '}
          {agoLabel(sum.last)}
          {t && ` · ${t.dir === 'up' ? '▲' : t.dir === 'down' ? '▼' : '='} ${Math.abs(t.pct)}%`}
        </div>
      </div>
      <div className="streak">
        {p.e1rm ? `1RM ≈ ${p.e1rm} kg` : `rekord ${sum.bestSet} ${unitOf(sum.id)}`}
        <Sparkline hist={p.hist} />
      </div>
    </button>
  );
}

/* ---------------- Historia jednego ćwiczenia ---------------- */

const VERDICT: Record<Trend['dir'], (t: Trend, unit: string) => string> = {
  up: (t) => `W górę o ${t.pct}% — z ${t.from} na ${t.to}. Tak wygląda progresja na liczbach.`,
  down: (t) =>
    `W dół o ${Math.abs(t.pct)}% — z ${t.from} na ${t.to}. Spadek po przerwie albo po zmianie ciężaru jest normalny; wykres nie ocenia, tylko liczy.`,
  flat: (t) =>
    `Bez zmian — ${t.from} wtedy, ${t.to} teraz. Utrzymanie poziomu też jest wynikiem, zwłaszcza dłużej niż miesiąc.`,
};

const METRIC_LABEL: Record<Trend['metric'], string> = {
  e1rm: 'szacowane maksimum',
  reps: 'powtórzenia w sesji',
  secs: 'sekundy w sesji',
};

export function ExerciseStatsPage({ state, id }: { state: AppState; id: ExerciseId }) {
  const m = EX[id];
  const rows = exerciseRows(state, id);

  if (!m) {
    return (
      <div className="wrap">
        <button className="back" onClick={() => go('#/profil')}>
          ← Profil
        </button>
        <EmptyState
          title="Nie ma takiego ćwiczenia"
          text={`Identyfikator „${id}” do niczego nie pasuje.`}
          cast={{ who: 'siwy', mood: 'wise' }}
        />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <>
        <div className="wrap">
          <button className="back" onClick={() => go('#/profil')}>
            ← Profil
          </button>
        </div>
        <div className="wrap">
          <EmptyState
            title={`${m.name} — jeszcze bez historii`}
            text="Historia zaczyna się przy pierwszym zamkniętym treningu z tym ruchem."
          />
          <div className="actions">
            <button className="btn ghost wide" onClick={() => go(exercisePath(id))}>
              Zobacz technikę w atlasie
            </button>
          </div>
        </div>
      </>
    );
  }

  const p = P(state, id);
  const t = trend(rows, id);
  const unit = unitOf(id);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const tonnage = rows.reduce((a, r) => a + r.tonnage, 0);
  const bestSet = Math.max(...rows.flatMap((r) => r.reps));
  const weights = rows.map((r) => r.w).filter((w): w is number => w !== null);
  const e1rms = rows.map((r) => r.e1rm).filter((v): v is number => v !== null);
  const span = weeksBetween(rows[0]!.date, rows[rows.length - 1]!.date);
  const chart = e1rms.length >= 3 ? e1rms : rows.map((r) => r.total);
  const chartLabel = e1rms.length >= 3 ? 'szacowane maksimum (kg)' : `wynik sesji (${unit})`;

  return (
    <>
      <div className="wrap">
        <button className="back" onClick={() => go('#/profil')}>
          ← Profil
        </button>
      </div>

      <div className="wrap">
        <div className="ex-hero">
          <Chip state={state} id={id} />
          <div>
            <div className="ex-group">
              {m.group} · {GEAR_LABEL[gearOf(id)]}
            </div>
            <h2 className="ex-h">{m.name}</h2>
            <div className="ex-target">{planLabel(state, id)}</div>
          </div>
        </div>
      </div>

      <div className="grp">
        <h3>Jak to szło</h3>
        {t ? (
          <>
            <p className={`trend ${t.dir}`}>{VERDICT[t.dir](t, unit)}</p>
            <p className="tight">
              Liczone na wielkości „{METRIC_LABEL[t.metric]}”: średnia z pierwszych {t.span}{' '}
              {t.span === 1 ? 'sesji' : 'sesji'} kontra średnia z ostatnich {t.span}. Pojedyncze
              treningi skaczą za bardzo, żeby cokolwiek z nich wyczytać.
            </p>
          </>
        ) : (
          <p className="tight">
            Za mało danych na kierunek — kierunek pokazuje się od czwartej sesji. Na razie
            masz {rows.length} {rows.length === 1 ? 'sesję' : rows.length < 5 ? 'sesje' : 'sesji'}.
          </p>
        )}
        <Trendline values={chart} label={chartLabel} />
        {EX_JOKES[id] && <p className="exjoke">{EX_JOKES[id]}</p>}
      </div>

      <div className="wrap">
        <div className="tiles">
          <div className="tile">
            <b>{rows.length}</b>
            <span>sesji</span>
          </div>
          <div className="tile">
            <b>{num(total)}</b>
            <span>{unit === 's' ? 'sekund' : 'powtórzeń'}</span>
          </div>
          <div className="tile">
            <b>{weights.length ? `${Math.max(...weights)} kg` : `${bestSet} ${unit}`}</b>
            <span>{weights.length ? 'najcięższy' : 'rekord serii'}</span>
          </div>
          <div className="tile">
            <b>{tonnage ? tons(tonnage) : `${span} tyg.`}</b>
            <span>{tonnage ? 'tonaż' : 'w historii'}</span>
          </div>
        </div>
        <p className="tight" style={{ marginTop: 10 }}>
          Pierwszy raz {dmy(rows[0]!.date)}, ostatni {agoLabel(rows[rows.length - 1]!.date)}.
          {p.e1rm ? ` Aktualne szacowane maksimum: ${p.e1rm} kg.` : ''}
        </p>
      </div>

      <div className="sect-label">Sesja po sesji</div>
      {[...rows].reverse().map((r, i) => (
        <SessionRow key={`${r.date}-${i}`} row={r} unit={unit} />
      ))}

      <div className="wrap">
        <div className="actions">
          <button className="btn ghost wide" onClick={() => go(exercisePath(id))}>
            Technika, tor ruchu i wideo
          </button>
        </div>
      </div>
    </>
  );
}

const EFFORT_MARK: Record<string, string> = {
  easy: 'łatwo',
  solid: 'solidnie',
  max: 'na maksa',
};

function SessionRow({ row, unit }: { row: ExerciseRow; unit: string }) {
  return (
    <div className="h-item">
      <div className="h-date">{dm(row.date)}</div>
      <div>
        <div>
          <b>
            {row.reps.join(' / ')} {unit}
          </b>
          {row.w !== null && ` · ${row.w} kg`}
        </div>
        <div className="h-detail">
          {EFFORT_MARK[row.effort] ?? row.effort}
          {row.e1rm !== null && ` · 1RM ≈ ${row.e1rm} kg`}
        </div>
      </div>
      <div className="streak">
        {row.total} {unit}
      </div>
    </div>
  );
}
