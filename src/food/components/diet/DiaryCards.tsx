import { Copy, Droplet, Minus, Timer } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { HealthNote } from '../../../components/Health';
import { pluralEn, text } from '../../../i18n';
import { useBridge } from '../../bridge';
import type { Meal } from '../../diet/copy';
import type { DayRow, Entry } from '../../diet/db';
import {
  DRINK_KINDS,
  DRINK_STEPS,
  caffeineSafeMg,
  drinksOf,
  hydration,
  sweetValues,
  type DrinkKind,
} from '../../diet/drinks';
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
import { addDrink, copyEntries, deleteEntries, saveFast, undoDrink } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { waterTargetMl } from '../../diet/water';
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
    hydration: 'Nawodnienie',
    waterAmount: (drunk: string, target: string) => `${drunk} l z ${target} l`,
    kindsLabel: 'Co pijesz',
    kinds: { water: 'Woda', zero: 'Napój 0 kcal', coffee: 'Kawa', tea: 'Herbata', sweet: 'Napój słodzony', other: 'Inne' },
    kindsLower: { water: 'woda', zero: 'napój 0 kcal', coffee: 'kawa', tea: 'herbata', sweet: 'napój słodzony', other: 'inne' },
    drinkAdd: (ml: number, kind: string) => `Dodaj ${ml} ml — ${kind}`,
    drinkUndo: (ml: number, kind: string) => `Cofnij ostatnie: ${kind}, ${ml} ml`,
    kindHint: {
      water: null,
      zero: 'Bez cukru i kalorii: woda smakowa, napoje „zero” i light, herbatki owocowe bez cukru.',
      coffee: 'Kawa w zwykłych ilościach nawadnia podobnie jak woda (Maughan i in., 2016). Mleko i cukier dopisz w „Dodaj zjedzone”.',
      tea: 'Herbata nawadnia podobnie jak woda (Maughan i in., 2016). Mleko, cukier czy miód dopisz w „Dodaj zjedzone”.',
      sweet: null,
      other: 'Wszystko inne do picia. Jeśli ma kalorie — mleko, kefir, koktajl — dopisz je też w „Dodaj zjedzone”.',
    } as Record<DrinkKind, string | null>,
    sweetHint: (kcal: string, sugars: string) =>
      `Dopisze się też do „Zjedzone”: ok. ${kcal} kcal i ${sugars} g cukru na 250 ml — szacunek jak dla coli, soku czy słodzonej herbaty.`,
    sweetHintPlain: (sugars: string) =>
      `Dopisze się też do „Zjedzone”: ok. ${sugars} g cukru na 250 ml — szacunek jak dla coli, soku czy słodzonej herbaty.`,
    sweetLogged: (ml: number, kcal: number) => `Napój słodzony ${ml} ml — dopisany do „Zjedzone”, ok. ${kcal} kcal.`,
    sweetLoggedPlain: (ml: number) => `Napój słodzony ${ml} ml — dopisany do „Zjedzone”.`,
    drinkUndone: 'Napój cofnięty.',
    sweetDay: (kcal: number) => `w tym ok. ${kcal} kcal w „Zjedzone”`,
    caffeine: (mg: number, limit: number, pregnancy: boolean) =>
      `Kofeina z kawy i herbaty: ok. ${mg} mg. EFSA uznaje za bezpieczne do ${limit} mg dziennie${pregnancy ? ' w ciąży i przy karmieniu' : ' u dorosłych'} (kawa parzona ok. 40 mg, herbata ok. 20 mg na 100 ml).`,
    hydrationHint: 'Liczą się wszystkie napoje, bez wody w jedzeniu. Cel i wyłączenie karty — w profilu diety.',
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
    hydration: 'Hydration',
    waterAmount: (drunk: string, target: string) => `${drunk} l of ${target} l`,
    kindsLabel: 'What you’re drinking',
    kinds: { water: 'Water', zero: '0 kcal drink', coffee: 'Coffee', tea: 'Tea', sweet: 'Sweetened drink', other: 'Other' },
    kindsLower: { water: 'water', zero: '0 kcal drink', coffee: 'coffee', tea: 'tea', sweet: 'sweetened drink', other: 'other' },
    drinkAdd: (ml: number, kind: string) => `Add ${ml} ml — ${kind}`,
    drinkUndo: (ml: number, kind: string) => `Take back the last: ${kind}, ${ml} ml`,
    kindHint: {
      water: null,
      zero: 'No sugar, no calories: flavoured water, “zero” and diet drinks, unsweetened fruit teas.',
      coffee: 'In usual amounts coffee hydrates about as well as water (Maughan et al., 2016). Log milk and sugar in “Add food”.',
      tea: 'Tea hydrates about as well as water (Maughan et al., 2016). Log milk, sugar or honey in “Add food”.',
      sweet: null,
      other: 'Anything else you drink. If it has calories — milk, kefir, a smoothie — log it in “Add food” too.',
    } as Record<DrinkKind, string | null>,
    sweetHint: (kcal: string, sugars: string) =>
      `Also goes into “Eaten”: about ${kcal} kcal and ${sugars} g of sugar per 250 ml — an estimate as for cola, juice or sweetened tea.`,
    sweetHintPlain: (sugars: string) =>
      `Also goes into “Eaten”: about ${sugars} g of sugar per 250 ml — an estimate as for cola, juice or sweetened tea.`,
    sweetLogged: (ml: number, kcal: number) => `Sweetened drink ${ml} ml — added to “Eaten”, about ${kcal} kcal.`,
    sweetLoggedPlain: (ml: number) => `Sweetened drink ${ml} ml — added to “Eaten”.`,
    drinkUndone: 'Drink taken back.',
    sweetDay: (kcal: number) => `about ${kcal} kcal of it in “Eaten”`,
    caffeine: (mg: number, limit: number, pregnancy: boolean) =>
      `Caffeine from coffee and tea: about ${mg} mg. EFSA considers up to ${limit} mg a day safe${pregnancy ? ' in pregnancy and while breastfeeding' : ' for adults'} (brewed coffee about 40 mg, tea about 20 mg per 100 ml).`,
    hydrationHint: 'All drinks count, not the water in food. Target and hiding the card — in the diet profile.',
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

/** Ostatnio wybrany rodzaj napoju — na tym urządzeniu, bo ktoś, kto pije kawę, pije ją co dzień. */
const KIND_KEY = 'produkty-pl:napoj';

function rememberedKind(): DrinkKind {
  try {
    const v = localStorage.getItem(KIND_KEY);
    return (DRINK_KINDS as readonly string[]).includes(v ?? '') ? (v as DrinkKind) : 'water';
  } catch {
    return 'water';
  }
}

/**
 * Nawodnienie pod „Zjedzone”: ile wypite ze wszystkich napojów i cel (EFSA albo własny z profilu),
 * sam pasek bez oceny dnia. Rodzaj napoju wybiera się raz (zostaje zapamiętany), potem „+250”,
 * „+330”, „+500 ml”; „−” cofa ostatni napój. Napój słodzony dopisuje się też do „Zjedzone” jako
 * szacunek — inaczej puszka coli nawadniałaby i znikała z bilansu. Kawa i herbata dokładają
 * kofeinę, pokazaną obok bezpiecznej dawki EFSA. Dzień przyszły karty nie ma.
 */
export function HydrationCard({ date, day, profile }: { date: string; day: DayRow; profile: Profile }) {
  const bridge = useBridge();
  const shown = useKcalShown();
  const [kind, setKind] = useState<DrinkKind>(rememberedKind);
  const drinks = drinksOf(day);
  const h = hydration(drinks);
  const target = waterTargetMl(profile);
  const last = drinks.at(-1);
  const amount = T.waterAmount(litres(h.total), litres(target));
  const per250 = sweetValues(250);
  const hint =
    kind === 'sweet'
      ? shown
        ? T.sweetHint(formatNumber(per250.kcal, 0), formatNumber(per250.sugars, 0))
        : T.sweetHintPlain(formatNumber(per250.sugars, 0))
      : T.kindHint[kind];

  const pick = (k: DrinkKind) => {
    setKind(k);
    try {
      localStorage.setItem(KIND_KEY, k);
    } catch {
      // Prywatne okno: wybór zostaje do odświeżenia.
    }
  };
  const add = (ml: number) =>
    void addDrink(date, kind, ml).then(() => {
      if (kind !== 'sweet') return;
      const message = shown ? T.sweetLogged(ml, sweetValues(ml).kcal) : T.sweetLoggedPlain(ml);
      bridge.toast(message, { label: T.undo, run: () => void undoDrink(date).then(() => bridge.toast(T.drinkUndone)) });
    });

  return (
    <section className="grp fd-diet-water" aria-labelledby="fd-diet-water-title">
      <div className="fd-diet-water-head">
        <h2 id="fd-diet-water-title">
          <Droplet {...ICON} /> {T.hydration}
        </h2>
        <span className="fd-diet-nums fd-diet-water-num" aria-live="polite">
          {amount}
        </span>
      </div>
      <Bar value={h.total} target={target} label={T.hydration} unit="g" valueText={amount} />
      {h.byKind.length > 0 && (
        <p className="tight fd-diet-water-kinds">
          {h.byKind.map((k) => `${T.kinds[k.kind]} ${litres(k.ml)} l`).join(' · ')}
          {shown && h.sweetKcal > 0 && ` (${T.sweetDay(h.sweetKcal)})`}
        </p>
      )}
      <div className="chips fd-diet-water-pick" role="group" aria-label={T.kindsLabel}>
        {DRINK_KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => pick(k)}>
            {T.kinds[k]}
          </button>
        ))}
      </div>
      <div className="actions fd-diet-water-acts">
        {DRINK_STEPS.map((ml) => (
          <button key={ml} type="button" className="btn ghost sm" aria-label={T.drinkAdd(ml, T.kindsLower[kind])} onClick={() => add(ml)}>
            +{ml} ml
          </button>
        ))}
        <button
          type="button"
          className="btn ghost sm fd-diet-water-undo"
          aria-label={last ? T.drinkUndo(last.ml, T.kindsLower[last.kind]) : T.undo}
          disabled={!last}
          onClick={() => void undoDrink(date)}
        >
          <Minus {...ICON} />
        </button>
      </div>
      {hint && <p className="tight fd-diet-soft">{hint}</p>}
      {h.caffeineMg > 0 && (
        <p className="tight fd-diet-soft">{T.caffeine(h.caffeineMg, caffeineSafeMg(profile.pregnancy), profile.pregnancy)}</p>
      )}
      <p className="tight fd-diet-soft">{T.hydrationHint}</p>
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
