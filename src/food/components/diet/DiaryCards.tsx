import { Copy, Droplet, Minus, Timer } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { HealthNote } from '../../../components/Health';
import { pluralEn, text } from '../../../i18n';
import { useBridge } from '../../bridge';
import type { Meal } from '../../diet/copy';
import type { DayRow, Entry } from '../../diet/db';
import {
  FAST_HOURS,
  fastState,
  hoursMinutes,
  localStamp,
  parseStamp,
  startFrom,
  suggestedStart,
} from '../../diet/fasting';
import { addDays } from '../../diet/model';
import { addWater, copyEntries, deleteEntries, saveFast, undoWater } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { WATER_STEPS, waterTargetMl } from '../../diet/water';
import { formatNumber, plural } from '../../lib/format';
import { Sheet } from '../common/Sheet';
import { dayMonthLong } from './dietFormat';
import { useKcalShown } from './kcalShown';
import { Bar } from './MacroBars';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const T = text({
  pl: {
    meals: { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja' } as Record<Meal, string>,
    mealsAcc: { breakfast: 'śniadanie', lunch: 'obiad', dinner: 'kolację' } as Record<Meal, string>,
    copyMealTo: (meal: string): ReactNode => (
      // Jeden element: w przycisku-flexie spacje na granicach osobnych kawałków tekstu znikają.
      <span>
        Kopiuj <span className="sr-only">{meal}</span> na…
      </span>
    ),
    copyDayTo: 'Kopiuj dzień na…',
    copyDayTitle: 'Kopiuj cały dzień',
    copyMealTitle: (meal: string) => `Kopiuj ${meal}`,
    entries: (n: number) => `${n} ${plural(n, 'wpis', 'wpisy', 'wpisów')}`,
    keeps: 'Kopie mają te same ilości, wartości i godziny.',
    today: 'Dziś',
    tomorrow: 'Jutro',
    otherDay: 'Inny dzień',
    copy: 'Kopiuj',
    sameDay: 'To ten sam dzień — wybierz inny.',
    copied: (n: number, where: string) => `Skopiowano ${n} ${plural(n, 'wpis', 'wpisy', 'wpisów')} na ${where}.`,
    whereToday: 'dziś',
    whereTomorrow: 'jutro',
    undo: 'Cofnij',
    undone: 'Kopia cofnięta.',
    water: 'Woda',
    waterAmount: (drunk: string, target: string) => `${drunk} l z ${target} l`,
    waterAdd: (ml: number) => `Dodaj ${ml} ml wody`,
    waterUndo: (ml: number) => `Cofnij ostatnie: ${ml} ml`,
    waterHint: 'Z napojów, bez wody w jedzeniu. Cel i wyłączenie karty — w profilu diety.',
    fastTitle: 'Okno jedzenia',
    fasting: (start: string, left: string) => `Post od ${start} · zostało ${left}`,
    fastingDone: (start: string, hours: number, at: string) => `Post od ${start} · zaplanowane ${hours} h minęło o ${at}`,
    window: (until: string) => `Okno jedzenia do ${until}`,
    windowOver: (until: string) => `Okno jedzenia skończyło się o ${until}.`,
    idle: 'Post zaczyna się, kiedy kończysz jeść. Podpowiadam godzinę ostatniego wpisu — zmień ją, jeśli trzeba.',
    startField: 'Początek postu',
    start: 'Zaczynam post',
    end: 'Kończę post',
    started: (time: string) => `Post od ${time}.`,
    ended: (duration: string) => `Post zakończony po ${duration}.`,
    tomorrowMark: ' (jutro)',
    noTarget: 'Okno nie zmienia celu dnia — liczy się to, co i ile zjesz, nie kiedy.',
    hm: (h: number, min: number) => (h && min ? `${h} h ${min} min` : h ? `${h} h` : `${min} min`),
  },
  en: {
    meals: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' } as Record<Meal, string>,
    mealsAcc: { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner' } as Record<Meal, string>,
    copyMealTo: (meal: string): ReactNode => (
      <span>
        Copy <span className="sr-only">{meal}</span> to…
      </span>
    ),
    copyDayTo: 'Copy day to…',
    copyDayTitle: 'Copy the whole day',
    copyMealTitle: (meal: string) => `Copy ${meal}`,
    entries: (n: number) => `${n} ${pluralEn(n, 'entry', 'entries')}`,
    keeps: 'Copies keep the same amounts, values and times.',
    today: 'Today',
    tomorrow: 'Tomorrow',
    otherDay: 'Another day',
    copy: 'Copy',
    sameDay: 'That’s the same day — pick another one.',
    copied: (n: number, where: string) => `Copied ${n} ${pluralEn(n, 'entry', 'entries')} to ${where}.`,
    whereToday: 'today',
    whereTomorrow: 'tomorrow',
    undo: 'Undo',
    undone: 'Copy undone.',
    water: 'Water',
    waterAmount: (drunk: string, target: string) => `${drunk} l of ${target} l`,
    waterAdd: (ml: number) => `Add ${ml} ml of water`,
    waterUndo: (ml: number) => `Take back the last ${ml} ml`,
    waterHint: 'From drinks, not counting the water in food. Target and hiding the card — in the diet profile.',
    fastTitle: 'Eating window',
    fasting: (start: string, left: string) => `Fasting since ${start} · ${left} to go`,
    fastingDone: (start: string, hours: number, at: string) => `Fasting since ${start} · the planned ${hours} h passed at ${at}`,
    window: (until: string) => `Eating window until ${until}`,
    windowOver: (until: string) => `The eating window ended at ${until}.`,
    idle: 'A fast starts when you stop eating. I suggest the time of your last entry — change it if you need to.',
    startField: 'Fast started at',
    start: 'Start fasting',
    end: 'End the fast',
    started: (time: string) => `Fasting since ${time}.`,
    ended: (duration: string) => `Fast ended after ${duration}.`,
    tomorrowMark: ' (tomorrow)',
    noTarget: 'The window doesn’t change the day’s target — what counts is what and how much you eat, not when.',
    hm: (h: number, min: number) => (h && min ? `${h} h ${min} min` : h ? `${h} h` : `${min} min`),
  },
});

/** Nazwa pory posiłku w nagłówku listy „Zjedzone”. */
export const mealName = (meal: Meal): string => T.meals[meal];

/**
 * „Kopiuj na…” przy porze posiłku: na ekranie krótko, czytnik ekranu słyszy „Kopiuj śniadanie na…” —
 * trzy takie same przyciski w jednej karcie byłyby nie do odróżnienia.
 */
export const CopyMealLabel = ({ meal }: { meal: Meal }) => T.copyMealTo(T.mealsAcc[meal]);

export const COPY_DAY_TO = T.copyDayTo;

/** „na dziś”, „na jutro”, „na 5 listopada” — dokąd poszła kopia. */
function whereTo(date: string, today: string): string {
  if (date === today) return T.whereToday;
  if (date === addDays(today, 1)) return T.whereTomorrow;
  return dayMonthLong(date);
}

/**
 * Kopia z „Cofnij” w komunikacie: jedna transakcja, a „Cofnij” usuwa dokładnie skopiowane wpisy.
 * Wspólne dla „Kopiuj na…” i „Jak wczoraj”.
 */
export function useCopy() {
  const bridge = useBridge();
  return async (entries: readonly Entry[], to: string, today: string) => {
    const ids = await copyEntries(entries, to);
    if (!ids.length) return;
    bridge.toast(T.copied(ids.length, whereTo(to, today)), {
      label: T.undo,
      run: () => void deleteEntries(ids).then(() => bridge.toast(T.undone)),
    });
  };
}

/**
 * „Kopiuj na…”: cały dzień albo jedna pora posiłku na dziś, jutro albo inny dzień. Kopie mają te
 * same ilości i godziny, więc śniadanie zostaje śniadaniem. Po wyborze arkusz się zamyka — komunikat
 * z „Cofnij” stoi wtedy na wierzchu, a nie pod arkuszem. Dzień, z którego się kopiuje, nie jest do
 * wyboru: „Dziś” znika, gdy ogląda się dziś, „Jutro” — gdy jutro.
 */
export function CopySheet({
  open,
  meal,
  entries,
  from,
  today,
  onClose,
}: {
  open: boolean;
  /** Pora posiłku; `null` — cały dzień. */
  meal: Meal | null;
  entries: readonly Entry[];
  /** Dzień, z którego się kopiuje. */
  from: string;
  today: string;
  onClose: () => void;
}) {
  const shown = useKcalShown();
  const copy = useCopy();
  const [busy, setBusy] = useState(false);
  const tomorrow = addDays(today, 1);
  const kcal = entries.reduce((sum, e) => sum + e.kcal, 0);

  const to = (date: string) => {
    if (busy || date === from || !entries.length) return;
    setBusy(true);
    void copy(entries, date, today).finally(() => {
      setBusy(false);
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={meal ? T.copyMealTitle(T.mealsAcc[meal]) : T.copyDayTitle}
      subtitle={`${T.entries(entries.length)}${shown ? ` · ${formatNumber(kcal, 0)} kcal` : ''}`}
      className="fd-diet-sheet"
    >
      {open && (
        <div className="fd-diet-copy">
          <p className="tight">{T.keeps}</p>
          <div className="actions fd-diet-copy-days">
            {from !== today && (
              <button type="button" className="btn" disabled={busy} onClick={() => to(today)}>
                {T.today}
              </button>
            )}
            {from !== tomorrow && (
              <button type="button" className="btn" disabled={busy} onClick={() => to(tomorrow)}>
                {T.tomorrow}
              </button>
            )}
          </div>
          <OtherDay from={from} busy={busy} onPick={to} />
        </div>
      )}
    </Sheet>
  );
}

/** „Inny dzień”: pole daty i „Kopiuj”; ten sam dzień, z którego się kopiuje, mówi to pod polem. */
function OtherDay({ from, busy, onPick }: { from: string; busy: boolean; onPick: (date: string) => void }) {
  const id = useId();
  const [date, setDate] = useState('');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const same = date === from;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && !same) onPick(date);
  };
  return (
    <form className="fd-diet-copy-other" onSubmit={submit} noValidate>
      <label className="fld" htmlFor={id}>
        <span>{T.otherDay}</span>
        <input
          id={id}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={same || undefined}
          aria-describedby={same ? `${id}-same` : undefined}
        />
      </label>
      <button type="submit" className="btn ghost" disabled={busy || !valid || same}>
        <Copy {...ICON} /> {T.copy}
      </button>
      {same && (
        <p className="fd-diet-err" id={`${id}-same`}>
          {T.sameDay}
        </p>
      )}
    </form>
  );
}

/** Litry jak na etykiecie: 1,25 l, 2 l. */
const litres = (ml: number) => formatNumber(ml / 1000, 2);

/**
 * Woda pod „Zjedzone”: ile wypite z napojów i cel (EFSA albo własny z profilu), sam pasek bez oceny
 * dnia. „+250 ml” i „+500 ml” dopisują, „−” cofa ostatnie dodanie. Dzień przyszły karty nie ma.
 */
export function WaterCard({ date, day, profile }: { date: string; day: DayRow; profile: Profile }) {
  const water = day.water ?? 0;
  const target = waterTargetMl(profile);
  const last = day.waterAdds?.at(-1) ?? 250;
  const amount = T.waterAmount(litres(water), litres(target));
  return (
    <section className="grp fd-diet-water" aria-labelledby="fd-diet-water-title">
      <div className="fd-diet-water-head">
        <h2 id="fd-diet-water-title">
          <Droplet {...ICON} /> {T.water}
        </h2>
        <span className="fd-diet-nums fd-diet-water-num" aria-live="polite">
          {amount}
        </span>
      </div>
      <Bar value={water} target={target} label={T.water} unit="g" valueText={amount} />
      <div className="actions fd-diet-water-acts">
        {WATER_STEPS.map((ml) => (
          <button key={ml} type="button" className="btn ghost sm" aria-label={T.waterAdd(ml)} onClick={() => void addWater(date, ml)}>
            +{ml} ml
          </button>
        ))}
        <button
          type="button"
          className="btn ghost sm fd-diet-water-undo"
          aria-label={T.waterUndo(last)}
          disabled={water === 0}
          onClick={() => void undoWater(date)}
        >
          <Minus {...ICON} />
        </button>
      </div>
      <p className="tight fd-diet-soft">{T.waterHint}</p>
    </section>
  );
}

/** Godzina z zapisu, z „(jutro)”, gdy to już następny dzień. */
function timeOf(stamp: string, today: string): string {
  return `${stamp.slice(11, 16)}${stamp.slice(0, 10) > today ? T.tomorrowMark : ''}`;
}

/** Prawdziwe „teraz” w chwili stuknięcia — zegar karty może się spóźniać o pół minuty. */
const clockNow = () => new Date();

const duration = (minutes: number) => {
  const { h, min } = hoursMinutes(minutes);
  return T.hm(h, min);
};

/**
 * Okno jedzenia (post przerywany) — tylko dziś i tylko z opcją włączoną w profilu. Własny zegar co
 * 30 s, żeby „zostało” szło bez przeładowania. Start postu podpowiada ostatni wpis dnia, ale
 * zapisuje go człowiek; „Kończę post” zapisuje teraz. Okno nie dotyka celu — jeden cel na dzień.
 */
export function FastCard({ profile, today, entries }: { profile: Profile; today: string; entries: readonly Entry[] }) {
  const bridge = useBridge();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const plan = profile.fastPlan;
  if (!plan) return null;
  const state = fastState(profile.fast, plan, now);

  const end = () => {
    if (state.kind !== 'fasting') return;
    const at = clockNow();
    setNow(at);
    const minutes = Math.max(0, Math.round((at.getTime() - parseStamp(state.start).getTime()) / 60_000));
    void saveFast({ start: state.start, end: localStamp(at) }).then(() => bridge.toast(T.ended(duration(minutes))));
  };

  return (
    <section className="grp fd-diet-fast" aria-labelledby="fd-diet-fast-title">
      <h2 id="fd-diet-fast-title">
        <Timer {...ICON} />
        <span>
          {T.fastTitle}
          <span className="fd-diet-h-meta"> · {plan}</span>
        </span>
      </h2>
      {state.kind === 'fasting' ? (
        <>
          <p className="tight fd-diet-fast-now" aria-live="polite">
            {state.left > 0
              ? T.fasting(timeOf(state.start, today), duration(state.left))
              : T.fastingDone(timeOf(state.start, today), FAST_HOURS[plan], timeOf(state.until, today))}
          </p>
          <div className="actions">
            <button type="button" className="btn" onClick={end}>
              {T.end}
            </button>
          </div>
        </>
      ) : (
        <>
          {state.kind === 'eating' && (
            <p className="tight fd-diet-fast-now">
              {state.open ? T.window(timeOf(state.until, today)) : T.windowOver(timeOf(state.until, today))}
            </p>
          )}
          {/* Kluczem stan: po końcu postu pole zaczyna od świeżej podpowiedzi. */}
          <StartFast key={`${state.kind}:${profile.fast?.end ?? ''}`} entries={entries} now={now} onStart={setNow} />
        </>
      )}
      <p className="tight fd-diet-soft">{T.noTarget}</p>
      <HealthNote kind="fast" more className="tight fd-diet-soft fd-diet-fast-note" />
    </section>
  );
}

/** „Zaczynam post”: godzina z podpowiedzią (ostatni wpis albo teraz) do poprawienia i zapis. */
function StartFast({ entries, now, onStart }: { entries: readonly Entry[]; now: Date; onStart: (at: Date) => void }) {
  const bridge = useBridge();
  const id = useId();
  const [time, setTime] = useState(() => suggestedStart(entries, now));
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    // Zegar karty może się spóźniać o pół minuty: zapis liczy od prawdziwego „teraz”.
    const at = clockNow();
    onStart(at);
    void saveFast({ start: startFrom(time, at), end: null }).then(() => bridge.toast(T.started(time)));
  };
  return (
    <form className="fd-diet-fast-start" onSubmit={submit} noValidate>
      <p className="tight">{T.idle}</p>
      <div className="fd-diet-fast-row">
        <label className="fld" htmlFor={id}>
          <span>{T.startField}</span>
          <input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <button type="submit" className="btn" disabled={!valid}>
          {T.start}
        </button>
      </div>
    </form>
  );
}
