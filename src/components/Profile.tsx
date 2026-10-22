import { useState } from 'react';
import type { ReactNode } from 'react';
import { BUILTIN, EX, GEAR_LABEL, ex, gearOf, groupLabel } from '../data/exercises';
import { EX_JOKES } from '../data/exjokes';
import { doneExercises, exerciseRows, trend, weeksBetween } from '../engine/history';
import type { ExerciseRow, ExerciseSummary, Trend } from '../engine/history';
import { sessionTonnage } from '../engine/math';
import { metrics } from '../engine/metrics';
import { P, planLabel } from '../engine/plan';
import { exercisePath, go, snackAddPath, snacksPath, statsPath } from '../routing';
import { Chip, EmptyState, Sparkline, Trendline } from './ui';
import { LoadGauge } from './views';
import { CharacterCard } from './Character';
import type { Avatar } from './Character';
import { ExerciseBadgeRow, badgeTally } from './ExerciseBadges';
import { SupportLine } from './Support';
import { achCtx, exerciseProgress } from '../engine/badges';
import { snackStats, snacksOf, snacksOn } from '../engine/snacks';
import { dayKey } from '../engine/schedule';
import { plural } from '../engine/quips';
import { rowBurn, workoutBurn } from '../engine/burn';
import { durationText, timed, transitions } from '../engine/clock';
import { formatClock } from './Timer';
import { BodyCard, CardioSummary, kcalText } from './Cardio';
import { PromoCard } from './Promo';
import { LOCALE, pluralEn, text } from '../i18n';
import type { AppState, ExerciseId, LogTime } from '../types';

/**
 * Profil: historia bez konta.
 *
 * Aplikacja nie zna maila, nazwiska ani hasła i nie ma zamiaru poznać — wszystko siedzi
 * w tej przeglądarce. „Profil” znaczy tu więc coś innego niż zwykle: nie tożsamość,
 * tylko jedno miejsce, z którego widać przeszłość. Co się robiło, jak często, z jakim
 * skutkiem — i osobna podstrona dla każdego ruchu, który kiedykolwiek wszedł do dziennika.
 */

const T = text({
  pl: {
    sep: '.',
    today: 'dzisiaj',
    yesterday: 'wczoraj',
    daysAgo: (d: number) => `${d} dni temu`,
    reps: 'powt.',
    snacksTitle: 'Przekąski ruchowe',
    snackLine: (count: number, today: number, run: number, distinct: number) =>
      `${count} ${plural(count, ['przekąska', 'przekąski', 'przekąsek'])} od początku, dziś ${today}. Najdłuższy ciąg: ${run} ${plural(run, ['dzień', 'dni', 'dni'])} z rzędu, różnych ćwiczeń: ${distinct}.`,
    noSnacks:
      'Jeszcze żadnej. Krótka seria poza treningiem nie zmienia planu ani poziomów — dokłada się do odznak ćwiczeń i do postaci.',
    snacksLink: 'Przekąski — dziś i historia',
    firstSnack: 'Zapisz pierwszą przekąskę',
    exBadges: 'Odznaki ćwiczenia',
    badgesNote: 'Rekord dnia, tygodnia i miesiąca oraz suma — z treningów i przekąsek razem.',
    snacksWith: (n: number) => ` Przekąsek z tym ruchem: ${n}.`,
    logSnack: 'Zapisz przekąskę z tym ćwiczeniem',
    workouts: (n: number): string => (n === 1 ? 'trening' : 'treningów'),
    repsTile: 'powtórzeń',
    tonnage: 'tonaż',
    weeks: (n: number) => `${n} tyg.`,
    tenure: 'staż',
    lead: (
      <>
        Wszystko, co zrobiłeś, policzone w jednym miejscu. Bez konta, bez maila i bez
        wysyłania czegokolwiek na zewnątrz — te liczby nie opuszczają tej przeglądarki.
      </>
    ) as ReactNode,
    firstLine: (date: string, ago: string, n: number) =>
      `Pierwszy zapisany trening: ${date}. Ostatni: ${ago}. Różnych ruchów w historii: ${n}.`,
    yourExercises: 'Twoje ćwiczenia',
    emptyTitle: 'Jeszcze nic tu nie ma',
    emptyText:
      'Ta lista bierze się z historii, więc pierwszy zamknięty trening ją zakłada — pojawią się na niej ćwiczenia zrobione, nie zaplanowane.',
    listNote: (
      <>
        Lista bierze się z historii, więc rośnie sama. Kliknij dowolne ćwiczenie, żeby
        zobaczyć, co się z nim działo w czasie.
      </>
    ) as ReactNode,
    showAll: (n: number) => `Pokaż wszystkie (${n})`,
    history: 'Historia treningów',
    historyEmpty: 'Historia pusta',
    historyEmptyText: 'Pierwszy zamknięty trening zajmie tu miejsce na zawsze.',
    outOfStats: 'poza statystykami',
    kgReps: 'kg·p',
    showHistory: (n: number) => `Pokaż całą historię (${n})`,
    sessions: (n: number): string => (n === 1 ? 'sesja' : n < 5 ? 'sesje' : 'sesji'),
    best: (n: number, unit: string) => `rekord ${n} ${unit}`,
    timeline: (n: number) => `Przebieg: ${n} ${plural(n, ['część', 'części', 'części'])}`,
    loggedAfter: (d: string) => `zapisane po ${d}`,
    gapBefore: 'przejście przed:',
    verdict: {
      up: (t: Trend) => `W górę o ${t.pct}% — z ${t.from} na ${t.to}. Tak wygląda progresja na liczbach.`,
      down: (t: Trend) =>
        `W dół o ${Math.abs(t.pct)}% — z ${t.from} na ${t.to}. Spadek po przerwie albo po zmianie ciężaru jest normalny; wykres nie ocenia, tylko liczy.`,
      flat: (t: Trend) =>
        `Bez zmian — ${t.from} wtedy, ${t.to} teraz. Utrzymanie poziomu też jest wynikiem, zwłaszcza dłużej niż miesiąc.`,
    } as Record<Trend['dir'], (t: Trend) => string>,
    metric: {
      e1rm: 'szacowane maksimum',
      reps: 'powtórzenia w sesji',
      secs: 'sekundy w sesji',
    } as Record<Trend['metric'], string>,
    noExercise: 'Nie ma takiego ćwiczenia',
    badId: (id: string) => `Identyfikator „${id}” do niczego nie pasuje.`,
    onlySnacks: 'Na razie tylko w przekąskach — wykres sesji ruszy z pierwszym treningiem.',
    noHistory: (name: string) => `${name} — jeszcze bez historii`,
    noHistoryText: 'Historia zaczyna się przy pierwszym zamkniętym treningu albo pierwszej przekąsce z tym ruchem.',
    atlas: 'Zobacz technikę w atlasie',
    chartMax: 'szacowane maksimum (kg)',
    chartResult: (unit: string) => `wynik sesji (${unit})`,
    howItWent: 'Jak to szło',
    basis: (metric: string, span: number) =>
      `Liczone na wielkości „${metric}”: średnia z pierwszych ${span} ${span === 1 ? 'sesji' : 'sesji'} kontra średnia z ostatnich ${span}. Pojedyncze treningi skaczą za bardzo, żeby cokolwiek z nich wyczytać.`,
    tooFew: (n: number) =>
      `Za mało danych na kierunek — kierunek pokazuje się od czwartej sesji. Na razie masz ${n} ${n === 1 ? 'sesję' : n < 5 ? 'sesje' : 'sesji'}.`,
    sessionsTile: 'sesji',
    secondsTile: 'sekund',
    heaviest: 'najcięższy',
    bestSet: 'rekord serii',
    inHistory: 'w historii',
    firstLast: (date: string, ago: string) => `Pierwszy raz ${date}, ostatni ${ago}.`,
    maxNow: (kg: number) => ` Aktualne szacowane maksimum: ${kg} kg.`,
    kcalAll: (kcal: string) => ` Łącznie ${kcal} ponad spoczynek, z serii i przerw.`,
    noKcal: ' Wpisz wagę w profilu, a przy każdej sesji pojawią się kalorie.',
    bySession: 'Sesja po sesji',
    technique: 'Technika, tor ruchu i wideo',
    effort: { easy: 'łatwo', solid: 'solidnie', max: 'na maksa' } as Record<string, string>,
  },
  en: {
    sep: '/',
    today: 'today',
    yesterday: 'yesterday',
    daysAgo: (d: number) => `${d} days ago`,
    reps: 'reps',
    snacksTitle: 'Exercise snacks',
    snackLine: (count: number, today: number, run: number, distinct: number) =>
      `${count} ${pluralEn(count, 'snack', 'snacks')} so far, ${today} today. Longest streak: ${run} ${pluralEn(run, 'day', 'days')} in a row; different exercises: ${distinct}.`,
    noSnacks:
      'None yet. A short set outside a workout doesn’t change your plan or levels — it counts towards exercise badges and your character.',
    snacksLink: 'Snacks — today and history',
    firstSnack: 'Log your first snack',
    exBadges: 'Exercise badges',
    badgesNote: 'Best day, week and month, plus the total — workouts and snacks together.',
    snacksWith: (n: number) => ` Snacks with this exercise: ${n}.`,
    logSnack: 'Log a snack with this exercise',
    workouts: (n: number) => pluralEn(n, 'workout', 'workouts'),
    repsTile: 'reps',
    tonnage: 'tonnage',
    weeks: (n: number) => `${n} wk`,
    tenure: 'training age',
    lead: (
      <>
        Everything you’ve done, counted in one place. No account, no email and nothing sent anywhere — these numbers
        never leave this browser.
      </>
    ),
    firstLine: (date: string, ago: string, n: number) =>
      `First logged workout: ${date}. Latest: ${ago}. Different exercises in your history: ${n}.`,
    yourExercises: 'Your exercises',
    emptyTitle: 'Nothing here yet',
    emptyText:
      'This list comes from your history, so your first finished workout starts it — it shows exercises you’ve done, not ones you’ve planned.',
    listNote: (
      <>
        The list comes from your history, so it grows by itself. Tap any exercise to see how it has gone over time.
      </>
    ),
    showAll: (n: number) => `Show all (${n})`,
    history: 'Workout history',
    historyEmpty: 'No history yet',
    historyEmptyText: 'Your first finished workout will take its place here for good.',
    outOfStats: 'not in stats',
    kgReps: 'kg·reps',
    showHistory: (n: number) => `Show full history (${n})`,
    sessions: (n: number) => pluralEn(n, 'session', 'sessions'),
    best: (n: number, unit: string) => `best ${n} ${unit}`,
    timeline: (n: number) => `Timeline: ${n} ${pluralEn(n, 'part', 'parts')}`,
    loggedAfter: (d: string) => `logged after ${d}`,
    gapBefore: 'transition before:',
    verdict: {
      up: (t: Trend) => `Up ${t.pct}% — from ${t.from} to ${t.to}. That’s what progression looks like in numbers.`,
      down: (t: Trend) =>
        `Down ${Math.abs(t.pct)}% — from ${t.from} to ${t.to}. A dip after a break or a weight change is normal; the chart doesn’t judge, it just counts.`,
      flat: (t: Trend) =>
        `No change — ${t.from} then, ${t.to} now. Holding your level is a result too, especially for more than a month.`,
    },
    metric: {
      e1rm: 'estimated max',
      reps: 'reps per session',
      secs: 'seconds per session',
    },
    noExercise: 'No such exercise',
    badId: (id: string) => `The ID “${id}” doesn’t match anything.`,
    onlySnacks: 'Only in snacks so far — the session chart starts with your first workout.',
    noHistory: (name: string) => `${name} — no history yet`,
    noHistoryText: 'History starts with your first finished workout or your first snack with this exercise.',
    atlas: 'See the technique in the atlas',
    chartMax: 'estimated max (kg)',
    chartResult: (unit: string) => `session result (${unit})`,
    howItWent: 'How it went',
    basis: (metric: string, span: number) =>
      `Measured on “${metric}”: the average of the first ${span} ${pluralEn(span, 'session', 'sessions')} against the average of the last ${span}. Single workouts jump around too much to read anything from them.`,
    tooFew: (n: number) =>
      `Not enough data for a trend — it shows from the fourth session. So far you have ${n} ${pluralEn(n, 'session', 'sessions')}.`,
    sessionsTile: 'sessions',
    secondsTile: 'seconds',
    heaviest: 'heaviest',
    bestSet: 'best set',
    inHistory: 'in history',
    firstLast: (date: string, ago: string) => `First time ${date}, latest ${ago}.`,
    maxNow: (kg: number) => ` Current estimated max: ${kg} kg.`,
    kcalAll: (kcal: string) => ` In total ${kcal} above resting, from sets and rests.`,
    noKcal: ' Enter your weight in your profile and every session will show its calories.',
    bySession: 'Session by session',
    technique: 'Technique, movement path and video',
    effort: { easy: 'easy', solid: 'solid', max: 'all out' },
  },
});

const num = (n: number): string => Math.round(n).toLocaleString(LOCALE);

const tons = (kg: number): string =>
  kg >= 1000
    ? `${(kg / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} t`
    : `${num(kg)} kg`;

const dmy = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}${T.sep}${String(d.getMonth() + 1).padStart(2, '0')}${T.sep}${d.getFullYear()}`;
};

const dm = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}${T.sep}${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const daysAgo = (iso: string): number =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

const agoLabel = (iso: string): string => {
  const d = daysAgo(iso);
  return d <= 0 ? T.today : d === 1 ? T.yesterday : T.daysAgo(d);
};

const unitOf = (id: ExerciseId): string => (ex(id).unit === 'secs' ? 's' : T.reps);

/* ---------------- Zakładka profilu ---------------- */

/**
 * Przekąski w profilu: jednym zdaniem ile, jak regularnie i czym — i wejście do pełnego
 * ekranu. Liczby treningów wyżej zostają treningowe, bo tak liczą się poziomy i plan.
 */
function SnackSummary({ state }: { state: AppState }) {
  const st = snackStats(snacksOf(state));
  const today = snacksOn(state, dayKey(Date.now())).length;
  return (
    <div className="grp">
      <h2>{T.snacksTitle}</h2>
      <p className="tight">
        {st.count ? T.snackLine(st.count, today, st.run, st.distinct) : T.noSnacks}
      </p>
      <div style={{ marginTop: 10 }}>
        <button className="btn ghost sm" onClick={() => go(snacksPath())}>
          {st.count ? T.snacksLink : T.firstSnack}
        </button>
      </div>
    </div>
  );
}

/** Cztery odznaki ćwiczenia z nagłówkiem i przyciskiem przekąski — na podstronie ruchu. */
function ExerciseBadgesBlock({ state, id }: { state: AppState; id: ExerciseId }) {
  const rows = exerciseProgress(achCtx(state, null, null, dayKey(Date.now())), id);
  const snacks = snacksOf(state).filter((s) => s.ex === id).length;
  return (
    <>
      <div className="sect-label">
        {T.exBadges} {badgeTally(rows)}
      </div>
      <p className="ach-note">
        {T.badgesNote}
        {snacks ? T.snacksWith(snacks) : ''}
      </p>
      <div className="wk-body">
        {rows.map((r) => (
          <ExerciseBadgeRow key={r.ach.id} r={r} />
        ))}
      </div>
      <div className="wrap">
        <div className="actions">
          <button className="btn ghost wide" onClick={() => go(snackAddPath(id))}>
            {T.logSnack}
          </button>
        </div>
      </div>
    </>
  );
}

export function ProfileView({
  state,
  onAvatar,
  onWeight,
  onHeight,
  onDeleteWeight,
  onToast,
}: {
  state: AppState;
  onAvatar: (a: Avatar) => void;
  onWeight: (kg: number, day?: string) => void;
  onHeight: (cm: number | null) => void;
  onDeleteWeight: (day: string) => void;
  onToast: (m: string) => void;
}) {
  const m = metrics(state);
  const done = doneExercises(state);
  const [allHistory, setAllHistory] = useState(false);
  const [allExercises, setAllExercises] = useState(false);

  const first = state.log.length ? [...state.log].sort((a, b) => a.date.localeCompare(b.date))[0]! : null;
  const weeks = first ? weeksBetween(first.date, new Date().toISOString()) : 0;

  const tiles: [string, string][] = [
    [num(m.workouts), T.workouts(m.workouts)],
    [num(m.reps), T.repsTile],
    [tons(m.tonnage), T.tonnage],
    [weeks ? T.weeks(weeks) : '—', T.tenure],
  ];

  const shownExercises = allExercises ? done : done.slice(0, 12);
  const history = [...state.log].sort((a, b) => b.date.localeCompare(a.date));
  const shownHistory = allHistory ? history : history.slice(0, 20);

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead}</p>
      </div>

      <CharacterCard state={state} onAvatar={onAvatar} />

      <div className="wrap">
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
            {T.firstLine(dmy(first.date), agoLabel(history[0]!.date), done.length)}
          </p>
        )}
      </div>

      <BodyCard
        state={state}
        onWeight={onWeight}
        onHeight={onHeight}
        onDeleteWeight={onDeleteWeight}
        onToast={onToast}
      />
      <LoadGauge state={state} />
      <SnackSummary state={state} />
      <CardioSummary state={state} />
      <PromoCard />

      <div className="sect-label">{T.yourExercises}</div>
      {!done.length ? (
        <EmptyState title={T.emptyTitle} text={T.emptyText} />
      ) : (
        <>
          <p className="ach-note">{T.listNote}</p>
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
                {T.showAll(done.length)}
              </button>
            </div>
          )}
        </>
      )}

      <div className="sect-label">{T.history}</div>
      {!history.length ? (
        <EmptyState
          title={T.historyEmpty}
          text={T.historyEmptyText}
          cast={{ who: 'gosia', mood: 'longing' }}
        />
      ) : (
        <>
          {shownHistory.map((e, idx) => {
            const burn = workoutBurn(state, e);
            return (
              <div className="h-item" key={`${e.date}-${idx}`}>
                <div className="h-date">{dm(e.date)}</div>
                <div>
                  <div>
                    {/* Gotowy trening — nazwą z biblioteki w języku wizyty; własny — tak, jak go nazwano. */}
                    <b>{BUILTIN.find((w) => w.id === e.wid)?.name ?? e.workout}</b>
                    {/* Czas stoi zawsze, gdy był zegar; spoza 3 min – 4 h tylko nie wchodzi do statystyk i odznak. */}
                    {e.time && (
                      <span className="h-time">
                        {' '}
                        · {durationText(e.time.secs)}
                        {!timed(e.time) && <span className="h-out"> ({T.outOfStats})</span>}
                      </span>
                    )}
                  </div>
                  <div className="h-detail">
                    {e.items
                      .map((i) => `${EX[i.id]?.name ?? i.id} ${i.sets.map((s) => s.reps).join('/')}`)
                      .join(' · ')}
                  </div>
                  {e.time && e.time.parts.length > 0 && <TimeLine time={e.time} />}
                </div>
                <div className="streak">
                  {num(sessionTonnage(e))} {T.kgReps}
                  {burn && <span className="kcal-line">{kcalText(burn.active)}</span>}
                </div>
              </div>
            );
          })}
          {history.length > shownHistory.length && (
            <div className="wrap">
              <button
                className="btn ghost sm"
                style={{ marginTop: 10 }}
                onClick={() => setAllHistory(true)}
              >
                {T.showHistory(history.length)}
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
          {sum.sessions} {T.sessions(sum.sessions)}
          {' · '}
          {agoLabel(sum.last)}
          {t && ` · ${t.dir === 'up' ? '▲' : t.dir === 'down' ? '▼' : '='} ${Math.abs(t.pct)}%`}
        </div>
      </div>
      <div className="streak">
        {p.e1rm ? `1RM ≈ ${p.e1rm} kg` : T.best(sum.bestSet, unitOf(sum.id))}
        <Sparkline hist={p.hist} />
      </div>
    </button>
  );
}

/**
 * Przebieg treningu z zegarem: części po kolei, ile trwała każda i ile trwało przejście przed
 * nią. Część z widoku listy nie ma startu — stoi z chwilą zapisu, bez czasu i bez przejścia.
 */
function TimeLine({ time }: { time: LogTime }) {
  const gaps = new Map(transitions(time).map((g) => [g.block, g.secs]));
  return (
    <details className="h-parts">
      <summary>{T.timeline(time.parts.length)}</summary>
      <ol>
        {time.parts.map((p) => {
          const gap = gaps.get(p.block);
          return (
            <li key={p.block}>
              {p.ex.map((id) => EX[id]?.name ?? id).join(' + ')} —{' '}
              {p.at !== undefined ? durationText(p.end - p.at) : T.loggedAfter(durationText(p.end))}
              {gap !== undefined && (
                <span className="h-gap">
                  {' '}
                  · {T.gapBefore} {formatClock(gap)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/* ---------------- Historia jednego ćwiczenia ---------------- */

const VERDICT: Record<Trend['dir'], (t: Trend, unit: string) => string> = T.verdict;

const METRIC_LABEL: Record<Trend['metric'], string> = T.metric;

export function ExerciseStatsPage({ state, id }: { state: AppState; id: ExerciseId }) {
  const m = EX[id];
  const rows = exerciseRows(state, id);

  if (!m) {
    return (
      <div className="wrap">
        <EmptyState
          title={T.noExercise}
          text={T.badId(id)}
          cast={{ who: 'siwy', mood: 'wise' }}
        />
      </div>
    );
  }

  if (!rows.length) {
    // Ruch robiony dotąd tylko jako przekąska nie ma sesji do wykresu, ale ma odznaki.
    const snacked = snacksOf(state).some((s) => s.ex === id);
    return (
      <>
        <div className="wrap">
          {snacked ? (
            <div className="ex-hero">
              <Chip state={state} id={id} />
              <div>
                <div className="ex-group">
                  {groupLabel(m.group)} · {GEAR_LABEL[gearOf(id)]}
                </div>
                <h2 className="ex-h">{m.name}</h2>
                <div className="ex-target">{T.onlySnacks}</div>
              </div>
            </div>
          ) : (
            <EmptyState
              title={T.noHistory(m.name)}
              text={T.noHistoryText}
            />
          )}
        </div>
        {snacked ? (
          <ExerciseBadgesBlock state={state} id={id} />
        ) : (
          <div className="wrap">
            <div className="actions">
              <button className="btn wide" onClick={() => go(snackAddPath(id))}>
                {T.logSnack}
              </button>
            </div>
          </div>
        )}
        <div className="wrap">
          <div className="actions">
            <button className="btn ghost wide" onClick={() => go(exercisePath(id))}>
              {T.atlas}
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
  const burns = rows.map((r) => rowBurn(state, id, r));
  const kcalAll = burns.every((b) => b !== null) ? burns.reduce<number>((a, b) => a + (b ?? 0), 0) : null;
  const chartLabel = e1rms.length >= 3 ? T.chartMax : T.chartResult(unit);

  return (
    <>
      <div className="wrap">
        <div className="ex-hero">
          <Chip state={state} id={id} />
          <div>
            <div className="ex-group">
              {groupLabel(m.group)} · {GEAR_LABEL[gearOf(id)]}
            </div>
            <h2 className="ex-h">{m.name}</h2>
            <div className="ex-target">{planLabel(state, id)}</div>
          </div>
        </div>
      </div>

      <div className="grp">
        <h2>{T.howItWent}</h2>
        {t ? (
          <>
            <p className={`trend ${t.dir}`}>{VERDICT[t.dir](t, unit)}</p>
            <p className="tight">{T.basis(METRIC_LABEL[t.metric], t.span)}</p>
          </>
        ) : (
          <p className="tight">{T.tooFew(rows.length)}</p>
        )}
        <Trendline values={chart} label={chartLabel} />
        {EX_JOKES[id] && <p className="exjoke">{EX_JOKES[id]}</p>}
      </div>

      <div className="wrap">
        <div className="tiles">
          <div className="tile">
            <b>{rows.length}</b>
            <span>{T.sessionsTile}</span>
          </div>
          <div className="tile">
            <b>{num(total)}</b>
            <span>{unit === 's' ? T.secondsTile : T.repsTile}</span>
          </div>
          <div className="tile">
            <b>{weights.length ? `${Math.max(...weights)} kg` : `${bestSet} ${unit}`}</b>
            <span>{weights.length ? T.heaviest : T.bestSet}</span>
          </div>
          <div className="tile">
            <b>{tonnage ? tons(tonnage) : T.weeks(span)}</b>
            <span>{tonnage ? T.tonnage : T.inHistory}</span>
          </div>
        </div>
        <p className="tight" style={{ marginTop: 10 }}>
          {T.firstLast(dmy(rows[0]!.date), agoLabel(rows[rows.length - 1]!.date))}
          {p.e1rm ? T.maxNow(p.e1rm) : ''}
          {kcalAll !== null ? T.kcalAll(kcalText(kcalAll)) : T.noKcal}
        </p>
      </div>

      <ExerciseBadgesBlock state={state} id={id} />

      <div className="sect-label">{T.bySession}</div>
      {rows
        .map((r, i) => ({ r, kcal: burns[i] ?? null }))
        .reverse()
        .map(({ r, kcal }, i) => (
          <SessionRow key={`${r.date}-${i}`} row={r} unit={unit} kcal={kcal} />
        ))}

      <div className="wrap">
        <div className="actions">
          <button className="btn ghost wide" onClick={() => go(exercisePath(id))}>
            {T.technique}
          </button>
        </div>
      </div>
    </>
  );
}

const EFFORT_MARK: Record<string, string> = T.effort;

function SessionRow({ row, unit, kcal }: { row: ExerciseRow; unit: string; kcal: number | null }) {
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
          {kcal !== null && ` · ${kcalText(kcal)}`}
        </div>
      </div>
      <div className="streak">
        {row.total} {unit}
      </div>
    </div>
  );
}
