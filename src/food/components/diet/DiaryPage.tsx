import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  Pizza,
  Plus,
  Star,
  TrendingDown,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Segmented } from '../../../components/ui';
import { LOCALE, pluralEn, text } from '../../../i18n';
import { NEARBY_PATH, dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import { MISSING_DATA_MESSAGE } from '../../data';
import { hashWith } from '../../hash';
import type { Activity } from '../../diet/activity';
import { simulateCheat } from '../../diet/cheat';
import { macroStatus, totals, type DayTotals } from '../../diet/day';
import { db, type DayRow, type Entry, type PlannedCheat } from '../../diet/db';
import { entryFood } from '../../diet/favorites';
import { planFood, type Food } from '../../diet/foods';
import { addDays, dayGoal, dayLabel, longDay, mealsLeftAt, mondayOf, remainingOf } from '../../diet/model';
import { plannedDay, plannedKcal, type Plan, type PlannedItem, type PlanItem } from '../../diet/plan';
import { DIET_PROFILES } from '../../diet/profiles';
import { dropCheat, eatCheat, logFood, updateChoices, updateDay } from '../../diet/store';
import { autoDay, restVariants, seedOf, suggest, swaps, type Context } from '../../diet/suggest';
import type { Profile } from '../../diet/types';
import { diaryFromParams, diaryToParams } from '../../diet/url';
import {
  useDay,
  useEntries,
  useFavorites,
  useMergedDay,
  useMergedHistory,
  type History,
  type NearbyChains,
} from '../../hooks/useDiet';
import { activityKcalOf, useActivity, weightFrom } from '../../hooks/useActivity';
import { usePrepPlans } from '../../hooks/usePrep';
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber } from '../../lib/format';
import type { Dictionaries } from '../../lib/types';
import { formatDistance } from '../../nearby/geo';
import { weekday } from '../../prep/format';
import { dayPlanTotals } from '../../prep/meals';
import { nextPlanAfter, planCovering, planName } from '../../prep/store';
import type { PrepPlan } from '../../prep/types';
import { planHref } from '../prep/links';
import { PrepDayCard } from '../prep/PrepDayCard';
import { activityLine, activityParts, pendingParts } from './activityText';
import { AutoDayCard } from './AutoDayCard';
import { CheatMealSheet } from './CheatMealSheet';
import { verdictText } from './cheatText';
import { DT } from './dietText';
import { FavoritesSheet } from './FavoritesSheet';
import { FoodPicker } from './FoodPicker';
import { StarButton } from '../common/StarButton';
import { MacroBars } from './MacroBars';
import { Loading, Onboarding } from './Onboarding';
import { PlanDayCard } from './PlanDayCard';
import { RestVariants } from './RestVariants';
import { SuggestionList } from './SuggestionList';
import { SwapDialog } from './SwapDialog';
import { useDietBase, useFoodPool, type FoodPool } from './useDietPage';
import { WeighCard } from './WeighCard';
import './diet.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const T = text({
  pl: {
    cheatDropped: 'Cheat meal usunięty z planu dnia.',
    nowTitle: 'Co teraz?',
    cheatCoversRest: 'Na resztę dnia zostaje zaplanowany cheat meal.',
    left: (kcal: string, protein: string, meals: number, cheat: boolean) =>
      `Zostało ${kcal} kcal i ${protein} g białka na ${meals} ${meals === 1 ? 'posiłek' : 'posiłki'}${cheat ? ' — po odjęciu zaplanowanego cheat mealu' : ''}. Najlepsze oznaczone gwiazdką.`,
    usedWithCheat: 'Z zaplanowanym cheat mealem kalorie na dziś są wykorzystane – reszta dnia lekko i białkowo.',
    used: 'Kalorie na dziś wykorzystane – jeśli jesteś głodny, wybierz coś lekkiego i białkowego.',
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
    plannedCheat: 'Zaplanowany cheat meal',
    eatenNow: 'Zjedzone',
    change: 'Zmień',
    drop: 'Usuń',
    eaten: 'Zjedzone',
    nothingYet: 'Nic jeszcze nie zapisane. Odhacz pozycję planu albo dodaj, co zjadłeś – liczy się to, co naprawdę zjedzone.',
    macrosUnknown: ' · makro nieznane',
    deleteEntry: (name: string) => `Usuń: ${name}`,
    nearby: (shops: string) => `Propozycje biorą pod uwagę sklepy w pobliżu: ${shops}.`,
    preferred: (store: string) => `Planuję pod sklep ${store} – nie znam sklepów wokół Ciebie.`,
    noShops: 'Nie znam sklepów wokół Ciebie – propozycje biorą pod uwagę wszystkie sieci.',
    refreshNearby: 'Odśwież w „W pobliżu”',
    openNearby: 'Otwórz „W pobliżu”',
    datasetLoading: 'Wczytuję bazę produktów — przepisy i produkty zaraz dojdą.',
    noDataset: 'Bez bazy produktów proponuję tylko z planu i Twojego jedzenia.',
    datasetFailed: (message: string) => `${message} Proponuję na razie z planu i Twojego jedzenia.`,
    retry: 'Spróbuj ponownie',
    training: (kcal: string | null) => `trening${kcal ? ` ${kcal}` : ''}`,
    cardio: (kcal: string) => `kroki i cardio ${kcal}`,
    moveTitle: 'Kroki i ruch',
    stepsLater: 'Kroki wpiszesz tego dnia.',
    steps: 'Kroki',
    saveSteps: 'Zapisz kroki',
    save: 'Zapisz',
    stepsHint: 'Kroki trafiają do kroków w treningach — wpisane tu czy tam, to te same liczby.',
    moveToday: 'Ruch dziś',
    moveThatDay: 'Ruch tego dnia',
    trainedNoKcal: 'był trening — kalorie policzę po pierwszym ważeniu.',
    noKcal: 'kalorie ruchu policzę po pierwszym ważeniu.',
    noMove: 'bez treningu i cardio.',
    notAdapted: 'Cel kalorii nie idzie za ruchem — włączysz to w profilu diety („Dopasowuj cel do ruchu”).',
    futureGoal: 'Cel tego dnia zakłada ruch z planu — zmieni się, gdy dzień przyjdzie.',
    goalAndMove: 'Cel a ruch:',
    unchangedToday: 'na razie bez zmian wobec planu.',
    unchanged: 'ruch zgodny z planem — cel bez zmian.',
    mayDrop: (parts: string) => ` Do wieczora może jeszcze ubyć: ${parts}.`,
    assumes: (steps: string, training: string) =>
      `Cel zakłada ${steps} kroków${training}. Liczę tylko różnicę między tym a ruchem zrobionym — całe spalone kalorie liczyłyby treningi dwa razy.`,
    planTraining: (name: string | null, kcal: string) => ` i trening z planu (${name ? `„${name}”, ` : ''}ok. ${kcal})`,
    noPlanTraining: ', bez treningu w planie',
    profileTraining: (kcal: string) => ` i treningi z profilu (średnio ${kcal} dziennie)`,
  },
  en: {
    cheatDropped: 'Cheat meal removed from the day’s plan.',
    nowTitle: 'What now?',
    cheatCoversRest: 'The planned cheat meal takes the rest of the day.',
    left: (kcal: string, protein: string, meals: number, cheat: boolean) =>
      `${kcal} kcal and ${protein} g protein left for ${meals} ${pluralEn(meals, 'meal', 'meals')}${cheat ? ' — after the planned cheat meal' : ''}. The best are starred.`,
    usedWithCheat: 'With the planned cheat meal, today’s calories are used up – keep the rest of the day light and high in protein.',
    used: 'Today’s calories are used up – if you’re hungry, pick something light and high in protein.',
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
    tomorrow: 'tomorrow',
    on: (start: string) => `on ${WEEKDAY_DAY_MONTH.format(new Date(`${start}T12:00:00Z`))}`,
    nextPlan: (link: ReactNode, when: string): ReactNode => (
      <>
        The plan “{link}” starts {when}.
      </>
    ),
    plannedCheat: 'Planned cheat meal',
    eatenNow: 'Eaten',
    change: 'Change',
    drop: 'Delete',
    eaten: 'Eaten',
    nothingYet: 'Nothing logged yet. Tick off a plan item or add what you ate – what counts is what you really ate.',
    macrosUnknown: ' · macros unknown',
    deleteEntry: (name: string) => `Delete: ${name}`,
    nearby: (shops: string) => `Suggestions take the shops nearby into account: ${shops}.`,
    preferred: (store: string) => `I’m planning around ${store} – I don’t know the shops around you.`,
    noShops: 'I don’t know the shops around you – suggestions take every chain into account.',
    refreshNearby: 'Refresh in “Nearby”',
    openNearby: 'Open “Nearby”',
    datasetLoading: 'Loading the product database — recipes and products are on their way.',
    noDataset: 'Without the product database I suggest only from your plan and your own food.',
    datasetFailed: (message: string) => `${message} For now I suggest from your plan and your own food.`,
    retry: 'Try again',
    training: (kcal: string | null) => `workout${kcal ? ` ${kcal}` : ''}`,
    cardio: (kcal: string) => `steps & cardio ${kcal}`,
    moveTitle: 'Steps & activity',
    stepsLater: 'You’ll enter steps on the day.',
    steps: 'Steps',
    saveSteps: 'Save steps',
    save: 'Save',
    stepsHint: 'Steps go to the steps in Training — entered here or there, they’re the same numbers.',
    moveToday: 'Activity today',
    moveThatDay: 'Activity that day',
    trainedNoKcal: 'you did a workout — I’ll count the calories after your first weigh-in.',
    noKcal: 'I’ll count activity calories after your first weigh-in.',
    noMove: 'no workout or cardio.',
    notAdapted: 'Your calorie goal doesn’t follow your activity — turn it on in the diet profile (“Match the goal to activity”).',
    futureGoal: 'This day’s goal assumes the planned activity — it changes when the day comes.',
    goalAndMove: 'Goal and activity:',
    unchangedToday: 'no change from the plan so far.',
    unchanged: 'activity as planned — goal unchanged.',
    mayDrop: (parts: string) => ` By tonight it may still drop: ${parts}.`,
    assumes: (steps: string, training: string) =>
      `Your goal assumes ${steps} steps${training}. I count only the difference between that and the activity you did — counting every calorie burned would count workouts twice.`,
    planTraining: (name: string | null, kcal: string) => ` and the planned workout (${name ? `“${name}”, ` : ''}about ${kcal})`,
    noPlanTraining: ', with no workout planned',
    profileTraining: (kcal: string) => ` and your profile’s workouts (${kcal} a day on average)`,
  },
});

/**
 * Dziennik — korzeń zakładki Jedzenie (w Produktach PL widok „Dziś” zakładki Dieta). Od góry: dzień,
 * pytanie o wagę (rano, raz dziennie), bilans z „Dodaj zjedzone” i „Ulubione”, zaraz pod nim to,
 * co zjedzone — dopisane pojawia się tam, gdzie się stuknęło — potem plan dnia (z zakupami, z arkusza
 * albo propozycja), „Co teraz?”, kroki i ruch, a na dole wejścia do podstron (plan posiłków, moje
 * plany, postęp, profil diety) ze strzałką wstecz zamiast drugiego rzędu zakładek. Oglądany dzień
 * siedzi w adresie (`?dzien=`), a `?dodaj=1` z karty na ekranie Dziś otwiera „Dodaj zjedzone”
 * i znika z adresu.
 */
export default function DiaryPage() {
  const [state, update] = useUrlState(diaryFromParams, diaryToParams);
  const { profile, plan, clock } = useDietBase();
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

  // Tydzień oglądanego dnia (korekta celu) i bieżący — gdy ktoś patrzy na inny tydzień.
  const from = profile ? [mondayOf(date), mondayOf(today)].sort()[0]! : null;
  const history = useMergedHistory(from);

  if (profile === undefined || plan === undefined) return <Loading />;
  if (!profile) return <Onboarding />;
  if (!history) return <Loading />;

  return (
    <TodayView
      profile={profile}
      plan={plan}
      date={date}
      today={today}
      hour={clock.hour}
      nowMs={clock.ms}
      history={history}
      pickerOpen={pickerOpen}
      onPicker={setPickerOpen}
      onDate={(next) => update({ date: next === today ? null : next })}
    />
  );
}

interface ViewProps {
  profile: Profile;
  plan: Plan | null;
  date: string;
  today: string;
  /** Bieżąca godzina: dzień się kończy, a po 21:00 niedobór jest już prawdziwy. */
  hour: number;
  nowMs: number;
  history: History;
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

function TodayView({ profile, plan, date, today, hour, nowMs, history, pickerOpen, onPicker, onDate }: ViewProps) {
  const bridge = useBridge();
  const entries = useEntries(date);
  // Surowy wiersz dnia: wybory planu i ziarno propozycji. Waga i kroki — z wersji scalonej z treningami.
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
  const activity = useActivity(profile, today);

  const eaten = useMemo(() => totals(entries ?? []), [entries]);
  // Cel po tygodniu i po ruchu wobec planu (kroki, treningi) — ten sam w każdym miejscu diety.
  const goal = dayGoal(profile, history.eaten, date, today, activityKcalOf(activity));
  const moved = activity ? activity(date) : null;
  // Zaplanowany cheat meal rezerwuje swoje kalorie i jeden posiłek: reszta dnia liczy się już z nim.
  const cheat = day?.cheat ?? null;
  const reserved = cheat ? withCheat(eaten, cheat) : eaten;
  const mealsAhead = date === today ? mealsLeftAt(hour) : date < today ? 1 : 4;
  const restMeals = cheat ? Math.max(0, mealsAhead - 1) : mealsAhead;
  const dietProfile = DIET_PROFILES[profile.dietProfile];
  const targets = dietProfile.targets(goal.kcal, profile.targetWeightKg);
  const dayDone = date < today || (date === today && hour >= 21);
  const status = macroStatus(targets, eaten, dayDone);
  const planned = plan && !prep ? plannedDay(plan, date, day?.choices) : null;
  const { nearby, dict, pool } = food;

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
  const ctx: Context = {
    ...base,
    remaining: remainingOf(targets, reserved),
    mealsLeft: Math.max(1, restMeals),
  };
  const suggestions = suggest(pool, ctx, 8);
  // Reszta dnia w wariantach, gdy zostały dwa posiłki albo więcej — albo jeden, ale za duży na jeden talerz.
  const restShown =
    !(cheat && restMeals === 0) && ctx.remaining.kcal > 50 && (ctx.mealsLeft >= 2 || ctx.remaining.kcal > BIG_REST_KCAL);
  const view = restShown ? (nowView ?? 'rest') : 'one';
  // Warianty liczone tylko na widoku „Reszta dnia” — po kilka przebiegów `suggest` na każdy.
  const variants = view === 'rest' ? restVariants(pool, ctx, seedOf(date) + restRoll * 7919, 3) : [];
  const autoSeed = day?.autoSeed ?? seedOf(date);
  // Kilkaset pozycji oceniane cztery razy: na tyle tanio, że bez zapamiętywania.
  const auto = planned || prep ? null : autoDay(pool, base, autoSeed);
  const swapOptions = swapping ? swaps(planFood(swapping), pool, ctx) : [];

  if (!entries || !day || !body || !prepPlans) return <Loading />;

  const save = (f: Food) =>
    logFood(date, f).then(() => bridge.toast(DT.saved(f.name, f.nutrients.kcal)));
  const log = (f: Food) => void save(f);
  const starred = favorites?.length ?? 0;
  const dayPlanKcal = prep ? dayPlanTotals(prep, date).kcal : plannedKcal(planned);

  return (
    <>
      <DayNav date={date} today={today} onDate={onDate} />

      {/* Kluczem dzień: pole i „Zmień” zaczynają od nowa na każdym dniu. */}
      <WeighCard key={date} date={date} today={today} weightKg={body.weightKg ?? null} />

      <MacroBars
        targets={targets}
        eaten={eaten}
        status={status}
        adjustment={goal.adjustment}
        activity={moved && date <= today ? activityLine(moved) : null}
        plannedKcal={dayPlanKcal}
      >
        <div className="actions fd-diet-dayacts">
          <button type="button" className="btn" onClick={() => onPicker(true)}>
            <Plus {...ICON} /> {DT.addEaten}
          </button>
          <button type="button" className="btn ghost" onClick={() => setFavoritesOpen(true)}>
            <Star {...ICON} className="fd-diet-fav-ico" /> {DT.favorites}
            {starred > 0 && ` (${starred})`}
          </button>
          <button type="button" className="btn ghost" onClick={() => setCheatOpen(true)}>
            <Pizza {...ICON} /> Cheat meal
          </button>
        </div>
      </MacroBars>

      {cheat && (
        <CheatCard
          cheat={cheat}
          date={date}
          today={today}
          verdict={verdictText(
            simulateCheat({
              cheat,
              targets,
              eaten,
              mealsLeft: mealsAhead,
              profile,
              kg: weightFrom(bridge.weights, date) ?? profile.startWeightKg,
              date,
              eatenByDate: new Map(),
              plannedLeftKcal: null,
              typicalWorkoutKcal: 0,
            }),
          )}
          onEdit={() => setCheatOpen(true)}
          onEaten={() =>
            void eatCheat(date, cheat, { planned: true }).then(
              (id) => id !== null && bridge.toast(DT.saved(cheat.name || 'Cheat meal', cheat.kcal)),
            )
          }
          onDrop={() => void dropCheat(date).then(() => bridge.toast(T.cheatDropped))}
        />
      )}

      <EatenCard entries={entries} kcal={eaten.kcal} />

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
          {cheat && restMeals === 0
            ? T.cheatCoversRest
            : ctx.remaining.kcal > 50
              ? T.left(
                  formatNumber(ctx.remaining.kcal, 0),
                  formatNumber(Math.max(0, ctx.remaining.protein), 0),
                  ctx.mealsLeft,
                  cheat !== null,
                )
              : cheat
                ? T.usedWithCheat
                : T.used}{' '}
          {T.profile(dietProfile.label)}
        </p>
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
            entries={entries}
            onLog={log}
            onReroll={() => setRestRoll((n) => n + 1)}
          />
        ) : (
          <SuggestionList suggestions={suggestions} actionLabel={DT.ate} onPick={log} />
        )}
      </section>

      <MoveCard
        key={`${date}:${body.steps ?? ''}`}
        date={date}
        today={today}
        body={body}
        activity={moved}
      />

      <DietLinks date={date} today={today} />

      <FoodPicker
        open={pickerOpen}
        date={date}
        pool={pool}
        products={food.products}
        dict={dict}
        productsLoading={food.data.status === 'loading'}
        onClose={() => onPicker(false)}
        onLogged={bridge.toast}
      />
      <CheatMealSheet
        open={cheatOpen}
        date={date}
        today={today}
        hour={hour}
        profile={profile}
        eaten={eaten}
        eatenByDate={history.eaten}
        activity={activity}
        plannedKcal={dayPlanKcal}
        planned={cheat}
        ideasFor={(remaining, mealsLeft) => {
          const rest = { ...base, remaining, mealsLeft };
          const variants = mealsLeft >= 2 || remaining.kcal > BIG_REST_KCAL ? restVariants(pool, rest, seedOf(date), 2) : [];
          return variants.length ? { variants, singles: [] } : { variants: [], singles: suggest(pool, rest, 3) };
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
 * Wejścia do podstron dziennika: cztery kafelki na dole, każdy prowadzi w głąb (strzałka wstecz
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

/** What is eaten plus the planned cheat meal: the rest of the day is planned around it. */
function withCheat(eaten: DayTotals, cheat: PlannedCheat): DayTotals {
  return {
    kcal: eaten.kcal + cheat.kcal,
    protein: eaten.protein + (cheat.protein ?? 0),
    carbs: eaten.carbs + (cheat.carbs ?? 0),
    fat: eaten.fat + (cheat.fat ?? 0),
    unknownMacros: eaten.unknownMacros + (cheat.protein === null || cheat.carbs === null || cheat.fat === null ? 1 : 0),
  };
}

/**
 * Zaplanowany cheat meal na górze dnia: co to i ile, czy dzień się z nim mieści, i trzy ruchy —
 * „Zjedzone” (wpis w „Zjedzone”, plan znika), „Zmień” (arkusz z jego liczbami), „Usuń”.
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
  verdict: string;
  onEdit: () => void;
  onEaten: () => void;
  onDrop: () => void;
}) {
  const g = (v: number | null) => (v === null ? '?' : formatNumber(v, 0));
  return (
    <section className="grp fd-diet-cheat" aria-labelledby="fd-diet-cheat-title">
      <h2 id="fd-diet-cheat-title">
        <Pizza {...ICON} /> {T.plannedCheat}
      </h2>
      <p className="fd-diet-name">{cheat.name || 'Cheat meal'}</p>
      {cheat.items && cheat.items.length > 1 && <p className="fd-diet-meta">{cheat.items.join(' · ')}</p>}
      <p className="fd-diet-meta fd-diet-nums">
        {formatNumber(cheat.kcal, 0)} kcal · {DT.p} {g(cheat.protein)} · {DT.c} {g(cheat.carbs)} · {DT.f} {g(cheat.fat)}
      </p>
      <p className="tight">{verdict}</p>
      <div className="actions fd-diet-cheatacts">
        <button type="button" className="btn sm" onClick={onEaten} disabled={date > today}>
          {T.eatenNow}
        </button>
        <button type="button" className="btn ghost sm" onClick={onEdit}>
          {T.change}
        </button>
        <button type="button" className="btn ghost sm" onClick={onDrop}>
          {T.drop}
        </button>
      </div>
    </section>
  );
}

function EatenCard({ entries, kcal }: { entries: Entry[]; kcal: number }) {
  return (
    <section className="grp" aria-labelledby="fd-diet-eaten-title">
      <h2 id="fd-diet-eaten-title">
        {T.eaten} <span className="fd-diet-h-meta">· {formatNumber(kcal, 0)} kcal</span>
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
                  {formatNumber(e.kcal, 0)} kcal
                  {e.protein !== null
                    ? ` · ${DT.p} ${formatNumber(e.protein, 0)} · ${DT.c} ${formatNumber(e.carbs ?? 0, 0)} · ${DT.f} ${formatNumber(e.fat ?? 0, 0)}`
                    : T.macrosUnknown}
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
    </section>
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
        <a href={NEARBY_PATH}>{nearby.source === 'nearby' ? T.refreshNearby : T.openNearby}</a>
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

const kcalText = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;

/** Liczba z polskim przecinkiem albo kropką; `null`, gdy pole puste albo to nie liczba. */
function numberOrNull(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Kroki i ruch dnia — z danych treningowych, jedno źródło. Kroki zapisują przez most jako zwykły
 * wpis kroków, więc liczą się do odznak i kalorii jak każdy inny. Trening i jego kalorie tylko się
 * czyta: dziennik treningów jest jeden. Waga ma własne pytanie na górze dziennika (`WeighCard`):
 * waży się rano, a kroki wpisuje się wieczorem albo przychodzą z zegarka.
 */
function MoveCard({
  date,
  today,
  body,
  activity,
}: {
  date: string;
  today: string;
  body: DayRow;
  /** Ruch wobec planu; `null`, gdy cel w profilu nie idzie za ruchem. */
  activity: Activity | null;
}) {
  const bridge = useBridge();
  const move = bridge.moveOn(date);
  const [steps, setSteps] = useState(body.steps != null ? String(body.steps) : '');
  const walked = numberOrNull(steps);
  const newSteps = walked !== null && Math.round(walked) !== (body.steps ?? null);
  const future = date > today;
  const isToday = date === today;

  const save = (e: FormEvent) => {
    e.preventDefault();
    // Dzień z dziennika (data lokalna), nie „dziś” treningów — patrz `dayKey` w treningach (UTC).
    if (newSteps && walked !== null) bridge.setSteps(date, Math.round(walked));
  };

  const noKcal = move.workoutKcal === null && move.cardioKcal === null;
  const parts = [
    move.trained || (move.workoutKcal ?? 0) > 0 ? T.training(move.workoutKcal ? kcalText(move.workoutKcal) : null) : null,
    (move.cardioKcal ?? 0) > 0 ? T.cardio(kcalText(move.cardioKcal ?? 0)) : null,
  ].filter(Boolean);

  return (
    <section className="grp" aria-labelledby="fd-diet-body-title">
      <h2 id="fd-diet-body-title">{T.moveTitle}</h2>
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
      <p className="tight">
        <b>{isToday ? T.moveToday : T.moveThatDay}:</b>{' '}
        {noKcal
          ? move.trained
            ? T.trainedNoKcal
            : T.noKcal
          : parts.length
            ? `${parts.join(' · ')}.`
            : T.noMove}
      </p>
      {activity === null ? (
        <p className="tight fd-diet-soft">{T.notAdapted}</p>
      ) : future ? (
        <p className="tight fd-diet-soft">{T.futureGoal}</p>
      ) : (
        <>
          <p className="tight">
            <b>{T.goalAndMove}</b>{' '}
            {activityParts(activity).length
              ? `${activityParts(activity).join(' · ')}.`
              : isToday
                ? T.unchangedToday
                : T.unchanged}
            {pendingParts(activity).length > 0 && T.mayDrop(pendingParts(activity).join(' · '))}
          </p>
          <p className="tight fd-diet-soft">
            {T.assumes(
              formatNumber(activity.steps.planned, 0),
              activity.training.source === 'plan'
                ? activity.training.planned > 0
                  ? T.planTraining(activity.training.plannedName, kcalText(activity.training.planned))
                  : T.noPlanTraining
                : activity.training.source === 'profile'
                  ? T.profileTraining(kcalText(activity.training.planned))
                  : '',
            )}
          </p>
        </>
      )}
    </section>
  );
}
