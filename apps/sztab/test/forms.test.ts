import { describe, expect, it, vi } from 'vitest';
import { cleanForm, isoWeek, localDay } from '@gymtracker/link';
import type { AssignmentV1, FormBody, FormQuestion } from '@gymtracker/link';
import type { SentAssignment } from '../src/lib/data';

vi.hoisted(() => {
  (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
});

const forms = await import('../src/lib/forms');
const {
  FORM_TEMPLATES,
  answerRows,
  answerText,
  chartSeries,
  dayIn,
  duplicateQuestion,
  expectedPeriods,
  formIssues,
  formStatus,
  fromTemplate,
  moveQuestion,
  newQuestion,
  nextQuestionId,
  periodLabel,
  retype,
  sentForms,
  weekStart,
} = forms;

const q = (id: string, type: FormQuestion['type'], extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id,
  type,
  label: `Pytanie ${id}`,
  help: '',
  required: false,
  unit: '',
  min: type === 'scale' ? 0 : null,
  max: type === 'scale' ? 10 : null,
  options: [],
  ...extra,
});

const form = (questions: FormQuestion[], patch: Partial<FormBody> = {}): FormBody => ({
  kind: 'form',
  title: 'Check-in',
  intro: '',
  questions,
  repeat: 'weekly',
  weekday: 1,
  intake: false,
  ...patch,
});

describe('gotowe formularze', () => {
  it('każdy przechodzi cleanForm bez żadnej zmiany i ma numery q1…qN', () => {
    expect(FORM_TEMPLATES.map((t) => t.key)).toEqual(['intake', 'diet', 'checkin', 'pain', 'after']);
    for (const t of FORM_TEMPLATES) {
      expect(cleanForm(t.body as unknown as Record<string, unknown>), t.name).toEqual(t.body);
      expect(t.body.questions.map((x) => x.id)).toEqual(t.body.questions.map((_, i) => `q${i + 1}`));
      expect(formIssues(t.body), t.name).toEqual([]);
    }
  });

  it('wywiady są na start, check-in co tydzień, skala bólu codziennie', () => {
    const by = Object.fromEntries(FORM_TEMPLATES.map((t) => [t.key, t.body]));
    expect(by.intake).toMatchObject({ repeat: 'once', intake: true });
    expect(by.diet).toMatchObject({ repeat: 'once', intake: true });
    expect(by.checkin).toMatchObject({ repeat: 'weekly', weekday: 1, intake: false });
    expect(by.pain).toMatchObject({ repeat: 'daily', weekday: null });
    expect(by.pain!.questions[0]).toMatchObject({ type: 'scale', min: 0, max: 10, required: true });
    const checkin = by.checkin!.questions.map((x) => x.type);
    expect(checkin).toEqual(['number', 'scale', 'number', 'scale', 'scale', 'yesno', 'text', 'text']);
  });

  it('bez słów o diagnozie i leczeniu', () => {
    const words = JSON.stringify(FORM_TEMPLATES).toLowerCase();
    for (const w of ['diagno', 'leczen', 'leczy', 'terapi', 'dawkow', 'lekarstw']) expect(words).not.toContain(w);
  });

  it('angielska wersja ma te same rodzaje i też przechodzi cleanForm', async () => {
    vi.resetModules();
    (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'en';
    try {
      const en = await import('../src/lib/forms');
      expect(en.FORM_TEMPLATES.map((t) => t.body.questions.map((x) => x.type))).toEqual(FORM_TEMPLATES.map((t) => t.body.questions.map((x) => x.type)));
      expect(en.FORM_TEMPLATES[0]!.name).toBe('Starting interview');
      for (const t of en.FORM_TEMPLATES) expect(cleanForm(t.body as unknown as Record<string, unknown>)).toEqual(t.body);
    } finally {
      (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
      vi.resetModules();
    }
  });

  it('kopia wzoru jest osobna', () => {
    const t = FORM_TEMPLATES[0]!;
    const copy = fromTemplate(t);
    copy.questions[0]!.options[0] = 'zmienione';
    copy.questions.pop();
    expect(t.body.questions[0]!.options[0]).not.toBe('zmienione');
    expect(t.body.questions).toHaveLength(12);
  });
});

describe('pytania w kreatorze', () => {
  it('numer następnego pytania: rośnie od największego, nie wraca po usuniętym, zawsze pasuje do protokołu', () => {
    expect(nextQuestionId([])).toBe('q1');
    expect(nextQuestionId([{ id: 'q1' }, { id: 'q2' }])).toBe('q3');
    expect(nextQuestionId([{ id: 'q1' }, { id: 'q3' }])).toBe('q4');
    expect(nextQuestionId([{ id: 'waga' }, { id: 'q2' }])).toBe('q3');
    // Na samej granicy długości (8 znaków) szuka pierwszej wolnej.
    expect(nextQuestionId([{ id: 'q9999999' }, { id: 'q1' }])).toBe('q2');
    const ids: { id: string }[] = [];
    for (let i = 0; i < 40; i++) ids.push({ id: nextQuestionId(ids) });
    expect(new Set(ids.map((x) => x.id)).size).toBe(40);
    for (const { id } of ids) expect(id).toMatch(/^[a-z0-9]{1,8}$/);
  });

  it('nowe pytanie dostaje rozsądne ustawienia rodzaju', () => {
    expect(newQuestion('scale', [])).toMatchObject({ id: 'q1', type: 'scale', min: 0, max: 10, options: [] });
    expect(newQuestion('choice', [{ id: 'q1' }])).toMatchObject({ id: 'q2', type: 'choice', options: ['', ''], min: null });
    expect(newQuestion('number', [])).toMatchObject({ type: 'number', min: null, max: null, unit: '' });
  });

  it('zmiana rodzaju zostawia treść i „wymagane”, czyści resztę', () => {
    const a = q('q1', 'number', { label: 'Sen', required: true, unit: 'h', min: 0, max: 14 });
    expect(retype(a, 'scale')).toMatchObject({ label: 'Sen', required: true, unit: '', min: 0, max: 14 });
    expect(retype(a, 'yesno')).toMatchObject({ label: 'Sen', required: true, min: null, max: null, unit: '' });
    expect(retype(q('q2', 'number', { min: 0.5, max: 100 }), 'scale')).toMatchObject({ min: 0, max: 10 });
    expect(retype(q('q3', 'multi', { options: ['a', 'b', 'c'] }), 'choice').options).toEqual(['a', 'b', 'c']);
  });

  it('przestawianie i kopia', () => {
    const list = [q('q1', 'text'), q('q2', 'scale'), q('q3', 'yesno')];
    expect(moveQuestion(list, 0, 1).map((x) => x.id)).toEqual(['q2', 'q1', 'q3']);
    expect(moveQuestion(list, 0, -1).map((x) => x.id)).toEqual(['q1', 'q2', 'q3']);
    expect(moveQuestion(list, 2, 1).map((x) => x.id)).toEqual(['q1', 'q2', 'q3']);
    const dup = duplicateQuestion(list, 1);
    expect(dup.map((x) => x.id)).toEqual(['q1', 'q2', 'q4', 'q3']);
    expect(dup[2]).toMatchObject({ type: 'scale', label: 'Pytanie q2' });
    const full = Array.from({ length: 40 }, (_, i) => q(`q${i + 1}`, 'text'));
    expect(duplicateQuestion(full, 0)).toHaveLength(40);
  });

  it('sprawdzenie słowami mówi, czego brakuje', () => {
    expect(formIssues(form([], { title: ' ' }))).toEqual(['Wpisz tytuł formularza.', 'Dodaj co najmniej jedno pytanie.']);
    expect(formIssues(form([q('q1', 'text', { label: '' })]))).toEqual(['Pytanie 1: wpisz treść pytania.']);
    expect(formIssues(form([q('q1', 'text'), q('q2', 'choice', { options: ['Tak', ''] })]))).toEqual([
      'Pytanie 2: potrzebne co najmniej 2 odpowiedzi do wyboru.',
    ]);
    expect(formIssues(form([q('q1', 'multi', { options: ['A', '', 'B'] })]))).toEqual(['Pytanie 1: puste pole odpowiedzi — uzupełnij je albo usuń.']);
    expect(formIssues(form([q('q1', 'scale', { min: 5, max: 5 })]))[0]).toMatch(/^Pytanie 1: skala/);
    expect(formIssues(form([q('q1', 'scale', { min: 0, max: 30 })]))[0]).toMatch(/^Pytanie 1: skala/);
    expect(formIssues(form([q('q1', 'number', { min: 10, max: 1 })]))).toEqual(['Pytanie 1: najmniejsza wartość jest większa od największej.']);
    expect(formIssues(form(Array.from({ length: 41 }, (_, i) => q(`q${i + 1}`, 'text'))))).toContain('Najwyżej 40 pytań — usuń 1.');
    expect(formIssues(form([q('q1', 'scale')]))).toEqual([]);
  });
});

describe('okresy i stan po stronie prowadzącego', () => {
  it('dzień w strefie telefonu', () => {
    const at = Date.parse('2026-11-25T23:30:00Z');
    expect(dayIn('Europe/Warsaw', at)).toBe('2026-11-26');
    expect(dayIn('America/New_York', at)).toBe('2026-11-25');
    expect(dayIn('Nie/Ma', at)).toBe(localDay(at));
  });

  it('poniedziałek tygodnia ISO zgadza się z isoWeek, także na przełomie roku', () => {
    expect(weekStart('2026-W48')).toBe('2026-11-23');
    expect(weekStart('2026-W01')).toBe('2025-12-29');
    expect(weekStart('2027-W01')).toBe('2027-01-04');
    expect(weekStart('2026-W53')).toBe('2026-12-28');
    expect(weekStart('once')).toBeNull();
    for (let d = Date.parse('2025-12-01T00:00:00Z'); d < Date.parse('2027-02-01T00:00:00Z'); d += 7 * 86_400_000) {
      const w = isoWeek(new Date(d).toISOString().slice(0, 10));
      expect(isoWeek(weekStart(w)!)).toBe(w);
    }
  });

  it('podpis okresu: tydzień jako zakres dni, dzień jako data', () => {
    expect(periodLabel('2026-W48', 'pl-PL')).toBe('23–29 lis');
    // Odstępy wokół półpauzy zależą od wersji ICU.
    expect(periodLabel('2026-W49', 'pl-PL')).toMatch(/^30 lis\s?–\s?6 gru$/);
    expect(periodLabel('2026-11-25', 'pl-PL')).toBe('25 lis');
    expect(periodLabel('2026-W48', 'en-GB')).toMatch(/^23\s?–\s?29 Nov$/);
    expect(periodLabel('once', 'pl-PL')).toBe('');
  });

  it('cotygodniowy: przed dniem — następny, w dzień — czeka, po nim — zaległy; po odpowiedzi — termin za tydzień', () => {
    const f = { repeat: 'weekly' as const, weekday: 3 };
    const none = new Set<string>();
    const sent = '2026-11-02';
    expect(formStatus(f, none, '2026-11-23', sent)).toEqual({ kind: 'upcoming', due: '2026-11-25' });
    expect(formStatus(f, none, '2026-11-25', sent)).toEqual({ kind: 'waiting', due: '2026-11-25' });
    expect(formStatus(f, none, '2026-11-26', sent)).toEqual({ kind: 'overdue', due: '2026-11-25' });
    expect(formStatus(f, new Set(['2026-W48']), '2026-11-26', sent)).toEqual({ kind: 'answered', due: '2026-12-02' });
    // Formularz przyszedł już po dniu tygodnia — w tym tygodniu jeszcze nie „zaległy”.
    expect(formStatus(f, none, '2026-11-27', '2026-11-26')).toEqual({ kind: 'waiting', due: '2026-11-25' });
  });

  it('zaległość liczy się w strefie podopiecznego, nie przeglądarki', () => {
    const f = { repeat: 'weekly' as const, weekday: 3 };
    const at = Date.parse('2026-11-25T16:00:00Z'); // środa 17:00 w Warszawie, czwartek 1:00 w Tokio
    expect(formStatus(f, new Set(), dayIn('Europe/Warsaw', at), '2026-11-02').kind).toBe('waiting');
    expect(formStatus(f, new Set(), dayIn('Asia/Tokyo', at), '2026-11-02').kind).toBe('overdue');
  });

  it('codzienny: zaległy, gdy wczoraj (po wysłaniu) nie było odpowiedzi', () => {
    const f = { repeat: 'daily' as const, weekday: null };
    expect(formStatus(f, new Set(['2026-11-25']), '2026-11-25', '2026-11-01').kind).toBe('answered');
    expect(formStatus(f, new Set(['2026-11-24']), '2026-11-25', '2026-11-01').kind).toBe('waiting');
    expect(formStatus(f, new Set(), '2026-11-25', '2026-11-01').kind).toBe('overdue');
    expect(formStatus(f, new Set(), '2026-11-25', '2026-11-25').kind).toBe('waiting');
  });

  it('jednorazowy: jest odpowiedź albo czeka', () => {
    expect(formStatus({ repeat: 'once', weekday: null }, new Set(['once']), '2026-11-25', '2026-11-01').kind).toBe('answered');
    expect(formStatus({ repeat: 'once', weekday: null }, new Set(), '2026-11-25', '2026-11-01').kind).toBe('waiting');
  });

  it('należne okresy: „5 z 7”', () => {
    const weekly = { repeat: 'weekly' as const, weekday: 1 };
    // Wysłany w poniedziałek 2.11, dziś środa 25.11 bez odpowiedzi (zaległy): tygodnie 45–48.
    expect(expectedPeriods(weekly, new Set(), '2026-11-25', '2026-11-02')).toEqual(['2026-W45', '2026-W46', '2026-W47', '2026-W48']);
    // Wysłany we wtorek po dniu tygodnia — pierwszy tydzień się nie liczy.
    expect(expectedPeriods(weekly, new Set(), '2026-11-25', '2026-11-03')).toEqual(['2026-W46', '2026-W47', '2026-W48']);
    // Przed terminem tego tygodnia bieżący jeszcze się nie należy.
    expect(expectedPeriods({ repeat: 'weekly', weekday: 5 }, new Set(), '2026-11-25', '2026-11-02')).toEqual(['2026-W45', '2026-W46', '2026-W47']);
    const daily = { repeat: 'daily' as const, weekday: null };
    expect(expectedPeriods(daily, new Set(), '2026-11-25', '2026-11-22')).toEqual(['2026-11-22', '2026-11-23', '2026-11-24']);
    expect(expectedPeriods(daily, new Set(['2026-11-25']), '2026-11-25', '2026-11-24')).toEqual(['2026-11-24', '2026-11-25']);
    expect(expectedPeriods(daily, new Set(), '2026-11-25', '2025-01-01')).toHaveLength(179);
    // Zegary się rozjechały: odpowiedź sprzed „wysłania” też się liczy, razem z dniami po niej.
    expect(expectedPeriods(daily, new Set(['2026-11-21', '2026-11-25']), '2026-11-25', '2026-11-24')).toEqual([
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
    ]);
    expect(expectedPeriods(weekly, new Set(['2026-W47', '2026-W48']), '2026-11-25', '2026-11-25')).toEqual(['2026-W47', '2026-W48']);
  });
});

describe('odpowiedzi z paczki', () => {
  const f = form([
    q('q1', 'number', { unit: 'kg', min: 30, max: 300 }),
    q('q2', 'scale', { required: true }),
    q('q3', 'choice', { options: ['Mało', 'Dużo'] }),
    q('q4', 'multi', { options: ['Siłownia', 'Dom', 'Basen'] }),
    q('q5', 'yesno'),
    q('q6', 'text'),
  ]);

  const env = (id: string, body: unknown, sentAt = Date.parse('2026-11-02T10:00:00Z')): AssignmentV1 =>
    ({ v: 1, id, area: 'training', sentAt, from: { name: 'Ola', profession: 'trainer' }, body }) as AssignmentV1;
  const row = (id: string, body: unknown, patch: Partial<SentAssignment> = {}): SentAssignment => ({
    id,
    kind: 'form',
    area: 'training',
    createdAt: '2026-11-02T10:00:00Z',
    withdrawnAt: null,
    visibleFrom: null,
    envelope: env(id, body),
    receipt: null,
    ...patch,
  });

  it('wysłane formularze: bez wycofanych, innych rodzajów i nieczytelnych; puste odpowiedzi do wyboru wypadają jak na telefonie; wywiad pierwszy', () => {
    const intake = { ...f, title: 'Wywiad', repeat: 'once', weekday: null, intake: true };
    const list = sentForms([
      row('a1', f),
      row('a2', { kind: 'note', title: 'x', text: 'y', checklist: [] }, { kind: 'note' }),
      row('a3', f, { withdrawnAt: '2026-11-03T10:00:00Z' }),
      row('a4', f, { envelope: null }),
      { ...row('a5', intake), envelope: env('a5', intake, Date.parse('2026-11-01T10:00:00Z')) },
      row('a6', { ...f, questions: [q('q1', 'choice', { options: ['A', '', 'B'] })] }),
    ]);
    expect(list.map((x) => x.id)).toEqual(['a5', 'a1', 'a6']);
    expect(list[2]!.form.questions[0]!.options).toEqual(['A', 'B']);
  });

  it('jedna odpowiedź na okres (najnowsza), najnowszy okres pierwszy, wartości sprawdzone pytaniami', () => {
    const coaching = {
      answers: [
        { assignmentId: 'a1', period: '2026-W46', at: 1, values: { q1: 82.4, q2: 6, q3: 1, q4: [2, 0], q5: true, q6: 'Dobrze' } },
        { assignmentId: 'a1', period: '2026-W47', at: 2, values: { q1: 82, q2: 7 } },
        { assignmentId: 'a1', period: '2026-W47', at: 3, values: { q1: 81.6, q2: 8, q3: 9, q4: [7], q5: 'tak' } },
        { assignmentId: 'a1', period: '2026-11-25', at: 4, values: { q2: 1 } },
        { assignmentId: 'inne', period: '2026-W48', at: 5, values: { q2: 3 } },
        { assignmentId: 'a1', period: '2026-W48', at: 6, values: { q1: 500, q2: 11 } },
      ],
      habits: [],
      meals: [],
    };
    const rows = answerRows(f, 'a1', coaching);
    expect(rows.map((r) => r.period)).toEqual(['2026-W48', '2026-W47', '2026-W46']);
    expect(rows[1]!.values).toEqual({ q1: 81.6, q2: 8, q3: null, q4: null, q5: null, q6: null });
    expect(rows[0]!.values).toMatchObject({ q1: null, q2: null });
    expect(rows[2]!.values).toMatchObject({ q4: [0, 2] });
    expect(answerRows(f, 'a1', 'zepsute')).toEqual([]);
  });

  it('odpowiedź słowami', () => {
    const [num, scale, choice, multi, yesno, txt] = f.questions as [FormQuestion, FormQuestion, FormQuestion, FormQuestion, FormQuestion, FormQuestion];
    expect(answerText(num, 82.5)).toBe('82,5 kg');
    expect(answerText(scale, 7)).toBe('7');
    expect(answerText(choice, 1)).toBe('Dużo');
    expect(answerText(multi, [0, 2])).toBe('Siłownia, Basen');
    expect(answerText(yesno, true)).toBe('Tak');
    expect(answerText(yesno, false)).toBe('Nie');
    expect(answerText(txt, 'Kolano lepiej')).toBe('Kolano lepiej');
    expect(answerText(txt, null)).toBe('');
    expect(answerText(choice, undefined)).toBe('');
  });

  it('seria do wykresu: od najstarszego, tylko liczby, tydzień na osi od poniedziałku', () => {
    const rows = [
      { period: '2026-W48', at: 3, values: { q1: 81, q2: null } },
      { period: '2026-W46', at: 1, values: { q1: 83, q2: 5 } },
      { period: '2026-W47', at: 2, values: { q1: null, q2: 6 } },
    ];
    expect(chartSeries(f.questions[0]!, rows)).toEqual([
      { period: '2026-W46', day: '2026-11-09', value: 83 },
      { period: '2026-W48', day: '2026-11-23', value: 81 },
    ]);
    expect(chartSeries(f.questions[1]!, rows).map((p) => p.value)).toEqual([5, 6]);
    expect(chartSeries(f.questions[5]!, rows)).toEqual([]);
  });
});
