import { CalendarCheck } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { text } from '../../../i18n';
import { Segmented } from '../../../components/ui';
import { useBridge } from '../../bridge';
import { paceKgPerWeek } from '../../diet/energy';
import { addDays } from '../../diet/model';
import { DIET_PROFILES } from '../../diet/profiles';
import type { Profile } from '../../diet/types';
import { useDataset } from '../../hooks/useDataset';
import { useClock, useFavorites, useMergedHistory, useNearbyChains } from '../../hooks/useDiet';
import { formatNumber } from '../../lib/format';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { formatDistance } from '../../nearby/geo';
import { onlineShop } from '../../online/shops';
import { chainsWithFood } from '../../recipes/chains';
import { recipeIndex, type RecipeIndex } from '../../recipes/resolve';
import { planDates } from '../../prep/blocks';
import { EXCLUSION_LABELS, planRecipes } from '../../prep/candidates';
import { checkIn as runCheckIn, WINDOW_DAYS, type CheckIn } from '../../prep/checkin';
import { goalName, shortDate } from '../../prep/format';
import { generatePlan, newSeed } from '../../prep/generate';
import { latestPlan, planEnd, startPlan } from '../../prep/store';
import { planTargets } from '../../prep/targets';
import { MAX_DAYS, MIN_DAYS, NAME_MAX, cleanName, type Cooking, type Exclusion, type PrepPlan } from '../../prep/types';
import { StatusScreen } from '../common/StatusScreen';
import './prep.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const EXCLUSIONS = Object.keys(EXCLUSION_LABELS) as Exclusion[];

const T = text({
  pl: {
    saveFailed: 'Nie udało się zapisać planu na tym urządzeniu — spróbuj jeszcze raz.',
    readyGoal: (days: number, kcal: string, was: string) =>
      `Plan na ${days} dni gotowy. Cel kalorii w profilu: ${kcal} kcal (było ${was}).`,
    ready: (days: number) => `Plan na ${days} dni gotowy — lista zakupów czeka.`,
    next: 'Następny plan z zakupami',
    title: 'Plan z listą zakupów',
    intro:
      'Jedzenie na kolejne dni dla jednej osoby, pod Twój cel i jeden sklep — z listą zakupów, obiadami gotowanymi na zapas (najwyżej 4 dni w lodówce) i odhaczaniem w dzienniku.',
    start: 'Od kiedy',
    today: (date: string) => `dziś, ${date}`,
    tomorrow: (date: string) => `jutro, ${date}`,
    length: 'Na ile dni',
    days: (n: number) => `${n} dni${n === 7 ? ' (tydzień)' : n === 14 ? ' (dwa tygodnie)' : ''}`,
    meals: 'Posiłki dziennie',
    cooking: 'Gotowanie na zapas',
    lunchBox: 'Obiad z pudełka',
    bothBoxes: 'Obiad i kolacja z pudełka',
    store: 'Sklep (jedna wizyta)',
    online: 'Zamówienie przez internet',
    noOrder: 'bez zamówienia',
    more: (shop: string, n: number) => `${shop} · +${n} przepisów`,
    name: 'Nazwa planu (nieobowiązkowa)',
    exclude: 'Czego nie jesz',
    goal: 'Cel planu',
    working: 'Liczę Twoje tempo z wagi i zapisów…',
    kcalLegend: 'Cel kalorii planu',
    maintenance: 'utrzymanie',
    fitted: 'dopasowany do Twojego tempa',
    recommended: '(zalecane)',
    asProfile: '— jak w profilu diety',
    goalLine: (goal: string, kcal: string, style: string, protein: number, carbsMax: number | null) =>
      `${goal} · ${kcal} kcal dziennie · ${style} · białko ${protein} g${carbsMax !== null ? ` · węglowodany do ${carbsMax} g` : ''}.`,
    willSave: 'Zapiszę ten cel w profilu diety, żeby dziennik liczył tak samo.',
    making: 'Układam…',
    make: 'Ułóż plan',
    cancel: 'Anuluj',
  },
  en: {
    saveFailed: 'Couldn’t save the plan on this device — try again.',
    readyGoal: (days: number, kcal: string, was: string) =>
      `Your ${days}-day plan is ready. Calorie goal in your profile: ${kcal} kcal (was ${was}).`,
    ready: (days: number) => `Your ${days}-day plan is ready — the shopping list is waiting.`,
    next: 'Next plan & shopping',
    title: 'Plan with a shopping list',
    intro:
      'Food for the coming days for one person, for your goal and one shop — with a shopping list, lunches cooked ahead (at most 4 days in the fridge) and ticking off in the diary.',
    start: 'Starting',
    today: (date: string) => `today, ${date}`,
    tomorrow: (date: string) => `tomorrow, ${date}`,
    length: 'How many days',
    days: (n: number) => `${n} days${n === 7 ? ' (a week)' : n === 14 ? ' (two weeks)' : ''}`,
    meals: 'Meals a day',
    cooking: 'Batch cooking',
    lunchBox: 'Lunch from a box',
    bothBoxes: 'Lunch and dinner from a box',
    store: 'Shop (one visit)',
    online: 'Online order',
    noOrder: 'no order',
    more: (shop: string, n: number) => `${shop} · +${n} recipes`,
    name: 'Plan name (optional)',
    exclude: 'What you don’t eat',
    goal: 'Plan goal',
    working: 'Working out your pace from your weight and logs…',
    kcalLegend: 'The plan’s calorie goal',
    maintenance: 'maintenance',
    fitted: 'fitted to your pace',
    recommended: '(recommended)',
    asProfile: '— as in your diet profile',
    goalLine: (goal: string, kcal: string, style: string, protein: number, carbsMax: number | null) =>
      `${goal} · ${kcal} kcal a day · ${style} · protein ${protein} g${carbsMax !== null ? ` · carbs up to ${carbsMax} g` : ''}.`,
    willSave: 'I’ll save this goal in your diet profile so the diary counts the same way.',
    making: 'Making the plan…',
    make: 'Make the plan',
    cancel: 'Cancel',
  },
});

interface Props {
  profile: Profile;
  plans: PrepPlan[];
  today: string;
  /** The last plan already made: the next one starts the day after it ends. */
  after: PrepPlan | null;
  onDone: () => void;
  onCancel?: () => void;
}

/**
 * Nowy plan z listą zakupów: od kiedy, na ile dni, ile posiłków, co z pudełek, sklep (i jedno
 * zamówienie przez internet), czego nie jesz — i cel kalorii, który check-in dopasował do wagi
 * i zapisów. Baza produktów musi być wczytana: przepisy kupuje się w prawdziwych sklepach.
 */
export function PrepForm(props: Props) {
  const data = useDataset();
  if (data.status === 'loading') return <StatusScreen kind="loading" />;
  if (data.status === 'error') return <StatusScreen kind="error" message={data.message} onRetry={data.retry} />;
  return <Form {...props} products={data.products} dict={data.dataset.dictionaries} />;
}

function Form({
  profile,
  plans,
  today,
  after,
  onDone,
  onCancel,
  products,
  dict,
}: Props & { products: IndexedProduct[]; dict: Dictionaries }) {
  const bridge = useBridge();
  const clock = useClock();
  const favorites = useFavorites();
  const history = useMergedHistory(addDays(today, -WINDOW_DAYS));
  const index = recipeIndex(products);
  const nearby = useNearbyChains(chainsWithFood(products), profile.preferredStore, clock.ms);
  const last = latestPlan(plans)?.settings ?? null;
  const storeName = (key: string) => dict.stores[key] ?? onlineShop(key)?.name ?? key;

  // The person as the model sees them: height from the gym profile, the last weigh-in.
  const body = useMemo(() => ({ ...profile, heightCm: bridge.heightCm ?? profile.heightCm }), [profile, bridge.heightCm]);
  const weight = [...bridge.weights].reverse().find((w) => w.day <= today)?.kg ?? profile.startWeightKg;

  const firstStore =
    nearby.chains.map((c) => c.chain).find((c) => index.ranking.includes(c)) ??
    (last && index.ranking.includes(last.store) ? last.store : null) ??
    (profile.preferredStore && index.ranking.includes(profile.preferredStore) ? profile.preferredStore : null) ??
    index.ranking[0] ??
    '';
  const startOptions = Array.from({ length: 15 }, (_, i) => addDays(today, i));
  const nextDay = after ? addDays(planEnd(after), 1) : null;
  const firstStart = nextDay && nextDay <= startOptions.at(-1)! ? nextDay : clock.hour < 12 ? today : addDays(today, 1);

  const [start, setStart] = useState(firstStart);
  const [days, setDays] = useState(last?.days ?? 7);
  const [meals, setMeals] = useState<3 | 4 | 5>(last?.meals ?? 4);
  const [cooking, setCooking] = useState<Cooking>(last?.cooking ?? 'lunch');
  const [store, setStore] = useState(firstStore);
  const [online, setOnline] = useState<string | null>(last?.online && index.online.includes(last.online) ? last.online : null);
  const [exclude, setExclude] = useState<Exclusion[]>(last?.exclude ?? []);
  const [useCheckIn, setUseCheckIn] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check: CheckIn | null = useMemo(
    () => (history ? runCheckIn({ profile: body, days: history.days.values(), eaten: history.eaten, today }) : null),
    [history, body, today],
  );
  const adjusts = check !== null && check.suggestedKcal !== profile.dailyKcal;
  const kcal = adjusts && useCheckIn ? check.suggestedKcal : profile.dailyKcal;
  const style = DIET_PROFILES[profile.dietProfile];
  const targets = style.targets(kcal, profile.targetWeightKg);
  // The pace of the goal chosen: with the check-in's correction when its goal is chosen.
  const pace = paceKgPerWeek(adjusts && useCheckIn ? { ...body, kcalCorrection: check.correction } : body, weight, kcal);

  // What an online order adds: recipes the shop alone cannot make.
  const extra = useMemo(() => recipesAdded(recipeIndex(products), store, exclude, profile), [products, store, exclude, profile]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!history || busy) return;
    setBusy(true);
    setError(null);
    const source = adjusts && useCheckIn ? 'checkin' : 'profile';
    // Accepted, the check-in's goal carries its correction, so the next check-in starts from the model's goal.
    const planned =
      source === 'checkin' && check
        ? { ...profile, dailyKcal: kcal, kcalCorrection: check.correction, goalSince: today }
        : profile;
    const result = generatePlan({
      settings: { start, days, meals, cooking, store, online, exclude, seed: newSeed(), avoid: [] },
      index,
      dict,
      dayTargets: planTargets({ profile: planned, kcal, eaten: history.eaten, today, dates: planDates(start, days) }),
      goal: { kcal, source, dietProfile: profile.dietProfile, styleLabel: style.label, pace, weightKg: weight },
      checkIn: check,
      favorites: new Set((favorites ?? []).filter((f) => f.key.startsWith('recipe:')).map((f) => f.key.slice(7))),
    });
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    const own = cleanName(name);
    try {
      // The adjusted goal is the profile's goal from now on: the diary and the plan say the same number.
      await startPlan(own ? { ...result.plan, name: own } : result.plan, source === 'checkin' ? planned : null);
    } catch {
      setError(T.saveFailed);
      setBusy(false);
      return;
    }
    bridge.toast(
      source === 'checkin'
        ? T.readyGoal(days, formatNumber(kcal, 0), formatNumber(profile.dailyKcal, 0))
        : T.ready(days),
    );
    setBusy(false);
    onDone();
    // The plan takes the form's place: its name and actions are at the top, not where „Ułóż plan” was.
    document.scrollingElement?.scrollTo?.({ top: 0 });
  };

  const toggle = (x: Exclusion) => setExclude((list) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]));

  return (
    <form className="grp fd-prep-form" onSubmit={(e) => void submit(e)} aria-labelledby="fd-prep-form-title" noValidate>
      <h2 id="fd-prep-form-title" className="today-name">
        {after ? T.next : T.title}
      </h2>
      <p>{T.intro}</p>

      <div className="fd-prep-fields">
        <label className="fld">
          <span>{T.start}</span>
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            {startOptions.map((d) => (
              <option key={d} value={d}>
                {d === today ? T.today(shortDate(d)) : d === addDays(today, 1) ? T.tomorrow(shortDate(d)) : shortDate(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>{T.length}</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => MIN_DAYS + i).map((n) => (
              <option key={n} value={n}>
                {T.days(n)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <span className="seg-label">{T.meals}</span>
      <Segmented<'3' | '4' | '5'>
        label={T.meals}
        value={String(meals) as '3' | '4' | '5'}
        onChange={(v) => setMeals(Number(v) as 3 | 4 | 5)}
        options={[
          { key: '3', label: '3' },
          { key: '4', label: '4' },
          { key: '5', label: '5' },
        ]}
      />
      <span className="seg-label">{T.cooking}</span>
      <Segmented<Cooking>
        label={T.cooking}
        value={cooking}
        onChange={setCooking}
        options={[
          { key: 'lunch', label: T.lunchBox },
          { key: 'both', label: T.bothBoxes },
        ]}
      />

      <div className="fd-prep-fields">
        <label className="fld">
          <span>{T.store}</span>
          <select value={store} onChange={(e) => setStore(e.target.value)}>
            {index.ranking.map((key) => {
              const near = nearby.chains.find((c) => c.chain === key);
              return (
                <option key={key} value={key}>
                  {storeName(key)}
                  {near ? ` · ${formatDistance(near.nearest.distance)}` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <label className="fld">
          <span>{T.online}</span>
          <select value={online ?? ''} onChange={(e) => setOnline(e.target.value || null)}>
            <option value="">{T.noOrder}</option>
            {index.online.map((key) => (
              <option key={key} value={key}>
                {T.more(storeName(key), extra.get(key) ?? 0)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="fld">
        <span>{T.name}</span>
        <input
          type="text"
          value={name}
          maxLength={NAME_MAX}
          placeholder={`${style.label} · ${storeName(store)}`}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="chips" role="group" aria-label={T.exclude}>
        {EXCLUSIONS.map((x) => (
          <button key={x} type="button" aria-pressed={exclude.includes(x)} onClick={() => toggle(x)}>
            {EXCLUSION_LABELS[x]}
          </button>
        ))}
      </div>

      <section className="fd-prep-goal" aria-labelledby="fd-prep-goal-title">
        <h3 id="fd-prep-goal-title">{T.goal}</h3>
        {!check ? (
          <p className="tight">{T.working}</p>
        ) : adjusts ? (
          <fieldset className="fd-prep-kcal">
            <legend className="sr-only">{T.kcalLegend}</legend>
            <label className="check-row">
              <input type="radio" name="fd-prep-kcal" checked={useCheckIn} onChange={() => setUseCheckIn(true)} />
              <span>
                <b>{formatNumber(check.suggestedKcal, 0)} kcal</b> — {check.status === 'cel' ? T.maintenance : T.fitted}{' '}
                {T.recommended}
              </span>
            </label>
            <label className="check-row">
              <input type="radio" name="fd-prep-kcal" checked={!useCheckIn} onChange={() => setUseCheckIn(false)} />
              <span>
                <b>{formatNumber(profile.dailyKcal, 0)} kcal</b> {T.asProfile}
              </span>
            </label>
          </fieldset>
        ) : null}
        {check && <p className="tight fd-prep-reason">{check.reason}</p>}
        <p className="tight">
          <CalendarCheck {...ICON} className="fd-prep-ico" />{' '}
          {T.goalLine(goalName(pace), formatNumber(kcal, 0), style.label, targets.protein.target, targets.carbs.max)}{' '}
          {adjusts && useCheckIn ? T.willSave : ''}
        </p>
      </section>

      {error && (
        <p className="fd-prep-error" role="alert">
          {error}
        </p>
      )}
      <div className="fd-prep-actions">
        <button type="submit" className="btn" disabled={!history || busy || !store}>
          {busy ? T.making : T.make}
        </button>
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            {T.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

/** How many more recipes each online shop makes possible next to this physical shop. */
function recipesAdded(index: RecipeIndex, store: string, exclude: Exclusion[], profile: Profile): Map<string, number> {
  const dietProfile = DIET_PROFILES[profile.dietProfile];
  const count = (basket: string[]) => planRecipes({ candidates: index.candidates, basket, dietProfile, exclude }).length;
  const alone = count([store]);
  return new Map(index.online.map((shop) => [shop, Math.max(0, count([store, shop]) - alone)]));
}
