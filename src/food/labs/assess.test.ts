import { describe, expect, it } from 'vitest';
import { assess, type Person } from './assess';
import { readText } from './read/parse';
import { exampleDay, topFoods, topRecipes } from './recommend';
import type { LabReport } from './types';
import { ckdEpi2021, latestValues } from './verdict';

const PERSON: Person = { sex: 'K', age: 34, pregnancy: false, eats: 'all', lowCarb: false };

function report(text: string, date = '2026-10-02', id = 1): LabReport {
  const read = readText(text);
  return {
    id,
    date,
    lab: read.lab,
    source: 'text',
    addedAt: `${date}T10:00:00.000Z`,
    results: read.rows.filter((r) => !r.duplicate).map((r) => ({ marker: r.marker.id, value: r.value, cmp: r.cmp, qual: r.qual, printed: r.printed, ref: r.ref })),
  };
}

const run = (reports: LabReport[], person: Person = PERSON) => assess(latestValues(reports, person), person);

describe('assess', () => {
  it('puts iron first for low ferritin with small red cells, and keeps three focuses', () => {
    const a = run([
      report(`
HGB - hemoglobina 11,4 g/dl 12,0 - 16,0
MCV 76 fl 80 - 100
Ferrytyna 8 ng/ml 13 - 150
Witamina D3 metabolit 25(OH) 17 ng/ml 30 - 50
Cholesterol LDL 140 mg/dl < 115
Glukoza 108 mg/dl 70 - 99
Kwas moczowy 7,1 mg/dl 2,6 - 6,0
`),
    ]);
    expect(a.focus.map((f) => f.id)).toEqual(['iron', 'glucose', 'ldl']);
    expect(a.more.map((f) => f.id)).toEqual(['vitD', 'uric']);
    expect(a.findings.find((f) => f.marker === 'hgb')).toMatchObject({ severity: 'doctor' });
    expect(a.findings.find((f) => f.marker === 'vitD')?.note).toMatch(/lekarz/);
  });

  it('sends critical values to a doctor and gives them no focus', () => {
    const a = run([report('Potas 6,4 mmol/l 3,5 - 5,1\nALT 160 U/l < 33')]);
    expect(a.findings.slice(0, 2).map((f) => f.severity)).toEqual(['urgent', 'doctor']);
    expect(a.focus).toEqual([]);
  });

  it('never proposes iron for high ferritin, or during an infection', () => {
    expect(run([report('Ferrytyna 520 ng/ml 13 - 150\nWysycenie transferyny 60 % 20 - 45')]).focus).toEqual([]);
    const infected = run([report('Ferrytyna 10 ng/ml 13 - 150\nCRP 42 mg/l < 5')]);
    expect(infected.inflamed).toBe(true);
    expect(infected.focus.map((f) => f.id)).not.toContain('iron');
  });

  it('ignores a low serum iron when ferritin is fine', () => {
    expect(run([report('Żelazo 40 µg/dl 50 - 170\nFerrytyna 80 ng/ml 13 - 150')]).focus).toEqual([]);
  });

  it('judges vitamin D against the guideline even when the lab range is wider', () => {
    const a = run([report('25(OH)D 25 ng/ml 20 - 100')]);
    expect(a.findings[0]).toMatchObject({ marker: 'vitD', severity: 'diet' });
    expect(a.findings[0]!.verdict).toMatchObject({ level: 'ok', target: 'below' });
  });

  it('calculates eGFR from creatinine and warns about the protein rule under 60', () => {
    expect(ckdEpi2021(1, 40, 'M')).toBeCloseTo(97.6, 1);
    const a = run([report('Kreatynina 1,6 mg/dl 0,5 - 1,1')], { ...PERSON, age: 60 });
    expect(latestValues([report('Kreatynina 1,6 mg/dl')], { sex: 'K', age: 60 }).get('egfr')).toMatchObject({ derived: true });
    expect(a.proteinCaution).toBe(true);
  });

  it('takes the newest value of each marker and derives non-HDL from the same day', () => {
    const old = report('Ferrytyna 9 ng/ml\nCholesterol całkowity 240 mg/dl\nCholesterol HDL 50 mg/dl', '2026-06-01', 1);
    const fresh = report('Ferrytyna 35 ng/ml', '2026-09-01', 2);
    const latest = latestValues([fresh, old], PERSON);
    expect(latest.get('ferritin')).toMatchObject({ value: 35, date: '2026-09-01' });
    expect(latest.get('nonHdl')).toMatchObject({ value: 190, derived: true });
  });

  it('ketones on a low-carb profile are expected; without it they go to a doctor', () => {
    const text = 'Badanie ogólne moczu\nCiała ketonowe obecne';
    expect(run([report(text)], { ...PERSON, lowCarb: true }).findings[0]!.severity).toBe('ok');
    expect(run([report(text)]).findings[0]!.severity).toBe('doctor');
  });

  it('asks for ferritin when haemoglobin is low without it, and for B12 on a vegan diet', () => {
    const a = run([report('Hemoglobina 11 g/dl 12 - 16')], { ...PERSON, eats: 'vegan' });
    expect(a.missing.map((m) => m.marker)).toEqual(expect.arrayContaining(['ferritin', 'b12', 'vitD']));
  });
});

describe('recommend', () => {
  const person = { sex: 'K' as const, age: 34, pregnancy: false, eats: 'all' as const };

  it('ranks iron foods per portion, two at most from a group', () => {
    const picks = topFoods('iron', person);
    expect(picks.length).toBe(8);
    expect(picks[0]!.food.group).toBe('organ');
    const groups = picks.map((p) => p.food.group);
    for (const g of new Set(groups)) expect(groups.filter((x) => x === g).length).toBeLessThanOrEqual(2);
  });

  it('leaves out meat for vegans and offal when asked', () => {
    expect(topFoods('iron', { ...person, eats: 'vegan' }).every((p) => !['fish', 'meat', 'organ', 'poultry', 'eggs', 'dairy'].includes(p.food.group))).toBe(true);
    expect(topFoods('iron', person, { noOrgan: true }).some((p) => p.food.organ)).toBe(false);
  });

  it('builds an example that reaches the norm in at most four foods', () => {
    const day = exampleDay('magnesium', person);
    expect(day.items.length).toBeLessThanOrEqual(4);
    expect(day.share).toBeGreaterThan(0.9);
  });

  it('finds recipes that carry the nutrient', () => {
    const recipes = topRecipes('vitB12', person);
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0]!.share).toBeGreaterThan(0.15);
  });
});

describe('review fixes', () => {
  const focusOf = (text: string, person: Person = PERSON) => run([report(text)], person).focus.map((f) => f.id);

  it('never raises what is already too high, never cuts sugar for a low glucose', () => {
    expect(focusOf('25(OH)D 120 ng/ml 30 - 50')).toEqual([]);
    expect(focusOf('Glukoza 50 mg/dl 70 - 99')).toEqual([]);
    expect(focusOf('Żelazo 220 µg/dl 50 - 170')).toEqual([]);
    expect(focusOf('Glukoza 130 mg/dl 70 - 99')).toEqual(['glucose']);
  });

  it('reads a detection limit on its side of a red flag', () => {
    const a = run([report('Kwas foliowy <3,0 ng/ml 4 - 20')]);
    expect(a.findings[0]).toMatchObject({ marker: 'folate', severity: 'doctor' });
  });

  it('a newer creatinine gives a new eGFR instead of the old printed one', () => {
    const old = report('eGFR 85 ml/min/1,73m2', '2024-05-01', 1);
    const fresh = report('Kreatynina 1,8 mg/dl', '2026-10-01', 2);
    const latest = latestValues([old, fresh], { sex: 'M', age: 60 });
    expect(latest.get('egfr')).toMatchObject({ date: '2026-10-01', derived: true });
    expect(latest.get('egfr')!.value!).toBeLessThan(60);
  });

  it('a urine strip test printed as a bare number is present, not unknown', () => {
    const a = run([report('Badanie ogólne moczu\nGlukoza 250 mg/dl')]);
    expect(a.findings.find((f) => f.marker === 'uGlucose')).toMatchObject({ severity: 'doctor' });
  });

  it('small cells with normal haemoglobin give no iron focus (thalassaemia trait looks like this)', () => {
    expect(focusOf('Hemoglobina 14,5 g/dl 12 - 16\nMCV 68 fl 80 - 100')).toEqual([]);
  });
});
