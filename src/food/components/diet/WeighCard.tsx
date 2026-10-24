import { TrendingDown } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { WEIGHT_RANGE, validWeight } from '../../../engine/body';
import { LANG, pluralEn, text } from '../../../i18n';
import { dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import { daysBetween } from '../../diet/model';
import { formatNumber } from '../../lib/format';

const T = text({
  pl: {
    lastToday: (kg: string, gap: number) => `Ostatnio ${kg}, ${gap === 1 ? 'wczoraj' : `${gap} dni temu`}.`,
    lastBefore: (kg: string, gap: number) => `Poprzednie ważenie: ${kg}, ${gap === 1 ? 'dzień' : `${gap} dni`} wcześniej.`,
    progress: 'Postęp',
    weight: (kg: string) => `Waga: ${kg} kg`,
    changeWeight: 'Zmień wagę',
    change: 'Zmień',
    askToday: 'Ile dziś ważysz?',
    pastTitle: 'Waga tego dnia',
    pastNone: 'Waga tego dnia: bez ważenia.',
    addPast: 'Dodaj',
    skip: 'Nie dziś',
    skipped: 'Bez ważenia dziś.',
    addToday: 'Dodaj wagę',
    field: 'Waga, kg',
    saveWeight: 'Zapisz wagę',
    save: 'Zapisz',
    cancel: 'Anuluj',
    range: (min: number, max: number) => `Waga od ${min} do ${max} kg.`,
    tip: 'Najlepiej rano, po toalecie, przed jedzeniem.',
  },
  en: {
    lastToday: (kg: string, gap: number) => `Last time ${kg}, ${gap === 1 ? 'yesterday' : `${gap} days ago`}.`,
    lastBefore: (kg: string, gap: number) => `Previous weigh-in: ${kg}, ${gap} ${pluralEn(gap, 'day', 'days')} earlier.`,
    progress: 'Progress',
    weight: (kg: string) => `Weight: ${kg} kg`,
    changeWeight: 'Change weight',
    change: 'Change',
    askToday: 'What do you weigh today?',
    pastTitle: 'Weight that day',
    pastNone: 'Weight that day: no weigh-in.',
    addPast: 'Add',
    skip: 'Not today',
    skipped: 'No weigh-in today.',
    addToday: 'Add weight',
    field: 'Weight, kg',
    saveWeight: 'Save weight',
    save: 'Save',
    cancel: 'Cancel',
    range: (min: number, max: number) => `Weight from ${min} to ${max} kg.`,
    tip: 'Best in the morning, after the loo, before eating.',
  },
});

interface Props {
  date: string;
  today: string;
  /** Waga z oglądanego dnia (dziennik wagi nałożony na dzień diety); `null` — tego dnia bez ważenia. */
  weightKg: number | null;
}

/** Liczba z polskim przecinkiem albo kropką; `null`, gdy pole puste albo to nie liczba. */
function kgOrNull(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

const kgText = (kg: number) => (LANG === 'pl' ? String(kg).replace('.', ',') : String(kg));

/**
 * Ostatnie ważenie przed oglądanym dniem — z dziennika wagi w moście (rosnąco po dniu), więc bez
 * żadnego zapytania. Dziś mówi „2 dni temu”, a o dniu z przeszłości — „2 dni wcześniej”.
 */
function lastBefore(weights: readonly { day: string; kg: number }[], date: string, today: string): string | null {
  let last: { day: string; kg: number } | null = null;
  for (const w of weights) if (w.day < date && (!last || w.day > last.day)) last = w;
  if (!last) return null;
  const gap = daysBetween(last.day, date);
  const kg = `${formatNumber(last.kg, 1)} kg`;
  if (date === today) return T.lastToday(kg, gap);
  return T.lastBefore(kg, gap);
}

/** Dokąd ma pójść fokus, gdy pole zniknie albo się pojawi — przycisk, który go miał, znika ze strony. */
type Focus = 'field' | 'change' | 'add' | null;

/**
 * Pytanie o wagę na samej górze dziennika. Ważenie rano, w tych samych warunkach, to jedyne, co
 * czyni trend wagi czytelnym (i z czego korzysta poniedziałkowe sprawdzenie celu), więc dzień bez
 * ważenia zaczyna się od pytania — ale jednego: „Nie dziś” tu albo na ekranie Dziś pomija je w obu
 * miejscach (most, `skipWeigh`). Po odpowiedzi zostaje jedna linijka z „Zmień” albo „Dodaj wagę”.
 * Dzień z przeszłości bez ważenia mówi to jednym zdaniem i pozwala dopisać wagę; na dzień, który
 * jeszcze nie nadszedł, nic: nie ma czego ważyć.
 *
 * Zapis idzie przez most do dziennika wagi z treningów (z dniem oglądanym w dzienniku) — jedno
 * ciało, jedna lista ważeń.
 */
export function WeighCard({ date, today, weightKg }: Props) {
  const bridge = useBridge();
  // Pole otwarte z linijki („Zmień”, „Dodaj”, „Dodaj wagę”) — z „Anuluj” zamiast „Nie dziś”.
  const [editing, setEditing] = useState(false);
  // „Nie dziś” w tej karcie: most zapamiętuje pominięcie, karta zwija się od razu.
  const [skippedHere, setSkippedHere] = useState(false);
  const [text, setText] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const refocus = useRef<Focus>(null);

  useEffect(() => {
    const want = refocus.current;
    refocus.current = null;
    if (want === 'field') field.current?.focus();
    else if (want) button.current?.focus();
  }, [editing, weightKg, skippedHere]);

  if (date > today) return null;
  const isToday = date === today;
  const skipped = isToday && (skippedHere || (bridge.weighSkipped?.() ?? false));

  const progress = (
    <a className="fd-diet-weigh-link" href={dietPath('progress')}>
      <TrendingDown size={18} strokeWidth={2} aria-hidden /> {T.progress}
    </a>
  );

  const open = (value: string) => {
    setText(value);
    setEditing(true);
    refocus.current = 'field';
  };

  /** One line instead of the question: the weight with „Zmień”, or no weigh-in with a way to add one. */
  const line = (title: string, action: string, label: string | undefined, onClick: () => void) => (
    <section className="grp fd-diet-weigh" aria-labelledby="fd-diet-weigh-title">
      <div className="fd-diet-weigh-head">
        <h2 id="fd-diet-weigh-title">{title}</h2>
        <button ref={button} type="button" className="btn ghost sm" aria-label={label} onClick={onClick}>
          {action}
        </button>
        {progress}
      </div>
    </section>
  );

  if (!editing) {
    if (weightKg !== null) return line(T.weight(formatNumber(weightKg, 1)), T.change, T.changeWeight, () => open(kgText(weightKg)));
    if (!isToday) return line(T.pastNone, T.addPast, undefined, () => open(''));
    if (skipped) return line(T.skipped, T.addToday, undefined, () => open(''));
  }

  const kg = kgOrNull(text);
  const bad = text.trim() !== '' && !validWeight(kg);
  const fresh = kg !== null && validWeight(kg) && kg !== weightKg;
  const hint = lastBefore(bridge.weights, date, today);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!fresh || kg === null) return;
    // Dzień z dziennika (data lokalna), nie „dziś” treningów — patrz `dayKey` w treningach (UTC).
    bridge.setWeight(kg, date);
    setEditing(false);
    refocus.current = 'change';
  };

  return (
    <section className="grp fd-diet-weigh" aria-labelledby="fd-diet-weigh-title">
      <div className="fd-diet-weigh-head">
        <h2 id="fd-diet-weigh-title">{isToday ? T.askToday : T.pastTitle}</h2>
        {progress}
      </div>
      <form className="fd-diet-body" onSubmit={save} noValidate>
        <label className="fld">
          <span>{T.field}</span>
          <input
            ref={field}
            type="text"
            className="num"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={bad || undefined}
            aria-describedby="fd-diet-weigh-hint"
          />
        </label>
        <button type="submit" className="btn sm" disabled={!fresh} aria-label={T.saveWeight}>
          {T.save}
        </button>
        {editing ? (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              setEditing(false);
              refocus.current = 'add';
            }}
          >
            {T.cancel}
          </button>
        ) : (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              bridge.skipWeigh?.();
              setSkippedHere(true);
              refocus.current = 'add';
            }}
          >
            {T.skip}
          </button>
        )}
      </form>
      <p className={`tight${bad ? ' fd-diet-warn' : ''}`} id="fd-diet-weigh-hint">
        {bad ? T.range(WEIGHT_RANGE.min, WEIGHT_RANGE.max) : `${hint ? `${hint} ` : ''}${T.tip}`}
      </p>
    </section>
  );
}
