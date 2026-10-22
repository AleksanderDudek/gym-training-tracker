import { useState } from 'react';
import {
  GROUPS,
  GROUP_LABEL,
  GROUP_NOTE,
  achCtx,
  achievementProgress,
  exerciseProgress,
  formatTier,
  formatValue,
  touchedExercises,
} from '../engine/badges';
import type { AchProgress } from '../engine/badges';
import { KIND_NOW } from '../engine/exbadges';
import type { ExFamily } from '../engine/exbadges';
import { ex } from '../data/exercises';
import { go, statsPath } from '../routing';
import { ExerciseBadgeRow, badgeTally } from './ExerciseBadges';
import { SupportLine } from './Support';
import { BAND_NAME, BadgeMedal, bandFor } from './BadgeArt';
import type { Metrics } from '../engine/metrics';
import { EMPTY_SHELF, daySeed, massJoke, pick, repsJoke, timeJoke } from '../engine/quips';
import { snapshot } from '../engine/snapshot';
import { progressSubject } from '../engine/share';
import { rankFor } from '../engine/score';
import { ShareButton } from './Share';
import { dayKey } from '../engine/schedule';
import { LOCALE, text } from '../i18n';
import type { AppState } from '../types';

const T = text({
  pl: {
    dm: (dd: string, mm: string) => `${dd}.${mm}`,
    earned: (at: string) => `zdobyta${at ? ` ${at}` : ''}`,
    notYet: 'jeszcze nie',
    complete: (tier: string) => `komplet · ${tier}`,
    of: (value: string, tier: string) => `${value} z ${tier}`,
    lastTier: (at: string) => ` · ostatni próg ${at}`,
    medal: (name: string, tier: number, total: number) => `${name} — ${tier} z ${total}`,
    workouts: 'treningów',
    reps: 'powtórzeń',
    sets: 'serii',
    tonnage: 'tonaż',
    inNumbers: 'W liczbach',
    totalsLine: (exercises: string, distinct: number, time: string) =>
      `Wykonane ćwiczenia: ${exercises} · różne ruchy: ${distinct} · czas pod obciążeniem: ${time}`,
    massJoke: (joke: string) => `Tonaż to mniej więcej ${joke}. `,
    repsJoke: (joke: string) => `Powtórzenia: ${joke}. `,
    timeJoke: (joke: string) => `Czas pod obciążeniem: ${joke}.`,
    shelf: 'Półka',
    shelfEmpty: 'Pierwszy zapisany trening zdejmuje kłódkę — dalej odznaki rosną same.',
    shelfLead: 'Najmocniejsze tworzywa na przodzie.',
    closest: 'Najbliżej zdobycia',
    closestLead:
      'Pięć progów, do których brakuje najmniej. Rekordy dnia i tygodnia liczą się od początku bieżącego okresu — przekąska jeszcze dziś może któryś domknąć.',
    left: (v: string) => `brakuje ${v}`,
    lead: 'Każda rodzina odznak ma kilka progów, więc zdobyta odznaka nie kończy tematu, tylko pokazuje następny krok. Nic tu nie zależy od tego, jak ciężko trenujesz — liczy się to, ile i jak regularnie.',
    brag: 'Pochwal się',
    bragLead: 'Cały dorobek na jednej karcie: stopień, liczby i porównanie, którego nikt nie prosił.',
    share: 'Udostępnij dorobek',
    badges: (have: number, total: number) => `Odznaki ${have}/${total}`,
    exEmpty: 'Pojawią się po pierwszym treningu albo pierwszej przekąsce — każdy zrobiony ruch dostaje swoje cztery.',
    history: 'Historia ćwiczenia →',
  },
  en: {
    dm: (dd: string, mm: string) => `${dd}/${mm}`,
    earned: (at: string) => `earned${at ? ` ${at}` : ''}`,
    notYet: 'not yet',
    complete: (tier: string) => `complete · ${tier}`,
    of: (value: string, tier: string) => `${value} of ${tier}`,
    lastTier: (at: string) => ` · last tier ${at}`,
    medal: (name: string, tier: number, total: number) => `${name} — ${tier} of ${total}`,
    workouts: 'workouts',
    reps: 'reps',
    sets: 'sets',
    tonnage: 'tonnage',
    inNumbers: 'In numbers',
    totalsLine: (exercises: string, distinct: number, time: string) =>
      `Exercises done: ${exercises} · different moves: ${distinct} · time under load: ${time}`,
    massJoke: (joke: string) => `Your tonnage is roughly ${joke}. `,
    repsJoke: (joke: string) => `Reps: ${joke}. `,
    timeJoke: (joke: string) => `Time under load: ${joke}.`,
    shelf: 'Shelf',
    shelfEmpty: 'Your first logged workout takes the padlock off — after that, badges grow on their own.',
    shelfLead: 'The finest materials up front.',
    closest: 'Closest to earning',
    closestLead:
      'The five tiers you’re closest to. Day and week records count from the start of the current period — a snack today could still close one.',
    left: (v: string) => `${v} to go`,
    lead: 'Every badge family has several tiers, so earning a badge doesn’t end the story — it shows the next step. Nothing here depends on how heavy you train — what counts is how much and how regularly.',
    brag: 'Show it off',
    bragLead: 'Everything you’ve achieved on one card: your rank, the numbers and a comparison nobody asked for.',
    share: 'Share your progress',
    badges: (have: number, total: number) => `Badges ${have}/${total}`,
    exEmpty: 'They appear after your first workout or exercise snack — every move you do gets its own four.',
    history: 'Exercise history →',
  },
});

const shortDate = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return T.dm(dd!, mm!);
};

const num = (n: number): string => Math.round(n).toLocaleString(LOCALE);

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
      ? T.earned(r.at ? shortDate(r.at) : '')
      : T.notYet
    : `${done ? T.complete(formatTier(r.ach, r.value)) : T.of(formatValue(r.ach, r.value), formatTier(r.ach, r.next!))}${
        r.at ? T.lastTier(shortDate(r.at)) : ''
      }`;

  return (
    <div className={`ach${r.tier ? ' on' : ''}${done ? ' full' : ''}`}>
      <BadgeMedal
        art={r.ach.art}
        mark={r.ach.mark}
        band={bandFor(r.tier, r.ach.tiers.length)}
        title={T.medal(r.ach.name, r.tier, r.ach.tiers.length)}
      />
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
        {r.ach.quip && <div className="ach-quip">{r.ach.quip}</div>}
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
    [num(m.workouts), T.workouts],
    [num(m.reps), T.reps],
    [num(m.sets), T.sets],
    [
      m.tonnage >= 1000
        ? `${(Math.round(m.tonnage / 100) / 10).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} t`
        : `${num(m.tonnage)} kg`,
      T.tonnage,
    ],
  ];

  return (
    <div className="grp">
      <h2>{T.inNumbers}</h2>
      <div className="tiles">
        {tiles.map(([v, l]) => (
          <div className="tile" key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <p className="tight" style={{ marginTop: 10 }}>
        {T.totalsLine(num(m.exercises), m.distinct, m.secs >= 120 ? `${Math.round(m.secs / 60)} min` : `${m.secs} s`)}
      </p>
      {(massJoke(m.tonnage) || repsJoke(m.reps)) && (
        <p className="tight joke">
          {massJoke(m.tonnage) && T.massJoke(massJoke(m.tonnage)!)}
          {repsJoke(m.reps) && T.repsJoke(repsJoke(m.reps)!)}
          {timeJoke(m.secs) && T.timeJoke(timeJoke(m.secs)!)}
        </p>
      )}
    </div>
  );
}

/**
 * Półka trofeów: zdobyte odznaki w najmocniejszym tworzywie na przodzie. Sama lista rodzin
 * mówi, ile czego brakuje; półka pokazuje dorobek jako zbiór przedmiotów, a to inne uczucie.
 */
function Shelf({ rows }: { rows: AchProgress[] }) {
  const owned = rows
    .filter((r) => r.tier > 0)
    .map((r) => ({ r, band: bandFor(r.tier, r.ach.tiers.length) }))
    .sort((a, b) => b.band - a.band || b.r.tier - a.r.tier)
    .slice(0, 12);

  if (!owned.length)
    return (
      <div className="grp">
        <h2>{T.shelf}</h2>
        <p className="tight">
          {pick(EMPTY_SHELF, daySeed())} {T.shelfEmpty}
        </p>
      </div>
    );

  return (
    <div className="grp">
      <h2>{T.shelf}</h2>
      <p className="tight">{T.shelfLead}</p>
      <div className="shelf">
        {owned.map(({ r, band }) => (
          <div className="shelf-item" key={r.ach.id}>
            <BadgeMedal
              art={r.ach.art}
              mark={r.ach.mark}
              band={band}
              size={46}
              title={`${r.ach.name} — ${BAND_NAME[band]}`}
            />
            <span>{r.ach.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Progi najbliższe zdobycia. Przy dwustu siedemdziesięciu progach sama lista przestaje
 * odpowiadać na pytanie „co mogę zrobić teraz” — ta sekcja odpowiada, biorąc pięć rodzin
 * z najdalej posuniętym paskiem spośród tych, które jeszcze czegoś potrzebują.
 */
/** Wartość, z którą porównuje się następny próg: przy rekordzie okresu — ta z bieżącego okresu. */
const nowOf = (r: AchProgress): number => r.current ?? r.value;

/** „dziś 30 z 50”, „w tym tygodniu 120 z 150”, a przy sumach po prostu „1 200 z 1 500”. */
const nearMeta = (r: AchProgress): string => {
  const k = (r.ach as Partial<ExFamily>).kind;
  const lead = r.current !== null && k && k !== 'lacznie' ? `${KIND_NOW[k]} ` : '';
  return `${lead}${T.of(formatValue(r.ach, nowOf(r)), formatTier(r.ach, r.next!))}`;
};

function Closest({ rows }: { rows: AchProgress[] }) {
  const near = rows
    .filter((r) => r.next !== null && nowOf(r) > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  if (!near.length) return null;

  return (
    <div className="grp">
      <h2>{T.closest}</h2>
      <p className="tight">{T.closestLead}</p>
      <div className="near">
        {near.map((r) => (
          <div className="near-row" key={r.ach.id}>
            <span className="near-name">{r.ach.name}</span>
            <span className="near-left">{T.left(formatValue(r.ach, Math.max(0, r.next! - nowOf(r))))}</span>
            <span className="near-bar">
              <i style={{ width: `${Math.max(3, Math.round(r.progress * 100))}%` }} />
            </span>
            <span className="near-meta">{nearMeta(r)}</span>
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
  // Odznaki ćwiczeń tylko dla ruchów, które już się pojawiły — czterysta rodzin dla stu pięciu
  // ćwiczeń, z których ktoś robi dwanaście, to ściana, a nie zachęta.
  const touched = touchedExercises(ctx);
  const exRows = new Map(touched.map((id) => [id, exerciseProgress(ctx, id)]));
  const exAll = [...exRows.values()].flat();

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead}</p>
      </div>

      <Shelf rows={[...rows, ...exAll]} />
      <Totals m={ctx.metrics} />

      <div className="grp">
        <h2>{T.brag}</h2>
        <p className="tight">{T.bragLead}</p>
        <div style={{ marginTop: 10 }}>
          <ShareButton
            subject={progressSubject(
              ctx.metrics,
              rankFor((state.award.banked ?? 0) + (snap?.score.points ?? 0)).rank.name,
              ctx.metrics.workouts,
            )}
            label={T.share}
          />
        </div>
      </div>
      <Closest rows={[...rows, ...exAll]} />

      <div className="sect-label">{T.badges(have, total)}</div>

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

      <div>
        <button
          className="wk-head"
          aria-expanded={open === 'cwiczenia'}
          onClick={() => setOpen(open === 'cwiczenia' ? null : 'cwiczenia')}
        >
          <span>{GROUP_LABEL.cwiczenia}</span>
          <span className="wk-sum">{touched.length ? badgeTally(exAll) : '—'}</span>
        </button>
        {open === 'cwiczenia' && (
          <div className="wk-body">
            <p className="ach-note">{GROUP_NOTE.cwiczenia}</p>
            {!touched.length && (
              <p className="ach-note">{T.exEmpty}</p>
            )}
            {touched.map((id) => (
              <details className="gsel exbadges" key={id}>
                <summary>
                  {ex(id).name} <i>{badgeTally(exRows.get(id)!)}</i>
                </summary>
                {exRows.get(id)!.map((r) => (
                  <ExerciseBadgeRow key={r.ach.id} r={r} />
                ))}
                <button className="vidlink exbadges-link" onClick={() => go(statsPath(id))}>
                  {T.history}
                </button>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="wrap">
        <SupportLine seed={rows.length} />
      </div>
    </>
  );
}
