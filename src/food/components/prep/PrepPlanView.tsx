import { CalendarRange, ChefHat, ListChecks, NotebookPen, Pencil, Repeat, Shuffle, Snowflake, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { pluralEn, text } from '../../../i18n';
import { Modal, useModal } from '../../../components/ui';
import { useBridge } from '../../bridge';
import { addDays } from '../../diet/model';
import type { Profile } from '../../diet/types';
import { useDataset } from '../../hooks/useDataset';
import { useFavorites } from '../../hooks/useDiet';
import { formatNumber, plural } from '../../lib/format';
import { RECIPES } from '../../recipes/catalog';
import { gramsLabel, longDate, portionAfterPo, portionLabel, rangeLabel, shortDate, weekdaySpan } from '../../prep/format';
import { canSwap, newSeed, noSwapMessage, rerollPlan, swapChoices, swapRecipe, type GenerateResult } from '../../prep/generate';
import { PLAN_WORDS, averageDay, dayCheck, dayPlanTotals, mealAmount, mealsOn, shoppingProgress, type DayCheck } from '../../prep/meals';
import { itemName } from '../../prep/shopping';
import { deletePrepPlan, hiddenDays, movePlan, planCovering, planEnd, planName, renamePlan, replacePrepPlan, setInDiary } from '../../prep/store';
import type { PrepBatch, PrepPlan, Role } from '../../prep/types';
import { recipeIndex } from '../../recipes/resolve';
import { planHref, shoppingHref } from './links';
import { DatesSheet, RenameSheet, SwapSheet } from './PlanSheets';
import { COMMON } from '../common/text';
import './prep.css';

const T = text({
  pl: {
    roles: {
      lunchBox: 'Obiady z pudełka',
      dinnerBox: 'Kolacje z pudełka',
      lunch: 'Obiady na świeżo',
      dinner: 'Kolacje na świeżo',
      breakfast: 'Śniadania',
      snack: 'Przekąski',
    } as Record<Role, string>,
    saveFailed: 'Nie udało się zapisać zmiany na tym urządzeniu — spróbuj jeszcze raz.',
    rerollTitle: 'Ułożyć inny plan?',
    rerollStarted: 'Dni do dziś i ugotowane już pudełka zostają, reszta planu się zmieni. ',
    rerollList: 'Lista zakupów pójdzie za planem: odhaczone zostanie tylko to, czego nowy plan nie potrzebuje więcej.',
    rerollOk: 'Ułóż inny',
    rerolled: 'Nowy zestaw przepisów — lista zakupów też.',
    swapped: 'Przepis wymieniony — porcje i lista zakupów poszły za nim.',
    removeTitle: 'Usunąć plan z zakupami?',
    removeText: 'Zapisy jedzenia zostaną, zniknie tylko plan i jego lista.',
    removeOk: 'Usuń plan',
    removeFailed: 'Nie udało się usunąć planu — spróbuj jeszcze raz.',
    days: (n: number) => `Plan na ${n} dni`,
    shopping: 'zakupy:',
    order: (shop: string) => ` + ${shop} (zamówienie)`,
    meals: (n: number) => `${n} ${plural(n, 'posiłek', 'posiłki', 'posiłków')} dziennie`,
    goal: (style: string, kcal: string) => `${style} · cel ${kcal}`,
    fitted: ' (dopasowany do postępów)',
    average: (kcal: string, p: string, c: string, f: string) => `. Średni dzień planu: ${kcal} · B ${p} · W ${c} · T ${f} g.`,
    starts: (date: string) => `Plan zaczyna się ${date} — do tego dnia dziennik idzie po staremu.`,
    ended: 'Ten plan się skończył. Chcesz go powtórzyć? „Zmień daty” przeniesie go na nowe dni — z tymi samymi przepisami i listą.',
    owner: (hidden: number, days: number, href: string, name: string): ReactNode => (
      <>
        {hidden === days ? 'W dni tego planu' : `W ${hidden} z ${days} dni tego planu`} dziennik pokazuje plan{' '}
        <a href={href}>„{name}”</a>.
      </>
    ),
    stale: (kcal: string, same: boolean) =>
      `Od ułożenia planu zmienił się cel w profilu diety (${kcal}, ${same ? 'ten sam styl' : 'inny styl'}). Kupione zostaje kupione — następny plan pójdzie za nowym celem.`,
    short: (n: number, all: number) =>
      `${n === all ? 'Żaden dzień' : `${n} z ${all} dni`} nie domyka celu z tego koszyka (szczegóły w „Dzień po dniu”). Więcej posiłków, inny sklep albo zamówienie przez internet da planowi więcej możliwości.`,
    repeats: 'Ten styl i koszyk mają mało pasujących przepisów, więc dania się powtarzają. Więcej da inny sklep albo zamówienie przez internet.',
    noDinnerBox: 'Na kolację nie ma drugiego dania do pudełek w tym stylu i koszyku — kolacje robisz na świeżo.',
    list: 'Lista zakupów',
    follows: (name: string) => `Dziennik idzie za planem „${name}” w jego dni.`,
    setInDiary: 'Ustaw w dzienniku',
    rename: 'Zmień nazwę',
    dates: 'Zmień daty',
    reroll: 'Inny plan',
    next: 'Następny plan',
    remove: 'Usuń plan',
    loading: 'Wczytuję bazę produktów — wymiana przepisów zaraz będzie gotowa.',
    noData: 'Bez bazy produktów nie wymienię przepisu ani nie ułożę innego planu — plan i lista działają dalej.',
    recipes: 'Przepisy w planie',
    recipesLead:
      'Coś Ci nie pasuje? „Wymień” pokazuje przepisy, które mogą zająć to miejsce — wybrany wchodzi do całego planu, a porcje i lista zakupów idą za nim.',
    swapLabel: (name: string) => `Wymień: ${name}`,
    swap: 'Wymień',
    done: 'zjedzone albo ugotowane',
    cooking: 'Gotowanie na zapas',
    today: (date: string) => `Dziś, ${date}`,
    freeze: 'Zamroź po zakupach',
    freezeLine: (name: string, grams: string, date: string, move: string) =>
      `${name}: ${grams} na ${date} — przełóż do lodówki ${move}.`,
    raw: 'Surowe mięso i ryba wytrzymują w lodówce 1–2 dni.',
    byDay: 'Dzień po dniu',
    box: (date: string) => ` · pudełko z ${date}`,
    check: (kcal: string, w: Record<keyof Omit<DayCheck, 'ok'>, string>, p: string, pt: number, c: string, cmax: number | null, f: string) =>
      `Cel dnia ${kcal}: kalorie ${w.kcal}, białko ${p}/${pt} g (${w.protein}), węglowodany ${c}${cmax !== null ? `/${cmax} g limitu` : ' g'} (${w.carbs}), tłuszcz ${f} g (${w.fat}).`,
    renamed: (name: string) => `Plan nazywa się teraz „${name}”.`,
    unnamed: 'Plan wrócił do swojej nazwy.',
    moved: (range: string) => `Plan przesunięty: ${range}.`,
    batch: (portion: string, factor: string, boxes: number, each: string) =>
      `${portion} (przepis × ${factor}) · ${boxes} ${plural(boxes, 'pudełko', 'pudełka', 'pudełek')} po ${each}`,
    whole: 'Składniki na całość',
    steps: 'Jak zrobić',
  },
  en: {
    roles: {
      lunchBox: 'Lunches from a box',
      dinnerBox: 'Dinners from a box',
      lunch: 'Freshly made lunches',
      dinner: 'Freshly made dinners',
      breakfast: 'Breakfasts',
      snack: 'Snacks',
    } as Record<Role, string>,
    saveFailed: 'Couldn’t save the change on this device — try again.',
    rerollTitle: 'Make a different plan?',
    rerollStarted: 'The days up to today and the boxes already cooked stay; the rest of the plan changes. ',
    rerollList: 'The shopping list follows the plan: only what the new plan doesn’t need more of stays ticked.',
    rerollOk: 'Make another',
    rerolled: 'A new set of recipes — and a new shopping list.',
    swapped: 'Recipe swapped — servings and the shopping list followed.',
    removeTitle: 'Delete this plan & shopping?',
    removeText: 'Your food logs stay; only the plan and its list go.',
    removeOk: 'Delete plan',
    removeFailed: 'Couldn’t delete the plan — try again.',
    days: (n: number) => `Plan for ${n} days`,
    shopping: 'shopping:',
    order: (shop: string) => ` + ${shop} (order)`,
    meals: (n: number) => `${n} ${pluralEn(n, 'meal', 'meals')} a day`,
    goal: (style: string, kcal: string) => `${style} · goal ${kcal}`,
    fitted: ' (fitted to your progress)',
    average: (kcal: string, p: string, c: string, f: string) => `. Average plan day: ${kcal} · P ${p} · C ${c} · F ${f} g.`,
    starts: (date: string) => `The plan starts on ${date} — until then the diary carries on as before.`,
    ended: 'This plan has ended. Want to repeat it? “Change dates” moves it to new days — with the same recipes and list.',
    owner: (hidden: number, days: number, href: string, name: string): ReactNode => (
      <>
        {hidden === days ? 'On this plan’s days' : `On ${hidden} of this plan’s ${days} days`} the diary shows the plan{' '}
        <a href={href}>“{name}”</a>.
      </>
    ),
    stale: (kcal: string, same: boolean) =>
      `Since this plan was made, the goal in your diet profile has changed (${kcal}, ${same ? 'same style' : 'another style'}). What’s bought stays bought — the next plan will follow the new goal.`,
    short: (n: number, all: number) =>
      `${n === all ? 'No day meets' : `${n} of ${all} days don’t meet`} the goal from this basket (details in “Day by day”). More meals, another shop or an online order give the plan more options.`,
    repeats: 'This style and basket have few matching recipes, so dishes repeat. Another shop or an online order gives more.',
    noDinnerBox: 'There’s no second dish for boxes at dinner in this style and basket — you make dinners fresh.',
    list: 'Shopping list',
    follows: (name: string) => `The diary follows “${name}” on its days.`,
    setInDiary: 'Set in diary',
    rename: 'Rename',
    dates: 'Change dates',
    reroll: 'Another plan',
    next: 'Next plan',
    remove: 'Delete plan',
    loading: 'Loading the product database — swapping recipes will be ready in a moment.',
    noData: 'Without the product database I can’t swap a recipe or make another plan — the plan and the list still work.',
    recipes: 'Recipes in the plan',
    recipesLead:
      'Something not right? “Swap” shows recipes that can take its place — the one you pick goes into the whole plan, and the servings and shopping list follow.',
    swapLabel: (name: string) => `Swap: ${name}`,
    swap: 'Swap',
    done: 'eaten or cooked',
    cooking: 'Batch cooking',
    today: (date: string) => `Today, ${date}`,
    freeze: 'Freeze after shopping',
    freezeLine: (name: string, grams: string, date: string, move: string) =>
      `${name}: ${grams} for ${date} — move it to the fridge on ${move}.`,
    raw: 'Raw meat and fish keep for 1–2 days in the fridge.',
    byDay: 'Day by day',
    box: (date: string) => ` · box from ${date}`,
    check: (kcal: string, w: Record<keyof Omit<DayCheck, 'ok'>, string>, p: string, pt: number, c: string, cmax: number | null, f: string) =>
      `Day goal ${kcal}: calories ${w.kcal}, protein ${p}/${pt} g (${w.protein}), carbs ${c}${cmax !== null ? `/${cmax} g limit` : ' g'} (${w.carbs}), fat ${f} g (${w.fat}).`,
    renamed: (name: string) => `The plan is now called “${name}”.`,
    unnamed: 'The plan is back to its own name.',
    moved: (range: string) => `Plan moved: ${range}.`,
    batch: (portion: string, factor: string, boxes: number, each: string) =>
      `${portion} (recipe × ${factor}) · ${boxes} ${pluralEn(boxes, 'box', 'boxes')} of ${each}`,
    whole: 'Ingredients for the whole batch',
    steps: 'How to make it',
  },
});

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const ROLE_TITLE: Record<Role, string> = T.roles;
const ROLE_ORDER: Role[] = ['breakfast', 'lunchBox', 'lunch', 'snack', 'dinnerBox', 'dinner'];

const kcal = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;
const g = (n: number) => formatNumber(Math.round(n), 0);

interface Props {
  plan: PrepPlan & { id: number };
  /** Every plan on the device: which of them the diary follows on this plan's days. */
  plans: PrepPlan[];
  profile: Profile;
  today: string;
  onNext: () => void;
}

/**
 * Plan z zakupami: co, kiedy gotować i co jeść którego dnia. Przepis da się wymienić, a cały plan
 * ułożyć jeszcze raz — do tego potrzebna jest baza produktów; sam plan i lista działają bez niej.
 */
export function PrepPlanView({ plan, plans, profile, today, onNext }: Props) {
  const bridge = useBridge();
  const data = useDataset();
  const favorites = useFavorites();
  const { req, ask } = useModal();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'name' | 'dates' | null>(null);
  const [swapping, setSwapping] = useState<{ role: Role; id: string; name: string } | null>(null);
  const end = planEnd(plan);
  const ended = end < today;
  // Days on which another plan, set later, owns the diary: one line and „Ustaw w dzienniku”.
  const hidden = ended ? [] : hiddenDays(plans, plan).filter((d) => d >= today);
  const owner = hidden.length ? planCovering(plans, hidden[0]!) : null;
  const average = averageDay(plan);
  const physical = plan.shops.find((s) => !s.online);
  const order = plan.shops.find((s) => s.online);
  const progress = shoppingProgress(plan, new Set(plan.bought));
  const stale = plan.goal.kcal !== profile.dailyKcal || plan.goal.dietProfile !== profile.dietProfile;
  // A change touches only what is ahead: from today (or the plan's first day, when it starts later).
  const from = plan.settings.start > today ? plan.settings.start : today;
  const ready = useMemo(
    () =>
      data.status === 'ready'
        ? {
            index: recipeIndex(data.products),
            dict: data.dataset.dictionaries,
            favorites: new Set((favorites ?? []).filter((f) => f.key.startsWith('recipe:')).map((f) => f.key.slice(7))),
          }
        : null,
    [data, favorites],
  );

  const save = async (make: () => GenerateResult, done: string) => {
    setBusy(true);
    try {
      const next = make();
      if (!next.ok) {
        setNote(next.message);
        return;
      }
      await replacePrepPlan({ ...next.plan, id: plan.id });
      setNote(null);
      bridge.toast(done);
    } catch {
      setNote(T.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const reroll = async () => {
    if (!ready || busy) return;
    const started = from > plan.settings.start;
    if (
      (started || progress.done) &&
      !(await ask(
        T.rerollTitle,
        <p>
          {started ? T.rerollStarted : ''}
          {T.rerollList}
        </p>,
        T.rerollOk,
      ))
    )
      return;
    await save(() => rerollPlan(plan, ready, newSeed(), from), T.rerolled);
  };

  const swap = async (role: Role, recipeId: string, to: string) => {
    if (!ready || busy) return;
    setSwapping(null);
    await save(() => swapRecipe(plan, role, recipeId, ready, from, to), T.swapped);
  };
  // Ranked once per opening, not on every render.
  const options = useMemo(
    () => (swapping && ready ? swapChoices(plan, swapping.role, swapping.id, ready, from) : []),
    [swapping, plan, ready, from],
  );

  /** A change of the stored plan outside a remake: the name, the dates, the diary. */
  const change = async (run: () => Promise<void>, done: string) => {
    setSheet(null);
    try {
      await run();
      setNote(null);
      bridge.toast(done);
    } catch {
      setNote(T.saveFailed);
    }
  };

  const remove = async () => {
    if (!(await ask(T.removeTitle, <p>{T.removeText}</p>, T.removeOk)))
      return;
    try {
      await deletePrepPlan(plan.id);
    } catch {
      setNote(T.removeFailed);
    }
  };

  const roles = ROLE_ORDER.filter((r) => plan.choices[r]?.length);
  // Days the basket and the style cannot close: said once, at the top, with what would help.
  const short = plan.dayTargets.filter(({ date, targets }) => !dayCheck(dayPlanTotals(plan, date), targets).ok);
  // A rotation of one recipe for a week: the same breakfast every day.
  const repeats = (['breakfast', 'snack', 'dinner'] as const).some((r) => plan.choices[r]?.length === 1);
  const sessions = [...new Set(plan.batches.map((b) => b.date))];
  const freezes = plan.shopping.flatMap((i) => i.freeze.map((f) => ({ ...f, name: itemName(i) })));

  return (
    <>
      <section className="grp fd-prep-head" aria-labelledby="fd-prep-title">
        <div className="today-tag light">{T.days(plan.settings.days)}</div>
        <h2 id="fd-prep-title" className="today-name">
          {planName(plan)}
        </h2>
        <p className="tight">
          {rangeLabel(plan.settings.start, end)} · {T.shopping} {physical?.name}
          {order && T.order(order.name)} · {T.meals(plan.slots.length)}
        </p>
        <p className="tight">
          {T.goal(plan.goal.styleLabel, kcal(plan.goal.kcal))}
          {plan.goal.source === 'checkin' && T.fitted}
          {T.average(kcal(average.kcal), g(average.protein), g(average.carbs), g(average.fat))}
        </p>
        {plan.settings.start > today && <p className="tight">{T.starts(longDate(plan.settings.start))}</p>}
        {ended && <p className="tight">{T.ended}</p>}
        {owner && (
          <p className="tight fd-prep-warn">{T.owner(hidden.length, plan.settings.days, planHref(owner), planName(owner))}</p>
        )}
        {stale && (
          <p className="tight fd-prep-warn">
            {T.stale(kcal(profile.dailyKcal), profile.dietProfile === plan.goal.dietProfile)}
          </p>
        )}
        {short.length > 0 && <p className="tight fd-prep-warn">{T.short(short.length, plan.dayTargets.length)}</p>}
        {repeats && <p className="tight">{T.repeats}</p>}
        {plan.settings.cooking === 'both' && !plan.choices.dinnerBox && <p className="tight">{T.noDinnerBox}</p>}
        {note && (
          <p className="tight fd-prep-warn" role="alert">
            {note}
          </p>
        )}
        <div className="fd-prep-actions">
          <a className="btn" href={shoppingHref(plan)}>
            <ListChecks {...ICON} /> {T.list}
            {progress.done > 0 && ` (${progress.done}/${progress.total})`}
          </a>
          {owner && (
            <button
              type="button"
              className="btn sm"
              onClick={() => void change(() => setInDiary(plan.id), T.follows(planName(plan)))}
            >
              <NotebookPen {...ICON} /> {T.setInDiary}
            </button>
          )}
          <button type="button" className="btn ghost sm" onClick={() => setSheet('name')}>
            <Pencil {...ICON} /> {T.rename}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setSheet('dates')}>
            <CalendarRange {...ICON} /> {T.dates}
          </button>
          {!ended && (
            <button type="button" className="btn ghost sm" onClick={() => void reroll()} disabled={!ready || busy}>
              <Shuffle {...ICON} /> {T.reroll}
            </button>
          )}
          <button type="button" className="btn ghost sm" onClick={onNext}>
            {T.next}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => void remove()}>
            <Trash2 {...ICON} /> {T.remove}
          </button>
        </div>
        {data.status === 'loading' && <p className="tight fd-prep-soft">{T.loading}</p>}
        {data.status === 'error' && (
          <p className="tight fd-prep-warn">
            {T.noData}{' '}
            <button type="button" className="fd-prep-retry" onClick={data.retry}>
              {COMMON.retry}
            </button>
          </p>
        )}
      </section>

      <section className="grp" aria-labelledby="fd-prep-recipes-title">
        <h2 id="fd-prep-recipes-title">{T.recipes}</h2>
        <p className="tight">{T.recipesLead}</p>
        {roles.map((role) => (
          <div key={role} className="fd-prep-role">
            <h3>{ROLE_TITLE[role]}</h3>
            <ul className="fd-prep-rows">
              {[...new Set(plan.choices[role])].map((id) => {
                const uses = plan.meals.filter((m) => m.role === role && m.recipeId === id);
                const name = uses[0]?.name ?? RECIPES.find((r) => r.id === id)?.name ?? id;
                const swappable = canSwap(plan, role, id, from);
                return (
                  <li key={id} className="fd-prep-row">
                    <div className="fd-prep-row-main">
                      <p className="fd-prep-name">{name}</p>
                      <p className="fd-prep-meta">
                        {weekdaySpan(uses.map((u) => u.date))} · {uses.length} ×
                      </p>
                    </div>
                    {swappable ? (
                      <button
                        type="button"
                        className="btn ghost sm"
                        disabled={!ready || busy}
                        onClick={() => setSwapping({ role, id, name })}
                        aria-label={T.swapLabel(name)}
                      >
                        <Repeat {...ICON} /> {T.swap}
                      </button>
                    ) : (
                      <span className="fd-prep-meta">{T.done}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {sessions.length > 0 && (
        <section className="grp" aria-labelledby="fd-prep-cook-title">
          <h2 id="fd-prep-cook-title">
            <ChefHat {...ICON} className="fd-prep-ico" /> {T.cooking}
          </h2>
          {sessions.map((date) => (
            <div key={date} className="fd-prep-session">
              <h3>{date === today ? T.today(shortDate(date)) : shortDate(date)}</h3>
              <ul className="fd-prep-rows">
                {plan.batches
                  .filter((b) => b.date === date)
                  .map((b) => (
                    <BatchRow key={`${b.role}:${b.recipeId}`} batch={b} />
                  ))}
              </ul>
            </div>
          ))}
          {freezes.length > 0 && (
            <div className="dnote fd-prep-freeze">
              <b>
                <Snowflake size={16} strokeWidth={2} aria-hidden /> {T.freeze}
              </b>
              <ul className="fd-prep-bullets">
                {freezes.map((f) => (
                  <li key={`${f.name}:${f.date}`}>
                    {T.freezeLine(f.name, gramsLabel(f.grams), shortDate(f.date), shortDate(addDays(f.date, -1)))}
                  </li>
                ))}
              </ul>
              <p className="tight">{T.raw}</p>
            </div>
          )}
        </section>
      )}

      <section className="grp" aria-labelledby="fd-prep-days-title">
        <h2 id="fd-prep-days-title">{T.byDay}</h2>
        {plan.dayTargets.map(({ date, targets }) => {
          const meals = mealsOn(plan, date);
          const total = dayPlanTotals(plan, date);
          const check = dayCheck(total, targets);
          return (
            <details key={date} className="fd-prep-day" open={date === today}>
              <summary>
                <span>{date === today ? T.today(shortDate(date)) : shortDate(date)}</span>
                <span className="fd-prep-nums">
                  {kcal(total.kcal)} · {COMMON.p} {g(total.protein)} g
                </span>
              </summary>
              <ul className="fd-prep-rows">
                {meals.map((m) => (
                  <li key={m.slot} className="fd-prep-row">
                    <div className="fd-prep-row-main">
                      <p className="fd-prep-group">{m.slotName}</p>
                      <p className="fd-prep-name">{m.name}</p>
                      <p className="fd-prep-meta">
                        {mealAmount(m)}
                        {m.box !== null && T.box(shortDate(plan.batches[m.box]!.date))}
                      </p>
                      <p className="fd-prep-meta fd-prep-nums">
                        {kcal(m.total.kcal)} · {COMMON.p} {g(m.total.protein)} · {COMMON.c} {g(m.total.carbs)} · {COMMON.f}{' '}
                        {g(m.total.fat)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className={`tight fd-prep-nums${check.ok ? '' : ' fd-prep-warn'}`}>
                {T.check(
                  kcal(targets.kcal),
                  {
                    kcal: PLAN_WORDS[check.kcal],
                    protein: PLAN_WORDS[check.protein],
                    carbs: PLAN_WORDS[check.carbs],
                    fat: PLAN_WORDS[check.fat],
                  },
                  g(total.protein),
                  targets.protein.target,
                  g(total.carbs),
                  targets.carbs.max,
                  g(total.fat),
                )}
              </p>
            </details>
          );
        })}
      </section>
      <RenameSheet
        plan={sheet === 'name' ? plan : null}
        onSave={(name) =>
          void change(() => renamePlan(plan.id, name), name ? T.renamed(name) : T.unnamed)
        }
        onClose={() => setSheet(null)}
      />
      <DatesSheet
        plan={sheet === 'dates' ? plan : null}
        today={today}
        onSave={(start, clearTicks) =>
          void change(
            () => movePlan(plan.id, start, clearTicks),
            T.moved(rangeLabel(start, addDays(start, plan.settings.days - 1))),
          )
        }
        onClose={() => setSheet(null)}
      />
      <SwapSheet
        name={swapping?.name ?? null}
        options={options}
        favorites={ready?.favorites ?? new Set()}
        empty={swapping ? noSwapMessage(plan, swapping.role) : ''}
        onPick={(to) => swapping && void swap(swapping.role, swapping.id, to)}
        onClose={() => setSwapping(null)}
      />
      <Modal req={req} />
    </>
  );
}

/** One dish of a cooking day: how much, into how many boxes, what to put next to it, how to make it. */
function BatchRow({ batch }: { batch: PrepBatch }) {
  const recipe = RECIPES.find((r) => r.id === batch.recipeId);
  const boxes = batch.boxes.length;
  return (
    <li className="fd-prep-row fd-prep-batch">
      <div className="fd-prep-row-main">
        <p className="fd-prep-name">{batch.name}</p>
        <p className="fd-prep-meta">
          {T.batch(portionLabel(batch.servings), formatNumber(batch.factor, 2), boxes, portionAfterPo(batch.portion))}
          {batch.sides.length > 0 && ` + ${batch.sides.map((s) => s.amount).join(' + ')}`} · {weekdaySpan(batch.boxes.map((b) => b.date))}
        </p>
        <details className="fd-prep-more">
          <summary>{T.whole}</summary>
          <ul className="fd-prep-bullets">
            {batch.ingredients.map((i) => (
              <li key={i.label}>
                {i.label}: {gramsLabel(i.grams)}
              </li>
            ))}
            {batch.sides.map((s) => (
              <li key={s.ingredient}>
                {s.label}: {gramsLabel(s.grams * boxes)} ({boxes} × {s.amount})
              </li>
            ))}
          </ul>
        </details>
        {recipe && (
          <details className="fd-prep-more">
            <summary>{T.steps}</summary>
            <ol className="fd-prep-bullets">
              {recipe.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </li>
  );
}
