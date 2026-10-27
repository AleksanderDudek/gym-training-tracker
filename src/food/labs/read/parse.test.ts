import { describe, expect, it } from 'vitest';
import { collectionDate, labOf, readText, type ReadRow } from './parse';

const byId = (rows: ReadRow[]) => Object.fromEntries(rows.filter((r) => !r.duplicate).map((r) => [r.marker.id, r]));

// A Diagnostyka-like printout as pdf.js gives it: one row per line, columns joined by spaces.
const DIAGNOSTYKA = `
Diagnostyka Sp. z o.o.  ul. Prof. M. Życzkowskiego 16, 31-864 Kraków
Pacjent: JAN KOWALSKI   PESEL: 80010112345
Data i godzina pobrania materiału: 02.10.2026 07:45
Data rejestracji: 02.10.2026 07:50
Morfologia krwi z rozmazem automatycznym
WBC - leukocyty 6,42 tys/µl 4,00 - 10,00
RBC - erytrocyty 4,21 mln/µl 4,50 - 5,90 L
HGB - hemoglobina 12,1 g/dl 13,5 - 17,5 L
HCT - hematokryt 37,0 % 40,0 - 52,0 L
MCV 79,2 fl 80,0 - 100,0 L
MCH 26,1 pg 27,0 - 34,0 L
MCHC 32,9 g/dl 32,0 - 36,0
RDW-CV 15,8 % 11,5 - 14,5 H
RDW-SD 44,1 fl 37,0 - 54,0
PLT - płytki krwi 312 tys/µl 150 - 400
Neutrofile 3,51 tys/µl 1,80 - 7,70
Limfocyty 2,10 tys/µl 1,00 - 4,50
Ferrytyna 9,8 ng/ml 30,0 - 400,0 L
Żelazo 41 µg/dl 65 - 175 L
Witamina D3 metabolit 25(OH) 18,4 ng/ml 30,0 - 50,0 L
Witamina B12 356 pg/ml 197 - 771
Lipidogram (CHOL, HDL, nie-HDL, LDL, TG)
Cholesterol całkowity 232 mg/dl < 190 H
Cholesterol HDL 41 mg/dl > 40
Cholesterol nie-HDL 191 mg/dl < 145 H
Cholesterol LDL wyliczany 158 mg/dl < 115 H
Triglicerydy 165 mg/dl < 150 H
Glukoza 104 mg/dl 70 - 99 H
Hemoglobina glikowana (HbA1c) 5,8 % 4,0 - 5,6 H
TSH 1,84 µIU/ml 0,27 - 4,20
`;

describe('readText — a Diagnostyka-like printout', () => {
  const result = readText(DIAGNOSTYKA);
  const rows = byId(result.rows);

  it('reads the date of collection, not of registration, and the lab', () => {
    expect(result.date).toBe('2026-10-02');
    expect(result.lab).toBe('Diagnostyka');
  });

  it('reads the blood count with the abbreviation first ("HGB - hemoglobina")', () => {
    expect(rows.hgb).toMatchObject({ value: 12.1, unit: 'g/dl', ref: [13.5, 17.5], flag: 'L' });
    expect(rows.wbc?.value).toBe(6.42);
    expect(rows.rbc?.value).toBe(4.21);
    expect(rows.mcv?.value).toBe(79.2);
    expect(rows.plt?.value).toBe(312);
  });

  it('does not take RDW-SD for RDW, and drops the differential', () => {
    expect(rows.rdw?.value).toBe(15.8);
    expect(result.rows.filter((r) => r.marker.id === 'rdw')).toHaveLength(1);
    expect(result.unknown.join(' ')).not.toMatch(/Neutrofile|Limfocyty/);
  });

  it('skips the digits in a name: 25(OH), B12, HbA1c', () => {
    expect(rows.vitD).toMatchObject({ value: 18.4, ref: [30, 50] });
    expect(rows.b12).toMatchObject({ value: 356, ref: [197, 771] });
    expect(rows.hba1c).toMatchObject({ value: 5.8, ref: [4, 5.6] });
  });

  it('tells the cholesterols apart and reads one-sided ranges', () => {
    expect(rows.chol).toMatchObject({ value: 232, ref: [null, 190] });
    expect(rows.hdl).toMatchObject({ value: 41, ref: [40, null] });
    expect(rows.nonHdl?.value).toBe(191);
    expect(rows.ldl?.value).toBe(158);
    expect(rows.tg?.value).toBe(165);
  });

  it('does not report the header rows or the address as unknown results', () => {
    expect(result.unknown).toEqual([]);
  });
});

describe('readText — SI units and other spellings', () => {
  it('converts mmol/l, nmol/l, pmol/l and µmol/l to the canonical units', () => {
    const rows = byId(
      readText(`
Glukoza na czczo 5,9 mmol/l 3,9 - 5,5
Cholesterol LDL 4,1 mmol/l < 3,0
25(OH)D 50 nmol/l 75 - 125
Witamina B12 150 pmol/l
Kreatynina 97 µmol/l 62 - 106
Kwas moczowy 420 umol/l
HbA1c 42 mmol/mol
`).rows,
    );
    expect(rows.glucose!.value).toBeCloseTo(106.3, 1);
    expect(rows.glucose!.ref![1]).toBeCloseTo(99.1, 1);
    expect(rows.ldl!.value).toBeCloseTo(158.5, 1);
    expect(rows.vitD!.value).toBeCloseTo(20.0, 1);
    expect(rows.b12!.value).toBeCloseTo(203.25, 1);
    expect(rows.creatinine!.value).toBeCloseTo(1.097, 2);
    expect(rows.uricAcid!.value).toBeCloseTo(7.06, 2);
    expect(rows.hba1c!.value).toBeCloseTo(5.99, 2);
  });

  it('reads a unit glued to the number, a dot decimal, "do" ranges and a value on the next line', () => {
    const rows = byId(
      readText(`
Ferrytyna 45.2ng/ml 13.0 do 150.0
Magnez
1,95 mg/dl 1,70 - 2,55
ALT (GPT) 52 U/l < 41
`).rows,
    );
    expect(rows.ferritin).toMatchObject({ value: 45.2, ref: [13, 150] });
    expect(rows.magnesium).toMatchObject({ value: 1.95, ref: [1.7, 2.55] });
    expect(rows.alt).toMatchObject({ value: 52, ref: [null, 41] });
  });

  it('keeps an unknown unit visible instead of converting it', () => {
    const [row] = readText('Ferrytyna 45 jednostek').rows;
    expect(row).toMatchObject({ value: 45, unitGuessed: true });
  });

  it('keeps a detection limit as a comparison', () => {
    const [row] = readText('CRP <0,5 mg/l < 5,0').rows;
    expect(row).toMatchObject({ value: 0.5, cmp: '<', ref: [null, 5] });
  });

  it('needs a word boundary: "HbA1c" is not haemoglobin, "Kreatynina" is not potassium', () => {
    const rows = readText('HbA1c 5,4 %\nKreatynina 0,9 mg/dl\nK 4,4 mmol/l').rows;
    expect(rows.map((r) => r.marker.id)).toEqual(['hba1c', 'creatinine', 'potassium']);
  });
});

describe('readText — urinalysis', () => {
  const URINE = `
Badanie ogólne moczu z osadem
Barwa słomkowa
Przejrzystość przejrzysty
Ciężar właściwy 1,028 1,015 - 1,025 H
pH 5,5 4,5 - 8,0
Białko nieobecne
Glukoza nieobecna
Ciała ketonowe ślad
Bilirubina nieobecna
Urobilinogen w normie
Leukocyty 0-2 wpw
Erytrocyty świeże 0-1 wpw
Bakterie nieliczne
Glukoza
Glukoza 92 mg/dl 70 - 99
`;
  const result = readText(URINE);

  it('reads the strip results as urine markers, not blood ones', () => {
    const rows = byId(result.rows);
    expect(rows.uSg).toMatchObject({ value: 1.028, ref: [1.015, 1.025] });
    expect(rows.uPh?.value).toBe(5.5);
    expect(rows.uProtein).toMatchObject({ qual: 'neg', value: null });
    expect(rows.uGlucose).toMatchObject({ qual: 'neg' });
    expect(rows.uKetones).toMatchObject({ qual: 'trace' });
    expect(rows.uLeuko).toMatchObject({ printed: '0-2', value: 2 });
    expect(rows.uBlood).toMatchObject({ value: 1 });
    expect(rows.bilirubin).toBeUndefined();
    expect(rows.wbc).toBeUndefined();
  });

  it('goes back to blood when a strip test comes again', () => {
    expect(byId(result.rows).glucose?.value).toBe(92);
  });

  it('drops the sediment rows that matter for neither diet nor flags', () => {
    expect(result.unknown).toEqual([]);
  });
});

describe('dates and labs', () => {
  it('reads both date orders and rejects impossible dates', () => {
    expect(collectionDate('Data pobrania: 2026-09-30 08:00')).toBe('2026-09-30');
    expect(collectionDate('Data pobrania materiału 5.3.2026')).toBe('2026-03-05');
    expect(collectionDate('Data pobrania: 31.02.2026')).toBeNull();
    expect(collectionDate('Data wydania wyniku: 01.10.2026')).toBe('2026-10-01');
    expect(collectionDate('nic')).toBeNull();
  });

  it('names the lab from the header', () => {
    expect(labOf('ALAB laboratoria Sp. z o.o.')).toBe('ALAB');
    expect(labOf('Szpital Powiatowy')).toBeNull();
  });
});

it('lists rows with a number it does not know, for the review screen', () => {
  const result = readText('Testosteron 5,2 ng/ml 2,5 - 8,4\nFerrytyna 50 ng/ml');
  expect(result.unknown).toEqual(['Testosteron 5,2 ng/ml 2,5 - 8,4']);
  expect(result.rows.map((r) => r.marker.id)).toEqual(['ferritin']);
});

it('reads Diagnostyka’s header: "Data/godz. pobrania", sex and year of birth, and skips 1,25(OH)2D', () => {
  const result = readText(`SPRAWOZDANIE Z BADANIA
Data rej.: 2026-10-01
Data/godz. pobrania: 2026-10-02 08:32
Płeć: Żeńska
Data ur.: 1990-05-02
Witamina D3 metabolit 1,25(OH)2 45 pg/ml 25-86
Wapń zjonizowany 1,2 mmol/l 1,15-1,35
Bilirubina bezpośrednia 0,2 mg/dl
Glukoza po 120 min 150 mg/dl
Morfologia 9,9 tys/ul 3,8-10,0
WBC 9,9 tys/ul 3,8-10,0`);
  expect(result).toMatchObject({ date: '2026-10-02', sex: 'K', birthYear: 1990 });
  expect(result.rows.map((r) => r.marker.id)).toEqual(['wbc']);
});

it('reads a two-letter name only with its unit', () => {
  expect(readText('K 4,4').rows).toEqual([]);
  expect(readText('K 4,4 mmol/l').rows[0]?.marker.id).toBe('potassium');
});

describe('OCR text', () => {
  // As Tesseract read a 1600 px printout: commas lost, letters for digits, names misspelt.
  const OCR = `RBC - erytrocyty 401 mln/ul 4,20-5,40 L
Ferytyna 7,9 ng/ml 13,0-150,0 L
Witamina D3 metabolit 25(OH) 186 ng/ml 30,0-50,0 L
Cholesterol HDL s8 mg/dl >45
Tńglicerydy 96 mg/dl <150`;

  it('repairs digits, tolerates a typo in a name and flags a lost comma with a suggestion', () => {
    const rows = byId(readText(OCR, { ocr: true }).rows);
    expect(rows.rbc).toMatchObject({ value: 401, suspect: { suggest: 4.01 } });
    expect(rows.vitD).toMatchObject({ value: 186, suspect: { suggest: 18.6 } });
    expect(rows.ferritin).toMatchObject({ value: 7.9, suspect: null });
    expect(rows.hdl).toMatchObject({ value: 58, suspect: null });
    expect(rows.tg?.value).toBe(96);
  });

  it('keeps names exact outside OCR', () => {
    const rows = byId(readText(OCR).rows);
    expect(rows.ferritin).toBeUndefined();
    expect(rows.hdl?.value).toBe(45);
  });
});

it('takes a strip word next to the number, never one from the reference column', () => {
  const at = (text: string) => readText(`Badanie ogólne moczu\n${text}`).rows[0]!;
  expect(at('Glukoza 250 mg/dl Norma: ujemny')).toMatchObject({ value: 250, qual: null });
  expect(at('Glukoza 250 mg/dl 0 - 15 brak')).toMatchObject({ qual: null });
  expect(at('Białko 15 mg/dl ślad')).toMatchObject({ value: 15, qual: 'trace' });
});
