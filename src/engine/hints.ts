import { STAGES, ex } from '../data/exercises';
import { P, nextWeight, plan, step } from './plan';
import type { AppState, EffortKey, ExerciseId } from '../types';

export interface Hint {
  html: string;
  hit: boolean;
}

/** Co trzeba zrobić dziś, żeby wskoczyć na kolejny poziom. */
export function levelHint(
  state: AppState,
  id: ExerciseId,
  live: (string | number)[],
  effort: EffortKey,
): Hint {
  const p = P(state, id);
  const m = ex(id);
  const u = m.unit === 'secs' ? 's' : 'powt';
  const rows = plan(state, id);
  const nw = nextWeight(state, id);
  let head: string;

  if (p.trans) {
    const left = p.sets - p.trans.heavySets;
    head =
      left > 0
        ? `Komplet dziś przenosi <b>${p.trans.to} kg</b> do ${p.trans.heavySets + 1}. serii. Do pełnego przejścia ${
            left === 1 ? 'została 1 sesja' : `zostają ${left} sesje`
          }.`
        : `Komplet dziś domyka przejście — <b>${p.trans.to} kg</b> na wszystkich seriach.`;
  } else if (m.mode === 'ballistic') {
    head =
      p.sets < p.maxSets
        ? `Komplet <b>${p.sets} × ${p.target}</b> dokłada serię (${p.sets + 1} × ${p.target}). Przy ${p.maxSets} seriach wchodzi <b>${nw ? `${nw} kg` : 'cięższy kettlebell'}</b>.`
        : `Komplet dziś zaczyna przejście na <b>${nw ? `${nw} kg` : 'cięższy kettlebell'}</b>.`;
  } else if (m.mode === 'body') {
    head =
      p.target < p.max
        ? `Komplet <b>${p.sets} × ${p.target}</b> podnosi cel do ${p.target + step(id)}. Przy ${p.max} dochodzi kolejna seria.`
        : `Komplet dziś dokłada ${p.sets + 1}. serię, a cel wraca na ${p.min}.`;
  } else if (m.mode === 'stage' && m.stages) {
    const arr = STAGES[m.stages];
    const nxt = (p.stage ?? 0) < arr.length - 1 ? arr[(p.stage ?? 0) + 1] : null;
    head =
      p.target < p.max
        ? `Komplet <b>${p.sets} × ${p.target}</b> podnosi cel do ${p.target + step(id)}.${
            nxt ? ` Do etapu „${nxt}” zostaje ${p.max - p.target + 1} sesji.` : ''
          }`
        : nxt
          ? `Komplet dziś przenosi cię na etap <b>${nxt}</b>.`
          : 'Najwyższy etap. Utrzymuj.';
  } else {
    const left = Math.ceil((p.max - p.target) / step(id)) + 1;
    head =
      p.target < p.max
        ? `Komplet <b>${p.sets} × ${p.target} ${u}</b> podnosi cel do ${p.target + step(id)}.` +
          (nw ? ` Do wejścia na <b>${nw} kg</b> ${left === 1 ? 'została 1 sesja' : `zostaje ${left} sesji`}.` : '')
        : nw
          ? `Komplet dziś wprowadza <b>${nw} kg</b> do pierwszej serii.`
          : `Szczyt zakresu przy ${p.weight} kg.`;
  }

  if (!live.length) return { html: head, hit: false };
  const vals = live.map((v) => Number(v) || 0);
  if (!vals.some((v) => v > 0)) return { html: head, hit: false };

  const weak: string[] = [];
  vals.forEach((v, i) => {
    const target = rows[i]?.reps;
    if (v > 0 && target !== undefined && v < target) weak.push(`seria ${i + 1}: brakuje ${target - v} ${u}`);
  });
  const empty = vals.filter((v) => !v).length;

  if (weak.length) return { html: `${head}<br>Do zaliczenia — ${weak.join(', ')}.`, hit: false };
  if (empty) return { html: `${head}<br>Na razie komplet. Serii do wpisania: ${empty}.`, hit: false };
  if (effort === 'max')
    return {
      html: `${head}<br><b>Cel zaliczony, ale bez zapasu.</b> Poziom zostaje — powtórz go, aż zejdziesz z granicy.`,
      hit: false,
    };
  return {
    html: `${head}<br><b>Cel zaliczony z zapasem.</b> Awans naliczy się po zamknięciu treningu.`,
    hit: true,
  };
}

export const MODE_NAMES: Record<string, string> = {
  grind: 'siłowe — rosną powtórzenia, potem ciężar',
  ballistic: 'balistyczne — rosną serie, nie powtórzenia do granicy sił',
  carry: 'na czas — rośnie czas, potem ciężar',
  stage: 'masa ciała — rosną powtórzenia, potem etap trudności',
  body: 'masa ciała — rosną powtórzenia, potem serie',
};

/** Wyjaśnienie, skąd wziął się dzisiejszy cel. */
export function whyText(state: AppState, id: ExerciseId): string {
  const p = P(state, id);
  const m = ex(id);
  const bits: string[] = [`Typ: ${MODE_NAMES[m.mode]}.`];

  if (p.e1rm && p.weight)
    bits.push(
      `Szacowane maksimum: <b>${p.e1rm} kg</b> na jedno powtórzenie, liczone wzorem Epleya z twoich ostatnich serii z uwzględnieniem zadeklarowanego zapasu.`,
    );
  if (p.trans && p.weight) {
    bits.push(
      `Trwa przejście na ${p.trans.to} kg. Cięższy kettlebell wchodzi seria po serii, bo skok z ${p.weight} na ${p.trans.to} kg to ${Math.round(
        (p.trans.to / p.weight - 1) * 100,
      )}% obciążenia — na sztandze odpowiednik dorzucenia kilkunastu kilogramów naraz.`,
    );
    if (p.e1rm)
      bits.push(`Powtórzenia w ciężkiej serii (${p.trans.reps}) wynikają z przeliczenia maksimum na nowy ciężar.`);
  }
  if (p.stalls) bits.push(`Nieudane sesje z rzędu: ${p.stalls}. Przy dwóch cel schodzi o stopień.`);
  if (p.maxHolds) bits.push(`Sesje zaliczone bez zapasu: ${p.maxHolds}. Przy trzech cel schodzi.`);

  const h = p.hist.slice(-3).reverse();
  if (h.length)
    bits.push(
      `Ostatnie sesje: ${h
        .map((x) => `${x.d.slice(5)} — ${x.reps.join('/')}${x.w ? ` @ ${x.w} kg` : ''}`)
        .join(', ')}.`,
    );

  return bits.join(' ');
}
