import { useState } from 'react';
import { Segmented } from '../../../components/ui';
import { TYPICAL_FALLBACK_KCAL, type Assumptions } from '../../diet/activity';
import { simulateCheat } from '../../diet/cheat';
import type { DayTotals } from '../../diet/day';
import type { PlannedCheat } from '../../diet/db';
import { autoSetName, setTotals, type Food } from '../../diet/foods';
import type { Dictionaries, IndexedProduct } from '../../lib/types';
import { dayGoal, mealsLeftAt, remainingOf } from '../../diet/model';
import { DIET_PROFILES } from '../../diet/profiles';
import { eatCheat, planCheat } from '../../diet/store';
import type { Remaining, RestVariant, Suggestion } from '../../diet/suggest';
import type { Profile } from '../../diet/types';
import { useBridge } from '../../bridge';
import { weightFrom, type ActivityOf } from '../../hooks/useActivity';
import { formatNumber } from '../../lib/format';
import { text } from '../../../i18n';
import { Sheet } from '../common/Sheet';
import { activityParts, signedKcal } from './activityText';
import { beyondTexts, macroTexts, planText, verdictText } from './cheatText';
import { DT } from './dietText';
import { PartsPicker, badGrams, partsOf, type Part } from './PartsPicker';
import { RestVariants } from './RestVariants';
import { MacroLine } from './SuggestionList';

const T = text({
  pl: {
    subtitle: 'Wybierz z listy albo wpisz makro — pod spodem zobaczysz, co z tego wynika',
    saved: (label: string, kcal: string) => `Zapisane: ${label} · ${kcal}.`,
    planned: (label: string, kcal: string) =>
      `Cheat meal zaplanowany: ${label} · ${kcal}. Reszta dnia liczy się już z nim.`,
    source: 'Skąd liczby',
    fromList: 'Z listy',
    enterMacros: 'Wpisz makro',
    what: 'Co to będzie',
    whatPlaceholder: 'np. pizza ze znajomymi',
    inCheat: 'W cheat mealu',
    empty:
      'Wyszukaj w lokalach (pizza, burger, kebab…) i produktach albo wybierz z ulubionych poniżej. Kilka rzeczy złoży się w jeden posiłek.',
    search: 'Szukaj do cheat mealu',
    remove: 'Usuń z cheat mealu',
    macrosHint: 'Makroskładniki – jeśli znasz:',
    moveLegend: 'Ruch do końca dnia',
    stepsGroup: 'Kroki do końca dnia',
    steps: 'Kroki',
    reachTarget: (steps: string) => `Dojdę do celu (${steps} kroków)`,
    stayNow: (steps: string) => `Zostanę przy obecnych (${steps})`,
    otherNumber: 'Inna liczba',
    stepsDone: (steps: string) => `Kroki: ${steps} — cel na dziś już jest.`,
    stepsEnd: 'Kroki na koniec dnia',
    trainingDone: (kcal: string) => `Trening zrobiony: ${kcal}.`,
    trainingGroup: 'Trening do końca dnia',
    training: 'Trening',
    plannedTraining: (name: string | null, kcal: string) =>
      `Trening z planu będzie${name ? ` („${name}”, ok. ${kcal})` : ''}`,
    noTrainingToday: 'Dziś treningu nie będzie',
    asUsual: 'Jak zwykle (profil zakłada treningi w tygodniu)',
    noTraining: 'Bez treningu',
    extraTraining: 'Zrobię dodatkowy trening',
    onlySimulation: 'Te założenia są tylko do symulacji — cel w dzienniku zmieni się, gdy ruch naprawdę się wydarzy.',
    result: 'Co z tego wynika',
    goal: (today: boolean) => `Cel ${today ? 'na dziś' : 'tego dnia'}`,
    eaten: 'Zjedzone',
    total: 'Razem',
    moveInGoal: (kcal: string, parts: string) => `Ruch w celu: ${kcal}${parts ? ` — ${parts}` : ''}.`,
    enterKcal: 'Wpisz kalorie — zobaczysz, czy dzień się mieści i co zostaje na resztę.',
    restCould: 'Tak może wyglądać reszta dnia:',
    lastMeal: 'Na ostatni posiłek pasuje na przykład:',
    failed: 'Nie udało się zapisać w tej przeglądarce — spróbuj jeszcze raz.',
    saveChanges: 'Zapisz zmiany',
    plan: 'Zaplanuj',
    eatenNow: 'Zjedzone teraz',
  },
  en: {
    subtitle: 'Pick from the list or enter the macros — below you’ll see what it means',
    saved: (label: string, kcal: string) => `Saved: ${label} · ${kcal}.`,
    planned: (label: string, kcal: string) =>
      `Cheat meal planned: ${label} · ${kcal}. The rest of the day now counts with it.`,
    source: 'Where the numbers come from',
    fromList: 'From the list',
    enterMacros: 'Enter macros',
    what: 'What will it be',
    whatPlaceholder: 'e.g. pizza with friends',
    inCheat: 'In the cheat meal',
    empty:
      'Search restaurants (pizza, burger, kebab…) and products, or pick from your favourites below. Several things add up to one meal.',
    search: 'Search for the cheat meal',
    remove: 'Remove from the cheat meal',
    macrosHint: 'Macros – if you know them:',
    moveLegend: 'Activity for the rest of the day',
    stepsGroup: 'Steps for the rest of the day',
    steps: 'Steps',
    reachTarget: (steps: string) => `I’ll reach the goal (${steps} steps)`,
    stayNow: (steps: string) => `I’ll stay where I am (${steps})`,
    otherNumber: 'Another number',
    stepsDone: (steps: string) => `Steps: ${steps} — today’s goal is already reached.`,
    stepsEnd: 'Steps at the end of the day',
    trainingDone: (kcal: string) => `Workout done: ${kcal}.`,
    trainingGroup: 'Workout for the rest of the day',
    training: 'Workout',
    plannedTraining: (name: string | null, kcal: string) =>
      `The planned workout will happen${name ? ` (“${name}”, about ${kcal})` : ''}`,
    noTrainingToday: 'No workout today',
    asUsual: 'As usual (your profile assumes workouts during the week)',
    noTraining: 'No workout',
    extraTraining: 'I’ll do an extra workout',
    onlySimulation: 'These guesses are only for the simulation — the diary’s goal changes when the activity really happens.',
    result: 'What it means',
    goal: (today: boolean) => (today ? 'Today’s goal' : 'Goal that day'),
    eaten: 'Eaten',
    total: 'Total',
    moveInGoal: (kcal: string, parts: string) => `Activity in the goal: ${kcal}${parts ? ` — ${parts}` : ''}.`,
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
  /** Eaten kcal by date - this week's balance. */
  eatenByDate: Map<string, number>;
  activity: ActivityOf | null;
  /** The day's plan in kcal (meal prep or workbook); `null` without a plan. */
  plannedKcal: number | null;
  /** The cheat meal already planned on this day — the sheet edits it. */
  planned: PlannedCheat | null;
  /**
   * Food for what is left after the cheat meal: variants of the whole rest of the day when two or
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

type StepsChoice = 'target' | 'now' | 'custom';

/**
 * „Cheat meal”: makro posiłku i od razu, pod polami, co z tego wynika — czy dzień się mieści, ile
 * ponad cel, co zostaje na pozostałe posiłki, ile to kosztuje tydzień i wagę. Na dziś pyta też
 * o ruch do końca dnia: kroki (do celu, jak teraz, własna liczba) i trening (będzie / nie będzie /
 * dodatkowy), bo dostępne kalorie zależą od tego, co jeszcze się wydarzy.
 *
 * „Zaplanuj” zapisuje cheat meal na ten dzień — dziennik rezerwuje go w „Co teraz?”; „Zjedzone
 * teraz” zapisuje go od razu w „Zjedzone”. Treść montuje się przy każdym otwarciu od nowa.
 */
export function CheatMealSheet(props: Props) {
  return (
    <Sheet open={props.open} title="Cheat meal" subtitle={T.subtitle} onClose={props.onClose} className="fd-diet-sheet">
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
  eatenByDate,
  activity,
  plannedKcal,
  planned,
  ideasFor,
  pool,
  products,
  dict,
  productsLoading,
  onSaved,
}: Props) {
  // Nowy cheat meal zaczyna od listy (sieci, produkty, ulubione); zaplanowany — od swoich liczb.
  const [mode, setMode] = useState<'list' | 'macros'>(planned ? 'macros' : 'list');
  const [parts, setParts] = useState<Part[]>([]);
  const [name, setName] = useState(planned?.name ?? '');
  const [kcal, setKcal] = useState(fieldText(planned?.kcal));
  const [protein, setProtein] = useState(fieldText(planned?.protein));
  const [carbs, setCarbs] = useState(fieldText(planned?.carbs));
  const [fat, setFat] = useState(fieldText(planned?.fat));
  const [stepsChoice, setStepsChoice] = useState<StepsChoice>('target');
  const [customSteps, setCustomSteps] = useState('');
  const [training, setTraining] = useState<Assumptions['training']>('planned');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const bridge = useBridge();

  const isToday = date === today;
  const future = date > today;
  const now = isToday && activity ? activity(date) : null;
  const stepsNow = now?.steps.actual ?? 0;
  // Bez wpisanych kroków „jak teraz” nic nie znaczy: nikt nie wie, ile ich było.
  const stepsKnown = now?.steps.actual != null;
  const belowTarget = now !== null && stepsNow < profile.targetSteps;
  const assumptions: Assumptions | undefined = now
    ? {
        steps:
          !belowTarget || stepsChoice === 'now'
            ? null
            : stepsChoice === 'custom'
              ? (numberOrNull(customSteps) ?? stepsNow)
              : profile.targetSteps,
        training,
      }
    : undefined;
  const expected = now && activity ? activity(date, assumptions) : null;

  const goal = dayGoal(profile, eatenByDate, date, today, (d) =>
    d === date && expected ? expected.kcal : activity ? activity(d).kcal : 0,
  );
  const targets = DIET_PROFILES[profile.dietProfile].targets(goal.kcal, profile.targetWeightKg);
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
  const move = bridge.moveOn(date);
  const kg = weightFrom(bridge.weights, date) ?? profile.startWeightKg;
  const since = profile.goalSince ?? '';
  const sim = cheat
    ? simulateCheat({
        cheat,
        targets,
        eaten,
        mealsLeft,
        profile,
        kg,
        date,
        // Jak w korekcie tygodniowej: dni zjedzone pod starszy cel nie są nadwyżką wobec obecnego.
        // Dzień zamknięty to dzień przed dzisiejszym — dzisiejsze jedzenie przy planowaniu soboty jeszcze trwa.
        eatenByDate: new Map([...eatenByDate].filter(([d]) => d < date && d < today && d >= since)),
        goalOf: activity ? (d) => profile.dailyKcal + activity(d).kcal : undefined,
        plannedLeftKcal: plannedKcal !== null ? Math.max(0, plannedKcal - eaten.kcal) : null,
        typicalWorkoutKcal: move.typicalWorkoutKcal ?? TYPICAL_FALLBACK_KCAL,
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
  const ideas =
    sim && sim.restMeals > 0 && sim.left > 100 ? ideasFor(remainingOf(targets, after), sim.restMeals) : null;

  const save = async (eat: boolean) => {
    if (!cheat || busy) return;
    setBusy(true);
    setFailed(false);
    const label = cheat.name || 'Cheat meal';
    try {
      if (eat) await eatCheat(date, cheat);
      else await planCheat(date, cheat);
      onSaved(
        eat ? T.saved(label, kcalText(cheat.kcal)) : T.planned(label, kcalText(cheat.kcal)),
      );
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
          heading={T.inCheat}
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

      {now && (
        <fieldset className="fd-diet-cheatmove">
          <legend>{T.moveLegend}</legend>
          {belowTarget ? (
            <div className="fd-diet-radios" role="radiogroup" aria-label={T.stepsGroup}>
              <p className="fd-diet-radiohead" aria-hidden="true">
                {T.steps}
              </p>
              <label className="check-row">
                <input type="radio" name="cheat-steps" checked={stepsChoice === 'target'} onChange={() => setStepsChoice('target')} />
                {T.reachTarget(formatNumber(profile.targetSteps, 0))}
              </label>
              {stepsKnown && (
                <label className="check-row">
                  <input type="radio" name="cheat-steps" checked={stepsChoice === 'now'} onChange={() => setStepsChoice('now')} />
                  {T.stayNow(formatNumber(stepsNow, 0))}
                </label>
              )}
              <label className="check-row">
                <input type="radio" name="cheat-steps" checked={stepsChoice === 'custom'} onChange={() => setStepsChoice('custom')} />
                {T.otherNumber}
              </label>
            </div>
          ) : (
            <p className="tight">{T.stepsDone(formatNumber(stepsNow, 0))}</p>
          )}
          {belowTarget && stepsChoice === 'custom' && (
            <label className="fld fd-diet-cheatsteps">
              <span>{T.stepsEnd}</span>
              <input
                type="text"
                className="num"
                inputMode="numeric"
                autoComplete="off"
                value={customSteps}
                onChange={(e) => setCustomSteps(e.target.value)}
              />
            </label>
          )}
          {now.training.trained ? (
            <p className="tight">{T.trainingDone(kcalText(now.training.done))}</p>
          ) : (
            <div className="fd-diet-radios" role="radiogroup" aria-label={T.trainingGroup}>
              <p className="fd-diet-radiohead" aria-hidden="true">
                {T.training}
              </p>
              {now.training.source === 'plan' && now.training.planned > 0 ? (
                <>
                  <label className="check-row">
                    <input type="radio" name="cheat-training" checked={training === 'planned'} onChange={() => setTraining('planned')} />
                    {T.plannedTraining(now.training.plannedName, kcalText(now.training.planned))}
                  </label>
                  <label className="check-row">
                    <input type="radio" name="cheat-training" checked={training === 'none'} onChange={() => setTraining('none')} />
                    {T.noTrainingToday}
                  </label>
                </>
              ) : (
                <>
                  <label className="check-row">
                    <input type="radio" name="cheat-training" checked={training === 'planned'} onChange={() => setTraining('planned')} />
                    {now.training.source === 'profile' ? T.asUsual : T.noTraining}
                  </label>
                  {now.training.source === 'profile' && (
                    <label className="check-row">
                      <input type="radio" name="cheat-training" checked={training === 'none'} onChange={() => setTraining('none')} />
                      {T.noTrainingToday}
                    </label>
                  )}
                </>
              )}
              <label className="check-row">
                <input type="radio" name="cheat-training" checked={training === 'extra'} onChange={() => setTraining('extra')} />
                {T.extraTraining}
              </label>
            </div>
          )}
          <p className="tight fd-diet-soft">{T.onlySimulation}</p>
        </fieldset>
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
            <dt>Cheat meal</dt>
            <dd>{cheat ? kcalText(cheat.kcal) : '—'}</dd>
          </div>
          <div className="fd-diet-simsum">
            <dt>{T.total}</dt>
            <dd>{kcalText(eaten.kcal + (cheat?.kcal ?? 0))}</dd>
          </div>
        </dl>
        {expected && (expected.kcal !== 0 || activityParts(expected).length > 0) && (
          <p className="tight">{T.moveInGoal(signedKcal(expected.kcal), activityParts(expected).join(' · '))}</p>
        )}
        {!sim ? (
          <p className="tight">{T.enterKcal}</p>
        ) : (
          <>
            <p className={`fd-diet-verdict fd-diet-v-${sim.verdict}`} aria-live="polite">
              {verdictText(sim)}
            </p>
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
            {beyondTexts(sim, move.typicalWorkoutKcal !== null).map((t) => (
              <p key={t} className="tight">
                {t}
              </p>
            ))}
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
