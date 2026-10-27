import { AlertTriangle, CalendarClock, Minus, Plus, Stethoscope } from 'lucide-react';
import { num, text } from '../../../i18n';
import { Segmented } from '../../../components/ui';
import { addDays, daysBetween } from '../../diet/model';
import { formatDate, plural } from '../../lib/format';
import { hashWith } from '../../hash';
import type { Assessment, Finding, Focus, FocusId } from '../../labs/assess';
import { FOCUS, habitsFor, type Habit } from '../../labs/focus';
import { MARKERS } from '../../labs/markers';
import { NUTRIENT_LABELS, NUTRIENT_UNITS, normFor } from '../../labs/norms';
import { exampleDay, topFoods, topRecipes, type Person } from '../../labs/recommend';
import { savePrefs, tickHabit } from '../../labs/store';
import type { Eats, LabPlan, LabReport } from '../../labs/types';
import { historyOf, type Latest } from '../../labs/verdict';
import { recipesToParams, DEFAULT_RECIPES_STATE } from '../../recipes/url';
import { FOOD_SECTION_PATH } from '../../../routing';
import { amountText, markerOf, resultText, verdictWord } from './labsFormat';

const T = text({
  pl: {
    doctorTitle: 'Najpierw lekarz',
    doctorLead: 'Te wyniki omów z lekarzem. Dieta niżej ich nie dotyczy albo tylko pomaga w leczeniu.',
    urgent: 'Pilnie',
    protein:
      'Nerki pracują słabiej niż powinny. Przepisy tej zakładki są wysokobiałkowe — przed dietą bogatą w białko zapytaj lekarza.',
    inflamed: 'CRP wskazuje na infekcję lub stan zapalny. Ferrytyny i żelaza nie oceniam — powtórz je po wyzdrowieniu.',
    eats: 'Co jesz',
    eatsAll: 'Wszystko',
    eatsVege: 'Bez mięsa',
    eatsVegan: 'Wegańsko',
    goalsTitle: 'Twoje cele',
    goalsLead: 'Najwyżej trzy naraz: tyle da się wprowadzić na kilka tygodni. Najważniejszy jest pierwszy.',
    none: 'Wyniki, które znam, nie wymagają zmian w diecie. Trzymaj się tego, co robisz, i powtórz badania za rok.',
    noneWithDoctor: 'Poza wynikami do omówienia z lekarzem nic nie wymaga zmian w diecie.',
    more: 'Kolejne cele, gdy te trzy wejdą w nawyk',
    goal: (g: string) => `Cel: ${g}`,
    norm: (label: string, amount: string, kind: string) => `Dzienna norma: ${amount} (${label.toLowerCase()}, ${kind})`,
    rda: 'RDA',
    ai: 'AI',
    foods: 'Na talerz — najwięcej w porcji',
    perPortion: (amount: string, share: number | null) => (share === null ? amount : `${amount} · ${Math.round(share * 100)}% normy`),
    organ: 'najwyżej raz w tygodniu',
    heme: 'żelazo hemowe',
    pair: 'Do tego warzywo lub owoc z witaminą C:',
    example: 'Przykład na dziś',
    exampleSum: (total: string, share: number | null) => (share === null ? `razem ${total}` : `razem ${total} — ${Math.round(share * 100)}% normy`),
    recipes: 'Przepisy, które pomagają',
    recipePortion: (amount: string, share: number | null) => (share === null ? `${amount} w porcji` : `${amount} w porcji · ${Math.round(share * 100)}% normy`),
    favor: 'Na talerz',
    limit: 'Ogranicz',
    tips: 'Jak jeść',
    vegan: 'Na diecie wegańskiej',
    planTitle: 'Plan pod wyniki',
    planLead: (weeks: number) =>
      `Zacznij dziś, licz nawyki co tydzień, a po ${weeks} ${plural(weeks, 'tygodniu', 'tygodniach', 'tygodniach')} zrób badanie kontrolne — zobaczysz, co się zmieniło.`,
    start: 'Zaczynam plan',
    week: (n: number, of: number) => `Tydzień ${n} z ${of}`,
    retest: (date: string, names: string) => `Badanie kontrolne: ok. ${date} — ${names}.`,
    retestNow: (names: string) => `Czas na badanie kontrolne: ${names}. Dodaj nowe wyniki, a porównam je z tymi sprzed planu.`,
    habits: 'Nawyki w tym tygodniu',
    habitCount: (n: number, of: number) => `${n} z ${of}`,
    plus: (name: string) => `Dziś: ${name} — dodaj`,
    minus: (name: string) => `Dziś: ${name} — cofnij`,
    effect: 'Co się zmieniło od początku planu',
    newer: 'Masz nowsze wyniki niż te, z których powstał plan.',
    replan: 'Ułóż plan od nowa',
    stop: 'Zakończ plan',
    missingTitle: 'Warto dobadać',
  },
  en: {
    doctorTitle: 'See a doctor first',
    doctorLead: 'Discuss these results with a doctor. The diet below does not cover them, or only supports treatment.',
    urgent: 'Urgent',
    protein: 'The kidneys work less well than they should. This tab’s recipes are high in protein — ask a doctor before a protein-rich diet.',
    inflamed: 'CRP points to an infection or inflammation. I do not judge ferritin and iron now — retest them after recovery.',
    eats: 'What you eat',
    eatsAll: 'Everything',
    eatsVege: 'No meat',
    eatsVegan: 'Vegan',
    goalsTitle: 'Your goals',
    goalsLead: 'Three at most at once: that is what fits into a few weeks. The first matters most.',
    none: 'The results I know need no change in diet. Keep doing what you do and retest in a year.',
    noneWithDoctor: 'Apart from the results to discuss with a doctor, nothing needs a change in diet.',
    more: 'Next goals, once these three are habits',
    goal: (g: string) => `Goal: ${g}`,
    norm: (label: string, amount: string, kind: string) => `Daily norm: ${amount} (${label.toLowerCase()}, ${kind})`,
    rda: 'RDA',
    ai: 'AI',
    foods: 'On the plate — most per portion',
    perPortion: (amount: string, share: number | null) => (share === null ? amount : `${amount} · ${Math.round(share * 100)}% of the norm`),
    organ: 'once a week at most',
    heme: 'haem iron',
    pair: 'With it, a vegetable or fruit rich in vitamin C:',
    example: 'An example for today',
    exampleSum: (total: string, share: number | null) => (share === null ? `in all ${total}` : `in all ${total} — ${Math.round(share * 100)}% of the norm`),
    recipes: 'Recipes that help',
    recipePortion: (amount: string, share: number | null) => (share === null ? `${amount} a serving` : `${amount} a serving · ${Math.round(share * 100)}% of the norm`),
    favor: 'On the plate',
    limit: 'Limit',
    tips: 'How to eat it',
    vegan: 'On a vegan diet',
    planTitle: 'Plan for your results',
    planLead: (weeks: number) => `Start today, count the habits each week, and after ${weeks} ${weeks === 1 ? 'week' : 'weeks'} retest — you will see what changed.`,
    start: 'Start the plan',
    week: (n: number, of: number) => `Week ${n} of ${of}`,
    retest: (date: string, names: string) => `Retest: around ${date} — ${names}.`,
    retestNow: (names: string) => `Time to retest: ${names}. Add the new results and I will compare them with those before the plan.`,
    habits: 'Habits this week',
    habitCount: (n: number, of: number) => `${n} of ${of}`,
    plus: (name: string) => `Today: ${name} — add`,
    minus: (name: string) => `Today: ${name} — undo`,
    effect: 'What changed since the plan began',
    newer: 'You have newer results than the ones the plan was made from.',
    replan: 'Make the plan again',
    stop: 'End the plan',
    missingTitle: 'Worth testing',
  },
});

const EATS_OPTIONS: { key: Eats; label: string }[] = [
  { key: 'all', label: T.eatsAll },
  { key: 'vege', label: T.eatsVege },
  { key: 'vegan', label: T.eatsVegan },
];

export interface DietViewProps {
  assessment: Assessment;
  person: Person;
  plan: LabPlan | null;
  reports: LabReport[];
  today: string;
  habits: { week: Record<string, number>; today: Record<string, number> } | undefined;
  onToast: (message: string) => void;
}

export function DietView({ assessment, person, plan, reports, today, habits, onToast }: DietViewProps) {
  const doctor = assessment.findings.filter((f) => f.severity === 'urgent' || f.severity === 'doctor');
  const noOrgan = person.pregnancy || assessment.focus.some((f) => f.id === 'uric') || assessment.more.some((f) => f.id === 'uric');
  const newest = reports[0]?.date ?? today;
  const fail = (e: unknown) => {
    console.error(e);
    onToast(text({ pl: 'Nie udało się zapisać.', en: 'Could not save.' }));
  };
  return (
    <>
      {doctor.length > 0 && <DoctorCard findings={doctor} />}
      {assessment.proteinCaution && (
        <p className="wrap banner" role="note">
          {T.protein}
        </p>
      )}
      {assessment.inflamed && (
        <p className="wrap banner" role="note">
          {T.inflamed}
        </p>
      )}

      <section className="grp" aria-labelledby="fd-lab-goals">
        <h2 id="fd-lab-goals">{T.goalsTitle}</h2>
        <div className="fd-lab-eats">
          <span className="seg-label">{T.eats}</span>
          <Segmented<Eats> label={T.eats} value={person.eats} options={EATS_OPTIONS} onChange={(eats) => void savePrefs({ eats }).catch(fail)} />
        </div>
        {assessment.focus.length ? <p className="tight">{T.goalsLead}</p> : <p>{doctor.length ? T.noneWithDoctor : T.none}</p>}
      </section>

      {assessment.focus.map((f, i) => (
        <FocusCard key={f.id} focus={f} person={person} noOrgan={noOrgan} open={i === 0} findings={assessment.findings} />
      ))}

      {assessment.more.length > 0 && (
        <section className="grp" aria-labelledby="fd-lab-more">
          <h2 id="fd-lab-more">{T.more}</h2>
          {assessment.more.map((f) => (
            <FocusCard key={f.id} focus={f} person={person} noOrgan={noOrgan} open={false} findings={assessment.findings} nested />
          ))}
        </section>
      )}

      {(assessment.focus.length > 0 || plan !== null) && (
        <PlanCard
          plan={plan}
          focus={assessment.focus}
          person={person}
          today={today}
          newest={newest}
          reports={reports}
          habits={habits}
          canReplan={assessment.focus.length > 0}
          onStart={() => void savePrefs({ plan: { start: today, focus: assessment.focus.map((f) => f.id), basedOn: newest } }).catch(fail)}
          onStop={() => void savePrefs({ plan: null }).catch(fail)}
          onTick={(id, d) => void tickHabit(today, id, d).catch(fail)}
        />
      )}

      {assessment.missing.length > 0 && (
        <section className="grp" aria-labelledby="fd-lab-missing">
          <h2 id="fd-lab-missing">{T.missingTitle}</h2>
          <ul className="fd-lab-list">
            {assessment.missing.map((m) => (
              <li key={m.marker}>
                <b>{MARKERS[m.marker]!.name}</b> — {m.why}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function DoctorCard({ findings }: { findings: Finding[] }) {
  return (
    <section className="grp fd-lab-doctor" aria-labelledby="fd-lab-doctor">
      <h2 id="fd-lab-doctor">
        <Stethoscope aria-hidden="true" size={18} /> {T.doctorTitle}
      </h2>
      <p className="tight">{T.doctorLead}</p>
      <ul className="fd-lab-list">
        {findings.map((f) => {
          const m = markerOf(f.marker);
          return (
            <li key={f.marker}>
              {f.severity === 'urgent' && (
                <span className="fd-lab-badge fd-lab-tone-high">
                  <AlertTriangle aria-hidden="true" size={12} /> {T.urgent}
                </span>
              )}{' '}
              <b>{m.name}</b> {resultText(m, f.latest)}
              {f.note && <span className="fd-lab-note"> — {f.note}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MarkerLine({ finding }: { finding: Finding }) {
  const m = markerOf(finding.marker);
  const word = verdictWord(m, finding.verdict, finding.latest.qual);
  return (
    <li>
      <span className="fd-lab-mname">{m.short ?? m.name}</span> <b>{resultText(m, finding.latest)}</b>{' '}
      <span className={`fd-lab-badge fd-lab-tone-${word.tone}`}>{word.word}</span>
    </li>
  );
}

const recipeHref = (id: string) => hashWith(FOOD_SECTION_PATH.recipes, recipesToParams({ ...DEFAULT_RECIPES_STATE, recipe: id }));

function FocusCard({
  focus,
  person,
  noOrgan,
  open,
  findings,
  nested = false,
}: {
  focus: Focus;
  person: Person;
  noOrgan: boolean;
  open: boolean;
  findings: Finding[];
  nested?: boolean;
}) {
  const def = FOCUS[focus.id];
  const main = def.raise[0];
  const norm = main ? normFor(main, person) : null;
  const unit = main ? NUTRIENT_UNITS[main] : '';
  const veganBlock = person.eats === 'vegan' && def.vegan;
  const foods = main && !veganBlock ? topFoods(main, person, { noOrgan }) : [];
  const day = main && !veganBlock ? exampleDay(main, person, { noOrgan }) : null;
  // Vitamin C for plant iron comes from what is eaten with it: vegetables and fruit, not offal.
  const pair = def.pair ? topFoods(def.pair, person, { limit: 14, perGroup: 4 }).filter((p) => p.food.group === 'vegetables' || p.food.group === 'fruit').slice(0, 5) : [];
  const recipes = main && !veganBlock ? topRecipes(main, person, { noOrgan }) : [];
  const lines = focus.markers.flatMap((id) => findings.filter((f) => f.marker === id));
  const Head = nested ? 'h3' : 'h2';
  const body = (
    <>
      {lines.length > 0 && <ul className="fd-lab-markers">{lines.map((f) => <MarkerLine key={f.marker} finding={f} />)}</ul>}
      <p className="tight">{T.goal(def.goal)}</p>
      {veganBlock && (
        <div className="fd-lab-block">
          <h4>{T.vegan}</h4>
          <p>{def.vegan}</p>
        </div>
      )}
      {main && norm && <p className="fd-lab-norm">{T.norm(NUTRIENT_LABELS[main], amountText(norm.amount, unit), norm.kind === 'RDA' ? T.rda : T.ai)}</p>}
      {foods.length > 0 && (
        <div className="fd-lab-block">
          <h4>{T.foods}</h4>
          <ul className="fd-lab-foods">
            {foods.map((p) => (
              <li key={p.food.id}>
                <span className="fd-lab-food">{p.food.label}</span>
                <span className="fd-lab-food-meta">
                  {p.food.portion.label} · {T.perPortion(amountText(p.amount, unit), p.share)}
                  {p.food.organ && ` · ${T.organ}`}
                  {main === 'iron' && p.food.heme && ` · ${T.heme}`}
                </span>
              </li>
            ))}
          </ul>
          {pair.length > 0 && (
            <p className="fd-lab-pair">
              {T.pair} {pair.map((p) => p.food.label).join(', ')}
            </p>
          )}
        </div>
      )}
      {day && day.items.length > 1 && (
        <div className="fd-lab-block">
          <h4>{T.example}</h4>
          <p className="fd-lab-example">
            {day.items.map((p) => `${p.food.label} ${p.food.portion.label.replace(/^.*\((.*)\)$/, '$1')}`).join(' + ')}
            <br />
            <b>{T.exampleSum(amountText(day.total, unit), day.share)}</b>
          </p>
        </div>
      )}
      {recipes.length > 0 && (
        <div className="fd-lab-block">
          <h4>{T.recipes}</h4>
          <ul className="fd-lab-foods">
            {recipes.map((r) => (
              <li key={r.recipe.id}>
                <a className="fd-lab-food" href={recipeHref(r.recipe.id)}>
                  {r.recipe.name}
                </a>
                <span className="fd-lab-food-meta">{T.recipePortion(amountText(r.amount, unit), r.share)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {def.favor && def.favor.length > 0 && (
        <div className="fd-lab-block">
          <h4>{T.favor}</h4>
          <ul className="fd-lab-list">{def.favor.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      {def.limit.length > 0 && (
        <div className="fd-lab-block">
          <h4>{T.limit}</h4>
          <ul className="fd-lab-list">{def.limit.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      {def.tips.length > 0 && (
        <div className="fd-lab-block">
          <h4>{T.tips}</h4>
          <ul className="fd-lab-list">{def.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </>
  );
  const Wrapper = nested ? 'div' : 'section';
  return (
    <Wrapper className={nested ? 'fd-lab-nested' : 'grp fd-lab-focus'}>
      <details open={open}>
        <summary>
          <Head className="fd-lab-focus-title">{def.title}</Head>
        </summary>
        {body}
      </details>
    </Wrapper>
  );
}

function PlanCard({
  plan,
  focus,
  person,
  today,
  newest,
  reports,
  habits,
  canReplan,
  onStart,
  onStop,
  onTick,
}: {
  plan: LabPlan | null;
  focus: Focus[];
  person: Person;
  today: string;
  newest: string;
  reports: LabReport[];
  habits: DietViewProps['habits'];
  canReplan: boolean;
  onStart: () => void;
  onStop: () => void;
  onTick: (habit: string, delta: 1 | -1) => void;
}) {
  const ids: FocusId[] = plan ? (plan.focus.filter((f) => f in FOCUS) as FocusId[]) : focus.map((f) => f.id);
  const weeks = Math.max(...ids.map((id) => FOCUS[id].retestWeeks), 4);
  const retestMarkers = [...new Set(ids.flatMap((id) => FOCUS[id].retest))].filter((m) => MARKERS[m]);
  const names = retestMarkers.map((m) => MARKERS[m]!.short ?? MARKERS[m]!.name).join(', ');
  if (!plan) {
    return (
      <section className="grp fd-lab-plan" aria-labelledby="fd-lab-plan">
        <h2 id="fd-lab-plan">
          <CalendarClock aria-hidden="true" size={18} /> {T.planTitle}
        </h2>
        <p>{T.planLead(weeks)}</p>
        <button type="button" className="btn" onClick={onStart}>
          {T.start}
        </button>
      </section>
    );
  }
  const retestOn = addDays(plan.start, weeks * 7);
  const week = Math.min(weeks, Math.floor(daysBetween(plan.start, today) / 7) + 1);
  const list: Habit[] = [];
  for (const id of ids) for (const h of habitsFor(FOCUS[id], person.eats)) if (!list.some((x) => x.id === h.id)) list.push(h);
  const effect = retestMarkers.flatMap((m) => {
    const history = historyOf(reports, m);
    const before = [...history].reverse().find((h) => h.date <= plan.basedOn);
    const after = [...history].reverse().find((h) => h.date > plan.start);
    return before && after ? [{ m, before, after }] : [];
  });
  return (
    <section className="grp fd-lab-plan" aria-labelledby="fd-lab-plan">
      <h2 id="fd-lab-plan">
        <CalendarClock aria-hidden="true" size={18} /> {T.planTitle} · {T.week(week, weeks)}
      </h2>
      <p className="tight">{today >= retestOn ? T.retestNow(names) : T.retest(formatDate(retestOn), names)}</p>
      {effect.length > 0 && (
        <div className="fd-lab-block">
          <h4>{T.effect}</h4>
          <ul className="fd-lab-list">
            {effect.map(({ m, before, after }) => (
              <EffectLine key={m} marker={m} before={before} after={after} />
            ))}
          </ul>
        </div>
      )}
      {newest > plan.basedOn && canReplan && (
        <p className="fd-lab-pair">
          {T.newer}{' '}
          <button type="button" className="btn ghost sm" onClick={onStart}>
            {T.replan}
          </button>
        </p>
      )}
      <h4 className="fd-lab-habits-title">{T.habits}</h4>
      <ul className="fd-lab-habits">
        {list.map((h) => {
          const n = habits?.week[h.id] ?? 0;
          const mine = habits?.today[h.id] ?? 0;
          return (
            <li key={h.id} className={n >= h.perWeek ? 'fd-lab-habit-done' : undefined}>
              <span className="fd-lab-habit-name">{h.label}</span>
              <span className="fd-lab-habit-count">{T.habitCount(n, h.perWeek)}</span>
              <span className="fd-lab-habit-btns">
                <button type="button" className="fd-lab-icon" disabled={mine === 0} onClick={() => onTick(h.id, -1)} aria-label={T.minus(h.label)}>
                  <Minus aria-hidden="true" size={16} />
                </button>
                <button type="button" className="fd-lab-icon fd-lab-plus" onClick={() => onTick(h.id, 1)} aria-label={T.plus(h.label)}>
                  <Plus aria-hidden="true" size={16} />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn ghost sm" onClick={onStop}>
        {T.stop}
      </button>
    </section>
  );
}

function EffectLine({ marker, before, after }: { marker: string; before: Latest; after: Latest }) {
  const m = markerOf(marker);
  const delta = before.value !== null && after.value !== null ? after.value - before.value : null;
  return (
    <li>
      <b>{m.short ?? m.name}</b>: {resultText(m, before)} → {resultText(m, after)}
      {delta !== null && delta !== 0 && ` (${delta > 0 ? '+' : '−'}${num(Math.abs(delta), m.digits)})`}
    </li>
  );
}
