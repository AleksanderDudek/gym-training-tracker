import { useState } from 'react';
import type { FormEvent } from 'react';
import { WEIGHT_RANGE, latestWeight, validWeight, weightTrend } from '../engine/body';
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

const pl1 = (v: number): string => v.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** „−0,8 kg”, „+0,3 kg”, „bez zmian”. Minus typograficzny, a nie łącznik. */
const change = (d: number): string => (d === 0 ? 'bez zmian' : `${d > 0 ? '+' : '−'}${pl1(Math.abs(d))} kg`);

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
      <div className="today-tag light">Ważenie</div>
      {t.today === null ? (
        <>
          <h2 className="today-name">Waga z dziś</h2>
          <p className="tight">
            Najlepiej rano: po toalecie, przed jedzeniem i piciem, na tej samej wadze. Z dnia na dzień
            waga skacze o kilogram czy dwa — o kierunku mówi średnia z tygodnia.
          </p>
          <form className="body-row" onSubmit={save} noValidate>
            <label className="fld">
              <span>waga, kg</span>
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
              Zapisz
            </button>
          </form>
          <p className="hint" id="weigh-range">
            Od {WEIGHT_RANGE.min} do {WEIGHT_RANGE.max} kg, z jedną cyfrą po przecinku.
          </p>
          <button type="button" className="btn ghost sm" onClick={onSkip}>
            Nie dziś
          </button>
        </>
      ) : (
        <>
          <h2 className="today-name">Dziś {pl1(t.today)} kg</h2>
          <p className="tight">
            {t.avg !== null && `Średnia z 7 dni: ${pl1(t.avg)} kg`}
            {t.delta !== null && t.prevAvg !== null
              ? ` · tydzień wcześniej ${pl1(t.prevAvg)} kg (${change(t.delta)}).`
              : ' · zmiana tydzień do tygodnia pokaże się po drugim tygodniu ważeń.'}
          </p>
        </>
      )}
    </div>
  );
}
