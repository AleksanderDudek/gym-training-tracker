import { useState } from 'react';
import {
  GOAL_PLANS,
  PROFILE_PLANS,
  LEVELS,
  LEVEL_DESC,
  LEVEL_LABEL,
  SEXES,
  SEX_LABEL,
  loadFactorFor,
  planOf,
  weekdaysFor,
} from '../data/plans';
import { RULES, autoDeload, reviewPlan, weekLayout } from '../engine/design';
import { dayKey } from '../engine/schedule';
import { plural } from '../engine/quips';
import {
  PLAN_CLASSIC_PATH,
  PLAN_NEW_PATH,
  go,
  goBack,
  planEditPath,
  planPath,
  workoutPath,
} from '../routing';
import { Chips, DesignNotes, WeeklyBars } from './Design';
import { PlanArt } from './SceneArt';
import { HealthNote } from './Health';
import { GEAR_FILTER, GEAR_WORKOUT, allWorkouts } from './Workouts';
import { EmptyState, Segmented } from './ui';
import type { AppState, PlanLevel, PlanOptions, PlanPolicy, PlanTemplate, ProfileKey, Sex, WorkoutGear } from '../types';
import { PROFILES, PROFILE_KEYS } from '../data/profiles';
import { EX } from '../data/exercises';
import { snackAddPath } from '../routing';
import { pluralEn, text } from '../i18n';

const T = text({
  pl: {
    wd: ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'niedz'],
    wdShort: ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'],
    weeks: (n: number) => plural(n, ['tydzień', 'tygodnie', 'tygodni']),
    days: (n: number) => `${n} dni`,
    perWeek: (n: number) => `${n}× w tygodniu`,
    current: 'Twój plan teraz',
    view: 'Zobacz plan',
    lead: 'Plan rozpisuje treningi na konkretne dni i pilnuje terminów. Plany z celem trwają 30, 60 albo 90 dni i składają się z treningów z biblioteki; własny ułożysz na 4–48 tygodni, a doradca sprawdzi, czy tydzień ma sens.',
    goalPlans: 'Plany z celem',
    length: 'Długość',
    anyLength: 'Każda długość',
    gear: 'Sprzęt',
    noMatch: 'Żaden plan nie pasuje do filtrów.',
    profiles: 'Ogólnorozwojowe z profilem',
    profilesText:
      'Całe ciało trzy razy w tygodniu przez 60 dni, z akcentem na to, co uprawiasz albo chcesz poprawić: ćwiczenie priorytetowe na początku, dwa dodatki na końcu i przekąski między treningami. Sprzęt wybierasz filtrem wyżej.',
    profile: 'Profil',
    needsGear: (name: string) => `${name} potrzebuje drążka albo ciężaru — wybierz kettlebell albo siłownię.`,
    yourPlans: 'Twoje plany',
    buildOwn: 'Ułóż własny plan',
    classic: 'Plan klasyczny z kettlebell',
    classicText:
      'Dwanaście tygodni na treningach A–D, z doborem poziomu, płci i liczby treningów w tygodniu od dwóch do siedmiu. Pierwszy plan tej aplikacji — dalej działa jak dotąd.',
    setClassic: 'Ustaw plan klasyczny',
    rotation: (n: number, list: string) =>
      `Rotacja ma ${n} treningi, więc w kolejnych tygodniach dni przesuwają się po kolei: ${list}.`,
    start: 'Start',
    startDay: 'dzień startu',
    trainingDays: 'dni treningowe',
    daysMismatch: (plan: number, picked: number) =>
      `Plan jest ułożony na ${plan}× w tygodniu, a wybrane są ${picked} dni. Rotacja pójdzie dalej po kolei, ale doradca liczył tydzień dla ${plan} dni.`,
    missedHead: 'gdy trening się nie odbędzie',
    missed: 'Opuszczony trening',
    waits: 'Trening czeka',
    lost: 'Trening przepada',
    startWeights: (level: string, sex: string) => `Ciężary startowe: ${level}, ${sex}`,
    startWeightsText:
      'Tylko dla ćwiczeń, których jeszcze nie robiłeś — zmierzone poziomy zostają. Płeć zmienia wyłącznie przeciętny punkt startu ciężaru, nie sposób trenowania.',
    level: 'Poziom',
    sex: 'Płeć',
    startPlan: 'Zacznij ten plan',
    noPlanTitle: 'Nie ma takiego planu',
    noPlanText: 'Mógł zostać usunięty. Wróć do katalogu i wybierz inny.',
    isCurrent: 'To twój aktualny plan.',
    calendar: 'Kalendarz i terminy →',
    week: 'Tydzień',
    deload: (weeks: number[]) =>
      `${weeks.length === 1 ? `Tydzień lżejszy: ${weeks[0]}.` : `Tygodnie lżejsze: ${weeks.join(', ')}.`} Mniej serii (z trzech zostają dwie), bez serii „ile dasz radę” i bez zmiany poziomów — zmęczenie schodzi, forma zostaje.`,
    noDeload: 'Bez tygodnia lżejszego — przy tej długości nie jest potrzebny.',
    snacks: 'Przekąski profilu',
    snacksText:
      'W dni bez treningu 1–3 krótkie serie z zapasem 2–3 powtórzeń, rozłożone w ciągu dnia — nie do zmęczenia, tylko do powtórzenia ruchu. Liczą się do odznak i doświadczenia, nie ruszają poziomów ani kalendarza.',
    expect: 'Czego się spodziewać',
    weekly: 'Serie tygodniowo',
    weeklyText: (target: number, max: number) =>
      `Ile serii tygodniowo dostaje każda partia i w ilu dniach. Zielone pole to ${target}–${max} serii — zakres, w którym przyrost opłaca się najbardziej.`,
    advisor: 'Doradca',
    editPlan: 'Edytuj plan',
    deletePlan: 'Usuń plan',
    noDeloadOpt: 'bez tygodnia lżejszego',
    every: (n: number) => `co ${n} ${plural(n, ['tydzień', 'tygodnie', 'tygodni'])}`,
    recommended: (s: string) => `${s} (zalecane)`,
    noEditTitle: 'Tego planu nie da się edytować',
    noEditText: 'Edytować można tylko własne plany.',
    needName: 'Nadaj planowi nazwę.',
    needDay: 'Wybierz przynajmniej jeden dzień tygodnia.',
    ownDesc: (days: number, weeks: number) =>
      `Własny plan: ${days}× w tygodniu przez ${weeks} ${plural(weeks, ['tydzień', 'tygodnie', 'tygodni'])}.`,
    yours: 'Twoje',
    full: 'Całe ciało',
    splits: 'Podziały',
    parts: 'Partie',
    builderLead:
      'Wybierz dni, przypisz każdemu trening i długość planu. Doradca od razu policzy serie tygodniowo na partie, przerwy między ciężkimi dniami i tygodnie lżejsze.',
    name: 'nazwa',
    namePh: 'np. Góra i dół do wakacji',
    lengthLabel: (weeks: number, min: number, max: number) =>
      `długość: ${weeks} ${plural(weeks, ['tydzień', 'tygodnie', 'tygodni'])} (od ${min} do ${max})`,
    weekLess: 'Tydzień mniej',
    weekMore: 'Tydzień więcej',
    lighter: 'tydzień lżejszy',
    lighterOne: (n: number) => `Lżejszy wypadnie w ${n}. tygodniu.`,
    lighterMany: (list: string) => `Lżejsze wypadną w tygodniach: ${list}.`,
    lighterNone: 'Żaden tydzień nie będzie lżejszy.',
    save: 'Zapisz plan',
    cancel: 'Anuluj',
  },
  en: {
    wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    wdShort: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    weeks: (n: number) => pluralEn(n, 'week', 'weeks'),
    days: (n: number) => `${n} days`,
    perWeek: (n: number) => `${n}× a week`,
    current: 'Your current plan',
    view: 'View plan',
    lead: 'A plan puts workouts on specific days and keeps an eye on deadlines. Goal plans last 30, 60 or 90 days and use workouts from the library; you can build your own for 4–48 weeks, and the advisor checks that the week makes sense.',
    goalPlans: 'Goal plans',
    length: 'Length',
    anyLength: 'Any length',
    gear: 'Equipment',
    noMatch: 'No plan matches the filters.',
    profiles: 'All-round, with a focus',
    profilesText:
      'Full body three times a week for 60 days, with a focus on your sport or what you want to improve: a priority exercise at the start, two extras at the end and exercise snacks between workouts. Pick your equipment with the filter above.',
    profile: 'Focus',
    needsGear: (name: string) => `${name} needs a bar or a weight — pick kettlebell or gym.`,
    yourPlans: 'Your plans',
    buildOwn: 'Build your own plan',
    classic: 'Classic kettlebell plan',
    classicText:
      'Twelve weeks of workouts A–D, with your choice of level, sex and two to seven workouts a week. This app’s first plan — it still works just as before.',
    setClassic: 'Set up the classic plan',
    rotation: (n: number, list: string) =>
      `The rotation has ${n} workouts, so in the following weeks the days shift along in order: ${list}.`,
    start: 'Start',
    startDay: 'start date',
    trainingDays: 'training days',
    daysMismatch: (plan: number, picked: number) =>
      `The plan is built for ${plan}× a week, and you’ve picked ${picked} days. The rotation will carry on in order, but the advisor checked the week for ${plan} days.`,
    missedHead: 'if a workout doesn’t happen',
    missed: 'Missed workout',
    waits: 'Workout waits',
    lost: 'Workout is dropped',
    startWeights: (level: string, sex: string) => `Starting weights: ${level}, ${sex}`,
    startWeightsText:
      'Only for exercises you haven’t done yet — measured levels stay. Sex only changes the average starting weight, not the way you train.',
    level: 'Level',
    sex: 'Sex',
    startPlan: 'Start this plan',
    noPlanTitle: 'No such plan',
    noPlanText: 'It may have been deleted. Go back to the catalogue and pick another.',
    isCurrent: 'This is your current plan.',
    calendar: 'Calendar and deadlines →',
    week: 'Week',
    deload: (weeks: number[]) =>
      `${weeks.length === 1 ? `Lighter week: ${weeks[0]}.` : `Lighter weeks: ${weeks.join(', ')}.`} Fewer sets (two instead of three), no “as many as you can” set and no level changes — the fatigue goes, the fitness stays.`,
    noDeload: 'No lighter week — at this length you don’t need one.',
    snacks: 'Profile exercise snacks',
    snacksText:
      'On rest days, 1–3 short sets with 2–3 reps in reserve, spread through the day — not to tire you out, just to practise the movement. They count towards badges and XP, but don’t touch your levels or the calendar.',
    expect: 'What to expect',
    weekly: 'Weekly sets',
    weeklyText: (target: number, max: number) =>
      `How many sets a week each muscle group gets, and over how many days. The green zone is ${target}–${max} sets — the range where growth pays off most.`,
    advisor: 'Advisor',
    editPlan: 'Edit plan',
    deletePlan: 'Delete plan',
    noDeloadOpt: 'no lighter week',
    every: (n: number) => `every ${n} ${pluralEn(n, 'week', 'weeks')}`,
    recommended: (s: string) => `${s} (recommended)`,
    noEditTitle: 'This plan can’t be edited',
    noEditText: 'Only your own plans can be edited.',
    needName: 'Give your plan a name.',
    needDay: 'Pick at least one day of the week.',
    ownDesc: (days: number, weeks: number) => `Your own plan: ${days}× a week for ${weeks} ${pluralEn(weeks, 'week', 'weeks')}.`,
    yours: 'Yours',
    full: 'Full body',
    splits: 'Splits',
    parts: 'Body parts',
    builderLead:
      'Pick the days, give each one a workout and choose how long the plan runs. The advisor works out weekly sets per muscle group, breaks between hard days and lighter weeks straight away.',
    name: 'name',
    namePh: 'e.g. Upper and lower till the holidays',
    lengthLabel: (weeks: number, min: number, max: number) =>
      `length: ${weeks} ${pluralEn(weeks, 'week', 'weeks')} (${min} to ${max})`,
    weekLess: 'One week less',
    weekMore: 'One week more',
    lighter: 'lighter week',
    lighterOne: (n: number) => `The lighter one falls in week ${n}.`,
    lighterMany: (list: string) => `Lighter ones fall in weeks ${list}.`,
    lighterNone: 'No week will be lighter.',
    save: 'Save plan',
    cancel: 'Cancel',
  },
});

/**
 * Plany: katalog (z celem, własne i klasyczny), podgląd z doradcą i startem oraz kreator
 * planu na 4–48 tygodni.
 */

const WD = T.wd;
const WD_SHORT = T.wdShort;

export const MIN_WEEKS = 4;
export const MAX_WEEKS = 48;

const nameOf = (state: AppState, id: string): string =>
  allWorkouts(state).find((w) => w.id === id)?.name ?? id;

/** „60 dni · 9 tygodni · 4× w tygodniu · siłownia · podstawowy”. */
function planMeta(t: PlanTemplate): string {
  return [
    t.days ? T.days(t.days) : null,
    `${t.weeks} ${T.weeks(t.weeks)}`,
    T.perWeek(t.weekdays.length),
    t.gear ? GEAR_WORKOUT[t.gear] : null,
    t.kind === 'goal' ? LEVEL_LABEL[t.level].toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function PlanCard({ t, active }: { t: PlanTemplate; active: boolean }) {
  return (
    <div className={`grp wcard${active ? ' today' : ''}`}>
      <PlanArt plan={t} />
      {active && <div className="today-tag">{T.current}</div>}
      <h2 className="today-name">{t.name}</h2>
      <p className="wmeta">{planMeta(t)}</p>
      {t.goal && <p className="tight">{t.goal}</p>}
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button className="btn sm ghost" onClick={() => go(planPath(t.id))}>
          {T.view}
        </button>
      </div>
    </div>
  );
}

type Length = 'all' | '30' | '60' | '90';

/** Karta planu klasycznego w katalogu: scena poziomu podstawowego — środek drabiny, regularność. */
const CLASSIC_CARD = { id: 'classic', kind: 'classic', level: 'base' } as const;

/** Katalog planów. Na górze plany z celem, potem własne i konfigurator klasyczny. */
export function PlanCatalog({ state }: { state: AppState }) {
  const [len, setLen] = useState<Length>('all');
  const [gear, setGear] = useState<'all' | WorkoutGear>('all');
  const active = state.plan?.templateId;
  const goals = GOAL_PLANS.filter(
    (t) => (len === 'all' || String(t.days) === len) && (gear === 'all' || t.gear === gear),
  );
  const own = state.plans ?? [];
  const [prof, setProf] = useState<ProfileKey | ''>('');
  const profiled = PROFILE_PLANS.filter((t) => t.profile === prof && (gear === 'all' || t.gear === gear));

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead}</p>
      </div>

      <div className="sect-label">{T.goalPlans}</div>
      <div className="grp">
        <Chips
          label={T.length}
          value={len}
          onChange={setLen}
          options={[
            { key: 'all', label: T.anyLength },
            { key: '30', label: T.days(30) },
            { key: '60', label: T.days(60) },
            { key: '90', label: T.days(90) },
          ]}
        />
        <Segmented label={T.gear} value={gear} onChange={setGear} options={GEAR_FILTER} />
      </div>
      {goals.map((t) => (
        <PlanCard key={t.id} t={t} active={t.id === active} />
      ))}
      {!goals.length && (
        <div className="wrap">
          <p className="tight">{T.noMatch}</p>
        </div>
      )}

      <div className="sect-label">{T.profiles}</div>
      <div className="grp">
        <p className="tight">{T.profilesText}</p>
        <Chips
          label={T.profile}
          value={prof}
          onChange={setProf}
          options={PROFILE_KEYS.map((k) => ({ key: k, label: PROFILES[k].name }))}
        />
        {prof && !profiled.length && (
          <p className="tight" style={{ marginTop: 8 }}>
            {T.needsGear(PROFILES[prof].name)}
          </p>
        )}
      </div>
      {profiled.map((t) => (
        <PlanCard key={t.id} t={t} active={t.id === active} />
      ))}

      <div className="sect-label">{T.yourPlans}</div>
      {own.map((t) => (
        <PlanCard key={t.id} t={t} active={t.id === active} />
      ))}
      <div className="wrap">
        <div className="actions">
          <button className="btn wide" onClick={() => go(PLAN_NEW_PATH)}>
            {T.buildOwn}
          </button>
        </div>
      </div>

      <div className="sect-label">{T.classic}</div>
      <div className="grp wcard">
        <PlanArt plan={CLASSIC_CARD} />
        <p className="tight">{T.classicText}</p>
        <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => go(PLAN_CLASSIC_PATH)}>
          {T.setClassic}
        </button>
      </div>
    </>
  );
}

/** Wybór dni tygodnia — siedem przełączników. */
export function Weekdays({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (wd: number) => {
    const set = new Set(value);
    if (set.has(wd)) set.delete(wd);
    else set.add(wd);
    onChange([...set].sort((a, b) => a - b));
  };
  return (
    <div className="wdays">
      {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
        <button
          type="button"
          key={wd}
          aria-pressed={value.includes(wd)}
          aria-label={WD[wd - 1]}
          onClick={() => toggle(wd)}
        >
          {WD_SHORT[wd - 1]}
        </button>
      ))}
    </div>
  );
}

/** Tydzień planu słowami: dzień i trening, z odnośnikiem do podglądu treningu. */
function WeekTable({ state, t }: { state: AppState; t: Pick<PlanTemplate, 'cycle' | 'weekdays' | 'weeks'> }) {
  const rows = weekLayout(t);
  return (
    <div className="plan-week">
      {rows.map((r) => (
        <div className="pw-row" key={r.weekday}>
          <span className="pw-day">{WD[r.weekday - 1]}</span>
          {r.workout ? <a href={workoutPath(r.workout)}>{nameOf(state, r.workout)}</a> : <span>—</span>}
        </div>
      ))}
      {t.cycle.length > rows.length && (
        <p className="tight" style={{ marginTop: 6 }}>
          {T.rotation(t.cycle.length, t.cycle.map((c) => nameOf(state, c)).join(' → '))}
        </p>
      )}
    </div>
  );
}

/**
 * Start planu: dzień, dni tygodnia, co z opuszczonym treningiem i punkt wyjścia ciężarów.
 * Poziom i płeć wpływają tylko na ciężary startowe ćwiczeń jeszcze nieskalibrowanych —
 * pierwsza seria próbna i tak zweryfikuje każdy z nich.
 */
function StartForm({
  t,
  onStart,
}: {
  t: PlanTemplate;
  onStart: (t: PlanTemplate, o: PlanOptions) => void;
}) {
  const [start, setStart] = useState(dayKey(Date.now()));
  const [weekdays, setWeekdays] = useState<number[]>(t.weekdays);
  const [policy, setPolicy] = useState<PlanPolicy>('shift');
  const [level, setLevel] = useState<PlanLevel>(t.level);
  const [sex, setSex] = useState<Sex>('any');

  return (
    <div className="grp">
      <h2>{T.start}</h2>
      <label className="fld">
        <span>{T.startDay}</span>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value || dayKey(Date.now()))} />
      </label>
      <div className="seg-label">{T.trainingDays}</div>
      <Weekdays value={weekdays} onChange={setWeekdays} />
      {weekdays.length !== t.weekdays.length && weekdays.length > 0 && (
        <p className="tight warnline" style={{ marginTop: 6 }}>
          {T.daysMismatch(t.weekdays.length, weekdays.length)}
        </p>
      )}
      <div className="seg-label" style={{ marginTop: 10 }}>
        {T.missedHead}
      </div>
      <Segmented
        label={T.missed}
        value={policy}
        onChange={setPolicy}
        options={[
          { key: 'shift', label: T.waits },
          { key: 'fixed', label: T.lost },
        ]}
      />
      <details className="why">
        <summary>{T.startWeights(LEVEL_LABEL[level].toLowerCase(), SEX_LABEL[sex].toLowerCase())}</summary>
        <div>
          <p className="tight">{T.startWeightsText}</p>
          <Segmented
            label={T.level}
            value={level}
            onChange={setLevel}
            options={LEVELS.map((k) => ({ key: k, label: LEVEL_LABEL[k] }))}
          />
          <p className="tight">{LEVEL_DESC[level]}</p>
          <Segmented label={T.sex} value={sex} onChange={setSex} options={SEXES.map((k) => ({ key: k, label: SEX_LABEL[k] }))} />
        </div>
      </details>
      <div className="actions">
        <button
          className="btn wide"
          disabled={!weekdays.length}
          onClick={() => onStart(t, { start, weekdays, policy, loadFactor: loadFactorFor(level, sex) })}
        >
          {T.startPlan}
        </button>
      </div>
      <HealthNote style={{ marginTop: 10 }} />
    </div>
  );
}

/** Podgląd planu z celem albo własnego: tydzień, mięśnie, doradca, start. */
export function PlanDetail({
  state,
  id,
  onStart,
  onDelete,
}: {
  state: AppState;
  id: string;
  onStart: (t: PlanTemplate, o: PlanOptions) => void;
  onDelete: (t: PlanTemplate) => void;
}) {
  const t = planOf(state, id);
  if (!t)
    return (
      <div className="wrap">
        <EmptyState
          title={T.noPlanTitle}
          text={T.noPlanText}
          cast={{ who: 'siwy', mood: 'wise' }}
        />
      </div>
    );
  const r = reviewPlan(state, t, allWorkouts(state));
  const active = state.plan?.templateId === t.id;

  return (
    <>
      <div className="scene-hero">
        <PlanArt plan={t} />
      </div>
      <div className="wrap">
        <h2 className="ex-h">{t.name}</h2>
        <p className="wmeta">{planMeta(t)}</p>
        {t.goal && <p className="lead">{t.goal}</p>}
        {active && (
          <p className="tight">
            {T.isCurrent} <a href="#/plan">{T.calendar}</a>
          </p>
        )}
      </div>

      <div className="grp">
        <h2>{T.week}</h2>
        <p className="tight">{t.desc}</p>
        <WeekTable state={state} t={t} />
        <p className="tight" style={{ marginTop: 8 }}>
          {t.deload?.length ? T.deload(t.deload) : T.noDeload}
        </p>
      </div>

      {t.profile && (
        <div className="grp">
          <h2>{T.snacks}</h2>
          <p className="tight">{T.snacksText}</p>
          <ul className="ptlist">
            {PROFILES[t.profile].snacks.map((x) => (
              <li key={x}>
                <a href={snackAddPath(x)}>{EX[x]?.name ?? x}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {t.expect && (
        <div className="grp">
          <h2>{T.expect}</h2>
          <p className="tight">{t.expect}</p>
        </div>
      )}

      <div className="grp">
        <h2>{T.weekly}</h2>
        <p className="tight">{T.weeklyText(RULES.weeklyTarget, RULES.weeklyMax)}</p>
        <WeeklyBars weekly={r.weekly} />
      </div>

      <div className="grp">
        <h2>{T.advisor}</h2>
        <DesignNotes notes={r.notes} />
      </div>

      <StartForm key={t.id} t={t} onStart={onStart} />

      {t.kind === 'own' && (
        <div className="wrap">
          <div className="btnrow" style={{ marginTop: 12 }}>
            <button className="btn ghost" onClick={() => go(planEditPath(t.id))}>
              {T.editPlan}
            </button>
            <button className="btn ghost" onClick={() => onDelete(t)}>
              {T.deletePlan}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const DELOAD_OPTIONS: { every: number; label: string }[] = [
  { every: 0, label: T.noDeloadOpt },
  { every: 4, label: T.every(4) },
  { every: 5, label: T.every(5) },
  { every: 6, label: T.recommended(T.every(6)) },
  { every: 8, label: T.every(8) },
];

/**
 * Kreator planu na 4–48 tygodni. Dni tygodnia, trening na każdy dzień i tydzień lżejszy,
 * a obok na żywo tydzień rozpisany na partie i uwagi doradcy.
 */
export function PlanBuilder({
  state,
  id,
  onSave,
  onToast,
}: {
  state: AppState;
  id?: string | undefined;
  onSave: (t: PlanTemplate) => void;
  onToast: (m: string) => void;
}) {
  const editing = id ? state.plans?.find((p) => p.id === id) : undefined;
  const workouts = allWorkouts(state);
  const [name, setName] = useState(editing?.name ?? '');
  const [weeks, setWeeks] = useState(editing?.weeks ?? 8);
  const [weekdays, setWeekdays] = useState<number[]>(editing?.weekdays ?? weekdaysFor(3));
  // Trening na każdy dzień tygodnia; przy zmianie dni zostaje to, co już było wybrane.
  const [byDay, setByDay] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {};
    const days = editing?.weekdays ?? weekdaysFor(3);
    const cycle = editing?.cycle ?? ['A', 'B', 'C'];
    days.forEach((d, i) => (out[d] = cycle[i % cycle.length] ?? 'A'));
    return out;
  });
  const [every, setEvery] = useState<number>(() => {
    if (!editing) return RULES.deloadEvery;
    if (editing.deloadEvery !== undefined) return editing.deloadEvery;
    // Plany zapisane przed zapamiętywaniem: odczyt z pierwszego tygodnia lżejszego, a krótki
    // plan bez niego dostaje wartość zalecaną — przy wydłużeniu tydzień lżejszy się pojawi.
    const d = editing.deload?.[0];
    return d && DELOAD_OPTIONS.some((o) => o.every === d) ? d : RULES.deloadEvery;
  });

  if (id && !editing)
    return (
      <div className="wrap">
        <EmptyState
          title={T.noEditTitle}
          text={T.noEditText}
          cast={{ who: 'siwy', mood: 'wise' }}
        />
      </div>
    );

  const days = [...weekdays].sort((a, b) => a - b);
  const cycle = days.map((d) => byDay[d] ?? 'A');
  const deload = autoDeload(weeks, every);
  const shape = { cycle, weekdays: days, weeks, deload };
  const r = reviewPlan(state, shape, workouts);

  const setDays = (v: number[]) => {
    const next = { ...byDay };
    v.forEach((d) => (next[d] ??= 'A'));
    setByDay(next);
    setWeekdays(v);
  };

  const save = () => {
    if (!name.trim()) {
      onToast(T.needName);
      return;
    }
    if (!days.length) {
      onToast(T.needDay);
      return;
    }
    const t: PlanTemplate = {
      id: editing?.id ?? `p${Date.now()}`,
      name: name.trim(),
      kind: 'own',
      level: editing?.level ?? 'base',
      sex: 'any',
      daysPerWeek: days.length,
      weeks,
      loadFactor: editing?.loadFactor ?? loadFactorFor('base', 'any'),
      cycle,
      weekdays: days,
      desc: T.ownDesc(days.length, weeks),
      deload,
      deloadEvery: every,
    };
    onSave(t);
    go(planPath(t.id), { replace: true });
  };

  const groups: { label: string; list: typeof workouts }[] = [
    { label: T.yours, list: state.workouts },
    { label: T.full, list: workouts.filter((w) => w.kind === 'full' || w.kind === 'light') },
    { label: T.splits, list: workouts.filter((w) => ['push', 'pull', 'legs', 'upper', 'lower'].includes(w.kind ?? '')) },
    {
      label: T.parts,
      list: workouts.filter((w) => ['glutes', 'chest', 'back', 'shoulders', 'arms', 'core'].includes(w.kind ?? '')),
    },
  ].filter((g) => g.list.length);

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.builderLead}</p>
      </div>

      <div className="grp builder">
        <label className="fld">
          <span>{T.name}</span>
          <input type="text" placeholder={T.namePh} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="fld" style={{ marginTop: 10 }}>
          <span id="plan-weeks">{T.lengthLabel(weeks, MIN_WEEKS, MAX_WEEKS)}</span>
          <div className="stepper">
            <button type="button" onClick={() => setWeeks(Math.max(MIN_WEEKS, weeks - 1))} aria-label={T.weekLess}>
              −
            </button>
            <input
              type="range"
              min={MIN_WEEKS}
              max={MAX_WEEKS}
              value={weeks}
              aria-labelledby="plan-weeks"
              onChange={(e) => setWeeks(Number(e.target.value))}
            />
            <button type="button" onClick={() => setWeeks(Math.min(MAX_WEEKS, weeks + 1))} aria-label={T.weekMore}>
              +
            </button>
          </div>
        </div>

        <div className="seg-label" style={{ marginTop: 10 }}>
          {T.trainingDays}
        </div>
        <Weekdays value={days} onChange={setDays} />

        {days.map((d) => (
          <label className="fld" key={d}>
            <span>{WD[d - 1]}</span>
            <select value={byDay[d] ?? 'A'} onChange={(e) => setByDay({ ...byDay, [d]: e.target.value })}>
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.list.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.gear ? ` (${GEAR_WORKOUT[w.gear]})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}

        <label className="fld">
          <span>{T.lighter}</span>
          <select value={every} onChange={(e) => setEvery(Number(e.target.value))}>
            {DELOAD_OPTIONS.map((o) => (
              <option key={o.every} value={o.every}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint" style={{ marginTop: 6 }}>
          {deload.length === 1
            ? T.lighterOne(deload[0]!)
            : deload.length
              ? T.lighterMany(deload.join(', '))
              : T.lighterNone}
        </p>
      </div>

      <div className="grp">
        <h2>{T.advisor}</h2>
        <DesignNotes notes={r.notes} />
        <WeeklyBars weekly={r.weekly} />
      </div>

      <div className="wrap">
        <div className="actions">
          <button className="btn wide" onClick={save}>
            {T.save}
          </button>
          <button className="btn ghost wide" onClick={() => goBack('#/plany')}>
            {T.cancel}
          </button>
        </div>
      </div>
    </>
  );
}
