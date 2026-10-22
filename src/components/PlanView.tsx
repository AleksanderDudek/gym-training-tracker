import { useState, type ReactNode } from 'react';
import { BUILTIN } from '../data/exercises';
import {
  FREQUENCIES,
  LEVELS,
  LEVEL_DESC,
  LEVEL_LABEL,
  PLAN_WEEKS,
  SEXES,
  SEX_LABEL,
  planById,
  planId,
} from '../data/plans';
import { advise } from '../engine/advice';
import { journal } from '../engine/journal';
import { achievementById } from '../engine/badges';
import { LANG, pluralEn, text } from '../i18n';
import { achievementCount } from './Achievements';
import { POINTS, pointsToday } from '../engine/score';
import { dayKey, daysBetween, planPolicy, planWeekdays, planWeeks } from '../engine/schedule';
import { snapshot } from '../engine/snapshot';
import type { Snapshot } from '../engine/snapshot';
import { Segmented } from './ui';
import { SupportLine } from './Support';
import { PlanCatalog, Weekdays } from './Plans';
import { BoostCard } from './Boost';
import { PlanArt } from './SceneArt';
import { HealthNote } from './Health';
import { SectionSwitch } from './Design';
import { PLANS_PATH, go } from '../routing';
import type {
  AppState,
  PlanLevel,
  PlanOptions,
  PlanPolicy,
  PlanTemplate,
  PlannedDay,
  Sex,
} from '../types';

const T = text({
  pl: {
    wd: ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'niedz'],
    wdShort: ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'],
    /** Polska odmiana po liczebniku: 2–4 to „treningi”, poza nastkami; reszta „treningów”. */
    sessionsWord: (n: number): string => {
      const last = n % 10;
      const teen = n % 100 >= 12 && n % 100 <= 14;
      if (n === 1) return 'trening';
      return !teen && last >= 2 && last <= 4 ? 'treningi' : 'treningów';
    },
    days: (n: number): string => (n === 1 ? '1 dzień' : `${n} dni`),
    lead: 'Dwanaście tygodni rozpisane na konkretne dni. Aplikacja pilnuje terminów: liczy zrobione i opuszczone, przyznaje punkty za trzymanie się kalendarza i sama decyduje, który trening wypada następny — także wtedy, gdy poprzedni się nie odbył.',
    sex: 'Płeć',
    sexText:
      'Wpływa wyłącznie na ciężary startowe. Program, rotacja treningów i zasady progresji są identyczne — różni się przeciętny punkt wyjścia obciążenia, nie sposób trenowania.',
    level: 'Poziom',
    perWeek: 'Treningów w tygodniu',
    startDay: 'Dzień startu',
    startDayText: 'Terminy liczą się od tego dnia. Dni tygodnia sprzed startu nie są zaległościami.',
    trainingDays: 'Dni treningowe',
    trainingDaysText:
      'Domyślnie tak, żeby przerwy między treningami były równe. Zmień, jeśli tydzień wygląda u ciebie inaczej — silnik i tak liczy terminy z tego, co tu wybierzesz.',
    picked: (days: string, sessions: string, weeks: number) => `${days} · ${sessions} przez ${weeks} tygodni`,
    pickOne: 'Wybierz przynajmniej jeden dzień.',
    missedHead: 'Gdy trening się nie odbędzie',
    waits: 'Trening czeka',
    lost: 'Trening przepada',
    shiftText:
      'Rotacja przesuwa się dopiero po zrobionym treningu. Opuszczony poniedziałek nie zjada treningu A — dostanie go najbliższy termin. Zalecane: żaden wzorzec ruchowy nie wypada z planu.',
    fixedText:
      'Rotacja idzie sztywno z kalendarzem. Opuszczony trening przepada, a kolejny termin bierze to, co wypada w kalendarzu.',
    rotation: 'Układ rotacji:',
    lightDay: ' — D to dzień lekki, bez ciężkiego zawiasu i wyciskania.',
    tooMany:
      'Sześć i siedem treningów w tygodniu ma sens tylko przy dobrym śnie i bez bólu. Przy pierwszym sygnale przeciążenia zejdź na rzadszy wariant — plan zmienisz w każdej chwili.',
    startPlan: 'Zacznij ten plan',
    backToPlan: 'Wróć do planu',
    madeUp: (days: string) => `nadrobiony ${days} po terminie`,
    toMakeUp: 'do nadrobienia',
    missed: 'opuszczony — trening wchodzi na kolejny termin',
    gap: (days: string) => `${days} przerwy`,
    untick: 'Cofnij odhaczenie',
    tick: 'Odhacz — trening zrobiony poza aplikacją',
    pts: (n: number) => `${n} pkt`,
    toRank: (name: string, n: number) => `Do stopnia „${name}” brakuje ${n} pkt.`,
    topRank: 'Najwyższy stopień. Dalej liczy się już tylko seria.',
    adherence: 'realizacja',
    streak: 'seria w terminie',
    deadlines: 'terminy',
    missedTile: 'opuszczone',
    whyPoints: 'Skąd te punkty',
    ptsSessions: (pts: number, onTime: number, per: number, late: number, perLate: string): ReactNode => (
      <>
        Terminy: <b>{pts} pkt</b> — {onTime} w terminie po {per}, {late} nadrobione po {perLate}.
      </>
    ),
    ptsStreak: (pts: number, step: number, cap: number): ReactNode => (
      <>
        Seria: <b>{pts} pkt</b> — {step} pkt za każdy kolejny termin w terminie, do {cap} pkt za sesję.
      </>
    ),
    ptsWeeks: (pts: number, n: number, per: number): ReactNode => (
      <>
        Czyste tygodnie: <b>{pts} pkt</b> — {n} × {per}.
      </>
    ),
    ptsExtra: (pts: number, n: number, per: number): ReactNode => (
      <>
        Treningi poza planem: <b>{pts} pkt</b> — {n} × {per}.
      </>
    ),
    ptsEarlier: (pts: number): ReactNode => (
      <>
        Dorobek z wcześniejszych planów: <b>{pts} pkt</b>.
      </>
    ),
    noMinus:
      'Punktów ujemnych nie ma. Opuszczony termin nic nie zabiera — zeruje serię, a to i tak boli najbardziej.',
    badges: (have: number, total: number) => `Odznaki ${have}/${total}`,
    badgesText: (a: string, b: string, c: string, d: string): ReactNode => (
      <>
        Pełna lista z progami i postępem jest w zakładce <b>Osiągnięcia</b>. Terminy planu odblokowują rodziny „{a}”, „{b}”,
        „{c}” i „{d}”.
      </>
    ),
    seeBadges: 'Zobacz osiągnięcia',
    journal: 'Dziennik',
    journalText: 'Każdy termin zostawia ślad — także ten, w którym nic się nie wydarzyło.',
    journalEmpty: 'Jeszcze nic — pierwszy termin dopiero przed tobą.',
    showAll: (n: number) => `Pokaż wszystkie (${n})`,
    progress: (week: number, weeks: number, done: number, total: number, adherence: number | null): ReactNode => (
      <>
        Tydzień <b>{week}</b> z {weeks} · zrobione <b>{done}</b> z {total}
        {adherence !== null && ` · realizacja ${adherence}%`}
      </>
    ),
    worth: (pts: number): ReactNode => (
      <>
        Dziś do wzięcia: <b>{pts} pkt</b>
      </>
    ),
    switchTo: (n: number) => `Przejdź na ${n}× w tygodniu`,
    fromToday: (days: string) => `Od dziś: ${days}`,
    next: 'Najbliższy termin',
    today: 'Dzisiaj',
    nextOn: (day: string, inDays: string) => `${day} — za ${inDays}`,
    rhythmHead: 'Rytm i przerwy',
    rhythmText: (days: string, gap: string): ReactNode => (
      <>
        Dni treningowe: {days}. Najdłuższa zaplanowana przerwa to <b>{gap}</b>.
      </>
    ),
    breaks: (
      <>
        Do <b>10 dni</b> przerwy nie dzieje się nic. Od <b>11</b> wstrzymane są skoki na cięższy obciążenie. Od{' '}
        <b>21</b> cele powtórzeń wracają do dolnej granicy zakresu, a powyżej sześciu tygodni schodzą też szacowane
        maksima.
      </>
    ) as ReactNode,
    weekN: (n: number) => `Tydzień ${n}`,
    lighter: ' · lżejszy',
    sumToday: ' · dziś',
    sumMakeUp: ' · do nadrobienia',
    change: 'Zmień plan',
    end: 'Zakończ plan',
    adjust: 'Zmień plan od dziś',
    adjustText:
      'Zmiany działają od dziś. Terminy, które minęły, zostają takie, jakie były — razem z punktami, seriami i odznakami. Rotacja treningów idzie dalej.',
    trainingDaysLow: 'dni treningowe',
    saveDays: 'Zapisz dni od dziś',
    whenMissed: 'gdy termin przepadnie',
    whenMissedLabel: 'Gdy termin przepadnie',
    lasts: (total: number, extra: number | undefined, ending: boolean) =>
      `Plan trwa ${total} ${total === 1 ? 'tydzień' : total < 5 ? 'tygodnie' : 'tygodni'}${extra ? `, w tym ${extra} dołożone` : ''}. ${ending ? 'To już końcówka — da się ją przedłużyć bez zakładania nowego planu.' : ''}`,
    extend: (n: number) => `Przedłuż o ${n} tygodnie`,
    another: 'Inny plan z katalogu',
  },
  en: {
    wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    wdShort: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    sessionsWord: (n: number): string => pluralEn(n, 'workout', 'workouts'),
    days: (n: number): string => `${n} ${pluralEn(n, 'day', 'days')}`,
    lead: 'Twelve weeks laid out on specific days. The app keeps an eye on deadlines: it counts what’s done and what’s missed, gives points for sticking to the calendar and decides which workout comes next — even when the previous one didn’t happen.',
    sex: 'Sex',
    sexText:
      'Affects only the starting weights. The programme, workout rotation and progression rules are identical — only the average starting load differs, not the way you train.',
    level: 'Level',
    perWeek: 'Workouts a week',
    startDay: 'Start date',
    startDayText: 'Deadlines count from this day. Days before the start aren’t overdue.',
    trainingDays: 'Training days',
    trainingDaysText:
      'By default they’re spaced so the breaks between workouts are even. Change them if your week looks different — the engine works out deadlines from whatever you pick here.',
    picked: (days: string, sessions: string, weeks: number) => `${days} · ${sessions} over ${weeks} weeks`,
    pickOne: 'Pick at least one day.',
    missedHead: 'If a workout doesn’t happen',
    waits: 'Workout waits',
    lost: 'Workout is dropped',
    shiftText:
      'The rotation only moves on once a workout is done. A missed Monday doesn’t swallow workout A — the next slot gets it. Recommended: no movement pattern drops out of the plan.',
    fixedText:
      'The rotation follows the calendar strictly. A missed workout is dropped, and the next slot takes whatever the calendar says.',
    rotation: 'Rotation:',
    lightDay: ' — D is a light day, with no heavy hinging or pressing.',
    tooMany:
      'Six or seven workouts a week only make sense if you sleep well and nothing hurts. At the first sign of overload, drop to a less frequent option — you can change the plan at any time.',
    startPlan: 'Start this plan',
    backToPlan: 'Back to the plan',
    madeUp: (days: string) => `made up ${days} late`,
    toMakeUp: 'to make up',
    missed: 'missed — the workout moves to the next slot',
    gap: (days: string) => `${days} off`,
    untick: 'Undo tick',
    tick: 'Tick off — workout done outside the app',
    pts: (n: number) => `${n} pts`,
    toRank: (name: string, n: number) => `${n} pts to go to “${name}”.`,
    topRank: 'Top rank. From here on, only the streak counts.',
    adherence: 'completion',
    streak: 'on-time streak',
    deadlines: 'deadlines',
    missedTile: 'missed',
    whyPoints: 'Where the points come from',
    ptsSessions: (pts: number, onTime: number, per: number, late: number, perLate: string): ReactNode => (
      <>
        Deadlines: <b>{pts} pts</b> — {onTime} on time at {per} each, {late} made up at {perLate}.
      </>
    ),
    ptsStreak: (pts: number, step: number, cap: number): ReactNode => (
      <>
        Streak: <b>{pts} pts</b> — {step} pts for each deadline in a row met on time, up to {cap} pts per session.
      </>
    ),
    ptsWeeks: (pts: number, n: number, per: number): ReactNode => (
      <>
        Clean weeks: <b>{pts} pts</b> — {n} × {per}.
      </>
    ),
    ptsExtra: (pts: number, n: number, per: number): ReactNode => (
      <>
        Workouts outside the plan: <b>{pts} pts</b> — {n} × {per}.
      </>
    ),
    ptsEarlier: (pts: number): ReactNode => (
      <>
        Carried over from earlier plans: <b>{pts} pts</b>.
      </>
    ),
    noMinus: 'There are no negative points. A missed deadline takes nothing away — it resets the streak, and that hurts most anyway.',
    badges: (have: number, total: number) => `Badges ${have}/${total}`,
    badgesText: (a: string, b: string, c: string, d: string): ReactNode => (
      <>
        The full list with thresholds and progress is in the <b>Achievements</b> tab. Plan deadlines unlock the “{a}”,
        “{b}”, “{c}” and “{d}” families.
      </>
    ),
    seeBadges: 'See achievements',
    journal: 'Journal',
    journalText: 'Every deadline leaves a trace — even one where nothing happened.',
    journalEmpty: 'Nothing yet — your first deadline is still ahead.',
    showAll: (n: number) => `Show all (${n})`,
    progress: (week: number, weeks: number, done: number, total: number, adherence: number | null): ReactNode => (
      <>
        Week <b>{week}</b> of {weeks} · done <b>{done}</b> of {total}
        {adherence !== null && ` · completion ${adherence}%`}
      </>
    ),
    worth: (pts: number): ReactNode => (
      <>
        Up for grabs today: <b>{pts} pts</b>
      </>
    ),
    switchTo: (n: number) => `Switch to ${n}× a week`,
    fromToday: (days: string) => `From today: ${days}`,
    next: 'Next deadline',
    today: 'Today',
    nextOn: (day: string, inDays: string) => `${day} — in ${inDays}`,
    rhythmHead: 'Rhythm and breaks',
    rhythmText: (days: string, gap: string): ReactNode => (
      <>
        Training days: {days}. The longest planned break is <b>{gap}</b>.
      </>
    ),
    breaks: (
      <>
        Up to <b>10 days</b> off, nothing happens. From <b>11</b>, jumps to a heavier load are paused. From <b>21</b>,
        rep targets drop back to the bottom of the range, and after six weeks the estimated maxes come down too.
      </>
    ) as ReactNode,
    weekN: (n: number) => `Week ${n}`,
    lighter: ' · lighter',
    sumToday: ' · today',
    sumMakeUp: ' · to make up',
    change: 'Change plan',
    end: 'End plan',
    adjust: 'Change the plan from today',
    adjustText:
      'Changes apply from today. Past deadlines stay as they were — along with points, streaks and badges. The workout rotation carries on.',
    trainingDaysLow: 'training days',
    saveDays: 'Save days from today',
    whenMissed: 'when a deadline is missed',
    whenMissedLabel: 'When a deadline is missed',
    lasts: (total: number, extra: number | undefined, ending: boolean) =>
      `The plan runs for ${total} ${pluralEn(total, 'week', 'weeks')}${extra ? `, including ${extra} added` : ''}. ${ending ? 'This is the home stretch — you can extend it without starting a new plan.' : ''}`,
    extend: (n: number) => `Extend by ${n} weeks`,
    another: 'Another plan from the catalogue',
  },
});

const WD = T.wd;
const WD_SHORT = T.wdShort;

const shortDate = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return LANG === 'pl' ? `${dd}.${mm}` : `${dd}/${mm}`;
};

const sessionsWord = T.sessionsWord;

/** Nazwa rodziny odznak — z katalogu odznak, w języku tej wizyty. */
const family = (id: string): string => achievementById(id)?.name ?? id;

/** Nazwa treningu z rotacji — gotowego albo własnego. */
const nameIn =
  (state: AppState) =>
  (id: string): string =>
    [...BUILTIN, ...state.workouts].find((w) => w.id === id)?.name ?? id;

/** Sama liczba dni z odmianą. Kontekst („przerwy”, „to …”) dokłada miejsce użycia. */
const gapDays = (n: number): string => T.days(n);

/* ---------------- Katalog ---------------- */

export function Catalogue({
  onStart,
  onCancel,
}: {
  onStart: (t: PlanTemplate, o: PlanOptions) => void;
  onCancel?: (() => void) | undefined;
}) {
  const [sex, setSex] = useState<Sex>('any');
  const [level, setLevel] = useState<PlanLevel>('zero');
  const [days, setDays] = useState(3);
  const [start, setStart] = useState(dayKey(Date.now()));
  const [policy, setPolicy] = useState<PlanPolicy>('shift');
  const t = planById(planId(level, sex, days))!;
  // Wybór dni startuje od układu z szablonu i resetuje się przy zmianie częstotliwości.
  const [picked, setPicked] = useState<number[] | null>(null);
  const weekdays = picked ?? t.weekdays;

  const toggle = (wd: number) => {
    const set = new Set(weekdays);
    if (set.has(wd)) set.delete(wd);
    else set.add(wd);
    setPicked([...set].sort((a, b) => a - b));
  };

  const sessions = weekdays.length * PLAN_WEEKS;

  return (
    <>
      {/* Scena idzie za wybranym poziomem — od zera, podstawowy, mocny. */}
      <div className="scene-hero">
        <PlanArt plan={t} />
      </div>
      <div className="wrap">
        <p className="lead">{T.lead}</p>
      </div>

      <div className="grp">
        <h2>{T.sex}</h2>
        <p className="tight">{T.sexText}</p>
        <div style={{ marginTop: 10 }}>
          <Segmented
            value={sex}
            onChange={setSex}
            options={SEXES.map((k) => ({ key: k, label: SEX_LABEL[k] }))}
          />
        </div>
      </div>

      <div className="grp">
        <h2>{T.level}</h2>
        <Segmented
          value={level}
          onChange={setLevel}
          options={LEVELS.map((k) => ({ key: k, label: LEVEL_LABEL[k] }))}
        />
        <p className="tight">{LEVEL_DESC[level]}</p>
      </div>

      <div className="grp">
        <h2>{T.perWeek}</h2>
        <div className="freq">
          {FREQUENCIES.map((n) => (
            <button
              key={n}
              aria-pressed={days === n}
              onClick={() => {
                setDays(n);
                setPicked(null);
              }}
            >
              {n}×
            </button>
          ))}
        </div>
        <p className="tight">{t.desc}</p>
      </div>

      <div className="grp">
        <h2>{T.startDay}</h2>
        <p className="tight">{T.startDayText}</p>
        <div style={{ marginTop: 8, maxWidth: 200 }}>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value || dayKey(Date.now()))}
          />
        </div>
      </div>

      <div className="grp">
        <h2>{T.trainingDays}</h2>
        <p className="tight">{T.trainingDaysText}</p>
        <div className="wdays">
          {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
            <button
              key={wd}
              aria-pressed={weekdays.includes(wd)}
              aria-label={WD[wd - 1]}
              onClick={() => toggle(wd)}
            >
              {WD_SHORT[wd - 1]}
            </button>
          ))}
        </div>
        <p className="tight" style={{ marginTop: 8 }}>
          {weekdays.length
            ? T.picked(weekdays.map((w) => WD[w - 1]).join(', '), `${sessions} ${sessionsWord(sessions)}`, PLAN_WEEKS)
            : T.pickOne}
        </p>
      </div>

      <div className="grp">
        <h2>{T.missedHead}</h2>
        <Segmented
          value={policy}
          onChange={setPolicy}
          options={[
            { key: 'shift' as PlanPolicy, label: T.waits },
            { key: 'fixed' as PlanPolicy, label: T.lost },
          ]}
        />
        <p className="tight">{policy === 'shift' ? T.shiftText : T.fixedText}</p>
      </div>

      <div className="grp">
        <h2>{t.name}</h2>
        <p style={{ marginTop: 8 }}>
          {T.rotation}{' '}
          {t.cycle.map((c, i) => (
            <span key={i} className={`wtag${c === 'D' ? ' light' : ''}`}>
              {c}
            </span>
          ))}
          {t.cycle.includes('D') && T.lightDay}
        </p>
        {days >= 6 && (
          <p className="tight" style={{ color: 'var(--warn)' }}>
            {T.tooMany}
          </p>
        )}
        <div className="actions">
          <button
            className="btn wide"
            disabled={!weekdays.length}
            onClick={() => onStart(t, { start, weekdays, policy })}
          >
            {T.startPlan}
          </button>
          {onCancel && (
            <button className="btn ghost wide" onClick={onCancel}>
              {T.backToPlan}
            </button>
          )}
        </div>
        <HealthNote style={{ marginTop: 10 }} />
      </div>
    </>
  );
}

/* ---------------- Kalendarz ---------------- */

function DayRow({
  d,
  onTick,
  workoutName,
}: {
  d: PlannedDay;
  onTick: (i: number) => void;
  workoutName: (id: string) => string;
}) {
  const mark =
    d.status === 'done' ? (d.late === 0 ? '✓' : '↺') : d.status === 'missed' ? '–' : '';
  const tickable = d.status !== 'future' && d.source !== 'log';

  return (
    <div className={`pday ${d.status}${d.late > 0 ? ' late' : ''}`}>
      <span className="pd-date">
        {WD[d.weekday - 1]} {shortDate(d.date)}
      </span>
      <span className="pd-work">
        {workoutName(d.workout)}
        <span className="pd-gap">
          {d.status === 'done' && d.late > 0
            ? T.madeUp(gapDays(d.late))
            : d.status === 'open'
              ? T.toMakeUp
              : d.status === 'missed'
                ? T.missed
                : d.gap > 0
                  ? T.gap(gapDays(d.gap))
                  : ''}
        </span>
      </span>
      {tickable ? (
        <button
          className="pd-tick"
          aria-pressed={d.source === 'tick'}
          title={d.source === 'tick' ? T.untick : T.tick}
          onClick={() => onTick(d.index)}
        >
          <span>{d.source === 'tick' ? '✓' : ''}</span>
        </button>
      ) : (
        <span className="pd-mark">{mark}</span>
      )}
    </div>
  );
}

function Scoreboard({ snap }: { snap: Snapshot }) {
  const { stats, score, rank, points } = snap;
  const pct = Math.round(rank.progress * 100);

  return (
    <div className="grp">
      <div className="rankline">
        <span className="rank-name">{rank.rank.name}</span>
        <span className="rank-pts">{T.pts(points)}</span>
      </div>
      <div className="rank-bar">
        <i style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <p className="tight">
        {rank.next
          ? T.toRank(rank.next.name, rank.next.at - points)
          : T.topRank}
      </p>

      <div className="tiles">
        <div className="tile">
          <b>{stats.adherence === null ? '—' : `${stats.adherence}%`}</b>
          <span>{T.adherence}</span>
        </div>
        <div className="tile">
          <b>{stats.streak}</b>
          <span>{T.streak}</span>
        </div>
        <div className="tile">
          <b>
            {stats.done}/{stats.total}
          </b>
          <span>{T.deadlines}</span>
        </div>
        <div className="tile">
          <b>{stats.missed}</b>
          <span>{T.missedTile}</span>
        </div>
      </div>

      <details className="why" style={{ marginTop: 12 }}>
        <summary>{T.whyPoints}</summary>
        <div>
          <ul className="ptlist">
            <li>{T.ptsSessions(score.parts.sessions, stats.onTime, POINTS.onTime, stats.late, POINTS.late.join('/'))}</li>
            <li>{T.ptsStreak(score.parts.streak, POINTS.streakStep, POINTS.streakCap * POINTS.streakStep)}</li>
            <li>{T.ptsWeeks(score.parts.weeks, score.cleanWeeks, POINTS.cleanWeek)}</li>
            <li>{T.ptsExtra(score.parts.extra, stats.extra, POINTS.extra)}</li>
            {points > score.points && <li>{T.ptsEarlier(points - score.points)}</li>}
          </ul>
          <p style={{ marginTop: 8 }}>{T.noMinus}</p>
        </div>
      </details>
    </div>
  );
}

/**
 * Odznaki mają własną zakładkę, bo większość z nich liczy się z całej historii, a nie
 * z kalendarza planu. Tu zostaje sam licznik — żeby było widać, że rosną.
 */
function BadgeLine({ state }: { state: AppState }) {
  const { have, total } = achievementCount(state);
  return (
    <div className="grp">
      <h2>{T.badges(have, total)}</h2>
      <p className="tight">
        {/* i18n-ignore: identyfikatory odznak */}
        {T.badgesText(family('seria'), family('bez-pudla'), family('czysty-tydzien'), family('nadrabiacz'))}
      </p>
      <a className="vidlink" href="#/osiagniecia">
        {T.seeBadges}
      </a>
    </div>
  );
}

function Journal({ snap, state }: { snap: Snapshot; state: AppState }) {
  const [all, setAll] = useState(false);
  const workoutName = nameIn(state);
  const items = journal(snap.schedule, state.events, workoutName).filter(
    (e) => e.date <= snap.today,
  );
  const shown = all ? items : items.slice(0, 12);

  return (
    <div className="grp">
      <h2>{T.journal}</h2>
      <p className="tight">{T.journalText}</p>
      <div className="jrn">
        {shown.map((e) => (
          <div key={e.id} className={`jrow j-${e.kind}`}>
            <span className="j-date">{shortDate(e.date)}</span>
            <span className="j-body">
              <b>{e.title}</b>
              {e.text && <span className="j-text">{e.text}</span>}
            </span>
            <span className="j-pts">{e.points ? `+${e.points}` : ''}</span>
          </div>
        ))}
        {!shown.length && <p className="tight">{T.journalEmpty}</p>}
      </div>
      {items.length > shown.length && (
        <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setAll(true)}>
          {T.showAll(items.length)}
        </button>
      )}
    </div>
  );
}

function ActivePlanView({
  state,
  snap,
  onChange,
  onStop,
  onTick,
  onFrequency,
  edits,
}: {
  state: AppState;
  snap: Snapshot;
  onChange: () => void;
  onStop: () => void;
  onTick: (i: number) => void;
  onFrequency: (days: number) => void;
  edits: PlanEdits;
}) {
  const { template, schedule, stats, today } = snap;
  const workoutName = nameIn(state);
  const days = schedule.days;
  const weeks = [...new Set(days.map((d) => d.week))];
  const [open, setOpen] = useState<number>(stats.week);
  const tips = advise(state, template, snap.plan, stats, today);
  const worth = pointsToday(stats, today);

  return (
    <>
      <div className="scene-hero">
        <PlanArt plan={template} />
      </div>
      <div className="wrap">
        <h2>{template.name}</h2>
        <p className="lead">
          {T.progress(stats.week, planWeeks(template, snap.plan), stats.done, stats.total, stats.adherence)}
        </p>
      </div>

      <Scoreboard snap={snap} />

      {tips.map((a) => (
        <div className="grp" key={a.kind}>
          <h2>{a.title}</h2>
          <p className="tight" style={a.level === 'warn' ? { color: 'var(--warn)' } : undefined}>
            {a.text}
          </p>
          {a.kind === 'due' || a.kind === 'makeup' ? (
            <p style={{ marginTop: 8 }}>
              {T.worth(worth.now)}
              {stats.due && ` · ${workoutName(stats.due.workout)}`}
            </p>
          ) : null}
          {a.freq !== undefined && (
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => onFrequency(a.freq!)}>
              {T.switchTo(a.freq)}
            </button>
          )}
          {a.days && (
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => edits.onWeekdays(a.days!)}>
              {T.fromToday(a.days.map((d) => WD[d - 1]).join(', '))}
            </button>
          )}
        </div>
      ))}

      <BoostCard state={state} today={today} onStart={edits.onStart} />

      {stats.next && (
        <div className="grp">
          <h2>{T.next}</h2>
          <p className="tight">
            {stats.next.date === today
              ? T.today
              : T.nextOn(`${WD[stats.next.weekday - 1]} ${shortDate(stats.next.date)}`, gapDays(daysBetween(today, stats.next.date)))}
            {' · '}
            {workoutName(stats.next.workout)}
          </p>
        </div>
      )}

      <div className="grp">
        <h2>{T.rhythmHead}</h2>
        <p className="tight">
          {T.rhythmText(planWeekdays(template, snap.plan).map((w) => WD[w - 1]).join(', '), gapDays(stats.maxGap))}
        </p>
        <p style={{ marginTop: 8 }}>{T.breaks}</p>
      </div>

      {weeks.map((w) => {
        const rows = days.filter((d) => d.week === w);
        const done = rows.filter((d) => d.status === 'done').length;
        return (
          <div key={w}>
            <button
              className="wk-head"
              aria-expanded={open === w}
              onClick={() => setOpen(open === w ? -1 : w)}
            >
              <span>
                {T.weekN(w)}
                {rows[0]?.deload && <i className="wk-deload">{T.lighter}</i>}
              </span>
              <span className="wk-sum">
                {done}/{rows.length}
                {rows.some((d) => d.status === 'today') ? T.sumToday : ''}
                {rows.some((d) => d.status === 'open') ? T.sumMakeUp : ''}
              </span>
            </button>
            {open === w && (
              <div className="wk-body">
                {rows.map((d) => (
                  <DayRow key={d.index} d={d} onTick={onTick} workoutName={workoutName} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <PlanAdjust key={planWeekdays(template, snap.plan).join()} snap={snap} onChange={onChange} edits={edits} />

      <BadgeLine state={state} />
      <Journal snap={snap} state={state} />

      <div className="wrap">
        <div className="actions">
          <button className="btn ghost wide" onClick={onChange}>
            {T.change}
          </button>
          <button className="btn ghost wide" onClick={onStop}>
            {T.end}
          </button>
        </div>
        <SupportLine seed={state.log.length + 2} />
      </div>
    </>
  );
}

/* ---------------- Wejście ---------------- */

/** Zmiany planu w trakcie — od dziś, bez przepisywania tego, co minęło. */
export interface PlanEdits {
  onWeekdays: (days: number[]) => void;
  onPolicy: (p: PlanPolicy) => void;
  onExtend: (weeks: number) => void;
  /** Start treningu dodatkowego z podpowiedzi. */
  onStart: (workoutId: string) => void;
}

/**
 * Sekcja Plan zakładki Trening: uruchomiony plan z kalendarzem albo — gdy żadnego nie ma —
 * katalog planów. Przełącznik sekcji stoi nad jednym i drugim. Zmiana planu prowadzi do
 * katalogu pod własnym adresem (`#/plany`, podstrona bez przełącznika), więc „wstecz” wraca
 * do kalendarza.
 */
export function PlanView({
  state,
  onStop,
  onTick,
  onFrequency,
  edits,
}: {
  state: AppState;
  onStop: () => void;
  onTick: (index: number) => void;
  onFrequency: (days: number) => void;
  edits: PlanEdits;
}) {
  const snap = snapshot(state);
  return (
    <>
      <div className="wrap">
        <SectionSwitch on="plan" />
      </div>
      {snap ? (
        <ActivePlanView
          state={state}
          snap={snap}
          onChange={() => go(PLANS_PATH)}
          onStop={onStop}
          onTick={onTick}
          onFrequency={onFrequency}
          edits={edits}
        />
      ) : (
        <PlanCatalog state={state} />
      )}
    </>
  );
}

/** O ile przedłużyć plan jednym stuknięciem: miesiąc, czyli tyle, ile trwa krótki plan z celem. */
const EXTEND_WEEKS = 4;

/**
 * Zmiana planu od dziś: dni treningowe, zasada przepadłych terminów i przedłużenie. Nowe dni
 * działają od dziś — terminy, które minęły, zostają, razem z punktami, seriami i odznakami.
 */
function PlanAdjust({ snap, onChange, edits }: { snap: Snapshot; onChange: () => void; edits: PlanEdits }) {
  const { template, plan, stats } = snap;
  const now = planWeekdays(template, plan);
  const [days, setDays] = useState<number[]>(now);
  const policy = planPolicy(plan);
  const total = planWeeks(template, plan);
  const ending = !stats.next || stats.week >= total - 1;
  const changed = days.join() !== now.join();
  return (
    <details className="grp adjust" open={ending}>
      <summary>
        <h2>{T.adjust}</h2>
      </summary>
      <p className="tight">{T.adjustText}</p>
      <span className="seg-label">{T.trainingDaysLow}</span>
      <Weekdays value={days} onChange={setDays} />
      <button className="btn sm" disabled={!changed || !days.length} onClick={() => edits.onWeekdays(days)}>
        {T.saveDays}
      </button>
      <span className="seg-label" style={{ marginTop: 12 }}>
        {T.whenMissed}
      </span>
      <Segmented
        label={T.whenMissedLabel}
        options={[
          { key: 'shift' as PlanPolicy, label: T.waits },
          { key: 'fixed' as PlanPolicy, label: T.lost },
        ]}
        value={policy}
        onChange={(p) => p !== policy && edits.onPolicy(p)}
      />
      <p className="tight">{T.lasts(total, plan.extraWeeks, ending)}</p>
      <div className="btnrow">
        <button className="btn sm ghost" onClick={() => edits.onExtend(EXTEND_WEEKS)}>
          {T.extend(EXTEND_WEEKS)}
        </button>
        <button className="btn sm ghost" onClick={onChange}>
          {T.another}
        </button>
      </div>
    </details>
  );
}
