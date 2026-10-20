import { CalendarCheck } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Segmented } from '../../../components/ui';
import { useBridge } from '../../bridge';
import { paceKgPerWeek } from '../../diet/energy';
import { addDays } from '../../diet/model';
import { DIET_PROFILES } from '../../diet/profiles';
import { saveProfile } from '../../diet/store';
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
import { latestPlan, planEnd, savePrepPlan } from '../../prep/store';
import { planTargets } from '../../prep/targets';
import { MAX_DAYS, MIN_DAYS, type Cooking, type Exclusion, type PrepPlan } from '../../prep/types';
import { StatusScreen } from '../common/StatusScreen';
import './prep.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const EXCLUSIONS = Object.keys(EXCLUSION_LABELS) as Exclusion[];

interface Props {
  profile: Profile;
  plans: PrepPlan[];
  today: string;
  /** The plan the form follows (the next shopping starts after it). */
  current: PrepPlan | null;
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
  current,
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
  const nextDay = current ? addDays(planEnd(current), 1) : null;
  const firstStart = nextDay && nextDay <= startOptions.at(-1)! ? nextDay : clock.hour < 12 ? today : addDays(today, 1);

  const [start, setStart] = useState(firstStart);
  const [days, setDays] = useState(last?.days ?? 7);
  const [meals, setMeals] = useState<3 | 4 | 5>(last?.meals ?? 4);
  const [cooking, setCooking] = useState<Cooking>(last?.cooking ?? 'lunch');
  const [store, setStore] = useState(firstStore);
  const [online, setOnline] = useState<string | null>(last?.online && index.online.includes(last.online) ? last.online : null);
  const [exclude, setExclude] = useState<Exclusion[]>(last?.exclude ?? []);
  const [useCheckIn, setUseCheckIn] = useState(true);
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
  const pace = paceKgPerWeek(body, weight, kcal);

  // What an online order adds: recipes the shop alone cannot make.
  const extra = useMemo(() => recipesAdded(recipeIndex(products), store, exclude, profile), [products, store, exclude, profile]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!history || busy) return;
    setBusy(true);
    setError(null);
    const source = adjusts && useCheckIn ? 'checkin' : 'profile';
    // Accepted, the check-in's goal carries its correction, so the next check-in starts from the model's goal.
    const planned = source === 'checkin' && check ? { ...profile, dailyKcal: kcal, kcalCorrection: check.correction } : profile;
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
    // The adjusted goal is the profile's goal from now on: the diary and the plan say the same number.
    if (source === 'checkin') await saveProfile(planned);
    await savePrepPlan(result.plan);
    bridge.toast(
      source === 'checkin'
        ? `Plan na ${days} dni gotowy. Cel kalorii w profilu: ${formatNumber(kcal, 0)} kcal (było ${formatNumber(profile.dailyKcal, 0)}).`
        : `Plan na ${days} dni gotowy — lista zakupów czeka.`,
    );
    setBusy(false);
    onDone();
  };

  const toggle = (x: Exclusion) => setExclude((list) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]));

  return (
    <form className="grp fd-prep-form" onSubmit={(e) => void submit(e)} aria-labelledby="fd-prep-form-title" noValidate>
      <h2 id="fd-prep-form-title" className="today-name">
        {current ? 'Następny plan z zakupami' : 'Plan z listą zakupów'}
      </h2>
      <p>
        Jedzenie na kolejne dni dla jednej osoby, pod Twój cel i jeden sklep — z listą zakupów, obiadami gotowanymi na
        zapas (najwyżej 4 dni w lodówce) i odhaczaniem w dzienniku.
      </p>

      <div className="fd-prep-fields">
        <label className="fld">
          <span>Od kiedy</span>
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            {startOptions.map((d) => (
              <option key={d} value={d}>
                {d === today ? `dziś, ${shortDate(d)}` : d === addDays(today, 1) ? `jutro, ${shortDate(d)}` : shortDate(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>Na ile dni</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => MIN_DAYS + i).map((n) => (
              <option key={n} value={n}>
                {n} dni{n === 7 ? ' (tydzień)' : n === 14 ? ' (dwa tygodnie)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <span className="seg-label">Posiłki dziennie</span>
      <Segmented<'3' | '4' | '5'>
        label="Posiłki dziennie"
        value={String(meals) as '3' | '4' | '5'}
        onChange={(v) => setMeals(Number(v) as 3 | 4 | 5)}
        options={[
          { key: '3', label: '3' },
          { key: '4', label: '4' },
          { key: '5', label: '5' },
        ]}
      />
      <span className="seg-label">Gotowanie na zapas</span>
      <Segmented<Cooking>
        label="Gotowanie na zapas"
        value={cooking}
        onChange={setCooking}
        options={[
          { key: 'lunch', label: 'Obiad z pudełka' },
          { key: 'both', label: 'Obiad i kolacja z pudełka' },
        ]}
      />

      <div className="fd-prep-fields">
        <label className="fld">
          <span>Sklep (jedna wizyta)</span>
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
          <span>Zamówienie przez internet</span>
          <select value={online ?? ''} onChange={(e) => setOnline(e.target.value || null)}>
            <option value="">bez zamówienia</option>
            {index.online.map((key) => (
              <option key={key} value={key}>
                {storeName(key)} · +{extra.get(key) ?? 0} przepisów
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="chips" role="group" aria-label="Czego nie jesz">
        {EXCLUSIONS.map((x) => (
          <button key={x} type="button" aria-pressed={exclude.includes(x)} onClick={() => toggle(x)}>
            {EXCLUSION_LABELS[x]}
          </button>
        ))}
      </div>

      <section className="fd-prep-goal" aria-labelledby="fd-prep-goal-title">
        <h3 id="fd-prep-goal-title">Cel planu</h3>
        {!check ? (
          <p className="tight">Liczę Twoje tempo z wagi i zapisów…</p>
        ) : adjusts ? (
          <fieldset className="fd-prep-kcal">
            <legend className="sr-only">Cel kalorii planu</legend>
            <label className="check-row">
              <input type="radio" name="fd-prep-kcal" checked={useCheckIn} onChange={() => setUseCheckIn(true)} />
              <span>
                <b>{formatNumber(check.suggestedKcal, 0)} kcal</b> — {check.status === 'cel' ? 'utrzymanie' : 'dopasowany do Twojego tempa'}{' '}
                (zalecane)
              </span>
            </label>
            <label className="check-row">
              <input type="radio" name="fd-prep-kcal" checked={!useCheckIn} onChange={() => setUseCheckIn(false)} />
              <span>
                <b>{formatNumber(profile.dailyKcal, 0)} kcal</b> — jak w profilu diety
              </span>
            </label>
          </fieldset>
        ) : null}
        {check && <p className="tight fd-prep-reason">{check.reason}</p>}
        <p className="tight">
          <CalendarCheck {...ICON} className="fd-prep-ico" /> {goalName(pace)} · {formatNumber(kcal, 0)} kcal dziennie · {style.label}{' '}
          · białko {targets.protein.target} g
          {targets.carbs.max !== null ? ` · węglowodany do ${targets.carbs.max} g` : ''}.{' '}
          {adjusts && useCheckIn ? 'Zapiszę ten cel w profilu diety, żeby dziennik liczył tak samo.' : ''}
        </p>
      </section>

      {error && (
        <p className="fd-prep-error" role="alert">
          {error}
        </p>
      )}
      <div className="fd-prep-actions">
        <button type="submit" className="btn" disabled={!history || busy || !store}>
          {busy ? 'Układam…' : 'Ułóż plan'}
        </button>
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Anuluj
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
