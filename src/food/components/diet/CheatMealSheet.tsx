import { useState } from 'react';
import { Segmented } from '../../../components/ui';
import { simulateCheat } from '../../diet/cheat';
import type { DayTotals } from '../../diet/day';
import type { PlannedCheat } from '../../diet/db';
import { autoSetName, setTotals, type Food } from '../../diet/foods';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { mealsLeftAt, remainingOf } from '../../diet/model';
import { DIET_PROFILES } from '../../diet/profiles';
import { eatCheat, planCheat } from '../../diet/store';
import type { Remaining, RestVariant, Suggestion } from '../../diet/suggest';
import { targetOn } from '../../diet/target';
import type { Profile } from '../../diet/types';
import { formatNumber } from '../../lib/format';
import { text } from '../../../i18n';
import { Sheet } from '../common/Sheet';
import { macroTexts, planText, scaleText, verdictText } from './cheatText';
import { DT } from './dietText';
import { useKcalShown } from './kcalShown';
import { PartsPicker, badGrams, partsOf, type Part } from './PartsPicker';
import { RestVariants } from './RestVariants';
import { MacroLine } from './SuggestionList';

const T = text({
  pl: {
    title: 'Większy posiłek',
    subtitle: 'Wybierz z listy albo wpisz makro — zobaczysz, ile zostaje na resztę dnia',
    saved: (label: string, kcal: string) => `Zapisane: ${label} · ${kcal}.`,
    planned: (label: string, kcal: string) =>
      `Większy posiłek zaplanowany: ${label} · ${kcal}. Reszta dnia liczy się już z nim.`,
    source: 'Skąd liczby',
    fromList: 'Z listy',
    enterMacros: 'Wpisz makro',
    what: 'Co to będzie',
    whatPlaceholder: 'np. pizza ze znajomymi',
    inMeal: 'W większym posiłku',
    empty:
      'Wyszukaj w lokalach (pizza, burger, kebab…) i produktach albo wybierz z ulubionych poniżej. Kilka rzeczy złoży się w jeden posiłek.',
    search: 'Szukaj do większego posiłku',
    remove: 'Usuń z większego posiłku',
    macrosHint: 'Makroskładniki – jeśli znasz:',
    result: 'Co z tego wynika',
    goal: (today: boolean) => `Cel ${today ? 'na dziś' : 'tego dnia'}`,
    eaten: 'Zjedzone',
    total: 'Razem',
    enterKcal: 'Wpisz kalorie — zobaczysz, czy dzień się mieści i co zostaje na resztę.',
    restCould: 'Tak może wyglądać reszta dnia:',
    lastMeal: 'Na ostatni posiłek pasuje na przykład:',
    failed: 'Nie udało się zapisać w tej przeglądarce — spróbuj jeszcze raz.',
    saveChanges: 'Zapisz zmiany',
    plan: 'Zaplanuj',
    eatenNow: 'Zjedzone teraz',
  },
  en: {
    title: 'Bigger meal',
    subtitle: 'Pick from the list or enter the macros — you’ll see what’s left for the rest of the day',
    saved: (label: string, kcal: string) => `Saved: ${label} · ${kcal}.`,
    planned: (label: string, kcal: string) =>
      `Bigger meal planned: ${label} · ${kcal}. The rest of the day now counts with it.`,
    source: 'Where the numbers come from',
    fromList: 'From the list',
    enterMacros: 'Enter macros',
    what: 'What will it be',
    whatPlaceholder: 'e.g. pizza with friends',
    inMeal: 'In the bigger meal',
    empty:
      'Search restaurants (pizza, burger, kebab…) and products, or pick from your favourites below. Several things add up to one meal.',
    search: 'Search for the bigger meal',
    remove: 'Remove from the bigger meal',
    macrosHint: 'Macros – if you know them:',
    result: 'What it means',
    goal: (today: boolean) => (today ? 'Today’s target' : 'Target that day'),
    eaten: 'Eaten',
    total: 'Total',
    enterKcal: 'Enter the calories — you’ll see whether the day fits and what’s left for the rest of it.',
    restCould: 'The rest of the day could look like this:',
    lastMeal: 'For the last meal, for example:',
    failed: 'Couldn’t save in this browser — try again.',
    saveChanges: 'Save changes',
    plan: 'Plan it',
    eatenNow: 'Eaten now',
  },
});

interface Props {
  open: boolean;
  date: string;
  today: string;
  hour: number;
  profile: Profile;
  /** What is already logged on the day. */
  eaten: DayTotals;
  /**
   * @deprecated Ignored: the weekly balance is gone (one target a day). Accepted until the diary
   * stops passing it; removed at I2.
   */
  eatenByDate?: unknown;
  /** @deprecated Ignored: activity never changes food. Accepted until the diary stops passing it; removed at I2. */
  activity?: unknown;
  /** The day's plan in kcal (meal prep or workbook); `null` without a plan. */
  plannedKcal: number | null;
  /** The bigger meal already planned on this day — the sheet edits it. */
  planned: PlannedCheat | null;
  /**
   * Food for what is left after the bigger meal: variants of the whole rest of the day when two or
   * more meals are left, otherwise the best single meals (the diary's „Co teraz?”).
   */
  ideasFor: (remaining: Remaining, mealsLeft: number) => { variants: RestVariant[]; singles: Suggestion[] };
  /** The diary's food — search in restaurant menus, products, own food and favourites. */
  pool: Food[];
  products: IndexedProduct[];
  dict: Dictionaries;
  productsLoading: boolean;
  onClose: () => void;
  /** After a save the sheet closes and the app's message says what happened. */
  onSaved: (message: string) => void;
}

const kcalText = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;

/** Liczba z polskim przecinkiem albo kropką; `null`, gdy pole puste albo to nie liczba. */
function numberOrNull(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}

const fieldText = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));

/**
 * „Większy posiłek”: makro posiłku i od razu, pod polami, co z tego wynika dla tego dnia — czy
 * mieści się w celu dnia (±100 kcal to wciąż cel), co zostaje na pozostałe posiłki, białko i plan
 * dnia. Cel to cel tego dnia z historii celu (`targetOn`); ruch, tydzień i waga go nie zmieniają,
 * a większego dnia nie trzeba niczym odrabiać.
 *
 * „Zaplanuj” zapisuje posiłek na ten dzień — dziennik rezerwuje go w „Co teraz?”; „Zjedzone
 * teraz” zapisuje go od razu w „Zjedzone”. Treść montuje się przy każdym otwarciu od nowa.
 * W trybie bez liczenia kalorii arkusza nie ma (przycisk też znika).
 */
export function CheatMealSheet(props: Props) {
  const kcalShown = useKcalShown();
  if (!kcalShown) return null;
  return (
    <Sheet open={props.open} title={T.title} subtitle={T.subtitle} onClose={props.onClose} className="fd-diet-sheet">
      {props.open && <CheatBody {...props} />}
    </Sheet>
  );
}

function CheatBody({
  date,
  today,
  hour,
  profile,
  eaten,
  plannedKcal,
  planned,
  ideasFor,
  pool,
  products,
  dict,
  productsLoading,
  onSaved,
}: Props) {
  // Nowy posiłek zaczyna od listy (sieci, produkty, ulubione); zaplanowany — od swoich liczb.
  const [mode, setMode] = useState<'list' | 'macros'>(planned ? 'macros' : 'list');
  const [parts, setParts] = useState<Part[]>([]);
  const [name, setName] = useState(planned?.name ?? '');
  const [kcal, setKcal] = useState(fieldText(planned?.kcal));
  const [protein, setProtein] = useState(fieldText(planned?.protein));
  const [carbs, setCarbs] = useState(fieldText(planned?.carbs));
  const [fat, setFat] = useState(fieldText(planned?.fat));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const isToday = date === today;
  const future = date > today;
  // Cel dnia z historii celu: ten sam, który pokazuje dziennik tego dnia.
  const targets = DIET_PROFILES[profile.dietProfile].targets(targetOn(profile, date), profile.targetWeightKg);
  const mealsLeft = isToday ? mealsLeftAt(hour) : date < today ? 1 : 4;
  const chosen = partsOf(parts);
  const listTotal = setTotals(chosen);
  const listName = chosen.length ? autoSetName(chosen) : '';
  const items = chosen.map((p) => (p.amountLabel ? `${p.name} (${p.amountLabel})` : p.name));
  const cheatKcal = numberOrNull(kcal);
  const cheat: PlannedCheat | null =
    mode === 'list'
      ? chosen.length && !parts.some(badGrams) && listTotal.kcal > 0
        ? { name: name.trim() || listName, ...listTotal, items }
        : null
      : cheatKcal !== null && cheatKcal > 0
        ? {
            name: name.trim(),
            kcal: Math.round(cheatKcal),
            protein: numberOrNull(protein),
            carbs: numberOrNull(carbs),
            fat: numberOrNull(fat),
            ...(planned?.items && { items: planned.items }),
          }
        : null;

  // „Wpisz makro” zaczyna od sumy z listy — do poprawienia, nie do przepisania.
  const switchMode = (next: 'list' | 'macros') => {
    if (next === 'macros' && chosen.length) {
      setKcal(fieldText(listTotal.kcal));
      setProtein(fieldText(listTotal.protein));
      setCarbs(fieldText(listTotal.carbs));
      setFat(fieldText(listTotal.fat));
      if (!name.trim()) setName(listName);
    }
    setMode(next);
  };
  const sim = cheat
    ? simulateCheat({
        cheat,
        targets,
        eaten,
        mealsLeft,
        plannedLeftKcal: plannedKcal !== null ? Math.max(0, plannedKcal - eaten.kcal) : null,
      })
    : null;
  const after = cheat
    ? {
        ...eaten,
        kcal: eaten.kcal + cheat.kcal,
        protein: eaten.protein + (cheat.protein ?? 0),
        carbs: eaten.carbs + (cheat.carbs ?? 0),
        fat: eaten.fat + (cheat.fat ?? 0),
      }
    : eaten;
  // Propozycje na resztę dnia, gdy zostaje więcej niż pasmo celu (100 kcal).
  const ideas =
    sim && sim.restMeals > 0 && sim.left > 100 ? ideasFor(remainingOf(targets, after), sim.restMeals) : null;
  const scale = sim ? scaleText(sim) : null;

  const save = async (eat: boolean) => {
    if (!cheat || busy) return;
    setBusy(true);
    setFailed(false);
    const label = cheat.name || T.title;
    try {
      if (eat) await eatCheat(date, cheat);
      else await planCheat(date, cheat);
      onSaved(eat ? T.saved(label, kcalText(cheat.kcal)) : T.planned(label, kcalText(cheat.kcal)));
    } catch {
      // Komunikat aplikacji stoi pod arkuszem — błąd mówi pasek arkusza.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="fd-diet-quick fd-diet-cheatform"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
    >
      <Segmented
        label={T.source}
        options={[
          { key: 'list', label: T.fromList },
          { key: 'macros', label: T.enterMacros },
        ]}
        value={mode}
        onChange={switchMode}
      />
      <label className="fld">
        <span>{T.what}</span>
        <input
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder={listName || T.whatPlaceholder}
        />
      </label>
      {mode === 'list' ? (
        <PartsPicker
          parts={parts}
          onParts={setParts}
          pool={pool}
          products={products}
          dict={dict}
          productsLoading={productsLoading}
          heading={T.inMeal}
          empty={T.empty}
          searchLabel={T.search}
          removeLabel={T.remove}
          totalName={name.trim() || listName}
          showOwnWhenEmpty
        />
      ) : (
        <>
          <label className="fld">
            <span>{DT.kcalField}</span>
            <input
              type="text"
              className="num"
              required
              inputMode="decimal"
              autoComplete="off"
              data-autofocus
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
            />
          </label>
          <p className="fd-diet-hint">{T.macrosHint}</p>
          <div className="fd-diet-grid3">
            {(
              [
                [DT.proteinG, protein, setProtein],
                [DT.carbsG, carbs, setCarbs],
                [DT.fatG, fat, setFat],
              ] as const
            ).map(([label, value, setValue]) => (
              <label key={label} className="fld">
                <span>{label}</span>
                <input
                  type="text"
                  className="num"
                  inputMode="decimal"
                  autoComplete="off"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            ))}
          </div>
        </>
      )}

      <section className="fd-diet-sim" aria-label={T.result}>
        <h3>{T.result}</h3>
        <dl className="fd-diet-simrows">
          <div>
            <dt>{T.goal(isToday)}</dt>
            <dd>{kcalText(targets.kcal)}</dd>
          </div>
          <div>
            <dt>{T.eaten}</dt>
            <dd>{kcalText(eaten.kcal)}</dd>
          </div>
          <div>
            <dt>{T.title}</dt>
            <dd>{cheat ? kcalText(cheat.kcal) : '—'}</dd>
          </div>
          <div className="fd-diet-simsum">
            <dt>{T.total}</dt>
            <dd>{kcalText(eaten.kcal + (cheat?.kcal ?? 0))}</dd>
          </div>
        </dl>
        {!sim ? (
          <p className="tight">{T.enterKcal}</p>
        ) : (
          <>
            {/* Bez koloru werdyktu: słowa mówią, czy się mieści; kolor niczego nie ocenia. */}
            <p className="fd-diet-verdict" aria-live="polite">
              {verdictText(sim)}
            </p>
            {scale && <p className="tight">{scale}</p>}
            {macroTexts(sim).map((t) => (
              <p key={t} className="tight">
                {t}
              </p>
            ))}
            {planText(sim) && <p className="tight">{planText(sim)}</p>}
            {ideas && ideas.variants.length > 0 ? (
              <>
                <p className="tight">{T.restCould}</p>
                <RestVariants
                  variants={ideas.variants}
                  left={{ kcal: sim.left, protein: Math.max(0, sim.protein) }}
                />
              </>
            ) : (
              ideas &&
              ideas.singles.length > 0 && (
                <>
                  <p className="tight">{T.lastMeal}</p>
                  <ul className="fd-diet-simideas">
                    {ideas.singles.map((s) => (
                      <li key={s.food.key}>
                        <span className="fd-diet-name">{s.food.name}</span> <MacroLine food={s.food} />
                      </li>
                    ))}
                  </ul>
                </>
              )
            )}
          </>
        )}
      </section>

      {failed && (
        <p className="tight fd-diet-warn" role="alert">
          {T.failed}
        </p>
      )}
      <div className="actions fd-diet-cheatacts">
        <button type="submit" className="btn" disabled={!cheat || busy}>
          {planned ? T.saveChanges : T.plan}
        </button>
        <button type="button" className="btn ghost" disabled={!cheat || busy || future} onClick={() => void save(true)}>
          {T.eatenNow}
        </button>
      </div>
    </form>
  );
}
