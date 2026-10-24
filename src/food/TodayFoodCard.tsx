import { useMemo } from 'react';
import { FOOD_PATH } from '../routing';
import { dayLines, todayLink } from './components/diet/dayText';
import { Bar } from './components/diet/MacroBars';
import { dayState, totals } from './diet/day';
import { mealsLeftAt } from './diet/model';
import { dayNeeds } from './diet/now';
import { hidesKcal, targetOn } from './diet/target';
import { diaryToParams } from './diet/url';
import { FOOD_CARD_HEIGHT, FoodCardPlaceholder } from './FoodCardPlaceholder';
import { hashWith } from './hash';
import { useClock, useDay, useEntries, useProfile } from './hooks/useDiet';
import { useWeeklyCheck } from './hooks/useWeeklyCheck';
import { text } from '../i18n';
import { DT } from './components/diet/dietText';
import { KcalShown } from './components/diet/kcalShown';
import './components/diet/diet.css';

const T = text({
  pl: {
    tag: 'Jedzenie',
    kcalBar: 'Kalorie',
  },
  en: {
    tag: 'Food',
    kcalBar: 'Calories',
  },
});

/** „Dodaj zjedzone” prosto z ekranu Dziś: dziennik otwiera arkusz i zdejmuje `dodaj` z adresu. */
const ADD_HREF = hashWith(FOOD_PATH, diaryToParams({ date: null, add: true }));

/**
 * Karta jedzenia na ekranie Dziś: jedno zdanie o dniu („Zostało ok. 650 kcal i 54 g białka”) nad
 * dwoma paskami — białko, potem kalorie — i „Dodaj zjedzone”. Cel dnia to cel z historii celów
 * (`targetOn`): ten sam przez cały dzień, bez wpływu kroków, treningów i reszty tygodnia;
 * zaplanowany większy posiłek jest już odłożony. ±100 kcal to wciąż cel. Ekran Dziś wczytuje kartę
 * leniwie i tylko u kogoś, kto prowadzi dietę (`gt:diet`). Stuknięcie w kartę prowadzi do dziennika,
 * przycisk — od razu do dodawania, a jedna linijka pod spodem mówi, gdy dziennik na coś czeka.
 *
 * W poniedziałek sprawdzenie celu może go jeszcze zmienić: póki trwa (najwyżej 3 s), stoi zaślepka,
 * żeby nie mignął stary cel. Dzień to dzień kalendarza w strefie telefonu, jak w całym dzienniku.
 */
export default function TodayFoodCard() {
  const profile = useProfile();
  const clock = useClock();
  const today = clock.date;
  const entries = useEntries(today);
  const day = useDay(today);
  const check = useWeeklyCheck(profile, clock);
  const eaten = useMemo(() => totals(entries ?? []), [entries]);

  // Bez profilu (np. dane diety wyczyszczone na innej karcie) karty nie ma — nie ma celu, do którego liczyć.
  if (profile === null) return null;
  // IndexedDB jeszcze odpowiada albo trwa poniedziałkowe sprawdzenie: miejsce karty stoi zajęte,
  // żeby ekran pod nią nie skakał.
  if (!profile || !entries || !day || check === 'pending') return <FoodCardPlaceholder />;

  const shown = !hidesKcal(profile);
  const needs = dayNeeds({
    profile,
    goalKcal: targetOn(profile, today),
    eaten,
    cheat: day.cheat ?? null,
    mealsAhead: mealsLeftAt(clock.hour),
  });
  const { targets } = needs;
  const lines = dayLines(dayState(needs, eaten), shown);
  const notice = todayLink(profile, today, shown);

  return (
    <KcalShown.Provider value={shown}>
      <div className="grp snackcard fd-diet-foodcard" style={{ minHeight: FOOD_CARD_HEIGHT }}>
        <a className="fd-diet-foodcard-link" href={FOOD_PATH}>
          <div className="today-tag light">{T.tag}</div>
          <h2 className="today-name fd-diet-headline">{lines.headline}</h2>
          <div className="fd-diet-barrow">
            <span>{DT.protein}</span>
            <Bar value={eaten.protein} target={targets.protein.target} label={DT.protein} unit="g" />
          </div>
          {shown && (
            <div className="fd-diet-barrow">
              <span>{T.kcalBar}</span>
              <Bar value={eaten.kcal} target={targets.kcal} label={T.kcalBar} unit="kcal" />
            </div>
          )}
          {lines.over && <p className="tight">{lines.over}</p>}
          {lines.reserved && <p className="tight">{lines.reserved}</p>}
        </a>
        {notice && (
          <a className="fd-diet-notice-link" href={FOOD_PATH}>
            {notice} <span aria-hidden="true">→</span>
          </a>
        )}
        <a className="btn sm" href={ADD_HREF}>
          {DT.addEaten}
        </a>
      </div>
    </KcalShown.Provider>
  );
}
