import { strToU8, zipSync } from 'fflate';
import { describe, expect, test } from 'vitest';
import { plannedDay, plannedKcal, templateFor } from './plan';
import { importPlan } from './plan-import';
import { excelDate, readWorkbook } from './xlsx';

type Cells = Record<string, string | number>;

/**
 * A workbook written the way Excel writes one: strings in sharedStrings.xml
 * (one with an entity and one as rich text), numbers inline, a formula with a
 * cached value. Synthetic numbers - the user's own file stays out of the repo.
 */
function workbook(sheets: Record<string, Cells>): Uint8Array {
  const shared: string[] = [];
  const sid = (s: string) => {
    const i = shared.indexOf(s);
    return i >= 0 ? i : shared.push(s) - 1;
  };
  const files: Record<string, Uint8Array> = {};
  const names = Object.keys(sheets);
  Object.values(sheets).forEach((sheet, i) => {
    const cells = Object.entries(sheet)
      .map(([ref, v]) =>
        typeof v === 'number' ? `<c r="${ref}"><f>1+1</f><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${sid(v)}</v></c>`,
      )
      .join('');
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<worksheet><sheetData><row r="1">${cells}</row></sheetData></worksheet>`,
    );
  });
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  files['xl/sharedStrings.xml'] = strToU8(
    `<sst>${shared.map((s, i) => (i === 0 ? `<si><r><t>${escape(s.slice(0, 3))}</t></r><r><t xml:space="preserve">${escape(s.slice(3))}</t></r></si>` : `<si><t>${escape(s)}</t></si>`)).join('')}</sst>`,
  );
  files['xl/workbook.xml'] = strToU8(
    `<workbook><sheets>${names.map((n, i) => `<sheet name="${escape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  );
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    `<Relationships>${names.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  );
  return zipSync(files);
}

const PANEL: Cells = {
  B2: 'PLAN TESTOWY & SPÓJNY',
  B6: 'Data startu',
  D6: 46083,
  B7: 'Waga startowa (kg)',
  D7: 100,
  B8: 'Waga docelowa (kg)',
  D8: 90,
  B9: 'Wzrost (cm)',
  D9: 175,
  B10: 'Wiek (lata)',
  D10: 40,
  B11: 'Płeć (M / K)',
  D11: 'K',
  B12: 'Mnożnik aktywności bazowej',
  D12: 1.3,
  B13: 'Kroki bazowe zawarte w mnożniku',
  D13: 5000,
  B14: 'CEL: kroki dziennie',
  D14: 8000,
  B15: 'Dodatkowy wysiłek ponad 2 treningi (kcal/tydz.)',
  D15: 700,
  B16: 'kcal na 1000 kroków na 1 kg masy',
  D16: 0.5,
  B17: 'Energia zawarta w 1 kg masy ciała (kcal)',
  D17: 7700,
  B18: 'kcal planowane dziennie (średnia z wybranych wariantów)',
  D18: 1604.6,
  B49: '• 1 — plan podstawowy.',
  B50: '• 2 — z szejkiem.',
};

const DANIA: Cells = {
  B4: 'Danie',
  C4: 'kcal',
  B5: 'Bowl z kurczakiem w stylu Teriyaki',
  C5: 400,
  D5: 40,
  E5: 40,
  F5: 10,
  G5: 800,
  H5: 80,
  I5: 80,
  J5: 20,
  B6: 'Makaron w stylu azjatyckim',
  C6: 500,
  D6: 50,
  E6: 50,
  F6: 10,
  G6: 1000,
  H6: 100,
  I6: 100,
  J6: 20,
  B7: '2 łyżki oliwy (20 g) — do każdego przygotowania',
  C7: 180,
  D7: 0,
  E7: 0,
  F7: 20,
  B8: 'Shake: 1 miarka 28 g Whey',
  C8: 100,
  D8: 20,
  E8: 2,
  F8: 2,
  B13: 'PIZZE PROTEINOWE',
  B14: 'Pizza',
  C14: 'kcal',
  B15: 'Pizza Capricciosa (Lidl, Kaufland, Dino)',
  C15: 700,
  D15: 60,
  E15: 100,
  F15: 8,
  G15: 350,
  H15: 30,
  I15: 50,
  J15: 4,
  B16: 'Pizza Salami (tylko Żabka)',
  C16: 800,
  D16: 60,
  E16: 98,
  F16: 17,
  G16: 400,
  H16: 30,
  I16: 49,
  J16: 8.5,
};

const DODATKI: Cells = {
  B6: 'Produkt',
  C6: 'kcal',
  B7: 'Masło śmietankowe 60%',
  C7: 500,
  D7: 1,
  E7: 1,
  F7: 55,
  B8: 'Jogurt islandzki naturalny / skyr',
  C8: 60,
  D8: 12,
  E8: 4,
  F8: 0,
  B9: 'Maliny mrożone 100%',
  C9: 40,
  D9: 1,
  E9: 5,
  F9: 0,
  B10: 'Musztarda sarepska',
  C10: 150,
  D10: 6,
  E10: 10,
  F10: 9,
  B14: 'KALKULATOR',
  B16: 'Masło śmietankowe 60%',
  C16: 20,
};

const WARIANTY: Cells = {
  A1: 'Klucz',
  B1: 'Dzień',
  C1: 'Wariant',
  // 1A|1: Teriyaki whole + Makaron half, each with oil: 980 + 680
  A2: '1A|1',
  B2: '1A',
  C2: 1,
  D2: '1 opak. Teriyaki',
  E2: 980,
  F2: '½ opak. Makaron',
  G2: 680,
  N2: 1660,
  O2: 130,
  P2: 130,
  Q2: 70,
  // 1A|2: shake (skyr 400 g + maliny 200 g + 2 scoops) + Masło 10 g + pizza half
  A3: '1A|2',
  B3: '1A',
  C3: 2,
  D3: 'Szejk: skyr 400 g + maliny 200 g + 2 mk. whey',
  E3: 520,
  F3: 'Masło 10 g',
  G3: 50,
  H3: 'Pizza Capricciosa — ½',
  I3: 350,
  J3: 'Coś nieznanego',
  K3: 100,
  N3: 1020,
  A4: '2A|1',
  B4: '2A',
  C4: 1,
  D4: '1 opak. Makaron',
  E4: 1180,
  F4: 'Pizza Salami — cała',
  G4: 800,
  N4: 1980,
};

const PLAN: Cells = {
  A1: 'Dzień',
  B1: 'Data',
  D1: 'Dzień planu',
  E1: 'WARIANT',
  B2: 46083,
  D2: '1A',
  E2: 1,
  B3: 46084,
  D3: '2A',
  E3: 1,
  Y3: 9000,
  Z3: 99.4,
  B4: 46085,
  D4: '1A',
  E4: 2,
  V4: 300,
};

const BOOK = readWorkbook(workbook({ PANEL, WARIANTY, 'PLAN 91 DNI': PLAN, DANIA, DODATKI }));

describe('readWorkbook', () => {
  test('reads shared strings (rich text and entities included), numbers and cached formula results', () => {
    const panel = BOOK.get('PANEL')!;
    expect(panel.get('B2')).toBe('PLAN TESTOWY & SPÓJNY');
    expect(panel.get('D7')).toBe(100);
  });

  test('Excel serial dates', () => {
    expect(excelDate(46083)).toBe('2026-03-02');
  });

  test('a file that is not a workbook is refused in words', () => {
    expect(() => readWorkbook(zipSync({ 'a.txt': strToU8('x') }))).toThrow(/Excela/);
  });

  test('a file far bigger than any plan is refused before it is unpacked', () => {
    expect(() => readWorkbook(new Uint8Array(10_000_001))).toThrow(/za duży/);
  });

  test('an entity past the last code point stays as written instead of throwing', () => {
    const raw = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="S" r:id="r1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<Relationships><Relationship Id="r1" Target="worksheets/s.xml"/></Relationships>',
      ),
      'xl/worksheets/s.xml': strToU8(
        '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>x&#99999999;y&#x41;</t></is></c></row></sheetData></worksheet>',
      ),
    });
    expect(readWorkbook(raw).get('S')!.get('A1')).toBe('x&#99999999;yA');
  });
});

describe('importPlan', () => {
  const imported = importPlan(BOOK);

  test('the profile comes from PANEL, the daily goal rounded to 10 kcal', () => {
    expect(imported.profile).toEqual({
      startDate: '2026-03-02',
      startWeightKg: 100,
      targetWeightKg: 90,
      heightCm: 175,
      age: 40,
      sex: 'K',
      activityMultiplier: 1.3,
      baseSteps: 5000,
      targetSteps: 8000,
      extraWeeklyKcal: 700,
      kcalPer1000StepsPerKg: 0.5,
      kcalPerKg: 7700,
      dailyKcal: 1600,
    });
  });

  test('templates and variants from WARIANTY, the day order from PLAN', () => {
    expect(Object.keys(imported.plan.templates)).toEqual(['1A', '2A']);
    expect(imported.plan.templates['1A']?.map((v) => v.index)).toEqual([1, 2]);
    expect(imported.plan.days).toEqual(['1A', '2A', '1A']);
    expect(imported.plan.startDate).toBe('2026-03-02');
    expect(imported.plan.notes).toEqual(['1 — plan podstawowy.', '2 — z szejkiem.']);
  });

  test("a pack of a dish is the dish plus the plan's oil", () => {
    const [teriyaki, makaron] = imported.plan.templates['1A']?.[0]?.items ?? [];
    expect(teriyaki).toMatchObject({ text: '1 opak. Teriyaki', kcal: 980, protein: 80, carbs: 80, fat: 40 });
    expect(makaron).toMatchObject({ protein: 50, carbs: 50, fat: 30 });
  });

  test('a shake is added up from its parts; scoops come from the dishes table', () => {
    const shake = imported.plan.templates['1A']?.[1]?.items[0];
    // skyr 400 g: 48/16/0, maliny 200 g: 2/10/0, 2 scoops: 40/4/4
    expect(shake).toMatchObject({ protein: 90, carbs: 30, fat: 4 });
  });

  test('pizzas carry the shops that sell them', () => {
    expect(imported.plan.templates['1A']?.[1]?.items[2]).toMatchObject({
      protein: 30,
      stores: ['lidl', 'kaufland', 'dino'],
    });
    expect(imported.plan.templates['2A']?.[0]?.items[1]?.stores).toEqual(['zabka']);
  });

  test('an item it cannot read keeps its calories and is reported', () => {
    expect(imported.plan.templates['1A']?.[1]?.items[3]).toMatchObject({ kcal: 100, protein: null });
    expect(imported.warnings.join(' ')).toMatch(/Coś nieznanego/);
  });

  test('stated variant totals are checked against the derived ones', () => {
    expect(imported.warnings.some((w) => w.startsWith('1A|1'))).toBe(false);
  });

  test('days already logged in the workbook come along: variant, steps, weight, extra kcal', () => {
    expect(imported.days).toEqual([
      { date: '2026-03-03', steps: 9000, weightKg: 99.4 },
      { date: '2026-03-04', variant: 2, extraKcal: 300 },
    ]);
  });

  test('the foods are every distinct item, for swaps', () => {
    expect(imported.plan.foods.map((f) => f.text)).toContain('Pizza Salami — cała');
  });

  test('without WARIANTY it is not a plan', () => {
    expect(() => importPlan(readWorkbook(workbook({ PANEL })))).toThrow(/WARIANTY/);
  });
});

describe('plannedDay', () => {
  const { plan } = importPlan(BOOK);

  test("the template of a date cycles through the plan's days", () => {
    expect(templateFor(plan, '2026-03-01')).toBeNull();
    expect(templateFor(plan, '2026-03-02')).toBe('1A');
    expect(templateFor(plan, '2026-03-03')).toBe('2A');
    expect(templateFor(plan, '2026-03-05')).toBe('1A'); // day 4 = day 1 again
  });

  test('the chosen variant, a swap and a skip', () => {
    const swap = { text: 'Twaróg 250 g', kcal: 650, protein: 50, carbs: 10, fat: 1, stores: [] };
    const day = plannedDay(plan, '2026-03-02', { variant: 1, swaps: { 1: swap }, skipped: [0] })!;
    expect(day.items.map((i) => [i.text, i.skipped, i.replaced?.text ?? null])).toEqual([
      ['1 opak. Teriyaki', true, null],
      ['Twaróg 250 g', false, '½ opak. Makaron'],
    ]);
    expect(plannedKcal(day)).toBe(650);
  });
});
