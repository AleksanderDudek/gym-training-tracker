import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  Plus,
  Star,
  TrendingDown,
  Trash2,
  UserRound,
  FlaskConical,
  UtensilsCrossed,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Segmented } from '../../../components/ui';
import { LOCALE, text } from '../../../i18n';
import { NEARBY_PATH, dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import { MISSING_DATA_MESSAGE } from '../../data';
import { hashWith } from '../../hash';
import { simulateCheat } from '../../diet/cheat';
import { dayState, totals } from '../../diet/day';
import { db, type DayRow, type Entry, type PlannedCheat } from '../../diet/db';
import { entryFood } from '../../diet/favorites';
import { planFood, type Food } from '../../diet/foods';
import { addDays, dayLabel, longDay, mealsLeftAt } from '../../diet/model';
import { dayNeeds } from '../../diet/now';
import { plannedDay, plannedKcal, type Plan, type PlannedItem, type PlanItem } from '../../diet/plan';
import { dropCheat, eatCheat, endPause, logFood, markDay, updateChoices, updateDay } from '../../diet/store';
import { autoDay, notEatenToday, restVariants, seedOf, suggest, swaps, type Context } from '../../diet/suggest';
import { BAND, currentWeight, hidesKcal, isComplete, pauseOn, r10, targetOn } from '../../diet/target';
import type { Pause, Profile } from '../../diet/types';
import { diaryFromParams, diaryToParams } from '../../diet/url';
import { useDay, useEntries, useFavorites, useMergedDay, type NearbyChains } from '../../hooks/useDiet';
import { usePrepPlans } from '../../hooks/usePrep';
import { useUrlState } from '../../hooks/useUrlState';
import { useWeeklyCheck } from '../../hooks/useWeeklyCheck';
import { formatNumber } from '../../lib/format';
import type { Dictionaries } from '../../lib/types';
import { formatDistance } from '../../nearby/geo';
import { weekday } from '../../prep/format';
import { dayPlanTotals } from '../../prep/meals';
import { nextPlanAfter, planCovering, planName } from '../../prep/store';
import type { PrepPlan } from '../../prep/types';
import { planHref } from '../prep/links';
import { PrepDayCard } from '../prep/PrepDayCard';
import { AutoDayCard } from './AutoDayCard';
import { ChangeNotice } from './ChangeNotice';
import { CheatMealSheet } from './CheatMealSheet';
import { verdictText } from './cheatText';
import { dayMonthLong } from './dietFormat';
import { DT, savedText } from './dietText';
import { FavoritesSheet } from './FavoritesSheet';
import { FoodPicker } from './FoodPicker';
import { KcalShown, useKcalShown } from './kcalShown';
import { StarButton } from '../common/StarButton';
import { MacroBars } from './MacroBars';
import { Loading, Onboarding } from './Onboarding';
import { PlanDayCard } from './PlanDayCard';
import { RestVariants } from './RestVariants';
import { SuggestionList } from './SuggestionList';
import { SwapDialog } from './SwapDialog';
import { useDietBase, useFoodPool, type FoodPool } from './useDietPage';
import { WeekCheckCard } from './WeekCheckCard';
import { WeighCard } from './WeighCard';
import './diet.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const n = (value: number) => formatNumber(Math.round(value), 0);

const T = text({
  pl: {
    cheatDropped: 'Większy posiłek usunięty z planu dnia.',
    nowTitle: 'Co teraz?',
    mealCoversRest: 'Na resztę dnia zostaje zaplanowany większy posiłek.',
    left: (kcal: string, protein: string, meals: string, reserved: boolean) =>
      `Zostało ok. ${kcal} kcal i ${protein} g białka na ${meals}${reserved ? ' — po zaplanowanym większym posiłku' : ''}. Najlepsze oznaczone gwiazdką.`,
    within: 'Kalorie na dziś w zakresie celu — jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego z białkiem.',
    enough: 'Na dziś kalorii już wystarczy — jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego z białkiem.',
    enoughWithMeal: 'Z zaplanowanym większym posiłkiem kalorii na dziś wystarczy — reszta dnia lekko i z białkiem.',
    leftPlain: (meals: string, protein: string) => `Na ${meals}: białka jeszcze ${protein} g. Najlepsze oznaczone gwiazdką.`,
    bestPlain: 'Najlepsze oznaczone gwiazdką.',
    enoughPlain: 'Na dziś wystarczy — jeśli masz ochotę na coś jeszcze, wybierz coś lekkiego z białkiem.',
    profile: (label: string) => `Profil: ${label}.`,
    show: 'Co pokazać',
    rest: (meals: string) => `Reszta dnia (${meals})`,
    one: 'Jeden posiłek',
    prevDay: 'Poprzedni dzień',
    nextDay: 'Następny dzień',
    backToday: 'Wróć do dziś',
    diet: 'Dieta',
    mealPlan: 'Plan posiłków',
    myPlans: 'Moje plany',
    progress: 'Postęp',
    dietProfile: 'Profil diety',
    labs: 'Badania — dieta pod wyniki',
    tomorrow: 'jutro',
    on: (start: string) => {
      const day = weekday(start);
      return `${day.startsWith('wt') ? 'we' : 'w'} ${day} ${DAY_MONTH.format(new Date(`${start}T12:00:00Z`))}`;
    },
    nextPlan: (link: ReactNode, when: string): ReactNode => (
      <>
        Plan „{link}” zaczyna się {when}.
      </>
    ),
    plannedMeal: 'Zaplanowany większy posiłek',
    eatenNow: 'Zjedzone',
    change: 'Zmień',
    drop: 'Usuń',
    eaten: 'Zjedzone',
    nothingYet: 'Nic jeszcze nie zapisane. Odhacz pozycję planu albo dodaj jedzenie — liczy się to, co naprawdę zjedzone.',
    macrosUnknown: ' · makro nieznane',
    macrosUnknownPlain: 'makro nieznane',
    deleteEntry: (name: string) => `Usuń: ${name}`,
    notAll: 'Nie wszystko zapisane',
    partial: 'Dzień niepełny — nie liczy się do dopasowania celu ani średnich.',
    low: 'Mało zapisów jak na cały dzień — ten dzień nie liczy się do dopasowania celu ani średnich.',
    wholeDay: 'To był cały dzień',
    whole: 'Liczę jako pełny dzień.',
    undo: 'Cofnij',
    pause: (date: string, kcal: string) => `Przerwa do ${date}: cel to utrzymanie wagi (${kcal} kcal), a dopasowanie czeka.`,
    pausePlain: (date: string) => `Przerwa do ${date}: dopasowanie czeka.`,
    endPause: 'Zakończ przerwę',
    pauseEnded: (kcal: string) => `Przerwa zakończona. Cel: ${kcal} kcal.`,
    pauseEndedPlain: 'Przerwa zakończona.',
    nearby: (shops: string) => `Propozycje biorą pod uwagę sklepy w pobliżu: ${shops}.`,
    preferred: (store: string) => `Planuję pod sklep ${store} – nie znam sklepów wokół Ciebie.`,
    noShops: 'Nie znam sklepów wokół Ciebie – propozycje biorą pod uwagę wszystkie sieci.',
    refreshNearby: 'Odśwież w „W pobliżu”',
    eatOut: 'Poza domem? Zobacz, gdzie zjeść w pobliżu',
    openNearby: 'Otwórz „W pobliżu”',
    datasetLoading: 'Wczytuję bazę produktów — przepisy i produkty zaraz dojdą.',
    noDataset: 'Bez bazy produktów proponuję tylko z planu i Twojego jedzenia.',
    datasetFailed: (message: string) => `${message} Proponuję na razie z planu i Twojego jedzenia.`,
    retry: 'Spróbuj ponownie',
    stepsTitle: 'Kroki',
    stepsLater: 'Kroki wpiszesz tego dnia.',
    steps: 'Kroki',
    saveSteps: 'Zapisz kroki',
    save: 'Zapisz',
    stepsHint: 'Kroki trafiają do kroków w treningach — wpisane tu czy tam, to te same liczby.',
    stepsNote:
      'Ruch nie zmienia celu jedzenia. Twój zwykły ruch jest już w celu, a gdy ruszasz się więcej przez kilka tygodni, pokaże to waga — wtedy cel sam urośnie.',
  },
  en: {
    cheatDropped: 'Bigger meal removed from the day’s plan.',
    nowTitle: 'What now?',
    mealCoversRest: 'The planned bigger meal takes the rest of the day.',
    left: (kcal: string, protein: string, meals: string, reserved: boolean) =>
      `About ${kcal} kcal and ${protein} g protein left for ${meals}${reserved ? ' — after the planned bigger meal' : ''}. The best are starred.`,
    within: 'Calories for today are within your target — if you’d like something more, pick something light with protein.',
    enough: 'That’s enough calories for today — if you’d like something more, pick something light with protein.',
    enoughWithMeal: 'With the planned bigger meal, that’s enough calories for today — keep the rest of the day light, with protein.',
    leftPlain: (meals: string, protein: string) => `For ${meals}: ${protein} g protein to go. The best are starred.`,
    bestPlain: 'The best are starred.',
    enoughPlain: 'That’s enough for today — if you’d like something more, pick something light with protein.',
    profile: (label: string) => `Profile: ${label}.`,
    show: 'What to show',
    rest: (meals: string) => `Rest of the day (${meals})`,
    one: 'One meal',
    prevDay: 'Previous day',
    nextDay: 'Next day',
    backToday: 'Back to today',
    diet: 'Diet',
    mealPlan: 'Meal plan',
    myPlans: 'My plans',
    progress: 'Progress',
    dietProfile: 'Diet profile',
    labs: 'Lab results — diet for them',
    tomorrow: 'tomorrow',
    on: (start: string) => `on ${WEEKDAY_DAY_MONTH.format(new Date(`${start}T12:00:00Z`))}`,
    nextPlan: (link: ReactNode, when: string): ReactNode => (
      <>
        The plan “{link}” starts {when}.
      </>
    ),
    plannedMeal: 'Planned bigger meal',
    eatenNow: 'Eaten',
    change: 'Change',
    drop: 'Delete',
    eaten: 'Eaten',
    nothingYet: 'Nothing logged yet. Tick off a plan item or add food — what counts is what you really ate.',
    macrosUnknown: ' · macros unknown',
    macrosUnknownPlain: 'macros unknown',
    deleteEntry: (name: string) => `Delete: ${name}`,
    notAll: 'Not everything logged',
    partial: 'Incomplete day — it doesn’t count towards fitting your target or the averages.',
    low: 'Not much logged for a whole day — this day doesn’t count towards fitting your target or the averages.',
    wholeDay: 'That was the whole day',
    whole: 'Counted as a complete day.',
    undo: 'Undo',
    pause: (date: string, kcal: string) => `Break until ${date}: your target is maintenance (${kcal} kcal) and fitting waits.`,
    pausePlain: (date: string) => `Break until ${date}: fitting waits.`,
    endPause: 'End the break',
    pauseEnded: (kcal: string) => `Break over. Target: ${kcal} kcal.`,
    pauseEndedPlain: 'Break over.',
    nearby: (shops: string) => `Suggestions take the shops nearby into account: ${shops}.`,
    preferred: (store: string) => `I’m planning around ${store} – I don’t know the shops around you.`,
    noShops: 'I don’t know the shops around you – suggestions take every chain into account.',
    refreshNearby: 'Refresh in “Nearby”',
    eatOut: 'Out and about? See where to eat nearby',
    openNearby: 'Open “Nearby”',
    datasetLoading: 'Loading the product database — recipes and products are on their way.',
    noDataset: 'Without the product database I suggest only from your plan and your own food.',
    datasetFailed: (message: string) => `${message} For now I suggest from your plan and your own food.`,
    retry: 'Try again',
    stepsTitle: 'Steps',
    stepsLater: 'You’ll enter steps on the day.',
    steps: 'Steps',
    saveSteps: 'Save steps',
    save: 'Save',
    stepsHint: 'Steps go to the steps in Training — entered here or there, they’re the same numbers.',
    stepsNote:
      'Activity doesn’t change your food target. Your usual activity is already in it, and if you move more for a few weeks, the scale shows it — then the target grows by itself.',
  },
});

/**
 * Dziennik — korzeń zakładki Jedzenie (w Produktach PL widok „Dziś” zakładki Dieta). Od góry: dzień,
 * na dziś to, na co dziennik czeka (zmiany w liczeniu, poniedziałkowe sprawdzenie celu, przerwa),
 * pytanie o wagę (rano, raz dziennie), karta dnia z „Dodaj zjedzone”, „Ulubione” i „Większy
 * posiłek”, zaraz pod nią to, co zjedzone — dopisane pojawia się tam, gdzie się stuknęło — potem
 * plan dnia (z zakupami, z arkusza albo propozycja), „Co teraz?”, kroki, a na dole wejścia do
 * podstron (plan posiłków, moje plany, postęp, profil diety). Cel dnia to jedna liczba z historii
 * celów (`targetOn`): ruch ani reszta tygodnia go nie przesuwają. Oglądany dzień siedzi w adresie
 * (`?dzien=`), a `?dodaj=1` z karty na ekranie Dziś otwiera „Dodaj zjedzone” i znika z adresu.
 *
 * W poniedziałek sprawdzenie celu może go jeszcze zmienić: póki trwa (najwyżej 3 s), dziennik
 * czeka, żeby nie pokazać starego celu.
 */
export default function DiaryPage() {
  const [state, update] = useUrlState(diaryFromParams, diaryToParams);
  const { profile, plan, clock } = useDietBase();
  const check = useWeeklyCheck(profile, clock);
  const today = clock.date;
  const date = state.date ?? today;
  const [pickerOpen, setPickerOpen] = useState(false);

  // „Dodaj zjedzone” z ekranu Dziś: arkusz otwiera się raz, a `dodaj` schodzi z adresu podmianą —
  // przeładowanie ani powrót do zakładki nie otworzą go drugi raz. Otwarcie już w renderze (stan
  // pochodny od adresu), zdjęcie z adresu — po nim, bo to zapis do historii przeglądarki.
  if (state.add && !pickerOpen) setPickerOpen(true);
  useEffect(() => {
    if (state.add) update({ add: false });
  }, [state.add, update]);

  if (profile === undefined || plan === undefined) return <Loading />;
  if (!profile) return <Onboarding />;
  if (check === 'pending') return <Loading />;

  return (
    <KcalShown.Provider value={!hidesKcal(profile)}>
      <TodayView
        profile={profile}
        plan={plan}
        date={date}
        today={today}
        hour={clock.hour}
        nowMs={clock.ms}
        pickerOpen={pickerOpen}
        onPicker={setPickerOpen}
        onDate={(next) => update({ date: next === today ? null : next })}
      />
    </KcalShown.Provider>
  );
}

interface ViewProps {
  profile: Profile;
  plan: Plan | null;
  date: string;
  today: string;
  /** Bieżąca godzina: ile posiłków zostało do końca dnia. */
  hour: number;
  nowMs: number;
  pickerOpen: boolean;
  onPicker: (open: boolean) => void;
  onDate: (date: string) => void;
}

/** Czym zamieniona pozycja staje się w planie: nazwą z ilością, gdy ilość nie jest oczywista. */
function asPlanItem(food: Food): PlanItem {
  return {
    text: food.source === 'product' ? `${food.name} (${food.amountLabel})` : food.name,
    ...food.nutrients,
    stores: food.stores,
  };
}

function TodayView({ profile, plan, date, today, hour, nowMs, pickerOpen, onPicker, onDate }: ViewProps) {
  const bridge = useBridge();
  const shown = useKcalShown();
  const entries = useEntries(date);
  // Surowy wiersz dnia: wybory planu, ziarno propozycji, zaplanowany większy posiłek i słowo osoby
  // o dniu (`partial`). Waga i kroki — z wersji scalonej z treningami.
  const day = useDay(date);
  const body = useMergedDay(date);
  const food = useFoodPool(profile, plan, nowMs);
  // Plan z zakupami ma pierwszeństwo w swoje dni: to nowsza decyzja niż plan z arkusza.
  const prepPlans = usePrepPlans();
  const prep = prepPlans ? planCovering(prepPlans, date) : null;
  // Dzień bez planu z zakupami, a plan zaczyna się później: zapowiedź w miejscu planu dnia. Tylko
  // plan, który jeszcze się nie zaczął — o tym, który już trwa albo minął, zdanie „zaczyna się” kłamie.
  const ahead = prepPlans && !prep ? nextPlanAfter(prepPlans, date) : null;
  const upcoming = ahead && ahead.settings.start > today ? ahead : null;
  const favorites = useFavorites();
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  // „Co teraz?”: cała reszta dnia w wariantach albo jeden posiłek; null — według tego, ile posiłków zostało.
  const [nowView, setNowView] = useState<'rest' | 'one' | null>(null);
  const [restRoll, setRestRoll] = useState(0);
  const [swapping, setSwapping] = useState<PlannedItem | null>(null);

  const eaten = useMemo(() => totals(entries ?? []), [entries]);
  // Jeden cel na dzień, z historii celów: ten sam od rana do wieczora, bez ruchu i bez reszty tygodnia.
  const target = targetOn(profile, date);
  // Zaplanowany większy posiłek rezerwuje swoje kalorie i jeden posiłek: reszta dnia liczy się już z nim.
  const cheat = day?.cheat ?? null;
  const mealsAhead = date === today ? mealsLeftAt(hour) : date < today ? 1 : 4;
  const needs = dayNeeds({ profile, goalKcal: target, eaten, cheat, mealsAhead });
  const { restMeals, targets, profile: dietProfile } = needs;
  const now = dayState(needs, eaten);
  const planned = plan && !prep ? plannedDay(plan, date, day?.choices) : null;
  const { nearby, dict, pool } = food;
  // Waga, przy której liczą się odpowiedzi na sprawdzenie, przerwa i większy posiłek: trend z ważeń.
  const kgNow = currentWeight(profile, bridge.weights, today);

  const base: Omit<Context, 'remaining' | 'mealsLeft'> = {
    targets,
    profile: dietProfile,
    nearby: nearby.chains.length
      ? nearby.chains.map((c) => c.chain)
      : profile.preferredStore
        ? [profile.preferredStore]
        : [],
    storeName: (chain) => dict.stores[chain] ?? chain,
    distance: (chain) => {
      const c = nearby.chains.find((x) => x.chain === chain);
      return c ? formatDistance(c.nearest.distance) : null;
    },
  };
  const ctx: Context = { ...base, remaining: needs.remaining, mealsLeft: needs.mealsLeft };
  const suggestions = suggest(pool, ctx, 8);
  // Reszta dnia w wariantach, gdy zostało więcej niż pasmo celu i dwa posiłki albo więcej — albo jeden, ale za duży na jeden talerz.
  const restShown =
    !(cheat && restMeals === 0) && ctx.remaining.kcal > BAND && (ctx.mealsLeft >= 2 || ctx.remaining.kcal > BIG_REST_KCAL);
  const view = restShown ? (nowView ?? 'rest') : 'one';
  // Warianty liczone tylko na widoku „Reszta dnia” — po kilka przebiegów `suggest` na każdy.
  // Reszta dnia bez tego, co już dziś zjedzone: owsianka ze śniadania nie wraca jako kolacja.
  const restPool = notEatenToday(pool, (entries ?? []).map((e) => e.key));
  const variants = view === 'rest' ? restVariants(restPool, ctx, seedOf(date) + restRoll * 7919, 3) : [];
  const autoSeed = day?.autoSeed ?? seedOf(date);
  // Kilkaset pozycji oceniane cztery razy: na tyle tanio, że bez zapamiętywania.
  const auto = planned || prep ? null : autoDay(pool, base, autoSeed);
  const swapOptions = swapping ? swaps(planFood(swapping), pool, ctx) : [];

  if (!entries || !day || !body || !prepPlans) return <Loading />;

  const save = (f: Food) => logFood(date, f).then(() => bridge.toast(savedText(f.name, f.nutrients.kcal, shown)));
  const log = (f: Food) => void save(f);
  const starred = favorites?.length ?? 0;
  const dayPlanKcal = prep ? dayPlanTotals(prep, date).kcal : plannedKcal(planned);
  const isToday = date === today;
  const pause = isToday ? pauseOn(profile, today) : null;
  const protein = n(Math.max(0, ctx.remaining.protein));
  const meals = DT.meals(ctx.mealsLeft);
  const leftNow = now.kind === 'start' || now.kind === 'left';
  const nowText =
    cheat && restMeals === 0
      ? T.mealCoversRest
      : !shown
        ? leftNow
          ? now.proteinDone
            ? T.bestPlain
            : T.leftPlain(meals, protein)
          : T.enoughPlain
        : leftNow
          ? T.left(n(r10(ctx.remaining.kcal)), protein, meals, cheat !== null)
          : cheat
            ? T.enoughWithMeal
            : now.kind === 'within'
              ? T.within
              : T.enough;

  // The bigger meal's verdict (spec §4.4): the day's targets at its own target (`targetOn(date)`).
  const verdictOf = (meal: PlannedCheat) =>
    verdictText(simulateCheat({ cheat: meal, targets, eaten, mealsLeft: mealsAhead, plannedLeftKcal: null }));

  return (
    <>
      <DayNav date={date} today={today} onDate={onDate} />

      {isToday && profile.notice === 'show' && <ChangeNotice profile={profile} today={today} kgNow={kgNow} />}
      {isToday && <WeekCheckCard profile={profile} today={today} kgNow={kgNow} />}
      {pause && <BreakLine pause={pause} target={target} today={today} kgNow={kgNow} />}

      {/* Kluczem dzień: pole i „Zmień” zaczynają od nowa na każdym dniu. */}
      <WeighCard key={date} date={date} today={today} weightKg={body.weightKg ?? null} />

      <MacroBars needs={needs} eaten={eaten} when={isToday ? 'today' : date < today ? 'past' : 'future'}>
        <div className="actions fd-diet-dayacts">
          <button type="button" className="btn" onClick={() => onPicker(true)}>
            <Plus {...ICON} /> {DT.addEaten}
          </button>
          <button type="button" className="btn ghost" onClick={() => setFavoritesOpen(true)}>
            <Star {...ICON} className="fd-diet-fav-ico" /> {DT.favorites}
            {starred > 0 && ` (${starred})`}
          </button>
          {shown && (
            <button type="button" className="btn ghost" onClick={() => setCheatOpen(true)}>
              <UtensilsCrossed {...ICON} /> {DT.bigMeal}
            </button>
          )}
        </div>
      </MacroBars>

      {cheat && (
        <CheatCard
          cheat={cheat}
          date={date}
          today={today}
          verdict={shown ? verdictOf(cheat) : null}
          onEdit={shown ? () => setCheatOpen(true) : null}
          onEaten={() =>
            void eatCheat(date, cheat, { planned: true }).then(
              (id) => id !== null && bridge.toast(savedText(cheat.name || DT.bigMeal, cheat.kcal, shown)),
            )
          }
          onDrop={() => void dropCheat(date).then(() => bridge.toast(T.cheatDropped))}
        />
      )}

      <EatenCard entries={entries} kcal={eaten.kcal} date={date} today={today} partial={day.partial} target={target} />

      {prep ? (
        <PrepDayCard plan={prep} date={date} entries={entries} />
      ) : (
        <>
          {upcoming && <NextPlanLine plan={upcoming} today={today} />}
          {planned && plan ? (
            <PlanDayCard plan={plan} planned={planned} date={date} entries={entries} onSwap={setSwapping} />
          ) : (
            <AutoDayCard
              meals={auto ?? []}
              entries={entries}
              hasPlan={plan !== null}
              loading={food.data.status === 'loading'}
              onLog={log}
              onReroll={() => void updateDay(date, { autoSeed: (autoSeed + 1) >>> 0 })}
            />
          )}
        </>
      )}

      <section className="grp" aria-labelledby="fd-diet-next-title">
        <h2 id="fd-diet-next-title">{T.nowTitle}</h2>
        <p className="tight">
          {nowText} {T.profile(dietProfile.label)}
        </p>
        {isToday && (
          <p className="tight">
            <a className="fd-diet-eatout" href={`${NEARBY_PATH}?widok=zjedz`}>
              <MapPin size={18} strokeWidth={2} aria-hidden /> {T.eatOut}
            </a>
          </p>
        )}
        <NearbyLine nearby={nearby} preferred={profile.preferredStore} dict={dict} />
        <DatasetLine food={food} />
        {restShown && (
          <Segmented
            label={T.show}
            options={[
              { key: 'rest', label: T.rest(DT.meals(ctx.mealsLeft)) },
              { key: 'one', label: T.one },
            ]}
            value={view}
            onChange={setNowView}
          />
        )}
        {view === 'rest' ? (
          <RestVariants
            variants={variants}
            left={{ kcal: ctx.remaining.kcal, protein: Math.max(0, ctx.remaining.protein) }}
            onLog={log}
            onReroll={() => setRestRoll((r) => r + 1)}
          />
        ) : (
          <SuggestionList suggestions={suggestions} actionLabel={DT.ate} onPick={log} />
        )}
      </section>

      <StepsCard key={`${date}:${body.steps ?? ''}`} date={date} today={today} body={body} />

      <DietLinks date={date} today={today} />

      <FoodPicker
        open={pickerOpen}
        date={date}
        pool={pool}
        products={food.products}
        dict={dict}
        productsLoading={food.data.status === 'loading'}
        left={needs.remaining.kcal}
        reserved={cheat !== null}
        past={!isToday}
        onClose={() => onPicker(false)}
        onLogged={bridge.toast}
      />
      {shown && (
        <CheatMealSheet
          open={cheatOpen}
          date={date}
          today={today}
          hour={hour}
          profile={profile}
          eaten={eaten}
          plannedKcal={dayPlanKcal}
          planned={cheat}
          ideasFor={(remaining, mealsLeft) => {
            const rest = { ...base, remaining, mealsLeft };
            const options = mealsLeft >= 2 || remaining.kcal > BIG_REST_KCAL ? restVariants(restPool, rest, seedOf(date), 2) : [];
            return options.length ? { variants: options, singles: [] } : { variants: [], singles: suggest(pool, rest, 3) };
          }}
          pool={pool}
          products={food.products}
          dict={dict}
          productsLoading={food.data.status === 'loading'}
          onClose={() => setCheatOpen(false)}
          onSaved={(message) => {
            setCheatOpen(false);
            bridge.toast(message);
          }}
        />
      )}
      <FavoritesSheet
        open={favoritesOpen}
        date={date}
        today={today}
        favorites={favorites ?? []}
        onLog={save}
        onClose={() => setFavoritesOpen(false)}
      />
      <SwapDialog
        item={swapping ? planFood(swapping) : null}
        options={swapOptions}
        onPick={(picked) => {
          if (!swapping) return;
          const index = swapping.index;
          void updateChoices(date, (c) => ({ ...c, swaps: { ...c.swaps, [index]: asPlanItem(picked) } }));
        }}
        onClose={() => setSwapping(null)}
      />
    </>
  );
}

/** Dzień w nagłówku z przejściem do poprzedniego i następnego; „Wróć do dziś”, gdy patrzy się gdzie indziej. */
function DayNav({ date, today, onDate }: { date: string; today: string; onDate: (date: string) => void }) {
  const near = Math.abs(Date.parse(date) - Date.parse(today)) <= 86_400_000;
  return (
    <div className="wrap fd-diet-daynav">
      <button
        type="button"
        className="fd-diet-icon-btn"
        onClick={() => onDate(addDays(date, -1))}
        aria-label={T.prevDay}
      >
        <ChevronLeft {...ICON} />
      </button>
      <div className="fd-diet-daynav-title" aria-live="polite">
        <h2>{dayLabel(date, today)}</h2>
        {near && <p>{longDay(date)}</p>}
      </div>
      <button
        type="button"
        className="fd-diet-icon-btn"
        onClick={() => onDate(addDays(date, 1))}
        aria-label={T.nextDay}
      >
        <ChevronRight {...ICON} />
      </button>
      {date !== today && (
        <button type="button" className="btn ghost sm fd-diet-today" onClick={() => onDate(today)}>
          {T.backToday}
        </button>
      )}
    </div>
  );
}

/**
 * Przerwa w liczeniu (urlop, choroba): cel to utrzymanie wagi, a poniedziałkowe dopasowanie czeka
 * do jej końca. Jedno zdanie z datą końca i „Zakończ przerwę”, które od dziś przywraca poprzedni cel.
 */
function BreakLine({ pause, target, today, kgNow }: { pause: Pause; target: number; today: string; kgNow: number }) {
  const bridge = useBridge();
  const shown = useKcalShown();
  const [busy, setBusy] = useState(false);
  const until = dayMonthLong(pause.to);
  const end = () => {
    if (busy) return;
    setBusy(true);
    void endPause({ today, kgNow })
      .then(() => bridge.toast(shown ? T.pauseEnded(n(pause.kcal)) : T.pauseEndedPlain))
      .finally(() => setBusy(false));
  };
  return (
    <div className="grp fd-diet-pause">
      <p className="tight">{shown ? T.pause(until, n(target)) : T.pausePlain(until)}</p>
      <button type="button" className="btn ghost sm" disabled={busy} onClick={end}>
        {T.endPause}
      </button>
    </div>
  );
}

/**
 * Wejścia do podstron dziennika: pięć kafelków na dole (badania szerokie, pod czterema), każdy prowadzi w głąb (strzałka wstecz
 * wraca). Góra dziennika należy do liczb dnia, a dwa najczęstsze cele mają odnośniki na miejscu:
 * karta wagi — do postępu, plan dnia — do swojego planu. Plan posiłków dostaje oglądany dzień
 * (`?dzien=`, ten sam zapis co w dzienniku), więc otwiera się na jego tygodniu — jak w Produktach
 * PL, gdzie zmiana widoku zostawiała dzień.
 */
function DietLinks({ date, today }: { date: string; today: string }) {
  const plan = hashWith(dietPath('plan'), diaryToParams({ date: date === today ? null : date, add: false }));
  return (
    <nav className="wrap fd-diet-subnav" aria-label={T.diet}>
      <a href={plan}>
        <CalendarDays {...ICON} />
        <span>{T.mealPlan}</span>
      </a>
      <a href={dietPath('plans')}>
        <ClipboardList {...ICON} />
        <span>{T.myPlans}</span>
      </a>
      <a href={dietPath('progress')}>
        <TrendingDown {...ICON} />
        <span>{T.progress}</span>
      </a>
      <a href={dietPath('profile')}>
        <UserRound {...ICON} />
        <span>{T.dietProfile}</span>
      </a>
      <a className="fd-diet-subnav-wide" href={dietPath('labs')}>
        <FlaskConical {...ICON} />
        <span>{T.labs}</span>
      </a>
    </nav>
  );
}

const DAY_MONTH = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** „jutro”, „w pon. 27 paź”, „we wt. 28 paź” — kiedy zaczyna się plan, do wstawienia w zdanie. */
function startsOn(start: string, today: string): string {
  if (start === addDays(today, 1)) return T.tomorrow;
  return T.on(start);
}

/**
 * Miejsce planu w dniu, którego żaden plan z zakupami nie obejmuje, gdy jakiś zaczyna się później:
 * jedno zdanie z odnośnikiem do niego. Do tego dnia dziennik idzie po staremu — plan z arkusza albo
 * propozycja dnia stoją zaraz pod spodem.
 */
function NextPlanLine({ plan, today }: { plan: PrepPlan; today: string }) {
  return (
    <div className="grp fd-diet-nextplan">
      <p className="fd-diet-line">
        <CalendarClock {...ICON} />
        <span>{T.nextPlan(<a href={planHref(plan)}>{planName(plan)}</a>, startsOn(plan.settings.start, today))}</span>
      </p>
    </div>
  );
}

/** Od tylu kcal na jeden posiłek reszta dnia to już kilka pozycji, nie jeden talerz. */
const BIG_REST_KCAL = 900;

/**
 * Zaplanowany większy posiłek na górze dnia: co to i ile, czy dzień się z nim mieści, i trzy ruchy —
 * „Zjedzone” (wpis w „Zjedzone”, plan znika), „Zmień” (arkusz z jego liczbami), „Usuń”. Bez liczenia
 * kalorii zostaje białko, bez oceny i bez arkusza.
 */
function CheatCard({
  cheat,
  date,
  today,
  verdict,
  onEdit,
  onEaten,
  onDrop,
}: {
  cheat: PlannedCheat;
  date: string;
  today: string;
  /** Czy dzień się mieści (`cheatText`); `null` bez liczenia kalorii. */
  verdict: string | null;
  /** „Zmień” otwiera arkusz; `null` — bez arkusza (bez liczenia kalorii). */
  onEdit: (() => void) | null;
  onEaten: () => void;
  onDrop: () => void;
}) {
  const g = (v: number | null) => (v === null ? '?' : formatNumber(v, 0));
  return (
    <section className="grp fd-diet-cheat" aria-labelledby="fd-diet-cheat-title">
      <h2 id="fd-diet-cheat-title">
        <UtensilsCrossed {...ICON} /> {T.plannedMeal}
      </h2>
      <p className="fd-diet-name">{cheat.name || DT.bigMeal}</p>
      {cheat.items && cheat.items.length > 1 && <p className="fd-diet-meta">{cheat.items.join(' · ')}</p>}
      <p className="fd-diet-meta fd-diet-nums">
        {verdict === null
          ? `${DT.p} ${g(cheat.protein)} g`
          : `${formatNumber(cheat.kcal, 0)} kcal · ${DT.p} ${g(cheat.protein)} · ${DT.c} ${g(cheat.carbs)} · ${DT.f} ${g(cheat.fat)}`}
      </p>
      {verdict && <p className="tight">{verdict}</p>}
      <div className="actions fd-diet-cheatacts">
        <button type="button" className="btn sm" onClick={onEaten} disabled={date > today}>
          {T.eatenNow}
        </button>
        {onEdit && (
          <button type="button" className="btn ghost sm" onClick={onEdit}>
            {T.change}
          </button>
        )}
        <button type="button" className="btn ghost sm" onClick={onDrop}>
          {T.drop}
        </button>
      </div>
    </section>
  );
}

/**
 * „Zjedzone”: wpisy dnia, a pod nimi słowo osoby o dniu (`DayRow.partial`) — dzień zapisany tylko
 * w części nie liczy się do dopasowania celu ani do średnich. Bez tego słowa decyduje 60 % celu:
 * zamknięty dzień z mniejszą sumą mówi to od razu i pozwala policzyć go jako cały.
 */
function EatenCard({
  entries,
  kcal,
  date,
  today,
  partial,
  target,
}: {
  entries: Entry[];
  kcal: number;
  date: string;
  today: string;
  partial: boolean | undefined;
  target: number;
}) {
  const shown = useKcalShown();
  return (
    <section className="grp" aria-labelledby="fd-diet-eaten-title">
      <h2 id="fd-diet-eaten-title">
        {T.eaten}
        {shown && <span className="fd-diet-h-meta"> · {formatNumber(kcal, 0)} kcal</span>}
      </h2>
      {entries.length === 0 ? (
        <p className="tight">{T.nothingYet}</p>
      ) : (
        <ul className="fd-diet-list">
          {entries.map((e) => (
            <li key={e.id} className="fd-diet-eaten">
              <span className="fd-diet-time">{e.time}</span>
              <div className="fd-diet-row-main">
                <p className="fd-diet-name">{e.name}</p>
                <p className="fd-diet-meta fd-diet-nums">
                  {shown
                    ? `${formatNumber(e.kcal, 0)} kcal${
                        e.protein !== null
                          ? ` · ${DT.p} ${formatNumber(e.protein, 0)} · ${DT.c} ${formatNumber(e.carbs ?? 0, 0)} · ${DT.f} ${formatNumber(e.fat ?? 0, 0)}`
                          : T.macrosUnknown
                      }`
                    : e.protein !== null
                      ? `${DT.p} ${formatNumber(e.protein, 0)} g`
                      : T.macrosUnknownPlain}
                  {e.amountLabel && ` · ${e.amountLabel}`}
                </p>
              </div>
              <StarButton food={entryFood(e)} />
              <button
                type="button"
                className="fd-diet-icon-btn"
                onClick={() => e.id && void db.entries.delete(e.id)}
                aria-label={T.deleteEntry(e.name)}
              >
                <Trash2 {...ICON} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown && entries.length > 0 && date <= today && (
        <PartialFooter date={date} today={today} partial={partial} eaten={kcal} target={target} />
      )}
    </section>
  );
}

/** Where a day with entries stands for the check and the averages, and the one button that changes it. */
function PartialFooter({
  date,
  today,
  partial,
  eaten,
  target,
}: {
  date: string;
  today: string;
  partial: boolean | undefined;
  eaten: number;
  target: number;
}) {
  const button = useRef<HTMLButtonElement>(null);
  // Po stuknięciu przycisk znika, a w jego miejscu staje inny: fokus idzie za nim, nie na `body`.
  const moved = useRef(false);
  const state =
    partial === true
      ? 'partial'
      : partial === false
        ? 'whole'
        : date < today && !isComplete(eaten, undefined, target)
          ? 'low'
          : 'open';
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    button.current?.focus();
  }, [state]);
  const mark = (value: boolean | undefined) => {
    moved.current = true;
    void markDay(date, value);
  };
  const line = { partial: T.partial, whole: T.whole, low: T.low, open: null }[state];
  // Otwarty dzień można oznaczyć jako niepełny, zamknięty z małą sumą — jako cały; słowo osoby — cofnąć.
  const action: { label: string; value: boolean | undefined } =
    state === 'open'
      ? { label: T.notAll, value: true }
      : state === 'low'
        ? { label: T.wholeDay, value: false }
        : { label: T.undo, value: undefined };
  return (
    <div className="fd-diet-partial">
      {line && <p className="tight">{line}</p>}
      <button ref={button} type="button" className="btn ghost sm" onClick={() => mark(action.value)}>
        {action.label}
      </button>
    </div>
  );
}

/** Jedno zdanie o tym, pod jakie sklepy idą propozycje, i droga, żeby to zmienić. */
function NearbyLine({
  nearby,
  preferred,
  dict,
}: {
  nearby: NearbyChains;
  preferred: string | null;
  dict: Dictionaries;
}) {
  const name = (chain: string) => dict.stores[chain] ?? chain;
  return (
    <p className="fd-diet-line">
      <MapPin {...ICON} />
      <span>
        {nearby.source === 'nearby'
          ? T.nearby(
              nearby.chains
                .slice(0, 5)
                .map((c) => `${name(c.chain)} ${formatDistance(c.nearest.distance)}`)
                .join(' · '),
            )
          : nearby.source === 'preferred' && preferred
            ? T.preferred(name(preferred))
            : T.noShops}{' '}
        <a href={`${NEARBY_PATH}?widok=sklepy`}>{nearby.source === 'nearby' ? T.refreshNearby : T.openNearby}</a>
      </span>
    </p>
  );
}

/** Stan bazy produktów pod „Co teraz?”: przepisy i produkty dochodzą do propozycji, gdy się wczyta. */
function DatasetLine({ food }: { food: FoodPool }) {
  const { data } = food;
  if (data.status === 'loading')
    return <p className="tight">{T.datasetLoading}</p>;
  if (data.status === 'ready') return null;
  return (
    <p className="tight fd-diet-warn">
      {data.message === MISSING_DATA_MESSAGE ? T.noDataset : T.datasetFailed(data.message)}{' '}
      {data.message !== MISSING_DATA_MESSAGE && (
        <button type="button" className="fd-diet-link" onClick={data.retry}>
          {T.retry}
        </button>
      )}
    </p>
  );
}

/** Liczba z polskim przecinkiem albo kropką; `null`, gdy pole puste albo to nie liczba. */
function numberOrNull(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Kroki dnia — z danych treningowych, jedno źródło. Zapis idzie przez most jako zwykły wpis kroków,
 * więc liczy się do odznak jak każdy inny. Ruch nie zmienia celu jedzenia: jedno zdanie mówi
 * dlaczego, bez kalorii ruchu — te zostają w treningach. Waga ma własne pytanie na górze dziennika
 * (`WeighCard`): waży się rano, a kroki wpisuje się wieczorem albo przychodzą z zegarka.
 */
function StepsCard({ date, today, body }: { date: string; today: string; body: DayRow }) {
  const bridge = useBridge();
  const [steps, setSteps] = useState(body.steps != null ? String(body.steps) : '');
  const walked = numberOrNull(steps);
  const newSteps = walked !== null && Math.round(walked) !== (body.steps ?? null);
  const future = date > today;

  const save = (e: FormEvent) => {
    e.preventDefault();
    // Dzień z dziennika (data lokalna), nie „dziś” treningów — patrz `dayKey` w treningach (UTC).
    if (newSteps && walked !== null) bridge.setSteps(date, Math.round(walked));
  };

  return (
    <section className="grp" aria-labelledby="fd-diet-body-title">
      <h2 id="fd-diet-body-title">{T.stepsTitle}</h2>
      {future ? (
        <p className="tight">{T.stepsLater}</p>
      ) : (
        <form className="fd-diet-body" onSubmit={save} noValidate>
          <label className="fld">
            <span>{T.steps}</span>
            <input
              type="text"
              className="num"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              aria-describedby="fd-diet-body-hint"
            />
          </label>
          <button type="submit" className="btn sm" disabled={!newSteps} aria-label={T.saveSteps}>
            {T.save}
          </button>
        </form>
      )}
      {!future && (
        <p className="tight" id="fd-diet-body-hint">
          {T.stepsHint}
        </p>
      )}
      <p className="tight fd-diet-soft">{T.stepsNote}</p>
    </section>
  );
}
