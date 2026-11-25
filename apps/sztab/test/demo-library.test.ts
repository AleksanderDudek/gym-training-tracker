import { describe, expect, it, vi } from 'vitest';
import { KINDS_BY_AREA, cleanForm, cleanHabits, cleanMeals, parseAssignment } from '@gymtracker/link';
import type { AssignmentBody } from '@gymtracker/link';
import { EX } from '@gt/data/exercises';
import { GROUP_LABELS, MARKER_LIST } from '@gt/food/labs/markers';
import { RECIPES } from '@gt/food/recipes/catalog';
import type { LibraryBody, LibraryItem } from '../src/lib/data';

/**
 * „Dodaj przykłady”: każdy przykład przechodzi to samo sprawdzenie co wysyłka (protokół telefonu),
 * program odsyła do elementów z tej samej partii, jadłospisy są z prawdziwych przepisów i mają sensowne sumy.
 */

vi.hoisted(() => {
  (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
});

const { addExamples, exampleArea, exampleLibrary, exampleSendable } = await import('../src/lib/demo/library');
const { toAssignment } = await import('../src/lib/assign');

const asLibrary = (batch: ReturnType<typeof exampleLibrary>): LibraryItem[] =>
  batch.map((x, i) => ({ id: `x${i}`, kind: x.body.kind, title: x.title, body: x.body, createdAt: '', updatedAt: '' }));

describe('Przykładowa biblioteka', () => {
  const batch = exampleLibrary();

  it('ma każdy rodzaj: 3 treningi, plan, cele, badania, 2 zalecenia, 5 gotowych formularzy (+ podsumowanie do programu), 2 listy nawyków, 2 jadłospisy, program', () => {
    const count = (k: LibraryBody['kind']) => batch.filter((x) => x.body.kind === k).length;
    expect(count('workout')).toBe(3);
    expect(count('plan')).toBe(1);
    expect(count('targets')).toBe(1);
    expect(count('labs')).toBe(1);
    expect(count('note')).toBe(2);
    expect(count('form')).toBe(6);
    expect(count('habits')).toBe(2);
    expect(count('meals')).toBe(2);
    expect(count('program')).toBe(1);
    expect(batch.map((x) => x.title)).toEqual(
      expect.arrayContaining(['Całe ciało A', 'Całe ciało B', 'Mobilność 15 min', 'Sen i regeneracja', 'Technika przysiadu', 'Start z prowadzącym — 4 tygodnie', 'Pakiet podstawowy']),
    );
  });

  it('każdy element przechodzi sprawdzenie wysyłki: bodyReady, czyszczenie protokołu i parseAssignment w obszarze, który pozwala na rodzaj', () => {
    const library = asLibrary(batch);
    for (const x of batch) {
      expect(exampleSendable(x, batch), x.key).toBe(true);
      const b = x.body;
      if (b.kind === 'program') continue;
      if (b.kind === 'form') expect(cleanForm(b as unknown as Record<string, unknown>), x.key).toEqual(b);
      if (b.kind === 'habits') expect(cleanHabits(b as unknown as Record<string, unknown>), x.key).toEqual(b);
      if (b.kind === 'meals') expect(cleanMeals(b as unknown as Record<string, unknown>), x.key).toEqual(b);
      const body: AssignmentBody = toAssignment(b, library, '');
      const area = exampleArea(body.kind);
      expect(KINDS_BY_AREA[area]).toContain(body.kind);
      const parsed = parseAssignment({ v: 1, id: 'x', area, sentAt: Date.now(), from: { name: 'Ola', profession: 'trainer' }, body });
      expect(parsed, x.key).not.toBeNull();
      // Telefon nie przycina niczego po cichu: treść po sprawdzeniu ta sama co wysłana (plan — z treningami).
      if (b.kind !== 'plan' && b.kind !== 'workout') expect(parsed!.body).toEqual(body);
    }
  });

  it('treningi z prawdziwych ćwiczeń atlasu; plan 8 tygodni, 3× w tygodniu, na zmianę A i B z tej partii', () => {
    const workouts = batch.flatMap((x) => (x.body.kind === 'workout' ? [x.body.workout] : []));
    for (const w of workouts) for (const it of w.items) expect(EX[it.ex], `${w.name}: ${it.ex}`).toBeDefined();
    const plan = batch.find((x) => x.key === 'plan')!.body;
    if (plan.kind !== 'plan') throw new Error('plan');
    expect(plan.plan).toMatchObject({ weeks: 8, daysPerWeek: 3, weekdays: [1, 3, 5] });
    expect(plan.plan.cycle).toEqual([workouts[0]!.id, workouts[1]!.id]);
    const sent = toAssignment(plan, asLibrary(batch), '');
    expect(sent.kind === 'plan' && sent.workouts.map((w) => w.name)).toEqual(['Całe ciało A', 'Całe ciało B']);
  });

  it('cele redukcji: 2000 kcal, 140 g białka, 10 000 kroków, 3 treningi, −0,5 kg na tydzień', () => {
    expect(batch.find((x) => x.key === 'targets')!.body).toMatchObject({ kcal: 2000, protein: 140, steps: 10000, workoutsPerWeek: 3, weeklyRate: -0.5 });
  });

  it('badania nazwami, które zna katalog GYM TRACKERa', () => {
    const labs = batch.find((x) => x.key === 'labs')!.body;
    if (labs.kind !== 'labs') throw new Error('labs');
    const known = new Set([...MARKER_LIST.map((m) => m.name), ...Object.values(GROUP_LABELS)]);
    expect(labs.tests.map((t) => t.name)).toEqual(['Morfologia', 'Lipidogram', expect.stringMatching(/glukoza/i), 'TSH', expect.stringMatching(/witamina D/i), 'Ferrytyna']);
    for (const t of labs.tests) expect(known.has(t.name), t.name).toBe(true);
  });

  it('jadłospisy: 7 dni × 4 posiłki z przepisów katalogu; wartości jak od prowadzącego (kcal co 10, gramy w całości); sumy dnia blisko celu', () => {
    const ids = new Set(RECIPES.map((r) => r.id));
    const plans = batch.flatMap((x) => (x.body.kind === 'meals' ? [x.body] : []));
    expect(plans).toHaveLength(2);
    for (const [i, m] of plans.entries()) {
      expect(m.days).toHaveLength(7);
      const [lo, hi] = i === 0 ? [1850, 2100] : [2000, 2250];
      for (const d of m.days) {
        expect(d.meals).toHaveLength(4);
        for (const meal of d.meals) {
          expect(ids.has(meal.recipe!), meal.recipe!).toBe(true);
          expect(meal.name).toBe(RECIPES.find((r) => r.id === meal.recipe)!.name);
          expect(meal.kcal! % 10).toBe(0);
          for (const g of [meal.protein, meal.carbs, meal.fat]) expect(Number.isInteger(g)).toBe(true);
        }
        const kcal = d.meals.reduce((n, x) => n + x.kcal!, 0);
        const protein = d.meals.reduce((n, x) => n + x.protein!, 0);
        expect(kcal, `${m.title} ${d.label}`).toBeGreaterThanOrEqual(lo);
        expect(kcal, `${m.title} ${d.label}`).toBeLessThanOrEqual(hi);
        expect(protein).toBeGreaterThanOrEqual(140);
      }
    }
  });

  it('program „Start z prowadzącym”: wywiad, nawyki i plan w dniu 0, jadłospis w dniu 1, zalecenie w dniu 3, podsumowania w dniach 6/13/20/27', () => {
    const program = batch.find((x) => x.key === 'program')!.body;
    if (program.kind !== 'program') throw new Error('program');
    const at = (day: number) => program.steps.filter((s) => s.day === day).map((s) => s.itemId);
    expect(at(0)).toEqual(['form-intake', 'habitsDaily', 'plan']);
    expect(at(1)).toEqual(['mealsCut']);
    expect(at(3)).toEqual(['sleep']);
    for (const d of [6, 13, 20, 27]) expect(at(d)).toEqual(['form-weekly']);
    // Podsumowanie wysyłane co tydzień jest jednorazowe — cotygodniowy formularz wysłany 4× wracałby 4× w tygodniu.
    expect(batch.find((x) => x.key === 'form-weekly')!.body).toMatchObject({ kind: 'form', repeat: 'once', intake: false });
  });
});

describe('addExamples', () => {
  it('zapisuje partię po kolei, a program dostaje numery z bazy; postęp do końca', async () => {
    let n = 0;
    const saved: LibraryItem[] = [];
    const save = vi.fn(async (_coach: string, item: { title: string; body: LibraryBody }) => {
      const row: LibraryItem = { id: `db-${++n}`, kind: item.body.kind, title: item.title, body: item.body, createdAt: '', updatedAt: '' };
      saved.push(row);
      return row;
    });
    const progress: [number, number][] = [];
    const out = await addExamples('coach-1', { save, onProgress: (d, t) => progress.push([d, t]) });
    expect(out).toHaveLength(saved.length);
    expect(save).toHaveBeenCalledTimes(exampleLibrary().length);
    expect(save.mock.calls.every((c) => c[0] === 'coach-1')).toBe(true);
    expect(progress[0]).toEqual([0, out.length]);
    expect(progress.at(-1)).toEqual([out.length, out.length]);

    const program = out.at(-1)!;
    expect(program.kind).toBe('program');
    if (program.body.kind !== 'program') throw new Error('program');
    for (const s of program.body.steps) {
      const target = out.find((x) => x.id === s.itemId);
      expect(target, s.itemId).toBeDefined();
      expect(target!.kind).not.toBe('program');
    }
    const byTitle = (id: string) => out.find((x) => x.id === id)!.title;
    expect(program.body.steps.filter((s) => s.day === 0).map((s) => byTitle(s.itemId))).toEqual(['Wywiad na start', 'Codzienne nawyki', 'Całe ciało — 8 tygodni']);
  });

  it('druga partia (kopie) ma własne numery treningów — plan nie miesza się z pierwszą', () => {
    const a = exampleLibrary();
    const b = exampleLibrary();
    const ids = (x: typeof a) => x.flatMap((i) => (i.body.kind === 'workout' ? [i.body.workout.id] : []));
    expect(ids(a).some((id) => ids(b).includes(id))).toBe(false);
  });

  it('po angielsku: treść po angielsku, nazwy przepisów i badań z katalogów', async () => {
    vi.resetModules();
    (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'en';
    try {
      const en = await import('../src/lib/demo/library');
      const batch = en.exampleLibrary();
      expect(batch.map((x) => x.title)).toEqual(expect.arrayContaining(['Full body A', 'Mobility 15 min', 'Sleep and recovery', 'Start with your coach — 4 weeks', 'Basic panel']));
      const labs = batch.find((x) => x.key === 'labs')!.body;
      expect(labs.kind === 'labs' && labs.tests[0]!.name).toBe('Blood count');
      for (const x of batch) expect(en.exampleSendable(x, batch), x.key).toBe(true);
    } finally {
      (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
      vi.resetModules();
    }
  });
});
