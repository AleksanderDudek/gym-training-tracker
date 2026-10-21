import { describe, expect, test } from 'vitest';
import { DIET_PROFILE_IDS, DIET_PROFILES } from '../diet/profiles';
import type { DietProfileId } from '../diet/types';
import { RECIPES } from '../recipes/catalog';
import { INGREDIENTS } from '../recipes/ingredients';
import { ONLINE_ONLY, PREP_DICT, prepIndex, prepProfile } from '../test/prep';
import { planDates } from './blocks';
import { planRecipes } from './candidates';
import { generatePlan, noSwapMessage, rerollPlan, swapChoices, swapRecipe, type GenerateInput } from './generate';
import { fitsRole } from './select';
import { planTargets } from './targets';
import type { Cooking, Exclusion, PrepPlan, PrepSettings } from './types';

const index = prepIndex();

function input(over: Partial<PrepSettings> = {}, style: DietProfileId = 'redukcja', kcal = 2200): GenerateInput {
  const settings: PrepSettings = {
    start: '2026-10-20',
    days: 7,
    meals: 4,
    cooking: 'lunch',
    store: 'biedronka',
    online: null,
    exclude: [],
    seed: 1,
    avoid: [],
    ...over,
  };
  const profile = prepProfile({ dietProfile: style, dailyKcal: kcal });
  return {
    settings,
    index,
    dict: PREP_DICT,
    dayTargets: planTargets({
      profile,
      kcal,
      eaten: new Map(),
      today: '2026-10-20',
      dates: planDates(settings.start, settings.days),
    }),
    goal: { kcal, source: 'profile', dietProfile: style, styleLabel: DIET_PROFILES[style].label, pace: 0.5, weightKg: 82 },
    checkIn: null,
  };
}

function plan(over: Partial<PrepSettings> = {}, style: DietProfileId = 'redukcja', kcal = 2200): PrepPlan {
  const result = generatePlan(input(over, style, kcal));
  if (!result.ok) throw new Error(result.message);
  return result.plan;
}

const dayTotal = (p: PrepPlan, date: string) =>
  p.meals
    .filter((m) => m.date === date)
    .reduce(
      (a, m) => ({
        kcal: a.kcal + m.total.kcal,
        protein: a.protein + m.total.protein,
        carbs: a.carbs + m.total.carbs,
        fat: a.fat + m.total.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );

describe('a plan meets the day, whatever the style', () => {
  const cases = DIET_PROFILE_IDS.flatMap((style) =>
    ([3, 4, 5] as const).flatMap((meals) => (['lunch', 'both'] as Cooking[]).map((cooking) => ({ style, meals, cooking }))),
  );

  test.each(cases)('$style, $meals meals, cooking $cooking: energy −7…+5 %, protein ≥ minimum, carbs within the limit', ({ style, meals, cooking }) => {
    const p = plan({ meals, cooking }, style);
    expect(p.meals).toHaveLength(7 * meals);
    for (const { date, targets } of p.dayTargets) {
      const t = dayTotal(p, date);
      // Never 5 % over (the diary's "ponad cel"), at most 7 % under.
      expect((t.kcal - targets.kcal) / targets.kcal, `${date} kcal ${t.kcal} / ${targets.kcal}`).toBeLessThanOrEqual(0.05);
      expect((t.kcal - targets.kcal) / targets.kcal, `${date} kcal ${t.kcal} / ${targets.kcal}`).toBeGreaterThanOrEqual(-0.07);
      expect(t.protein, date).toBeGreaterThanOrEqual(targets.protein.min);
      // A carb limit is a limit: not even a gram over.
      if (targets.carbs.max !== null) expect(t.carbs, date).toBeLessThanOrEqual(targets.carbs.max + 0.05);
    }
  });

  test.each([
    { sex: 'K' as const, kcal: 1200, weight: 55, meals: 3 as const },
    { sex: 'K' as const, kcal: 1200, weight: 55, meals: 4 as const },
    { sex: 'M' as const, kcal: 3200, weight: 85, meals: 3 as const },
    { sex: 'M' as const, kcal: 3500, weight: 85, meals: 4 as const },
  ])('$kcal kcal ($sex, $meals meals): every style fed within −7…+5 %, carbs within a limit, fat at its minimum', ({ sex, kcal, weight, meals }) => {
    for (const style of DIET_PROFILE_IDS) {
      const profile = prepProfile({ sex, dietProfile: style, dailyKcal: kcal, startWeightKg: weight, targetWeightKg: weight });
      const result = generatePlan({
        ...input({ meals }, style, kcal),
        dayTargets: planTargets({ profile, kcal, eaten: new Map(), today: '2026-10-20', dates: planDates('2026-10-20', 7) }),
      });
      if (!result.ok) throw new Error(result.message);
      for (const { date, targets } of result.plan.dayTargets) {
        const t = dayTotal(result.plan, date);
        expect((t.kcal - targets.kcal) / targets.kcal, `${style} ${date}`).toBeLessThanOrEqual(0.05);
        expect((t.kcal - targets.kcal) / targets.kcal, `${style} ${date}`).toBeGreaterThanOrEqual(-0.07);
        if (targets.carbs.max !== null) expect(t.carbs, `${style} ${date}`).toBeLessThanOrEqual(targets.carbs.max);
        expect(t.fat, `${style} ${date}`).toBeGreaterThanOrEqual(targets.fat.min);
      }
    }
  });

  test('keto and low carb get no starch and no banana next to their dishes', () => {
    for (const style of ['keto', 'lowcarb'] as const) {
      const p = plan({ meals: 5 }, style);
      const starch = p.meals.flatMap((m) => m.sides).filter((x) => ['rice', 'potato', 'roll', 'banana'].includes(x.ingredient));
      expect(starch, style).toEqual([]);
    }
  });

  test('a day never repeats a dish, every meal is filled, the style never gets what it calls "nie pasuje"', () => {
    for (const style of DIET_PROFILE_IDS) {
      const p = plan({ meals: 4 }, style);
      for (const date of planDates('2026-10-20', 7)) {
        const ids = p.meals.filter((m) => m.date === date).map((m) => m.recipeId);
        expect(new Set(ids).size, `${style} ${date}`).toBe(4);
      }
      // The verdict is on energy shares, so a portion of any size gets the recipe's own.
      for (const m of p.meals) expect(DIET_PROFILES[style].fit(m.recipe).level, m.recipeId).not.toBe('avoid');
    }
  });
});

describe('cooking ahead', () => {
  test('obiad comes from a box: one dish per block, cooked on its first day, equal boxes', () => {
    const p = plan();
    expect(p.batches.map((b) => [b.date, b.role, b.boxes.length])).toEqual([
      ['2026-10-20', 'lunchBox', 4],
      ['2026-10-24', 'lunchBox', 3],
    ]);
    for (const [i, batch] of p.batches.entries()) {
      const boxes = p.meals.filter((m) => m.box === i);
      expect(boxes.map((m) => m.date)).toEqual(batch.boxes.map((b) => b.date));
      expect(new Set(boxes.map((m) => m.portion))).toEqual(new Set([batch.portion]));
      expect(new Set(boxes.map((m) => JSON.stringify(m.sides)))).toHaveLength(1);
      expect(batch.servings).toBeCloseTo(batch.portion * batch.boxes.length, 9);
      expect(boxes.every((m) => m.slotName === 'Obiad')).toBe(true);
    }
    // Two different dishes: a week of the same box is what the second block is for.
    expect(p.batches[0]!.recipeId).not.toBe(p.batches[1]!.recipeId);
  });

  test('with both from boxes, kolacja is a second dish of the session', () => {
    const p = plan({ cooking: 'both' });
    expect(p.batches.map((b) => b.role)).toEqual(['lunchBox', 'dinnerBox', 'lunchBox', 'dinnerBox']);
    const [lunch, dinner] = p.batches;
    expect(lunch!.recipeId).not.toBe(dinner!.recipeId);
    expect(p.meals.filter((m) => m.slotName === 'Kolacja').every((m) => m.box !== null)).toBe(true);
  });

  test('a batch scales the recipe: every ingredient times servings over the recipe servings', () => {
    const p = plan();
    const batch = p.batches[0]!;
    const recipe = RECIPES.find((r) => r.id === batch.recipeId)!;
    expect(batch.factor).toBeCloseTo(batch.servings / (recipe.servings ?? 1), 2);
    const first = recipe.items.find((i) => i.ingredient !== 'water')!;
    expect(batch.ingredients.find((i) => i.label === INGREDIENTS[first.ingredient].label)!.grams).toBeCloseTo(
      first.grams * batch.factor,
      0,
    );
  });

  test('fresh meals are quick, gotowce stay one serving and are snacks only', () => {
    const p = plan({ meals: 5 });
    const byId = new Map(RECIPES.map((r) => [r.id, r]));
    for (const m of p.meals.filter((x) => x.box === null)) {
      const recipe = byId.get(m.recipeId)!;
      expect(recipe.servings ?? 1, m.recipeId).toBe(1);
      if (recipe.kind === 'gotowiec') {
        expect(m.portion).toBe(1);
        expect(m.role).toBe('snack');
        expect(m.sides).toEqual([]);
      }
    }
  });
});

describe('the basket', () => {
  test('one physical shop: nothing that only an online shop sells', () => {
    const p = plan();
    expect(p.shops).toEqual([{ key: 'biedronka', name: 'Biedronka', online: false, url: null }]);
    expect(p.shopping.some((i) => ONLINE_ONLY.has(i.ingredient as never))).toBe(false);
    expect(p.shopping.some((i) => i.group === 'order')).toBe(false);
  });

  test('with an online shop: its products in the order, the rest on the visit', () => {
    const pool = (online: string | null) =>
      planRecipes({
        candidates: index.candidates,
        basket: online ? ['biedronka', online] : ['biedronka'],
        dietProfile: DIET_PROFILES.redukcja,
        exclude: [],
      }).length;
    expect(pool('myprotein')).toBeGreaterThan(pool(null));
    const p = plan({ online: 'myprotein', seed: 4 }, 'zbilansowana');
    expect(p.shops.map((s) => [s.key, s.online])).toEqual([
      ['biedronka', false],
      ['myprotein', true],
    ]);
    const order = p.shopping.filter((i) => i.group === 'order');
    for (const item of order) {
      expect(item.shop).toBe('myprotein');
      expect(item.product?.url).toMatch(/^https:\/\/www\.myprotein\.pl\//);
    }
  });

  test('exclusions leave out every recipe with that ingredient', () => {
    const exclude: Exclusion[] = ['meat', 'fish'];
    const p = plan({ exclude });
    const banned = ['chicken', 'chickenFillet', 'turkeyMince', 'leanBeef', 'turkeyFillet', 'tuna', 'salmonFillet', 'whiteFish', 'shrimp', 'smokedSalmon', 'herring'];
    expect(p.shopping.filter((i) => banned.includes(i.ingredient))).toEqual([]);
  });

  test('nothing for a meal: no plan, and a message that says which meal and what to try', () => {
    const result = generatePlan(input({ exclude: ['meat', 'fish', 'eggs'] }, 'keto'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/^Nie mam przepisu na .+ z tego koszyka dla stylu „Keto”\. Spróbuj: /);
    expect(result.message).toContain('zdejmij wykluczenia');
  });
});

describe('the same plan, another plan, one recipe swapped', () => {
  test('deterministic: the same settings give the same plan', () => {
    expect(plan({ seed: 9 }).meals).toEqual(plan({ seed: 9 }).meals);
  });

  test('another seed, another plan with the same goal', () => {
    const p = { ...plan({ seed: 1 }), id: 3, bought: ['skyr', 'nope'] };
    const other = rerollPlan(p, { index, dict: PREP_DICT }, 2, '2026-10-20');
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.plan.id).toBe(3);
    expect(other.plan.settings.seed).toBe(2);
    expect(other.plan.dayTargets).toEqual(p.dayTargets);
    expect(JSON.stringify(other.plan.choices)).not.toBe(JSON.stringify(p.choices));
    // Ticks stay for the lines the new plan still has.
    expect(other.plan.bought.every((k) => other.plan.shopping.some((i) => i.key === k))).toBe(true);
  });

  test('a swap replaces one recipe everywhere in its role and keeps every other choice', () => {
    const p = plan();
    const out = p.choices.breakfast![0]!;
    const swapped = swapRecipe(p, 'breakfast', out, { index, dict: PREP_DICT }, '2026-10-20');
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    const next = swapped.plan;
    expect(next.choices.breakfast).not.toContain(out);
    expect(next.choices.breakfast![1]).toBe(p.choices.breakfast![1]);
    expect(next.choices.lunchBox).toEqual(p.choices.lunchBox);
    expect(next.choices.snack).toEqual(p.choices.snack);
    expect(next.settings.avoid).toEqual([out]);
    expect(next.meals.some((m) => m.recipeId === out)).toBe(false);
    // The newcomer can play the role and was not in the plan before.
    const pool = planRecipes({ candidates: index.candidates, basket: ['biedronka'], dietProfile: DIET_PROFILES.redukcja, exclude: [] });
    const newcomer = pool.find((r) => r.recipe.id === next.choices.breakfast![0])!;
    expect(fitsRole(newcomer, 'breakfast')).toBe(true);
    expect(Object.values(p.choices).flat()).not.toContain(newcomer.recipe.id);
  });

  test('a change from day 3 keeps the days eaten and the boxes cooked; the rest of the plan follows', () => {
    const p = { ...plan({ seed: 1 }), id: 7 };
    const from = '2026-10-22';
    const other = rerollPlan(p, { index, dict: PREP_DICT }, 2, from);
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    const q = other.plan;
    // Days before `from` are exactly as they were.
    expect(q.meals.filter((m) => m.date < from)).toEqual(p.meals.filter((m) => m.date < from));
    // The first block (20–23 Oct) was cooked on the 20th: its boxes stay, the 22nd and 23rd too.
    const firstBlock = (x: PrepPlan) =>
      x.meals.filter((m) => m.box !== null && m.date <= '2026-10-23').map((m) => [m.date, m.recipeId, m.portion]);
    expect(firstBlock(q)).toEqual(firstBlock(p));
    expect(q.batches[0]).toEqual(p.batches[0]);
    expect(q.choices.lunchBox![0]).toBe(p.choices.lunchBox![0]);
    // Every day is still whole: four meals, each slot once.
    for (const date of planDates('2026-10-20', 7)) expect(q.meals.filter((m) => m.date === date).map((m) => m.slot)).toEqual([0, 1, 2, 3]);
    // A box cooked already cannot be swapped; one of the second block can.
    expect(swapRecipe(p, 'lunchBox', p.choices.lunchBox![0]!, { index, dict: PREP_DICT }, from)).toMatchObject({ ok: false });
    const second = swapRecipe(p, 'lunchBox', p.choices.lunchBox![1]!, { index, dict: PREP_DICT }, from);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.plan.choices.lunchBox).toEqual([p.choices.lunchBox![0], expect.not.stringMatching(`^${p.choices.lunchBox![1]}$`)]);
  });

  test('a tick stays only while the new plan needs no more of that line', () => {
    const p = { ...plan({ seed: 1 }), id: 7 };
    const keys = p.shopping.map((i) => i.key);
    const other = rerollPlan({ ...p, bought: keys }, { index, dict: PREP_DICT }, 2, '2026-10-20');
    if (!other.ok) throw new Error(other.message);
    const was = new Map(p.shopping.map((i) => [i.key, i.grams]));
    for (const item of other.plan.shopping)
      expect(other.plan.bought.includes(item.key), item.key).toBe(was.has(item.key) && item.grams <= was.get(item.key)!);
  });

  test('nothing left to swap to: the plan stays, with a reason', () => {
    const p = plan({}, 'keto');
    const out = p.choices.lunchBox![0]!;
    const result = swapRecipe(p, 'lunchBox', out, { index, dict: PREP_DICT }, '2026-10-20');
    // Keto has one box dish that fits fully: nothing else may take its place.
    expect(result).toEqual({ ok: false, missing: [], message: noSwapMessage(p, 'lunchBox') });
    expect(noSwapMessage(p, 'lunchBox')).toMatch(/^Nie ma innego przepisu na obiad w tym koszyku\. Więcej da inny sklep, sklep internetowy/);
    expect(swapChoices(p, 'lunchBox', out, { index, dict: PREP_DICT }, '2026-10-20')).toEqual([]);
  });
});

describe('swapping from a list', () => {
  const input = { index, dict: PREP_DICT };

  test('the list: every recipe that can play the role and is not in the plan, best first — the automatic swap takes the first', () => {
    const p = plan();
    const out = p.choices.breakfast![0]!;
    const options = swapChoices(p, 'breakfast', out, input, '2026-10-20');
    expect(options.length).toBeGreaterThan(1);
    const inPlan = new Set(Object.values(p.choices).flat());
    for (const o of options) {
      expect(fitsRole(o.recipe, 'breakfast')).toBe(true);
      expect(inPlan.has(o.recipe.recipe.id)).toBe(false);
    }
    const scores = options.map((o) => o.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const auto = swapRecipe(p, 'breakfast', out, input, '2026-10-20');
    if (!auto.ok) throw new Error(auto.message);
    expect(auto.plan.choices.breakfast![0]).toBe(options[0]!.recipe.recipe.id);
  });

  test('a chosen recipe takes the place; the one swapped out stays listed, marked, and can be chosen back', () => {
    const p = plan();
    const out = p.choices.breakfast![0]!;
    const options = swapChoices(p, 'breakfast', out, input, '2026-10-20');
    const pick = options.at(-1)!.recipe.recipe.id;
    const swapped = swapRecipe(p, 'breakfast', out, input, '2026-10-20', pick);
    if (!swapped.ok) throw new Error(swapped.message);
    expect(swapped.plan.choices.breakfast![0]).toBe(pick);
    expect(swapped.plan.meals.some((m) => m.recipeId === pick)).toBe(true);
    expect(swapped.plan.settings.avoid).toEqual([out]);
    // Back again: the old breakfast is on the list, marked as swapped out, and leaves the avoid list when chosen.
    const back = swapChoices(swapped.plan, 'breakfast', pick, input, '2026-10-20').find((o) => o.recipe.recipe.id === out);
    expect(back?.avoided).toBe(true);
    const again = swapRecipe(swapped.plan, 'breakfast', pick, input, '2026-10-20', out);
    if (!again.ok) throw new Error(again.message);
    expect(again.plan.choices.breakfast![0]).toBe(out);
    expect(again.plan.settings.avoid).toEqual([pick]);
  });

  test('a recipe that cannot play the role (or is in the plan already) is refused', () => {
    const p = plan();
    const out = p.choices.breakfast![0]!;
    const result = swapRecipe(p, 'breakfast', out, input, '2026-10-20', p.choices.lunchBox![0]!);
    expect(result).toEqual({ ok: false, missing: [], message: 'Ten przepis nie pasuje już do planu — wybierz inny.' });
  });

  test('the name and the moment the plan was set survive a swap and another plan', () => {
    const p = { ...plan(), id: 4, name: 'Tydzień na masę', setAt: '2026-10-21T09:00:00.000Z' };
    const swapped = swapRecipe(p, 'breakfast', p.choices.breakfast![0]!, input, '2026-10-20');
    const other = rerollPlan(p, input, 7, '2026-10-20');
    for (const r of [swapped, other]) {
      if (!r.ok) throw new Error(r.message);
      expect(r.plan).toMatchObject({ id: 4, name: 'Tydzień na masę', setAt: '2026-10-21T09:00:00.000Z' });
    }
  });
});
