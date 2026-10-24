import { useState } from 'react';
import { pluralEn, text } from '../../../i18n';
import { useBridge } from '../../bridge';
import { keepAllowed, reachedApplied } from '../../diet/calibrate';
import { daysBetween, mondayOf } from '../../diet/model';
import { answerCheck } from '../../diet/store';
import { hardMinOf, impliedPace, minTargetOf, snap05 } from '../../diet/target';
import type { CheckFacts, Profile, WeekCheck } from '../../diet/types';
import { formatNumber, plural } from '../../lib/format';
import { shownCheck } from './dayText';
import { dayMonth, howHref, paceWord } from './dietFormat';
import { useKcalShown } from './kcalShown';

const n = (value: number) => formatNumber(Math.round(value), 0);

const T = text({
  pl: {
    titleChanged: (to: string, from: string) => `Od dziś cel: ${to} kcal (było ${from})`,
    titleProposal: (to: string, from: string) => `Propozycja: ${to} kcal zamiast ${from}`,
    titleReached: 'Waga docelowa osiągnięta',
    facts: (weeks: number, kg: string, plan: string, intake: string) =>
      `Ostatnie ${weeks} tygodnie: waga ${kg} na tydzień (plan: ${plan}), średnio zapisane ${intake} kcal dziennie.`,
    burnUp: 'Z zapisów i wagi wychodzi, że spalasz więcej, niż zakładał szacunek — stąd 100 kcal więcej.',
    burnDown: 'Z zapisów i wagi wychodzi, że spalasz trochę mniej, niż zakładał szacunek.',
    weightDown: 'Ważysz mniej, więc spalasz trochę mniej — 100 kcal mniej utrzyma tempo.',
    weightUp: 'Ważysz więcej, więc spalasz trochę więcej — 100 kcal więcej utrzyma tempo.',
    floorUp: (floor: string) => `Cel był poniżej Twojego bezpiecznego minimum (${floor} kcal), więc podnoszę go o 100 kcal.`,
    floorUpTo: (floor: string) => `Cel był poniżej Twojego bezpiecznego minimum (${floor} kcal), więc podnoszę go do minimum.`,
    askQuestion: 'Czy zapisujesz prawie wszystko, co jesz?',
    askHint: 'Dni zapisane tylko w części możesz oznaczyć w „Zjedzone” jako niepełne — wtedy nie liczą się do dopasowania.',
    reachedBody: (trend: string, target: string, maint: string) =>
      `Trend wagi: ${trend} kg, waga docelowa: ${target} kg. Od dziś cel to utrzymanie: ${maint} kcal dziennie. Przez pierwsze dni waga może pokazać trochę więcej — to woda i glikogen, nie tłuszcz.`,
    reachedProposal: (trend: string, target: string, maint: string) =>
      `Trend wagi: ${trend} kg, waga docelowa: ${target} kg. Na utrzymanie wystarczy ok. ${maint} kcal dziennie.`,
    reachedPlain: 'Od dziś dziennik podpowiada posiłki na utrzymanie wagi.',
    ok: 'Dobrze',
    keep: (from: string) => `Zostaw ${from} kcal`,
    keepDoctor: 'Zostaw — ustalony z lekarzem albo dietetykiem',
    yes: (to: string) => `Tak — ustaw ${to} kcal`,
    no: (from: string) => `Nie zawsze — zostaw ${from} kcal`,
    set: (to: string) => `Ustaw ${to} kcal`,
    later: 'Nie teraz',
    keepLosing: 'Chcę dalej chudnąć',
    keepGaining: 'Chcę dalej przybierać',
    maintain: 'Przejdź na utrzymanie',
    notYet: 'Jeszcze nie',
    keptPace: (from: string, pace: string) => `Cel zostaje: ${from} kcal. Przy nim tempo wyjdzie ok. ${pace} na tydzień.`,
    kept: (from: string) => `Cel zostaje: ${from} kcal.`,
    newTarget: (to: string) => `Nowy cel: ${to} kcal.`,
    maintenance: (to: string) => `Utrzymanie: ${to} kcal dziennie.`,
    back: (kcal: string) => `Wracam do poprzedniego celu: ${kcal} kcal. Zapytam znowu za 4 tygodnie.`,
    how: 'Jak liczę cel',
    details: 'Szczegóły',
    burnLabel: 'Spalanie z zapisów i wagi:',
    burn: (obs: string, se: string) => `ok. ${obs} kcal (±${se})`,
    estimateLabel: 'Szacunek w celu:',
    estimateSame: (before: string) => `${before} kcal — bez zmian`,
    estimate: (before: string, after: string) => `przed ${before} kcal, po ${after} kcal`,
    dataLabel: 'Dane:',
    data: (count: number, complete: number, span: number) =>
      `${count} ${plural(count, 'ważenie', 'ważenia', 'ważeń')}, pełne zapisy z ${complete} z ${span} dni`,
    periodLabel: 'Okres:',
    same: (t: string, facts: string) => `Ten tydzień: cel bez zmian (${t} kcal). ${facts}`,
    noisy: 'Waga mocno skacze z dnia na dzień — ważenie codziennie rano da pewniejszy wynik.',
    held: 'Cel zmienił się niedawno — z kolejną zmianą poczekam kilka tygodni.',
    floor: (f: string) =>
      `Niżej niż ${f} kcal nie schodzę — to bezpieczne minimum. Tempo może być trochę wolniejsze i to jest w porządku.`,
    lossFast: 'Chudniesz szybciej, niż zakłada plan — celu nie obniżam.',
    lossSlow: 'Chudniesz wolniej, niż zakłada plan — celu nie podnoszę.',
    gainSlow: 'Przybierasz wolniej, niż zakłada plan — celu nie obniżam.',
    gainFast: 'Przybierasz szybciej, niż zakłada plan — celu nie podnoszę.',
    keepDown: 'Waga spada — celu nie obniżam.',
    keepUp: 'Waga rośnie — celu nie podnoszę.',
    missing: (t: string, count: number, days: number) =>
      `Ten tydzień: cel bez zmian (${t} kcal). Do dopasowania potrzebuję co najmniej 5 ważeń z 2 tygodni i pełnych zapisów z ¾ dni — teraz ${count} ${plural(count, 'ważenie', 'ważenia', 'ważeń')} i pełne zapisy z ${days} ${days === 1 ? 'dnia' : 'dni'}.`,
    settleStart: (t: string) =>
      `Ten tydzień: cel bez zmian (${t} kcal). Dopasowanie zacznę po ok. 4–5 tygodniach ważenia i zapisów — pierwsze 2 tygodnie to głównie woda.`,
    settleChange: (t: string) =>
      `Ten tydzień: cel bez zmian (${t} kcal). Po zmianie celu pierwsze 2 tygodnie to głównie woda — dopasowanie wróci za 2–3 tygodnie.`,
    settlePause: (t: string) =>
      `Ten tydzień: cel bez zmian (${t} kcal). Po przerwie dopasowanie wróci, gdy zbiorą się 2 tygodnie nowych danych.`,
    implausible: (t: string) =>
      `Ten tydzień: cel bez zmian (${t} kcal). Zapisy i waga tym razem do siebie nie pasują — to się zdarza przy wahaniach wody albo dniach zapisanych w części. Sprawdzę znowu za tydzień.`,
  },
  en: {
    titleChanged: (to: string, from: string) => `New target from today: ${to} kcal (was ${from})`,
    titleProposal: (to: string, from: string) => `Suggestion: ${to} kcal instead of ${from}`,
    titleReached: 'Target weight reached',
    facts: (weeks: number, kg: string, plan: string, intake: string) =>
      `The last ${weeks} weeks: weight ${kg} a week (plan: ${plan}), ${intake} kcal a day logged on average.`,
    burnUp: 'Your logs and weight show you burn more than the estimate assumed — hence 100 kcal more.',
    burnDown: 'Your logs and weight show you burn a little less than the estimate assumed.',
    weightDown: 'You weigh less, so you burn a little less — 100 kcal less keeps the pace.',
    weightUp: 'You weigh more, so you burn a little more — 100 kcal more keeps the pace.',
    floorUp: (floor: string) => `Your target was below your safe minimum (${floor} kcal), so I’m raising it by 100 kcal.`,
    floorUpTo: (floor: string) => `Your target was below your safe minimum (${floor} kcal), so I’m raising it to the minimum.`,
    askQuestion: 'Do you log almost everything you eat?',
    askHint: 'You can mark partly logged days as incomplete under “Eaten” — then they don’t count when I fit your target.',
    reachedBody: (trend: string, target: string, maint: string) =>
      `Weight trend: ${trend} kg, target weight: ${target} kg. From today the target is maintenance: ${maint} kcal a day. For the first few days the scale may show a little more — that’s water and glycogen, not fat.`,
    reachedProposal: (trend: string, target: string, maint: string) =>
      `Weight trend: ${trend} kg, target weight: ${target} kg. About ${maint} kcal a day keeps it there.`,
    reachedPlain: 'From today the diary suggests meals for keeping your weight.',
    ok: 'OK',
    keep: (from: string) => `Keep ${from} kcal`,
    keepDoctor: 'Keep it — agreed with a doctor or dietitian',
    yes: (to: string) => `Yes — set ${to} kcal`,
    no: (from: string) => `Not always — keep ${from} kcal`,
    set: (to: string) => `Set ${to} kcal`,
    later: 'Not now',
    keepLosing: 'I want to keep losing',
    keepGaining: 'I want to keep gaining',
    maintain: 'Switch to maintenance',
    notYet: 'Not yet',
    keptPace: (from: string, pace: string) => `Target stays at ${from} kcal. At that, the pace comes to about ${pace} a week.`,
    kept: (from: string) => `Target stays at ${from} kcal.`,
    newTarget: (to: string) => `New target: ${to} kcal.`,
    maintenance: (to: string) => `Maintenance: ${to} kcal a day.`,
    back: (kcal: string) => `Back to your previous target: ${kcal} kcal. I’ll ask again in 4 weeks.`,
    how: 'How I work out the target',
    details: 'Details',
    burnLabel: 'Burn from your logs and weight:',
    burn: (obs: string, se: string) => `about ${obs} kcal (±${se})`,
    estimateLabel: 'Estimate behind the target:',
    estimateSame: (before: string) => `${before} kcal — unchanged`,
    estimate: (before: string, after: string) => `before ${before} kcal, after ${after} kcal`,
    dataLabel: 'Data:',
    data: (count: number, complete: number, span: number) =>
      `${count} ${pluralEn(count, 'weigh-in', 'weigh-ins')}, full logs on ${complete} of ${span} days`,
    periodLabel: 'Period:',
    same: (t: string, facts: string) => `This week: target unchanged (${t} kcal). ${facts}`,
    noisy: 'Your weight jumps a lot from day to day — weighing every morning gives a surer result.',
    held: 'Your target changed recently — I’ll wait a few weeks before another change.',
    floor: (f: string) => `I won’t go below ${f} kcal — that’s the safe minimum. The pace may be a little slower, and that’s fine.`,
    lossFast: 'You’re losing faster than planned — I won’t lower the target.',
    lossSlow: 'You’re losing slower than planned — I won’t raise the target.',
    gainSlow: 'You’re gaining slower than planned — I won’t lower the target.',
    gainFast: 'You’re gaining faster than planned — I won’t raise the target.',
    keepDown: 'Your weight is going down — I won’t lower the target.',
    keepUp: 'Your weight is going up — I won’t raise the target.',
    missing: (t: string, count: number, days: number) =>
      `This week: target unchanged (${t} kcal). To fit it I need at least 5 weigh-ins over 2 weeks and full logs on ¾ of the days — so far ${count} ${pluralEn(count, 'weigh-in', 'weigh-ins')} and full logs on ${days} ${pluralEn(days, 'day', 'days')}.`,
    settleStart: (t: string) =>
      `This week: target unchanged (${t} kcal). I’ll start fitting it after about 4–5 weeks of weigh-ins and logs — the first 2 weeks are mostly water.`,
    settleChange: (t: string) =>
      `This week: target unchanged (${t} kcal). After a change of target the first 2 weeks are mostly water — fitting resumes in 2–3 weeks.`,
    settlePause: (t: string) =>
      `This week: target unchanged (${t} kcal). After a break, fitting resumes once there are 2 weeks of new data.`,
    implausible: (t: string) =>
      `This week: target unchanged (${t} kcal). Your logs and weight don’t match this time — it happens with water swings or partly logged days. I’ll check again next week.`,
  },
});

/** Below this (in the 28-day window) the quiet line says nothing yet (the check's `quietMin`). */
const QUIET_MIN = { weighIns: 3, completeDays: 7 } as const;

/** The observed weekly change of weight: „−0,6 kg” while losing, „+0,25 kg” while gaining (to 0,05). */
function weightChange(pace: number): string {
  const p = snap05(pace);
  return `${p > 0 ? '−' : p < 0 ? '+' : ''}${formatNumber(Math.abs(p), 2)} kg`;
}

/** „Ostatnie 4 tygodnie: waga −0,6 kg na tydzień (plan: −0,5 kg), średnio zapisane 1960 kcal dziennie.” */
const factsText = (facts: CheckFacts, goalPace: number): string =>
  T.facts(facts.weeks, weightChange(facts.pace), paceWord(goalPace), n(facts.intake));

/** Why the target moved, in one sentence: what the logs and the scale showed, or the safe minimum. */
function reasonText(c: WeekCheck, floor: number): string | null {
  const up = c.to > c.from;
  if (c.reason === 'floor-up') return c.to >= floor ? T.floorUpTo(n(floor)) : T.floorUp(n(floor));
  if (c.reason === 'burn') return up ? T.burnUp : T.burnDown;
  if (c.reason === 'weight') return up ? T.weightUp : T.weightDown;
  return null;
}

/**
 * Why a quiet week blocked a move (note `pace`): weight went faster toward the goal than planned
 * (no cut) or slower (no raise) — said for losing, gaining or keeping.
 */
function paceNote(c: WeekCheck): string | null {
  if (!c.facts) return null;
  const cutHeld = c.facts.pace > c.goalPace;
  if (c.goalPace > 1e-9) return cutHeld ? T.lossFast : T.lossSlow;
  if (c.goalPace < -1e-9) return cutHeld ? T.gainSlow : T.gainFast;
  return cutHeld ? T.keepDown : T.keepUp;
}

function noteText(c: WeekCheck, floor: number): string | null {
  switch (c.note) {
    case 'noisy':
      return T.noisy;
    case 'held':
      return T.held;
    case 'floor':
      return T.floor(n(floor));
    case 'pace':
      return paceNote(c);
    default:
      return null;
  }
}

/**
 * The quiet line on Monday and Tuesday of a week without a change (spec §4.2): target unchanged,
 * and why — what the check saw, what it still needs, or why it waits. Only once there is something
 * to say about: at least 3 weigh-ins and 7 complete days in the 28-day window.
 */
export function quietLineOf(p: Profile, today: string, kgNow: number): string | null {
  const c = p.lastCheck;
  if (!c || c.week !== mondayOf(today) || daysBetween(c.week, today) > 1) return null;
  const counts = c.facts ?? c.missing;
  if (counts ? counts.weighIns < QUIET_MIN.weighIns || counts.completeDays < QUIET_MIN.completeDays : c.status !== 'implausible')
    return null;
  const t = n(c.to);
  switch (c.status) {
    case 'same': {
      if (!c.facts) return null;
      const note = noteText(c, c.floor ?? minTargetOf(p, kgNow));
      return note ? `${T.same(t, factsText(c.facts, c.goalPace))} ${note}` : T.same(t, factsText(c.facts, c.goalPace));
    }
    case 'data':
      return c.missing ? T.missing(t, c.missing.weighIns, c.missing.completeDays) : null;
    case 'settling':
      return c.settle === 'change' ? T.settleChange(t) : c.settle === 'pause' ? T.settlePause(t) : T.settleStart(t);
    case 'implausible':
      return T.implausible(t);
    default:
      return null;
  }
}

/** „Szczegóły”: what the check saw, closed — the observed burn, the estimate, the data, the window. */
function Details({ facts }: { facts: CheckFacts }) {
  return (
    <details className="fd-diet-weekdetails">
      <summary>{T.details}</summary>
      <dl>
        <div>
          <dt>{T.burnLabel}</dt> <dd>{T.burn(n(facts.burn), n(facts.burnSe))}</dd>
        </div>
        <div>
          <dt>{T.estimateLabel}</dt>{' '}
          <dd>{facts.before === facts.after ? T.estimateSame(n(facts.before)) : T.estimate(n(facts.before), n(facts.after))}</dd>
        </div>
        <div>
          <dt>{T.dataLabel}</dt> <dd>{T.data(facts.weighIns, facts.completeDays, facts.spanDays)}</dd>
        </div>
        <div>
          <dt>{T.periodLabel}</dt> <dd>{`${dayMonth(facts.from)}–${dayMonth(facts.to)}`}</dd>
        </div>
      </dl>
    </details>
  );
}

type Answer = NonNullable<WeekCheck['answer']>;
interface Choice {
  answer: Answer;
  label: string;
  /** What the app's message says after it; null for a plain „Dobrze” or „Nie teraz”. */
  toast: string | null;
}

/** The two buttons of a card, main one first (spec §4.2 „Buttons per status”). */
function choicesOf(p: Profile, c: WeekCheck, kgNow: number, shown: boolean, applied: boolean): Choice[] {
  const from = n(c.from);
  const to = n(c.to);
  switch (c.status) {
    case 'changed': {
      const ok: Choice = { answer: 'ok', label: T.ok, toast: null };
      if (c.reason === 'floor-up')
        return c.from >= hardMinOf(p) ? [ok, { answer: 'keep', label: T.keepDoctor, toast: T.kept(from) }] : [ok];
      // „Zostaw” only when the kept target is safe: within the pace limits and not under the floor.
      if (!keepAllowed(p, c, kgNow)) return [ok];
      const pace = snap05(impliedPace(p, kgNow, c.from));
      return [ok, { answer: 'keep', label: T.keep(from), toast: T.keptPace(from, paceWord(pace)) }];
    }
    case 'ask':
      return [
        { answer: 'yes', label: T.yes(to), toast: T.newTarget(to) },
        { answer: 'no', label: T.no(from), toast: T.kept(from) },
      ];
    case 'suggested':
      return [
        { answer: 'set', label: T.set(to), toast: T.newTarget(to) },
        { answer: 'later', label: T.later, toast: null },
      ];
    case 'reached': {
      if (!applied)
        return [
          { answer: 'set', label: T.maintain, toast: shown ? T.maintenance(to) : null },
          { answer: 'continue', label: T.notYet, toast: null },
        ];
      const gaining = (p.reached?.prevPace ?? 0) < 0;
      const prev = p.reached?.prevKcal;
      return [
        { answer: 'ok', label: T.ok, toast: null },
        {
          answer: 'continue',
          label: gaining ? T.keepGaining : T.keepLosing,
          toast: shown && prev !== undefined ? T.back(n(prev)) : null,
        },
      ];
    }
    default:
      return [];
  }
}

function Card({ profile, check: c, today, kgNow }: { profile: Profile; check: WeekCheck; today: string; kgNow: number }) {
  const bridge = useBridge();
  const shown = useKcalShown();
  const [busy, setBusy] = useState(false);
  const applied = reachedApplied(c);
  const floor = c.floor ?? minTargetOf(profile, kgNow);
  const reached = c.status === 'reached';
  const title =
    c.status === 'changed' ? T.titleChanged(n(c.to), n(c.from)) : reached ? T.titleReached : T.titleProposal(n(c.to), n(c.from));
  const trend = profile.reached?.kg ?? c.facts?.trendKg ?? null;
  const body = reached
    ? !shown || trend === null
      ? T.reachedPlain
      : (applied ? T.reachedBody : T.reachedProposal)(formatNumber(trend, 1), formatNumber(profile.targetWeightKg, 1), n(c.to))
    : reasonText(c, floor);
  const choices = choicesOf(profile, c, kgNow, shown, applied);

  const reply = (choice: Choice) => {
    if (busy) return;
    setBusy(true);
    void answerCheck(choice.answer, { today, kgNow })
      .then(() => {
        if (choice.toast) bridge.toast(choice.toast);
      })
      .finally(() => setBusy(false));
  };

  return (
    <section className="grp fd-diet-weekcard" aria-labelledby="fd-diet-week-title">
      <h2 id="fd-diet-week-title">{title}</h2>
      {!reached && c.facts && <p className="tight">{factsText(c.facts, c.goalPace)}</p>}
      {body && <p className="tight">{body}</p>}
      {c.status === 'ask' && (
        <>
          <p className="tight fd-diet-ask">{T.askQuestion}</p>
          <p className="tight fd-diet-soft">{T.askHint}</p>
        </>
      )}
      {shown && c.facts && <Details facts={c.facts} />}
      <div className="actions fd-diet-weekacts">
        {choices.map((choice, i) => (
          <button
            key={choice.answer}
            type="button"
            className={i === 0 ? 'btn sm' : 'btn ghost sm'}
            disabled={busy}
            onClick={() => reply(choice)}
          >
            {choice.label}
          </button>
        ))}
        {shown && (
          <a className="fd-diet-link" href={howHref}>
            {T.how} <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </section>
  );
}

interface Props {
  profile: Profile;
  today: string;
  /** The weight the check and its answers use: the display trend today, else the start weight. */
  kgNow: number;
}

/**
 * The Monday check in the diary (spec §4.2), shown on today's page only: the card while a change,
 * a proposal or the reached target waits for an answer — the new target, what the last weeks
 * showed, one reason and two answers — otherwise, on Monday and Tuesday, one quiet line saying the
 * target stays and why. Without calories on screen only the numberless reached card is left.
 */
export function WeekCheckCard({ profile, today, kgNow }: Props) {
  const shown = useKcalShown();
  const check = shownCheck(profile, shown);
  if (check) return <Card profile={profile} check={check} today={today} kgNow={kgNow} />;
  const quiet = shown ? quietLineOf(profile, today, kgNow) : null;
  if (!quiet) return null;
  const facts = profile.lastCheck?.status === 'same' ? profile.lastCheck.facts : null;
  return (
    <div className="wrap fd-diet-weekline">
      <p className="tight fd-diet-soft">{quiet}</p>
      {facts && <Details facts={facts} />}
    </div>
  );
}
