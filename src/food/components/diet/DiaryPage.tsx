import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, Star, TrendingDown, Trash2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { WEIGHT_RANGE, validWeight } from '../../../engine/body';
import { NEARBY_PATH, dietPath } from '../../../routing';
import { useBridge } from '../../bridge';
import { MISSING_DATA_MESSAGE } from '../../data';
import { hashWith } from '../../hash';
import { macroStatus, totals } from '../../diet/day';
import { db, type DayRow, type Entry } from '../../diet/db';
import { entryFood, favoriteFood } from '../../diet/favorites';
import { planFood, type Food } from '../../diet/foods';
import { addDays, dayGoal, dayLabel, longDay, mealsLeftAt, mondayOf, remainingOf } from '../../diet/model';
import { plannedDay, plannedKcal, type Plan, type PlannedItem, type PlanItem } from '../../diet/plan';
import { DIET_PROFILES } from '../../diet/profiles';
import { logFood, updateChoices, updateDay } from '../../diet/store';
import { autoDay, seedOf, suggest, swaps, type Context } from '../../diet/suggest';
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
import { useUrlState } from '../../hooks/useUrlState';
import { formatNumber } from '../../lib/format';
import type { Dictionaries } from '../../lib/types';
import { formatDistance } from '../../nearby/geo';
import { AutoDayCard } from './AutoDayCard';
import { FoodPicker } from './FoodPicker';
import { StarButton } from '../common/StarButton';
import { MacroBars } from './MacroBars';
import { Loading, Onboarding } from './Onboarding';
import { PlanDayCard } from './PlanDayCard';
import { MacroLine, SuggestionList } from './SuggestionList';
import { SwapDialog } from './SwapDialog';
import { useDietBase, useFoodPool, type FoodPool } from './useDietPage';
import './diet.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

/**
 * Dziennik — korzeń zakładki Jedzenie (w Produktach PL widok „Dziś” zakładki Dieta): bilans dnia,
 * plan albo propozycja dnia, „Co teraz?” i „Dodaj zjedzone”. Pod bilansem wejścia do planu
 * posiłków, postępu i profilu diety — podstron ze strzałką wstecz zamiast drugiego rzędu zakładek.
 * Oglądany dzień siedzi w adresie (`?dzien=`), a `?dodaj=1` z karty na ekranie Dziś otwiera
 * „Dodaj zjedzone” i znika z adresu.
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
  const [swapping, setSwapping] = useState<PlannedItem | null>(null);

  const eaten = useMemo(() => totals(entries ?? []), [entries]);
  const goal = dayGoal(profile, history.eaten, date, today);
  const dietProfile = DIET_PROFILES[profile.dietProfile];
  const targets = dietProfile.targets(goal.kcal, profile.targetWeightKg);
  const dayDone = date < today || (date === today && hour >= 21);
  const status = macroStatus(targets, eaten, dayDone);
  const planned = plan ? plannedDay(plan, date, day?.choices) : null;
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
    remaining: remainingOf(targets, eaten),
    mealsLeft: date === today ? mealsLeftAt(hour) : date < today ? 1 : 4,
  };
  const suggestions = suggest(pool, ctx, 8);
  const autoSeed = day?.autoSeed ?? seedOf(date);
  // Kilkaset pozycji oceniane cztery razy: na tyle tanio, że bez zapamiętywania.
  const auto = planned ? null : autoDay(pool, base, autoSeed);
  const swapOptions = swapping ? swaps(planFood(swapping), pool, ctx) : [];

  if (!entries || !day || !body) return <Loading />;

  const log = (f: Food) =>
    void logFood(date, f).then(() => bridge.toast(`Zapisane: ${f.name} · ${formatNumber(f.nutrients.kcal, 0)} kcal.`));

  return (
    <>
      <DayNav date={date} today={today} onDate={onDate} />

      <MacroBars
        targets={targets}
        eaten={eaten}
        status={status}
        adjustment={goal.adjustment}
        plannedKcal={plannedKcal(planned)}
      >
        <div className="actions">
          <button type="button" className="btn wide" onClick={() => onPicker(true)}>
            <Plus {...ICON} /> Dodaj zjedzone
          </button>
        </div>
      </MacroBars>

      <FavoritesCard date={date} today={today} onLog={log} />

      <DietLinks date={date} today={today} />

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

      <EatenCard entries={entries} kcal={eaten.kcal} />

      <section className="grp" aria-labelledby="fd-diet-next-title">
        <h2 id="fd-diet-next-title">Co teraz?</h2>
        <p className="tight">
          {ctx.remaining.kcal > 50
            ? `Zostało ${formatNumber(ctx.remaining.kcal, 0)} kcal i ${formatNumber(Math.max(0, ctx.remaining.protein), 0)} g białka na ${ctx.mealsLeft} ${ctx.mealsLeft === 1 ? 'posiłek' : 'posiłki'}. Najlepsze oznaczone gwiazdką.`
            : 'Kalorie na dziś wykorzystane – jeśli jesteś głodny, wybierz coś lekkiego i białkowego.'}{' '}
          Profil: {dietProfile.label}.
        </p>
        <NearbyLine nearby={nearby} preferred={profile.preferredStore} dict={dict} />
        <DatasetLine food={food} />
        <SuggestionList suggestions={suggestions} actionLabel="Zjadłem" onPick={log} />
      </section>

      <BodyCard key={`${date}:${body.weightKg ?? ''}:${body.steps ?? ''}`} date={date} today={today} body={body} />

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
        aria-label="Poprzedni dzień"
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
        aria-label="Następny dzień"
      >
        <ChevronRight {...ICON} />
      </button>
      {date !== today && (
        <button type="button" className="btn ghost sm fd-diet-today" onClick={() => onDate(today)}>
          Wróć do dziś
        </button>
      )}
    </div>
  );
}

/**
 * Wejścia do podstron dziennika: trzy kafelki pod bilansem, każdy prowadzi w głąb (strzałka wstecz
 * wraca). Plan posiłków dostaje oglądany dzień (`?dzien=`, ten sam zapis co w dzienniku), więc
 * otwiera się na jego tygodniu — jak w Produktach PL, gdzie zmiana widoku zostawiała dzień.
 */
function DietLinks({ date, today }: { date: string; today: string }) {
  const plan = hashWith(dietPath('plan'), diaryToParams({ date: date === today ? null : date, add: false }));
  return (
    <nav className="wrap fd-diet-subnav" aria-label="Dieta">
      <a href={plan}>
        <CalendarDays {...ICON} />
        <span>Plan posiłków</span>
      </a>
      <a href={dietPath('progress')}>
        <TrendingDown {...ICON} />
        <span>Postęp</span>
      </a>
      <a href={dietPath('profile')}>
        <UserRound {...ICON} />
        <span>Profil diety</span>
      </a>
    </nav>
  );
}

/** Ile ulubionych widać od razu — reszta pod „Pokaż wszystkie”. */
const FAVORITES_SHOWN = 8;

/**
 * Lista szybkiego wyboru: ulubione z „+ Zjadłem” — zapis jednym stuknięciem, w ilości z gwiazdki,
 * na oglądany dzień. Najczęściej jedzone na górze (każdy zapis takiego jedzenia liczy się do
 * kolejności). Bez ulubionych — jedno zdanie, jak je dodać.
 */
function FavoritesCard({ date, today, onLog }: { date: string; today: string; onLog: (food: Food) => void }) {
  const favorites = useFavorites();
  const [all, setAll] = useState(false);
  if (!favorites) return null;
  const shown = all ? favorites : favorites.slice(0, FAVORITES_SHOWN);
  const future = date > today;
  return (
    <section className="grp" aria-labelledby="fd-diet-fav-title">
      <h2 id="fd-diet-fav-title">
        <Star {...ICON} className="fd-diet-fav-ico" /> Ulubione
      </h2>
      {favorites.length === 0 ? (
        <p className="tight">
          To, co jesz najczęściej, oznacz gwiazdką — w „Dodaj zjedzone”, w produktach, w lokalach albo przy tym, co już
          zjedzone. Pojawi się tutaj do dodania jednym stuknięciem.
        </p>
      ) : (
        <>
          <ul className="fd-diet-list">
            {shown.map((f) => {
              const food = favoriteFood(f);
              return (
                <li key={f.key} className="fd-diet-sug">
                  <div className="fd-diet-row">
                    <div className="fd-diet-row-main">
                      <p className="fd-diet-name">{food.name}</p>
                      <p className="fd-diet-meta">
                        <MacroLine food={food} /> · {food.amountLabel || 'porcja'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn ghost sm fd-diet-act"
                      onClick={() => onLog(food)}
                      disabled={future}
                      aria-label={`Zjadłem: ${food.name}`}
                    >
                      <Plus size={20} strokeWidth={2} aria-hidden /> Zjadłem
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {favorites.length > FAVORITES_SHOWN && (
            <button type="button" className="fd-diet-link" onClick={() => setAll(!all)} aria-expanded={all}>
              {all ? 'Pokaż mniej' : `Pokaż wszystkie (${favorites.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function EatenCard({ entries, kcal }: { entries: Entry[]; kcal: number }) {
  return (
    <section className="grp" aria-labelledby="fd-diet-eaten-title">
      <h2 id="fd-diet-eaten-title">
        Zjedzone <span className="fd-diet-h-meta">· {formatNumber(kcal, 0)} kcal</span>
      </h2>
      {entries.length === 0 ? (
        <p className="tight">
          Nic jeszcze nie zapisane. Odhacz pozycję planu albo dodaj, co zjadłeś – liczy się to, co naprawdę zjedzone.
        </p>
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
                    ? ` · B ${formatNumber(e.protein, 0)} · W ${formatNumber(e.carbs ?? 0, 0)} · T ${formatNumber(e.fat ?? 0, 0)}`
                    : ' · makro nieznane'}
                  {e.amountLabel && ` · ${e.amountLabel}`}
                </p>
              </div>
              <StarButton food={entryFood(e)} />
              <button
                type="button"
                className="fd-diet-icon-btn"
                onClick={() => e.id && void db.entries.delete(e.id)}
                aria-label={`Usuń: ${e.name}`}
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
        {nearby.source === 'nearby' ? (
          <>
            Propozycje biorą pod uwagę sklepy w pobliżu:{' '}
            {nearby.chains
              .slice(0, 5)
              .map((c) => `${name(c.chain)} ${formatDistance(c.nearest.distance)}`)
              .join(' · ')}
            .
          </>
        ) : nearby.source === 'preferred' && preferred ? (
          <>Planuję pod sklep {name(preferred)} – nie znam sklepów wokół Ciebie.</>
        ) : (
          <>Nie znam sklepów wokół Ciebie – propozycje biorą pod uwagę wszystkie sieci.</>
        )}{' '}
        <a href={NEARBY_PATH}>{nearby.source === 'nearby' ? 'Odśwież w „W pobliżu”' : 'Otwórz „W pobliżu”'}</a>
      </span>
    </p>
  );
}

/** Stan bazy produktów pod „Co teraz?”: przepisy i produkty dochodzą do propozycji, gdy się wczyta. */
function DatasetLine({ food }: { food: FoodPool }) {
  const { data } = food;
  if (data.status === 'loading')
    return <p className="tight">Wczytuję bazę produktów — przepisy i produkty zaraz dojdą.</p>;
  if (data.status === 'ready') return null;
  return (
    <p className="tight fd-diet-warn">
      {data.message === MISSING_DATA_MESSAGE
        ? 'Bez bazy produktów proponuję tylko z planu i Twojego jedzenia.'
        : `${data.message} Proponuję na razie z planu i Twojego jedzenia.`}{' '}
      {data.message !== MISSING_DATA_MESSAGE && (
        <button type="button" className="fd-diet-link" onClick={data.retry}>
          Spróbuj ponownie
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
 * Waga, kroki i ruch dnia — z danych treningowych, jedno źródło. Pola zapisują przez most: waga
 * trafia do dziennika wagi (ta sama, co na ekranie Dziś i w profilu), kroki — jako zwykły wpis
 * kroków, więc liczą się do odznak i kalorii jak każdy inny. Trening i jego kalorie tylko się
 * czyta: dziennik treningów jest jeden.
 */
function BodyCard({ date, today, body }: { date: string; today: string; body: DayRow }) {
  const bridge = useBridge();
  const move = bridge.moveOn(date);
  const [weight, setWeight] = useState(body.weightKg != null ? String(body.weightKg).replace('.', ',') : '');
  const [steps, setSteps] = useState(body.steps != null ? String(body.steps) : '');
  const kg = numberOrNull(weight);
  const walked = numberOrNull(steps);
  const weightBad = weight.trim() !== '' && !validWeight(kg);
  const newWeight = kg !== null && validWeight(kg) && kg !== (body.weightKg ?? null);
  const newSteps = walked !== null && Math.round(walked) !== (body.steps ?? null);
  const future = date > today;
  const isToday = date === today;

  const save = (e: FormEvent) => {
    e.preventDefault();
    // Dzień z dziennika (data lokalna), nie „dziś” treningów — patrz `dayKey` w treningach (UTC).
    if (newWeight && kg !== null) bridge.setWeight(kg, date);
    if (newSteps && walked !== null) bridge.setSteps(date, Math.round(walked));
  };

  const noKcal = move.workoutKcal === null && move.cardioKcal === null;
  const parts = [
    move.trained || (move.workoutKcal ?? 0) > 0
      ? `trening${move.workoutKcal ? ` ${kcalText(move.workoutKcal)}` : ''}`
      : null,
    (move.cardioKcal ?? 0) > 0 ? `kroki i cardio ${kcalText(move.cardioKcal ?? 0)}` : null,
  ].filter(Boolean);

  return (
    <section className="grp" aria-labelledby="fd-diet-body-title">
      <h2 id="fd-diet-body-title">Waga, kroki i ruch</h2>
      {future ? (
        <p className="tight">Wagę i kroki wpiszesz tego dnia.</p>
      ) : (
        <form className="fd-diet-body" onSubmit={save} noValidate>
          <label className="fld">
            <span>Waga, kg</span>
            <input
              type="text"
              className="num"
              inputMode="decimal"
              autoComplete="off"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              aria-invalid={weightBad || undefined}
              aria-describedby="fd-diet-body-hint"
            />
          </label>
          <label className="fld">
            <span>Kroki</span>
            <input
              type="text"
              className="num"
              inputMode="numeric"
              autoComplete="off"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </label>
          <button type="submit" className="btn sm" disabled={!newWeight && !newSteps}>
            Zapisz
          </button>
        </form>
      )}
      {!future && (
        <p className={`tight${weightBad ? ' fd-diet-warn' : ''}`} id="fd-diet-body-hint">
          {weightBad
            ? `Waga od ${WEIGHT_RANGE.min} do ${WEIGHT_RANGE.max} kg.`
            : 'Waga trafia do dziennika wagi, a kroki do kroków w treningach — wpisane tu czy tam, to te same liczby.'}
        </p>
      )}
      <p className="tight">
        <b>{isToday ? 'Ruch dziś' : 'Ruch tego dnia'}:</b>{' '}
        {noKcal
          ? move.trained
            ? 'był trening — kalorie policzę po pierwszym ważeniu.'
            : 'kalorie ruchu policzę po pierwszym ważeniu.'
          : parts.length
            ? `${parts.join(' · ')}.`
            : 'bez treningu i cardio.'}
      </p>
      <p className="tight fd-diet-soft">
        To tylko informacja — nie dodaję tego do celu kalorii: współczynnik aktywności w profilu diety już zakłada
        treningi.
      </p>
    </section>
  );
}
