import { dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import { useClock, useMergedDay } from '../../hooks/useDiet';
import { Placeholder } from '../Placeholder';

const num = (n: number): string => n.toLocaleString('pl-PL');

/**
 * Dziennik — korzeń zakładki Jedzenie: bilans dnia, plan, „Dodaj zjedzone”, a pod spodem wejścia
 * do planu posiłków, postępu i profilu diety. Na razie zaślepka, która pokazuje dzisiejszą wagę,
 * kroki i ruch tak, jak zobaczy je dieta: przez most z danych treningowych.
 */
export default function DiaryPage() {
  const { date } = useClock();
  const day = useMergedDay(date);
  const move = useBridge().moveOn(date);
  const kcal = (move.workoutKcal ?? 0) + (move.cardioKcal ?? 0);
  const today = [
    day?.weightKg != null ? `waga ${num(day.weightKg)} kg` : 'bez ważenia',
    day?.steps != null ? `${num(day.steps)} kroków` : 'bez kroków',
    move.trained ? 'był trening' : 'bez treningu',
    kcal > 0 ? `ruch ≈ ${num(Math.round(kcal))} kcal` : null,
  ].filter(Boolean);
  return (
    <Placeholder>
      <p className="hint">Dziennik jedzenia już wkrótce. Dziś: {today.join(' · ')}.</p>
      <ul className="fd-links">
        <li>
          <a href={dietPath('plan')}>Plan posiłków</a>
        </li>
        <li>
          <a href={dietPath('progress')}>Postęp</a>
        </li>
        <li>
          <a href={dietPath('profile')}>Profil diety</a>
        </li>
      </ul>
    </Placeholder>
  );
}
