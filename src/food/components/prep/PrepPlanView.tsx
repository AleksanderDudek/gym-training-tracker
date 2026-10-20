import { ChefHat, ListChecks, Repeat, Shuffle, Snowflake, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Modal, useModal } from '../../../components/ui';
import { useBridge } from '../../bridge';
import { macroStatus, type Status } from '../../diet/day';
import { addDays } from '../../diet/model';
import type { Profile } from '../../diet/types';
import { useDataset } from '../../hooks/useDataset';
import { useFavorites } from '../../hooks/useDiet';
import { formatNumber, plural } from '../../lib/format';
import { RECIPES } from '../../recipes/catalog';
import { gramsLabel, longDate, portionLabel, rangeLabel, shortDate, weekdaySpan } from '../../prep/format';
import { canSwap, newSeed, rerollPlan, swapRecipe, type GenerateResult } from '../../prep/generate';
import { averageDay, dayPlanTotals, mealAmount, mealsOn, shoppingProgress } from '../../prep/meals';
import { itemName } from '../../prep/shopping';
import { deletePrepPlan, planEnd, replacePrepPlan } from '../../prep/store';
import type { PrepBatch, PrepPlan, Role } from '../../prep/types';
import { recipeIndex } from '../../recipes/resolve';
import { shoppingHref } from './links';
import './prep.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const ROLE_TITLE: Record<Role, string> = {
  lunchBox: 'Obiady z pudełka',
  dinnerBox: 'Kolacje z pudełka',
  lunch: 'Obiady na świeżo',
  dinner: 'Kolacje na świeżo',
  breakfast: 'Śniadania',
  snack: 'Przekąski',
};
const ROLE_ORDER: Role[] = ['breakfast', 'lunchBox', 'lunch', 'snack', 'dinnerBox', 'dinner'];

const STATUS_WORD: Record<Status, string> = { brak: 'za mało', ok: 'w normie', nadmiar: 'za dużo' };

const kcal = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;
const g = (n: number) => formatNumber(Math.round(n), 0);

interface Props {
  plan: PrepPlan & { id: number };
  profile: Profile;
  today: string;
  onNext: () => void;
}

/**
 * Plan z zakupami: co, kiedy gotować i co jeść którego dnia. Przepis da się wymienić, a cały plan
 * ułożyć jeszcze raz — do tego potrzebna jest baza produktów; sam plan i lista działają bez niej.
 */
export function PrepPlanView({ plan, profile, today, onNext }: Props) {
  const bridge = useBridge();
  const data = useDataset();
  const favorites = useFavorites();
  const { req, ask } = useModal();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const end = planEnd(plan);
  const average = averageDay(plan);
  const physical = plan.shops.find((s) => !s.online);
  const order = plan.shops.find((s) => s.online);
  const progress = shoppingProgress(plan, new Set(plan.bought));
  const stale = plan.goal.kcal !== profile.dailyKcal || plan.goal.dietProfile !== profile.dietProfile;
  // A change touches only what is ahead: from today (or the plan's first day, when it starts later).
  const from = plan.settings.start > today ? plan.settings.start : today;
  const ready =
    data.status === 'ready'
      ? {
          index: recipeIndex(data.products),
          dict: data.dataset.dictionaries,
          favorites: new Set((favorites ?? []).filter((f) => f.key.startsWith('recipe:')).map((f) => f.key.slice(7))),
        }
      : null;

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
      setNote('Nie udało się zapisać zmiany na tym urządzeniu — spróbuj jeszcze raz.');
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
        'Ułożyć inny plan?',
        <p>
          {started ? 'Dni do dziś i ugotowane już pudełka zostają, reszta planu się zmieni. ' : ''}
          Lista zakupów pójdzie za planem: odhaczone zostanie tylko to, czego nowy plan nie potrzebuje więcej.
        </p>,
        'Ułóż inny',
      ))
    )
      return;
    await save(() => rerollPlan(plan, ready, newSeed(), from), 'Nowy zestaw przepisów — lista zakupów też.');
  };

  const swap = async (role: Role, recipeId: string) => {
    if (!ready || busy) return;
    await save(() => swapRecipe(plan, role, recipeId, ready, from), 'Przepis wymieniony — porcje i lista zakupów poszły za nim.');
  };

  const remove = async () => {
    if (!(await ask('Usunąć plan z zakupami?', <p>Zapisy jedzenia zostaną, zniknie tylko plan i jego lista.</p>, 'Usuń plan')))
      return;
    try {
      await deletePrepPlan(plan.id);
    } catch {
      setNote('Nie udało się usunąć planu — spróbuj jeszcze raz.');
    }
  };

  const roles = ROLE_ORDER.filter((r) => plan.choices[r]?.length);
  // A rotation of one recipe for a week: the same breakfast every day.
  const repeats = (['breakfast', 'snack', 'dinner'] as const).some((r) => plan.choices[r]?.length === 1);
  const sessions = [...new Set(plan.batches.map((b) => b.date))];
  const freezes = plan.shopping.flatMap((i) => i.freeze.map((f) => ({ ...f, name: itemName(i) })));

  return (
    <>
      <section className="grp fd-prep-head" aria-labelledby="fd-prep-title">
        <h2 id="fd-prep-title" className="today-name">
          Plan na {plan.settings.days} dni
        </h2>
        <p className="tight">
          {rangeLabel(plan.settings.start, end)} · zakupy: {physical?.name}
          {order && ` + ${order.name} (zamówienie)`} · {plan.slots.length}{' '}
          {plural(plan.slots.length, 'posiłek', 'posiłki', 'posiłków')} dziennie
        </p>
        <p className="tight">
          {plan.goal.styleLabel} · cel {kcal(plan.goal.kcal)}
          {plan.goal.source === 'checkin' && ' (dopasowany do postępów)'}. Średni dzień planu: {kcal(average.kcal)} · B{' '}
          {g(average.protein)} · W {g(average.carbs)} · T {g(average.fat)} g.
        </p>
        {plan.settings.start > today && <p className="tight">Plan zaczyna się {longDate(plan.settings.start)} — do tego dnia dziennik idzie po staremu.</p>}
        {stale && (
          <p className="tight fd-prep-warn">
            Od ułożenia planu zmienił się cel w profilu diety ({kcal(profile.dailyKcal)}, {profile.dietProfile === plan.goal.dietProfile ? 'ten sam styl' : 'inny styl'}).
            Kupione zostaje kupione — następny plan pójdzie za nowym celem.
          </p>
        )}
        {repeats && (
          <p className="tight">
            Ten styl i koszyk mają mało pasujących przepisów, więc dania się powtarzają. Więcej da inny sklep albo
            zamówienie przez internet.
          </p>
        )}
        {plan.settings.cooking === 'both' && !plan.choices.dinnerBox && (
          <p className="tight">Na kolację nie ma drugiego dania do pudełek w tym stylu i koszyku — kolacje robisz na świeżo.</p>
        )}
        {note && (
          <p className="tight fd-prep-warn" role="alert">
            {note}
          </p>
        )}
        <div className="fd-prep-actions">
          <a className="btn" href={shoppingHref(plan)}>
            <ListChecks {...ICON} /> Lista zakupów
            {progress.done > 0 && ` (${progress.done}/${progress.total})`}
          </a>
          <button type="button" className="btn ghost sm" onClick={() => void reroll()} disabled={!ready || busy}>
            <Shuffle {...ICON} /> Inny plan
          </button>
          <button type="button" className="btn ghost sm" onClick={onNext}>
            Następny plan
          </button>
          <button type="button" className="btn ghost sm" onClick={() => void remove()}>
            <Trash2 {...ICON} /> Usuń plan
          </button>
        </div>
        {data.status === 'loading' && <p className="tight fd-prep-soft">Wczytuję bazę produktów — wymiana przepisów zaraz będzie gotowa.</p>}
        {data.status === 'error' && (
          <p className="tight fd-prep-warn">
            Bez bazy produktów nie wymienię przepisu ani nie ułożę innego planu — plan i lista działają dalej.{' '}
            <button type="button" className="fd-prep-retry" onClick={data.retry}>
              Spróbuj ponownie
            </button>
          </p>
        )}
      </section>

      <section className="grp" aria-labelledby="fd-prep-recipes-title">
        <h2 id="fd-prep-recipes-title">Przepisy w planie</h2>
        <p className="tight">Coś Ci nie pasuje? „Wymień” podmienia przepis w całym planie — porcje i lista zakupów idą za nim.</p>
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
                        onClick={() => void swap(role, id)}
                        aria-label={`Wymień: ${name}`}
                      >
                        <Repeat {...ICON} /> Wymień
                      </button>
                    ) : (
                      <span className="fd-prep-meta">zjedzone albo ugotowane</span>
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
            <ChefHat {...ICON} className="fd-prep-ico" /> Gotowanie na zapas
          </h2>
          {sessions.map((date) => (
            <div key={date} className="fd-prep-session">
              <h3>{date === today ? `Dziś, ${shortDate(date)}` : shortDate(date)}</h3>
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
                <Snowflake size={16} strokeWidth={2} aria-hidden /> Zamroź po zakupach
              </b>
              <ul className="fd-prep-bullets">
                {freezes.map((f) => (
                  <li key={`${f.name}:${f.date}`}>
                    {f.name}: {gramsLabel(f.grams)} na {shortDate(f.date)} — przełóż do lodówki {shortDate(addDays(f.date, -1))}.
                  </li>
                ))}
              </ul>
              <p className="tight">Surowe mięso i ryba wytrzymują w lodówce 1–2 dni.</p>
            </div>
          )}
        </section>
      )}

      <section className="grp" aria-labelledby="fd-prep-days-title">
        <h2 id="fd-prep-days-title">Dzień po dniu</h2>
        {plan.dayTargets.map(({ date, targets }) => {
          const meals = mealsOn(plan, date);
          const total = dayPlanTotals(plan, date);
          const status = macroStatus(targets, total, true);
          return (
            <details key={date} className="fd-prep-day" open={date === today}>
              <summary>
                <span>{date === today ? `Dziś, ${shortDate(date)}` : shortDate(date)}</span>
                <span className="fd-prep-nums">
                  {kcal(total.kcal)} · B {g(total.protein)} g
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
                        {m.box !== null && ` · pudełko z ${shortDate(plan.batches[m.box]!.date)}`}
                      </p>
                      <p className="fd-prep-meta fd-prep-nums">
                        {kcal(m.total.kcal)} · B {g(m.total.protein)} · W {g(m.total.carbs)} · T {g(m.total.fat)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="tight fd-prep-nums">
                Cel dnia {kcal(targets.kcal)}: kalorie {STATUS_WORD[status.kcal.status]}, białko {g(total.protein)}/{targets.protein.target} g (
                {STATUS_WORD[status.protein.status]}), węglowodany {g(total.carbs)}
                {targets.carbs.max !== null ? `/${targets.carbs.max} g limitu` : ' g'} ({STATUS_WORD[status.carbs.status]}), tłuszcz{' '}
                {g(total.fat)} g ({STATUS_WORD[status.fat.status]}).
              </p>
            </details>
          );
        })}
      </section>
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
          {portionLabel(batch.servings)} (przepis × {formatNumber(batch.factor, 2)}) · {boxes}{' '}
          {plural(boxes, 'pudełko', 'pudełka', 'pudełek')} po {portionLabel(batch.portion)}
          {batch.sides.length > 0 && ` + ${batch.sides.map((s) => s.amount).join(' + ')}`} · {weekdaySpan(batch.boxes.map((b) => b.date))}
        </p>
        <details className="fd-prep-more">
          <summary>Składniki na całość</summary>
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
            <summary>Jak zrobić</summary>
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
