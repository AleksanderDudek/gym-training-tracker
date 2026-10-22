import { useState } from 'react';
import type { FormEvent } from 'react';
import { WEIGHT_RANGE, latestWeight, validWeight, weightTrend } from '../engine/body';
import { num, text } from '../i18n';
import type { AppState } from '../types';

/**
 * Karta ważenia na ekranie Dziś. Pyta raz dziennie, dopóki dzisiejszej wagi nie ma w zapisie
 * albo ktoś nie powie „Nie dziś”; potem pokazuje dzisiejszą liczbę i średnią z tygodnia.
 *
 * Liczby stoją bez oceny — bez „brawo” i bez „uwaga”. Waga z dnia na dzień skacze z wodą,
 * solą i śniadaniem, więc karta mówi o średniej z 7 dni i o tym, jak ważyć, żeby kolejne
 * ranki dało się porównać. Co z tych liczb wynika, to rozmowa z trenerem, dietetykiem albo
 * lekarzem, a nie z aplikacją.
 */

const pl1 = (v: number): string => num(v, 1);

const T = text({
  pl: {
    same: 'bez zmian',
    tag: 'Ważenie',
    ask: 'Waga z dziś',
    how: 'Najlepiej rano: po toalecie, przed jedzeniem i piciem, na tej samej wadze. Z dnia na dzień waga skacze o kilogram czy dwa — o kierunku mówi średnia z tygodnia.',
    field: 'waga, kg',
    save: 'Zapisz',
    range: (min: number, max: number) => `Od ${min} do ${max} kg, z jedną cyfrą po przecinku.`,
    skip: 'Nie dziś',
    today: (kg: string) => `Dziś ${kg} kg`,
    avg: (kg: string) => `Średnia z 7 dni: ${kg} kg`,
    prev: (kg: string, change: string) => ` · tydzień wcześniej ${kg} kg (${change}).`,
    noPrev: ' · zmiana tydzień do tygodnia pokaże się po drugim tygodniu ważeń.',
  },
  en: {
    same: 'no change',
    tag: 'Weigh-in',
    ask: 'Today’s weight',
    how: 'Ideally in the morning: after the loo, before eating or drinking, on the same scales. Your weight jumps a kilo or two from day to day — the weekly average shows the direction.',
    field: 'weight, kg',
    save: 'Save',
    range: (min: number, max: number) => `From ${min} to ${max} kg, to one decimal place.`,
    skip: 'Not today',
    today: (kg: string) => `Today ${kg} kg`,
    avg: (kg: string) => `7-day average: ${kg} kg`,
    prev: (kg: string, change: string) => ` · a week earlier ${kg} kg (${change}).`,
    noPrev: ' · the week-to-week change appears after your second week of weigh-ins.',
  },
});

/** „−0,8 kg”, „+0,3 kg”, „bez zmian”. Minus typograficzny, a nie łącznik. */
const change = (d: number): string => (d === 0 ? T.same : `${d > 0 ? '+' : '−'}${pl1(Math.abs(d))} kg`);

export function WeighCard({
  state,
  today,
  onWeigh,
  onSkip,
}: {
  state: AppState;
  today: string;
  onWeigh: (kg: number) => void;
  onSkip: () => void;
}) {
  const [kg, setKg] = useState('');
  const t = weightTrend(state, today);
  const last = latestWeight(state);
  if (t.today === null && state.cfg.weighSkip === today) return null;

  const save = (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kg.trim().replace(',', '.'));
    if (!validWeight(v)) return;
    onWeigh(v);
    setKg('');
  };

  return (
    <div className="grp snackcard weighcard">
      <div className="today-tag light">{T.tag}</div>
      {t.today === null ? (
        <>
          <h2 className="today-name">{T.ask}</h2>
          <p className="tight">{T.how}</p>
          <form className="body-row" onSubmit={save} noValidate>
            <label className="fld">
              <span>{T.field}</span>
              <input
                type="text"
                inputMode="decimal"
                className="num"
                autoComplete="off"
                placeholder={last ? pl1(last.kg) : ''}
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                aria-describedby="weigh-range"
              />
            </label>
            <button className="btn sm" type="submit" disabled={!validWeight(Number(kg.trim().replace(',', '.')))}>
              {T.save}
            </button>
          </form>
          <p className="hint" id="weigh-range">
            {T.range(WEIGHT_RANGE.min, WEIGHT_RANGE.max)}
          </p>
          <button type="button" className="btn ghost sm" onClick={onSkip}>
            {T.skip}
          </button>
        </>
      ) : (
        <>
          <h2 className="today-name">{T.today(pl1(t.today))}</h2>
          <p className="tight">
            {t.avg !== null && T.avg(pl1(t.avg))}
            {t.delta !== null && t.prevAvg !== null ? T.prev(pl1(t.prevAvg), change(t.delta)) : T.noPrev}
          </p>
        </>
      )}
    </div>
  );
}
