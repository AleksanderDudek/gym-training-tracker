import { useState } from 'react';
import { TYPICAL_FALLBACK_KCAL, type Assumptions } from '../../diet/activity';
import { simulateCheat } from '../../diet/cheat';
import type { DayTotals } from '../../diet/day';
import type { PlannedCheat } from '../../diet/db';
import { dayGoal, mealsLeftAt, remainingOf } from '../../diet/model';
import { DIET_PROFILES } from '../../diet/profiles';
import { eatCheat, planCheat } from '../../diet/store';
import type { Remaining, Suggestion } from '../../diet/suggest';
import type { Profile } from '../../diet/types';
import { useBridge } from '../../bridge';
import { weightFrom, type ActivityOf } from '../../hooks/useActivity';
import { formatNumber } from '../../lib/format';
import { Sheet } from '../common/Sheet';
import { activityParts, signedKcal } from './activityText';
import { beyondTexts, macroTexts, planText, verdictText } from './cheatText';
import { MacroLine } from './SuggestionList';

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
  /** Food for what is left after the cheat meal (the diary's „Co teraz?” ranking). */
  suggestFor: (remaining: Remaining, mealsLeft: number) => Suggestion[];
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
    <Sheet open={props.open} title="Cheat meal" subtitle="Wpisz makro — pod spodem zobaczysz, co z tego wynika" onClose={props.onClose} className="fd-diet-sheet">
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
  suggestFor,
  onSaved,
}: Props) {
  const [name, setName] = useState(planned?.name ?? '');
  const [kcal, setKcal] = useState(fieldText(planned?.kcal));
  const [protein, setProtein] = useState(fieldText(planned?.protein));
  const [carbs, setCarbs] = useState(fieldText(planned?.carbs));
  const [fat, setFat] = useState(fieldText(planned?.fat));
  const [stepsChoice, setStepsChoice] = useState<StepsChoice>('target');
  const [customSteps, setCustomSteps] = useState('');
  const [training, setTraining] = useState<Assumptions['training']>('planned');
  const [busy, setBusy] = useState(false);
  const bridge = useBridge();

  const isToday = date === today;
  const future = date > today;
  const now = isToday && activity ? activity(date) : null;
  const stepsNow = now?.steps.actual ?? 0;
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
  const cheatKcal = numberOrNull(kcal);
  const cheat: PlannedCheat | null =
    cheatKcal !== null && cheatKcal > 0
      ? {
          name: name.trim(),
          kcal: Math.round(cheatKcal),
          protein: numberOrNull(protein),
          carbs: numberOrNull(carbs),
          fat: numberOrNull(fat),
        }
      : null;
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
        eatenByDate: new Map([...eatenByDate].filter(([d]) => d < date && d >= since)),
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
  const ideas = sim && sim.restMeals > 0 && sim.left > 100 ? suggestFor(remainingOf(targets, after), sim.restMeals).slice(0, 3) : [];

  const save = async (eat: boolean) => {
    if (!cheat || busy) return;
    setBusy(true);
    const label = cheat.name || 'Cheat meal';
    try {
      if (eat) await eatCheat(date, cheat);
      else await planCheat(date, cheat);
      onSaved(
        eat
          ? `Zapisane: ${label} · ${kcalText(cheat.kcal)}.`
          : `Cheat meal zaplanowany: ${label} · ${kcalText(cheat.kcal)}. Reszta dnia liczy się już z nim.`,
      );
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
      <label className="fld">
        <span>Co to będzie</span>
        <input type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="np. pizza ze znajomymi" />
      </label>
      <label className="fld">
        <span>Kalorie (kcal)</span>
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
      <p className="fd-diet-hint">Makroskładniki – jeśli znasz:</p>
      <div className="fd-diet-grid3">
        {(
          [
            ['Białko (g)', protein, setProtein],
            ['Węglowodany (g)', carbs, setCarbs],
            ['Tłuszcz (g)', fat, setFat],
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

      {now && (
        <fieldset className="fd-diet-cheatmove">
          <legend>Ruch do końca dnia</legend>
          {belowTarget ? (
            <div className="fd-diet-radios" role="radiogroup" aria-label="Kroki do końca dnia">
              <p className="fd-diet-radiohead" aria-hidden="true">
                Kroki
              </p>
              <label className="check-row">
                <input type="radio" name="cheat-steps" checked={stepsChoice === 'target'} onChange={() => setStepsChoice('target')} />
                Dojdę do celu ({formatNumber(profile.targetSteps, 0)} kroków)
              </label>
              <label className="check-row">
                <input type="radio" name="cheat-steps" checked={stepsChoice === 'now'} onChange={() => setStepsChoice('now')} />
                Zostanę przy obecnych ({stepsNow > 0 ? formatNumber(stepsNow, 0) : '0 — nic jeszcze nie wpisane'})
              </label>
              <label className="check-row">
                <input type="radio" name="cheat-steps" checked={stepsChoice === 'custom'} onChange={() => setStepsChoice('custom')} />
                Inna liczba
              </label>
              {stepsChoice === 'custom' && (
                <label className="fld fd-diet-cheatsteps">
                  <span>Kroki na koniec dnia</span>
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
            </div>
          ) : (
            <p className="tight">Kroki: {formatNumber(stepsNow, 0)} — cel na dziś już jest.</p>
          )}
          {now.training.trained ? (
            <p className="tight">Trening zrobiony: {kcalText(now.training.done)}.</p>
          ) : (
            <div className="fd-diet-radios" role="radiogroup" aria-label="Trening do końca dnia">
              <p className="fd-diet-radiohead" aria-hidden="true">
                Trening
              </p>
              {now.training.source === 'plan' && now.training.planned > 0 ? (
                <>
                  <label className="check-row">
                    <input type="radio" name="cheat-training" checked={training === 'planned'} onChange={() => setTraining('planned')} />
                    Trening z planu będzie{now.training.plannedName ? ` („${now.training.plannedName}”, ok. ${kcalText(now.training.planned)})` : ''}
                  </label>
                  <label className="check-row">
                    <input type="radio" name="cheat-training" checked={training === 'none'} onChange={() => setTraining('none')} />
                    Dziś treningu nie będzie
                  </label>
                </>
              ) : (
                <>
                  <label className="check-row">
                    <input type="radio" name="cheat-training" checked={training === 'planned'} onChange={() => setTraining('planned')} />
                    {now.training.source === 'profile' ? 'Jak zwykle (profil zakłada treningi w tygodniu)' : 'Bez treningu'}
                  </label>
                  {now.training.source === 'profile' && (
                    <label className="check-row">
                      <input type="radio" name="cheat-training" checked={training === 'none'} onChange={() => setTraining('none')} />
                      Dziś treningu nie będzie
                    </label>
                  )}
                </>
              )}
              <label className="check-row">
                <input type="radio" name="cheat-training" checked={training === 'extra'} onChange={() => setTraining('extra')} />
                Zrobię dodatkowy trening
              </label>
            </div>
          )}
        </fieldset>
      )}

      <section className="fd-diet-sim" aria-live="polite" aria-label="Co z tego wynika">
        <h3>Co z tego wynika</h3>
        <dl className="fd-diet-simrows">
          <div>
            <dt>Cel {isToday ? 'na dziś' : 'tego dnia'}</dt>
            <dd>{kcalText(targets.kcal)}</dd>
          </div>
          <div>
            <dt>Zjedzone</dt>
            <dd>{kcalText(eaten.kcal)}</dd>
          </div>
          <div>
            <dt>Cheat meal</dt>
            <dd>{cheat ? kcalText(cheat.kcal) : '—'}</dd>
          </div>
          <div className="fd-diet-simsum">
            <dt>Razem</dt>
            <dd>{kcalText(eaten.kcal + (cheat?.kcal ?? 0))}</dd>
          </div>
        </dl>
        {expected && (expected.kcal !== 0 || activityParts(expected).length > 0) && (
          <p className="tight">
            Ruch w celu: {signedKcal(expected.kcal)}
            {activityParts(expected).length ? ` — ${activityParts(expected).join(' · ')}` : ''}.
          </p>
        )}
        {!sim ? (
          <p className="tight">Wpisz kalorie — zobaczysz, czy dzień się mieści i co zostaje na resztę.</p>
        ) : (
          <>
            <p className={`fd-diet-verdict fd-diet-v-${sim.verdict}`}>{verdictText(sim)}</p>
            {macroTexts(sim).map((t) => (
              <p key={t} className="tight">
                {t}
              </p>
            ))}
            {planText(sim) && <p className="tight">{planText(sim)}</p>}
            {ideas.length > 0 && (
              <>
                <p className="tight">Na resztę dnia pasuje na przykład:</p>
                <ul className="fd-diet-simideas">
                  {ideas.map((s) => (
                    <li key={s.food.key}>
                      <span className="fd-diet-name">{s.food.name}</span> <MacroLine food={s.food} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {beyondTexts(sim, move.typicalWorkoutKcal !== null).map((t) => (
              <p key={t} className="tight">
                {t}
              </p>
            ))}
          </>
        )}
      </section>

      <div className="actions fd-diet-cheatacts">
        <button type="submit" className="btn" disabled={!cheat || busy}>
          {planned ? 'Zapisz zmiany' : 'Zaplanuj'}
        </button>
        <button type="button" className="btn ghost" disabled={!cheat || busy || future} onClick={() => void save(true)}>
          Zjedzone teraz
        </button>
      </div>
    </form>
  );
}
