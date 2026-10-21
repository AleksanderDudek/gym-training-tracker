import { TrendingDown } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { WEIGHT_RANGE, validWeight } from '../../../engine/body';
import { dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import { daysBetween } from '../../diet/model';
import { formatNumber } from '../../lib/format';

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

const kgText = (kg: number) => String(kg).replace('.', ',');

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
  if (date === today) return `Ostatnio ${kg}, ${gap === 1 ? 'wczoraj' : `${gap} dni temu`}.`;
  return `Poprzednie ważenie: ${kg}, ${gap === 1 ? 'dzień' : `${gap} dni`} wcześniej.`;
}

/**
 * Pytanie o wagę na samej górze dziennika. Ważenie rano, w tych samych warunkach, to jedyne, co
 * czyni trend wagi czytelnym (i z czego korzysta korekta celu), więc dzień bez ważenia zaczyna się
 * od pytania. Po odpowiedzi zostaje jedna linijka z „Zmień” — pytanie raz na dzień nie zajmuje góry
 * ekranu do wieczora. Na dzień, który jeszcze nie nadszedł, nic: nie ma czego ważyć.
 *
 * Zapis idzie przez most do dziennika wagi z treningów (z dniem oglądanym w dzienniku), jak dotąd
 * w karcie wagi i kroków — jedno ciało, jedna lista ważeń.
 */
export function WeighCard({ date, today, weightKg }: Props) {
  const bridge = useBridge();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const change = useRef<HTMLButtonElement>(null);
  // Dokąd ma pójść fokus, gdy pole zniknie albo się pojawi — przycisk, który go miał, znika ze strony.
  const refocus = useRef<'field' | 'change' | null>(null);

  useEffect(() => {
    const want = refocus.current;
    refocus.current = null;
    if (want === 'field') field.current?.focus();
    else if (want === 'change') change.current?.focus();
  }, [editing, weightKg]);

  if (date > today) return null;

  const progress = (
    <a className="fd-diet-weigh-link" href={dietPath('progress')}>
      <TrendingDown size={18} strokeWidth={2} aria-hidden /> Postęp
    </a>
  );

  if (weightKg !== null && !editing)
    return (
      <section className="grp fd-diet-weigh" aria-labelledby="fd-diet-weigh-title">
        <div className="fd-diet-weigh-head">
          <h2 id="fd-diet-weigh-title">Waga: {formatNumber(weightKg, 1)} kg</h2>
          <button
            ref={change}
            type="button"
            className="btn ghost sm"
            aria-label="Zmień wagę"
            onClick={() => {
              setText(kgText(weightKg));
              setEditing(true);
              refocus.current = 'field';
            }}
          >
            Zmień
          </button>
          {progress}
        </div>
      </section>
    );

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
        <h2 id="fd-diet-weigh-title">{date === today ? 'Ile dziś ważysz?' : 'Ile ważyłeś tego dnia?'}</h2>
        {progress}
      </div>
      <form className="fd-diet-body" onSubmit={save} noValidate>
        <label className="fld">
          <span>Waga, kg</span>
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
        <button type="submit" className="btn sm" disabled={!fresh} aria-label="Zapisz wagę">
          Zapisz
        </button>
        {editing && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              setEditing(false);
              refocus.current = 'change';
            }}
          >
            Anuluj
          </button>
        )}
      </form>
      <p className={`tight${bad ? ' fd-diet-warn' : ''}`} id="fd-diet-weigh-hint">
        {bad
          ? `Waga od ${WEIGHT_RANGE.min} do ${WEIGHT_RANGE.max} kg.`
          : `${hint ? `${hint} ` : ''}Najlepiej rano, po toalecie, przed jedzeniem.`}
      </p>
    </section>
  );
}
