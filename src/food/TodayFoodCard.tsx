import { useMemo } from 'react';
import { FOOD_PATH } from '../routing';
import { Bar } from './components/diet/MacroBars';
import { macroStatus, totals } from './diet/day';
import { dayGoal, mondayOf } from './diet/model';
import { DIET_PROFILES } from './diet/profiles';
import { diaryToParams } from './diet/url';
import { FOOD_CARD_HEIGHT, FoodCardPlaceholder } from './FoodCardPlaceholder';
import { hashWith } from './hash';
import { activityKcalOf, useActivity } from './hooks/useActivity';
import { useClock, useEntries, useHistory, useProfile } from './hooks/useDiet';
import { formatNumber } from './lib/format';
import { text } from '../i18n';
import { DT } from './components/diet/dietText';
import './components/diet/diet.css';

const kcal = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;
const grams = (n: number) => `${formatNumber(Math.round(n), 0)} g`;

const T = text({
  pl: {
    left: (kcal: string, protein: string | null) =>
      `Zostało ${kcal}${protein ? ` i ${protein} białka` : ' — białko na dziś już jest'}.`,
    over: (kcal: string, protein: string | null) =>
      `${kcal} ponad cel${protein ? `, a białka brakuje jeszcze ${protein}` : ''}.`,
    tag: 'Jedzenie',
    eaten: (eaten: string, goal: string) => `Dziś ${eaten} z ${goal}`,
    goal: (goal: string) => `Cel na dziś: ${goal}`,
    kcalBar: 'Kalorie',
  },
  en: {
    left: (kcal: string, protein: string | null) =>
      protein ? `${kcal} and ${protein} protein left.` : `${kcal} left — today’s protein is done.`,
    over: (kcal: string, protein: string | null) =>
      `${kcal} over the goal${protein ? `, and still ${protein} protein to go` : ''}.`,
    tag: 'Food',
    eaten: (eaten: string, goal: string) => `Today ${eaten} of ${goal}`,
    goal: (goal: string) => `Today’s goal: ${goal}`,
    kcalBar: 'Calories',
  },
});

/** „Dodaj zjedzone” prosto z ekranu Dziś: dziennik otwiera arkusz i zdejmuje `dodaj` z adresu. */
const ADD_HREF = hashWith(FOOD_PATH, diaryToParams({ date: null, add: true }));

/**
 * Karta jedzenia na ekranie Dziś: kalorie i białko wobec celu dnia, jedno zdanie, ile zostało,
 * i „Dodaj zjedzone”. Ekran Dziś wczytuje ją leniwie i tylko wtedy, gdy ktoś prowadzi dietę
 * (`gt:diet`), więc kto tylko trenuje, nie wczytuje Dexie. Wygląda jak sąsiednie karty (ważenie,
 * przekąska, kroki): etykieta, liczba dnia w nagłówku, zdanie pod spodem. Stuknięcie w kartę
 * prowadzi do dziennika, przycisk — od razu do dodawania.
 *
 * Dzień to dzień kalendarza w strefie telefonu, jak w całym dzienniku jedzenia.
 */
export default function TodayFoodCard() {
  const profile = useProfile();
  const { date: today, hour } = useClock();
  const entries = useEntries(today);
  // Tydzień do korekty celu: nadwyżka z poniedziałku obniża dzisiejszy cel tak samo jak w dzienniku.
  const history = useHistory(profile ? mondayOf(today) : null);
  const eaten = useMemo(() => totals(entries ?? []), [entries]);
  const activity = useActivity(profile, today);

  // Bez profilu (np. dane diety wyczyszczone na innej karcie) karty nie ma — nie ma celu, do którego liczyć.
  if (profile === null) return null;
  // IndexedDB jeszcze odpowiada: miejsce karty stoi zajęte, żeby ekran pod nią nie skakał.
  if (!profile || !entries || !history) return <FoodCardPlaceholder />;

  const goal = dayGoal(profile, history.eaten, today, today, activityKcalOf(activity));
  const targets = DIET_PROFILES[profile.dietProfile].targets(goal.kcal, profile.targetWeightKg);
  const status = macroStatus(targets, eaten, hour >= 21);
  const leftKcal = targets.kcal - eaten.kcal;
  const leftProtein = targets.protein.target - eaten.protein;
  const protein = leftProtein > 0 ? grams(leftProtein) : null;
  const line = leftKcal >= 0 ? T.left(kcal(leftKcal), protein) : T.over(kcal(-leftKcal), protein);

  return (
    <div className="grp snackcard fd-diet-foodcard" style={{ minHeight: FOOD_CARD_HEIGHT }}>
      <a className="fd-diet-foodcard-link" href={FOOD_PATH}>
        <div className="today-tag light">{T.tag}</div>
        <h2 className="today-name">
          {eaten.kcal > 0 ? T.eaten(formatNumber(eaten.kcal, 0), kcal(targets.kcal)) : T.goal(kcal(targets.kcal))}
        </h2>
        <Bar value={eaten.kcal} target={targets.kcal} status={status.kcal.status} label={T.kcalBar} />
        <div className="fd-diet-macro-head">
          <span>{DT.protein}</span>
          <span className="fd-diet-nums">
            {formatNumber(eaten.protein, 0)} / {grams(targets.protein.target)}
          </span>
        </div>
        <Bar value={eaten.protein} target={targets.protein.target} status={status.protein.status} label={DT.protein} />
        <p className="tight">{line}</p>
      </a>
      <a className="btn sm" href={ADD_HREF}>
        {DT.addEaten}
      </a>
    </div>
  );
}
