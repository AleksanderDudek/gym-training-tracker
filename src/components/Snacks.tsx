import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { EX, WEIGHTED, ex, ladderFor } from '../data/exercises';
import { step } from '../engine/plan';
import { achCtx, exerciseProgress, formatTier, formatValue } from '../engine/badges';
import { clock, exFamilyId } from '../engine/exbadges';
import { addDays, dayKey, weekdayOf } from '../engine/schedule';
import {
  recentExercises,
  snackHint,
  snackMax,
  snackStats,
  snacksByExercise,
  snacksOf,
  snacksOn,
} from '../engine/snacks';
import { periodValue } from '../engine/volume';
import { XP, snackXpLeft } from '../engine/xp';
import { SNACK_EMPTY, daySeed, pick, plural } from '../engine/quips';
import { LOCALE, pluralEn, text } from '../i18n';
import { go, goBack, snackAddPath, snacksPath, statsPath } from '../routing';
import { Timer } from './Timer';
import { ExercisePicker } from './ExercisePicker';
import type { AppState, ExerciseId, Snack } from '../types';

/**
 * Przekąski ruchowe: zapis krótkiej serii poza treningiem.
 *
 * Droga jest zawsze ta sama: ćwiczenie → liczba → zapis. Na ekranie sesji stoją same
 * ćwiczenia, bez liczb — stuknięcie prowadzi do widoku, w którym wpisuje się, ile było.
 * Gotowa liczba na przycisku („Przysiad ×15”, zapis jednym stuknięciem) była szybsza,
 * ale zapisywała to, co było ostatnio, a nie to, co jest teraz.
 *
 * Licznik dnia pojawia się dopiero po pierwszym zapisie: zero przy każdym ćwiczeniu
 * to lista rzeczy niezrobionych, a nie zaproszenie.
 */

export type LogSnack = (ex: ExerciseId, reps: number, w: number | null) => void;

// i18n-ignore: polska odmiana — tylko dla polskiej połowy katalogu
const SNACK_FORMS = ['przekąska', 'przekąski', 'przekąsek'] as const;
// i18n-ignore: polska odmiana — tylko dla polskiej połowy katalogu
const SNACK_FORMS_LOC = ['przekąsce', 'przekąskach', 'przekąskach'] as const;

const T = text({
  pl: {
    reps: (n: number) => `${n} powt.`,
    dm: (dd: string, mm: string) => `${dd}.${mm}`,
    weekday: ['', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'],
    inSnacks: (n: number) => `w ${n} ${plural(n, SNACK_FORMS_LOC)}`,
    today: (what: string) => `dziś ${what}`,
    shortcutAria: (name: string, now: string | null) => `${name}${now ? `, ${now}` : ''}. Zapisz przekąskę.`,
    other: 'Inne ćwiczenie',
    tag: 'Przekąska ruchowa',
    cardToday: (n: number, xp: number) => `Dziś ${n} ${plural(n, SNACK_FORMS)} · +${xp} XP`,
    cardLeft: (n: number) => `Jeszcze ${n} ${plural(n, SNACK_FORMS)} da dziś doświadczenie.`,
    cardCap: 'Limit doświadczenia z przekąsek na dziś wyczerpany — kolejne liczą się do odznak.',
    cardEmpty: 'Krótka seria poza treningiem',
    cardEmptyText:
      'Wybierz ćwiczenie, a liczbę wpiszesz na następnym ekranie. Przekąska nie zmienia planu ani poziomów — rośnie za to postać i odznaki ćwiczeń.',
    cardLink: 'Przekąski — dziś, tydzień i historia →',
    bothSources: (snacks: string, count: number, workout: string) =>
      `${snacks} w ${count} ${plural(count, SNACK_FORMS_LOC)} i ${workout} w treningu`,
    inWorkout: 'w treningu',
    exToday: 'Dziś z tym ćwiczeniem',
    perSide: ' na stronę',
    todayTotal: (where: string) => `Dziś łącznie, ${where}.`,
    dayDone: 'Rekord dnia w komplecie — wyżej już nie ma progu.',
    dayLeft: (tier: string, left: string) => `Do progu dnia (${tier}) brakuje ${left}.`,
    secs: 'sekund',
    repsSide: 'powtórzeń na stronę',
    repsWord: 'powtórzeń',
    pickFirst: 'Najpierw wybierz ćwiczenie.',
    enterSecs: 'Wpisz, ile sekund trwała przekąska.',
    enterReps: 'Wpisz, ile było powtórzeń.',
    tooMany: (max: number, timed: boolean) => `Przekąska ma najwyżej ${max}${timed ? ' s' : ' powtórzeń'} — sprawdź liczbę.`,
    leadEx: (what: string) => `Wpisz, ile było ${what}, i zapisz.`,
    leadPick: 'Wybierz ćwiczenie. Pisz nazwę — lista zawęża się przy każdej literze.',
    picker: 'ćwiczenie',
    howMany: (what: string) => `ile ${what}`,
    less: (n: number) => `Mniej o ${n}`,
    more: (n: number) => `Więcej o ${n}`,
    last: (v: string | number) => `ostatnio ${v}`,
    weight: 'ciężar',
    noWeight: 'bez ciężaru',
    save: 'Zapisz przekąskę',
    weekAria: 'Przekąski w ostatnich siedmiu dniach',
    dayAria: (wd: string, date: string, n: number) => `${wd} ${date}: ${n} ${plural(n, SNACK_FORMS)}`,
    deleteAria: (name: string, at: string) => `Usuń przekąskę: ${name} o ${at}`,
    amountIn: (amount: string, n: number) => `${amount} w ${n} ${plural(n, SNACK_FORMS_LOC)}`,
    withWorkout: (amount: string) => ` (z treningiem ${amount})`,
    rowLeft: (left: string) => ` — do progu dnia brakuje ${left}.`,
    rowDone: ' — rekord dnia w komplecie.',
    lead: 'Krótka seria poza treningiem: dziesięć przysiadów przy czajniku, minuta deski w przerwie. Kilka takich w ciągu dnia przerywa siedzenie i poprawia wydolność. Przekąska nie zmienia poziomów ćwiczeń ani planu — dokłada się za to do odznak ćwiczeń i do doświadczenia postaci.',
    add: 'Dodaj przekąskę',
    addHint: 'Wybierz ćwiczenie — liczbę wpiszesz na następnym ekranie.',
    todayLabel: 'Dziś',
    todayCount: (n: number, xp: number) => `${n} ${plural(n, SNACK_FORMS)} · +${xp} XP. `,
    todayNone: 'Dziś jeszcze bez przekąsek. ',
    xpLeft: (n: number) => `Doświadczenie da jeszcze ${n} ${plural(n, SNACK_FORMS)}.`,
    xpCap: 'Limit doświadczenia na dziś wyczerpany — kolejne przekąski liczą się do odznak.',
    week: 'Ostatnie siedem dni',
    totals: (count: number, run: number, distinct: number) =>
      `Od początku ${count} ${plural(count, SNACK_FORMS)}${run > 1 ? ` · najdłuższy ciąg ${run} dni z rzędu` : ''}${
        distinct ? ` · różnych ćwiczeń: ${distinct}` : ''
      }.`,
    earlier: 'Wcześniej',
    showAll: (n: number) => `Pokaż wszystkie dni (${n})`,
  },
  en: {
    reps: (n: number) => `${n} ${pluralEn(n, 'rep', 'reps')}`,
    dm: (dd: string, mm: string) => `${dd}/${mm}`,
    weekday: ['', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    inSnacks: (n: number) => `in ${n} ${pluralEn(n, 'snack', 'snacks')}`,
    today: (what: string) => `today ${what}`,
    shortcutAria: (name: string, now: string | null) => `${name}${now ? `, ${now}` : ''}. Log a snack.`,
    other: 'Another exercise',
    tag: 'Exercise snack',
    cardToday: (n: number, xp: number) => `Today ${n} ${pluralEn(n, 'snack', 'snacks')} · +${xp} XP`,
    cardLeft: (n: number) => `${n} more ${pluralEn(n, 'snack', 'snacks')} will earn XP today.`,
    cardCap: 'You’ve reached today’s XP limit for snacks — more still count towards badges.',
    cardEmpty: 'A short set outside your workout',
    cardEmptyText:
      'Pick an exercise and enter the number on the next screen. A snack doesn’t change your plan or levels — but your character and exercise badges grow.',
    cardLink: 'Exercise snacks — today, this week and history →',
    bothSources: (snacks: string, count: number, workout: string) =>
      `${snacks} in ${count} ${pluralEn(count, 'snack', 'snacks')} and ${workout} in your workout`,
    inWorkout: 'in your workout',
    exToday: 'Today with this exercise',
    perSide: ' per side',
    todayTotal: (where: string) => `Today in total, ${where}.`,
    dayDone: 'Day record complete — there’s no higher tier.',
    dayLeft: (tier: string, left: string) => `${left} to go to the day tier (${tier}).`,
    secs: 'seconds',
    repsSide: 'reps per side',
    repsWord: 'reps',
    pickFirst: 'Pick an exercise first.',
    enterSecs: 'Enter how many seconds the snack lasted.',
    enterReps: 'Enter how many reps you did.',
    tooMany: (max: number, timed: boolean) => `A snack is at most ${max}${timed ? ' s' : ' reps'} — check the number.`,
    leadEx: (what: string) => `Enter the number of ${what} and save.`,
    leadPick: 'Pick an exercise. Start typing its name — the list narrows with every letter.',
    picker: 'exercise',
    howMany: (what: string) => `how many ${what}`,
    less: (n: number) => `Down by ${n}`,
    more: (n: number) => `Up by ${n}`,
    last: (v: string | number) => `last time ${v}`,
    weight: 'weight',
    noWeight: 'no weight',
    save: 'Save snack',
    weekAria: 'Exercise snacks in the last seven days',
    dayAria: (wd: string, date: string, n: number) => `${wd} ${date}: ${n} ${pluralEn(n, 'snack', 'snacks')}`,
    deleteAria: (name: string, at: string) => `Delete snack: ${name} at ${at}`,
    amountIn: (amount: string, n: number) => `${amount} in ${n} ${pluralEn(n, 'snack', 'snacks')}`,
    withWorkout: (amount: string) => ` (${amount} with your workout)`,
    rowLeft: (left: string) => ` — ${left} to go to the day tier.`,
    rowDone: ' — day record complete.',
    lead: 'A short set outside your workout: ten squats while the kettle boils, a minute of plank on a break. A few of these a day break up sitting and improve your fitness. A snack doesn’t change your exercise levels or plan — but it adds to exercise badges and your character’s XP.',
    add: 'Add a snack',
    addHint: 'Pick an exercise — you’ll enter the number on the next screen.',
    todayLabel: 'Today',
    todayCount: (n: number, xp: number) => `${n} ${pluralEn(n, 'snack', 'snacks')} · +${xp} XP. `,
    todayNone: 'No snacks yet today. ',
    xpLeft: (n: number) => `${n} more ${pluralEn(n, 'snack', 'snacks')} will earn XP.`,
    xpCap: 'Today’s XP limit is reached — more snacks still count towards badges.',
    week: 'Last seven days',
    totals: (count: number, run: number, distinct: number) =>
      `${count} ${pluralEn(count, 'snack', 'snacks')} so far${run > 1 ? ` · longest streak ${run} days in a row` : ''}${
        distinct ? ` · different exercises: ${distinct}` : ''
      }.`,
    earlier: 'Earlier',
    showAll: (n: number) => `Show all days (${n})`,
  },
});

/** Liczba z jednostką ćwiczenia: „45 powt.”, „1 min 30 s”. */
export const amountOf = (id: ExerciseId, n: number): string =>
  EX[id]?.unit === 'secs' ? clock(n) : T.reps(n);

/** „Przysiad ×15”, „Deska 45 s”, „Swing ×10 · 16 kg”. */
export const snackLabel = (s: Pick<Snack, 'ex' | 'reps' | 'w'>): string => {
  const m = ex(s.ex);
  const amount = m.unit === 'secs' ? clock(s.reps) : `×${s.reps}`;
  return `${m.name} ${amount}${s.w ? ` · ${s.w} kg` : ''}`;
};

const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

const dm = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return T.dm(dd!, mm!);
};

const WEEKDAY = T.weekday;

/**
 * Skróty do ćwiczeń. Dzisiejsze na górze z tym, ile już jest, potem ostatnio robione,
 * a na start kilka ruchów bez sprzętu. Żadnych liczb do zatwierdzenia — tylko wejście
 * do widoku zapisu z wybranym ćwiczeniem.
 */
function SnackShortcuts({ state, today }: { state: AppState; today: string }) {
  const done = snacksByExercise(state, today);
  const doneIds = done.map((d) => d.ex);
  const rest = recentExercises(state, 8).filter((id) => !doneIds.includes(id));
  const ids = [...doneIds, ...rest].slice(0, Math.max(4, doneIds.length));

  return (
    <div className="snack-exs">
      {ids.map((id) => {
        const d = done.find((x) => x.ex === id);
        const now = d ? T.today(`${amountOf(id, d.total)}${d.count > 1 ? ` · ${d.count}×` : ''}`) : null;
        return (
          <button
            key={id}
            className={`snack-ex${d ? ' on' : ''}`}
            onClick={() => go(snackAddPath(id))}
            aria-label={T.shortcutAria(ex(id).name, now)}
          >
            <span className="snack-ex-name">{ex(id).name}</span>
            {now && <span className="snack-ex-now">{now}</span>}
            <span className="snack-ex-go" aria-hidden="true">
              +
            </span>
          </button>
        );
      })}
      <button className="snack-ex other" onClick={() => go(snackAddPath())}>
        <span className="snack-ex-name">{T.other}</span>
        <span className="snack-ex-go" aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  );
}

/**
 * Karta na ekranie sesji. Stoi pod treningiem z planu, nie nad nim: kto przyszedł trenować,
 * najpierw widzi trening. Licznik dnia wchodzi dopiero z pierwszą zapisaną przekąską.
 */
export function SnackCard({ state }: { state: AppState }) {
  const today = dayKey(Date.now());
  const n = snacksOn(state, today).length;
  const left = snackXpLeft(state, today);

  return (
    <div className="grp snackcard">
      <div className="today-tag light">{T.tag}</div>
      {n ? (
        <>
          <h2 className="today-name">{T.cardToday(n, Math.min(n, XP.snackCap) * XP.snack)}</h2>
          <p className="tight">{left ? T.cardLeft(left) : T.cardCap}</p>
        </>
      ) : (
        <>
          <h2 className="today-name">{T.cardEmpty}</h2>
          <p className="tight">{T.cardEmptyText}</p>
        </>
      )}
      <SnackShortcuts state={state} today={today} />
      {snacksOf(state).length > 0 && (
        <a className="vidlink" href={snacksPath()}>
          {T.cardLink}
        </a>
      )}
    </div>
  );
}

/**
 * Ile dziś tego ćwiczenia: przekąski i trening razem, i ile brakuje do progu dnia. Pokazuje
 * się dopiero, gdy jest co liczyć — po pierwszym zapisie albo po treningu z tym ruchem.
 */
function ExerciseToday({ state, id }: { state: AppState; id: ExerciseId }) {
  const today = dayKey(Date.now());
  const ctx = achCtx(state, null, null, today);
  const total = periodValue(ctx.metrics.perEx[id], 'dzien', today);
  if (!total) return null;

  const snacks = snacksByExercise(state, today).find((d) => d.ex === id);
  const fromSnacks = snacks?.total ?? 0;
  const fromWorkout = total - fromSnacks;
  const r = exerciseProgress(ctx, id).find((x) => x.ach.id === exFamilyId(id, 'dzien'));
  // Przy jednym źródle liczba stoi już wyżej, więc zdanie mówi tylko skąd; przy dwóch — ile z czego.
  const where =
    snacks && fromWorkout > 0
      ? T.bothSources(amountOf(id, fromSnacks), snacks.count, amountOf(id, fromWorkout))
      : snacks
        ? T.inSnacks(snacks.count)
        : T.inWorkout;

  return (
    <>
      <div className="sect-label">{T.exToday}</div>
      <div className="grp snack-today">
        <div className="snack-today-num">
          {amountOf(id, total)}
          {EX[id]?.side && EX[id]?.unit !== 'secs' && <small>{T.perSide}</small>}
        </div>
        <p className="tight">{T.todayTotal(where)}</p>
        {r && (
          <p className="tight">
            {r.next === null
              ? T.dayDone
              : T.dayLeft(formatTier(r.ach, r.next), formatValue(r.ach, Math.max(0, r.next - total)))}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Widok zapisu jednej przekąski. Pole liczby jest puste — podpowiedź mówi tylko, ile było
 * ostatnio. Po zapisie widok wraca tam, skąd ktoś przyszedł, a tam czeka już licznik dnia.
 */
export function SnackEntry({
  state,
  id,
  onLog,
  onToast,
}: {
  state: AppState;
  id?: ExerciseId | undefined;
  onLog: LogSnack;
  onToast: (m: string) => void;
}) {
  const initial = id && EX[id] ? id : null;
  const [exId, setExId] = useState<ExerciseId | null>(initial);
  const [reps, setReps] = useState('');
  const [w, setW] = useState<number | null>(() =>
    initial && WEIGHTED.includes(initial) ? snackHint(state, initial).w : null,
  );
  const amountRef = useRef<HTMLInputElement>(null);

  const m = exId ? ex(exId) : null;
  const timed = m?.unit === 'secs';
  const weighted = !!exId && WEIGHTED.includes(exId);
  const inc = exId ? step(exId) : 1;
  const hint = exId ? snackHint(state, exId) : { last: null, w: null };
  const what = timed ? T.secs : m?.side ? T.repsSide : T.repsWord;

  const choose = (next: ExerciseId) => {
    setExId(next);
    setReps('');
    setW(WEIGHTED.includes(next) ? snackHint(state, next).w : null);
    // Po wyborze ćwiczenia jedyne, co zostało, to liczba — fokus idzie od razu do niej.
    requestAnimationFrame(() => amountRef.current?.focus());
  };

  const bump = (dir: 1 | -1) => {
    const n = parseInt(reps || '0', 10) || 0;
    if (!n && dir < 0) return;
    setReps(String(Math.max(inc, n + dir * inc)));
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!exId) {
      onToast(T.pickFirst);
      return;
    }
    const n = parseInt(reps || '0', 10) || 0;
    if (n <= 0) {
      onToast(timed ? T.enterSecs : T.enterReps);
      amountRef.current?.focus();
      return;
    }
    if (n > snackMax(exId)) {
      onToast(T.tooMany(snackMax(exId), timed));
      return;
    }
    onLog(exId, n, weighted ? w : null);
    goBack('#/sesja');
  };

  return (
    <>
      <div className="wrap">
        <p className="lead">
          {m ? T.leadEx(what) : T.leadPick}
        </p>
      </div>

      <form className="grp snack-entry" onSubmit={save} noValidate>
        <ExercisePicker label={T.picker} value={exId} onChange={choose} autoFocus={!initial} />

        {m && exId && (
          <>
            <div className={`snack-row${weighted ? '' : ' single'}`}>
              <div className="fld">
                <span id="snack-amount">{T.howMany(what)}</span>
                <div className="stepper">
                  <button type="button" onClick={() => bump(-1)} aria-label={T.less(inc)}>
                    −
                  </button>
                  <input
                    ref={amountRef}
                    type="number"
                    inputMode="numeric"
                    enterKeyHint="done"
                    min={1}
                    max={snackMax(exId)}
                    aria-labelledby="snack-amount"
                    // Jedyna podpowiedź to własna liczba z ostatniego razu. Bez historii pole jest
                    // puste — przykładowa liczba też byłaby narzuconą.
                    placeholder={hint.last !== null ? T.last(timed ? clock(hint.last) : hint.last) : ''}
                    autoFocus={!!initial}
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                  />
                  <button type="button" onClick={() => bump(1)} aria-label={T.more(inc)}>
                    +
                  </button>
                </div>
              </div>
              {weighted && (
                <label className="fld">
                  <span>{T.weight}</span>
                  <select
                    value={w === null ? '' : String(w)}
                    onChange={(e) => setW(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">{T.noWeight}</option>
                    {ladderFor(state, exId).map((x) => (
                      <option key={x} value={x}>
                        {x} kg
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {timed && (
              <Timer
                key={exId}
                who={state.cfg.avatar ?? 'gustaw'}
                mode="stopwatch"
                target={m.def.target}
                onDone={(secs) => setReps(String(Math.max(1, secs)))}
              />
            )}

            <p className="hint">{m.hint}</p>
            <button className="btn wide" type="submit">
              {T.save}
            </button>
          </>
        )}
      </form>

      {exId && <ExerciseToday state={state} id={exId} />}
    </>
  );
}

/** Ostatnie siedem dni jako pasek kropek — widać, czy ruch rozkłada się na tydzień. */
function WeekStrip({ byDay, today }: { byDay: Record<string, number>; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <div className="snack-week" role="list" aria-label={T.weekAria}>
      {days.map((d) => {
        const n = byDay[d] ?? 0;
        return (
          <div
            key={d}
            role="listitem"
            className={`sw-day${n ? ' on' : ''}${d === today ? ' now' : ''}`}
            aria-label={T.dayAria(WEEKDAY[weekdayOf(d)]!, dm(d), n)}
          >
            <b>{n || '·'}</b>
            <span>{WEEKDAY[weekdayOf(d)]}</span>
          </div>
        );
      })}
    </div>
  );
}

function SnackItem({ s, onDelete }: { s: Snack; onDelete: (key: string) => void }) {
  const m = EX[s.ex];
  return (
    <div className="snack-item">
      <span className="snack-time">{time(s.at)}</span>
      <a className="snack-name" href={statsPath(s.ex)}>
        {m?.name ?? s.ex}
      </a>
      <span className="snack-amt">
        {m?.unit === 'secs' ? clock(s.reps) : `×${s.reps}`}
        {s.w ? ` · ${s.w} kg` : ''}
      </span>
      <button
        className="snack-del"
        onClick={() => onDelete(s.key)}
        aria-label={T.deleteAria(m?.name ?? s.ex, time(s.at))}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Dzień w rozbiciu na ćwiczenia: ile czego, w ilu przekąskach i ile brakuje do progu dnia.
 * Suma dnia liczy też trening, bo odznaka dnia liczy jedno i drugie.
 */
function TodayByExercise({ state, today }: { state: AppState; today: string }) {
  const rows = snacksByExercise(state, today);
  if (!rows.length) return null;
  const ctx = achCtx(state, null, null, today);
  return (
    <ul className="ptlist snack-targets">
      {rows.map((d) => {
        const r = exerciseProgress(ctx, d.ex).find((x) => x.ach.id === exFamilyId(d.ex, 'dzien'));
        const all = periodValue(ctx.metrics.perEx[d.ex], 'dzien', today);
        return (
          <li key={d.ex}>
            <b>{ex(d.ex).name}</b>: {T.amountIn(amountOf(d.ex, d.total), d.count)}
            {all > d.total ? T.withWorkout(amountOf(d.ex, all)) : ''}
            {r && r.next !== null
              ? T.rowLeft(formatValue(r.ach, Math.max(0, r.next - all)))
              : r
                ? T.rowDone
                : '.'}
          </li>
        );
      })}
    </ul>
  );
}

/** Przekąski: dziś, tydzień i historia. Zapis idzie przez skróty i widok zapisu. */
export function SnacksPage({ state, onDelete }: { state: AppState; onDelete: (key: string) => void }) {
  const [allHistory, setAllHistory] = useState(false);
  const today = dayKey(Date.now());
  const all = snacksOf(state);
  const stats = snackStats(all);
  const todays = snacksOn(state, today);
  const left = snackXpLeft(state, today);

  const past = [...new Set(all.map((s) => dayKey(s.at)))].filter((d) => d < today).sort().reverse();
  const shown = allHistory ? past : past.slice(0, 14);

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead}</p>
      </div>

      <div className="grp">
        <h2>{T.add}</h2>
        <p className="tight">{T.addHint}</p>
        <SnackShortcuts state={state} today={today} />
      </div>

      <div className="sect-label">{T.todayLabel}</div>
      <div className="grp">
        {/* Żart w pustym dniu stoi we własnym akapicie i rejestrze — nie miesza się z liczbami. */}
        {!todays.length && <p className="tight joke">{pick(SNACK_EMPTY, daySeed())}</p>}
        <p className="tight">
          {todays.length ? T.todayCount(todays.length, Math.min(todays.length, XP.snackCap) * XP.snack) : T.todayNone}
          {left ? T.xpLeft(left) : T.xpCap}
        </p>
        <TodayByExercise state={state} today={today} />
        {todays.map((s) => (
          <SnackItem key={s.key} s={s} onDelete={onDelete} />
        ))}
      </div>

      <div className="sect-label">{T.week}</div>
      <div className="grp">
        <WeekStrip byDay={stats.byDay} today={today} />
        <p className="tight" style={{ marginTop: 10 }}>
          {T.totals(stats.count, stats.run, stats.distinct)}
        </p>
      </div>

      {past.length > 0 && (
        <>
          <div className="sect-label">{T.earlier}</div>
          {shown.map((d) => {
            const list = snacksOn(state, d);
            return (
              <div className="h-item" key={d}>
                <div className="h-date">{dm(d)}</div>
                <div className="h-detail">{list.map((s) => snackLabel(s)).join(' · ')}</div>
                <div className="streak">{list.length}</div>
              </div>
            );
          })}
          {past.length > shown.length && (
            <div className="wrap">
              <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setAllHistory(true)}>
                {T.showAll(past.length)}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
