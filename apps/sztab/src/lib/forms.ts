import { addDays, cleanAnswers, cleanCoaching, cleanForm, isoWeek, localDay, weekdayOf } from '@gymtracker/link';
import type { AnswerValue, FormBody, FormQuestion, FormRepeat, QuestionType } from '@gymtracker/link';
import { LOCALE, text } from '@gt/i18n';
import type { SentAssignment } from './data';

/**
 * Formularze w Sztabie: gotowe szablony, czyste pomocniki kreatora (numery pytań, przestawianie,
 * sprawdzenie słowami) i zakładki „Odpowiedzi” (okresy, stan w strefie telefonu, serie do wykresu).
 *
 * **Dni liczymy jak telefon.** Okres odpowiedzi to `once`, dzień albo tydzień ISO z `formPeriod`
 * (`@gymtracker/link`), a „dziś” — w strefie telefonu z paczki (`s.tz`), bo to telefon decyduje,
 * który okres zamyka odpowiedź. Rachunek na samych datach idzie w UTC, tak jak w protokole.
 */

export const MAX_QUESTIONS = 40;
export const MAX_OPTIONS = 12;
export const MIN_OPTIONS = 2;

/* ── Numery pytań ──────────────────────────────────────────────────────────────────── */

const QID = /^[a-z0-9]{1,8}$/;
const QNUM = /^q(\d{1,7})$/;

/**
 * Następny wolny numer pytania `qN`. Rośnie od największego użytego — numer usuniętego pytania nie
 * wraca do innej treści w tym samym formularzu. Zawsze pasuje do `^[a-z0-9]{1,8}$`.
 */
export function nextQuestionId(questions: readonly Pick<FormQuestion, 'id'>[]): string {
  const used = new Set(questions.map((q) => q.id));
  const top = Math.max(0, ...questions.map((q) => Number(q.id.match(QNUM)?.[1] ?? 0)));
  const next = `q${top + 1}`;
  if (QID.test(next) && !used.has(next)) return next;
  for (let n = 1; ; n++) if (!used.has(`q${n}`)) return `q${n}`;
}

/** Nowe pytanie danego rodzaju z rozsądnymi ustawieniami (skala 0–10, wybór z dwoma polami). */
export function newQuestion(type: QuestionType, questions: readonly Pick<FormQuestion, 'id'>[]): FormQuestion {
  return retype({ id: nextQuestionId(questions), type: 'text', label: '', help: '', required: false, unit: '', min: null, max: null, options: [] }, type);
}

/** Zmiana rodzaju pytania: treść, podpowiedź i „wymagane” zostają, reszta dopasowuje się do rodzaju. */
export function retype(q: FormQuestion, type: QuestionType): FormQuestion {
  const base = { ...q, type };
  const numeric = q.type === 'scale' || q.type === 'number';
  switch (type) {
    case 'scale': {
      const min = numeric ? (q.min ?? 0) : 0;
      const max = numeric ? (q.max ?? 10) : 10;
      const ok = Number.isInteger(min) && Number.isInteger(max) && max > min && max - min <= 20;
      return { ...base, unit: '', options: [], min: ok ? min : 0, max: ok ? max : 10 };
    }
    case 'number':
      return { ...base, options: [], min: numeric ? q.min : null, max: numeric ? q.max : null };
    case 'choice':
    case 'multi': {
      const options = q.options.length >= MIN_OPTIONS ? q.options : [...q.options, '', ''].slice(0, MIN_OPTIONS);
      return { ...base, unit: '', min: null, max: null, options };
    }
    default:
      return { ...base, unit: '', min: null, max: null, options: [] };
  }
}

/** Pytanie przesunięte o `d` (−1 wyżej, +1 niżej); poza listą — bez zmian. */
export function moveQuestion<T>(list: readonly T[], i: number, d: number): T[] {
  const j = i + d;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/** Kopia pytania tuż pod nim, z nowym numerem. */
export function duplicateQuestion(questions: readonly FormQuestion[], i: number): FormQuestion[] {
  const q = questions[i];
  if (!q || questions.length >= MAX_QUESTIONS) return [...questions];
  const copy: FormQuestion = { ...q, id: nextQuestionId(questions), options: [...q.options] };
  return [...questions.slice(0, i + 1), copy, ...questions.slice(i + 1)];
}

/* ── Sprawdzenie słowami ───────────────────────────────────────────────────────────── */

const V = text({
  pl: {
    title: 'Wpisz tytuł formularza.',
    none: 'Dodaj co najmniej jedno pytanie.',
    tooMany: (n: number) => `Najwyżej ${MAX_QUESTIONS} pytań — usuń ${n}.`,
    label: (n: number) => `Pytanie ${n}: wpisz treść pytania.`,
    options: (n: number) => `Pytanie ${n}: potrzebne co najmniej ${MIN_OPTIONS} odpowiedzi do wyboru.`,
    emptyOption: (n: number) => `Pytanie ${n}: puste pole odpowiedzi — uzupełnij je albo usuń.`,
    tooManyOptions: (n: number) => `Pytanie ${n}: najwyżej ${MAX_OPTIONS} odpowiedzi do wyboru.`,
    scale: (n: number) => `Pytanie ${n}: skala musi kończyć się wyżej, niż się zaczyna, i mieć najwyżej 20 kroków.`,
    range: (n: number) => `Pytanie ${n}: najmniejsza wartość jest większa od największej.`,
    other: 'Formularz nie przechodzi sprawdzenia w aplikacji podopiecznego.',
  },
  en: {
    title: 'Enter the form title.',
    none: 'Add at least one question.',
    tooMany: (n: number) => `At most ${MAX_QUESTIONS} questions — remove ${n}.`,
    label: (n: number) => `Question ${n}: enter the question text.`,
    options: (n: number) => `Question ${n}: needs at least ${MIN_OPTIONS} answers to choose from.`,
    emptyOption: (n: number) => `Question ${n}: an answer field is empty — fill it in or remove it.`,
    tooManyOptions: (n: number) => `Question ${n}: at most ${MAX_OPTIONS} answers to choose from.`,
    scale: (n: number) => `Question ${n}: the scale must end higher than it starts and have at most 20 steps.`,
    range: (n: number) => `Question ${n}: the lowest value is higher than the highest.`,
    other: 'The form would not pass the check in the client’s app.',
  },
});

/**
 * Co trzeba poprawić, zanim formularz da się zapisać i wysłać — słowami, pytanie po pytaniu.
 * Pusta lista znaczy, że `cleanForm` (to samo sprawdzenie co na telefonie) go przepuści.
 */
export function formIssues(form: FormBody): string[] {
  const out: string[] = [];
  if (!form.title.trim()) out.push(V.title);
  if (!form.questions.length) out.push(V.none);
  if (form.questions.length > MAX_QUESTIONS) out.push(V.tooMany(form.questions.length - MAX_QUESTIONS));
  form.questions.forEach((q, i) => {
    const n = i + 1;
    if (!q.label.trim()) out.push(V.label(n));
    if (q.type === 'choice' || q.type === 'multi') {
      const filled = q.options.filter((o) => o.trim());
      if (filled.length < MIN_OPTIONS) out.push(V.options(n));
      else if (filled.length !== q.options.length) out.push(V.emptyOption(n));
      if (q.options.length > MAX_OPTIONS) out.push(V.tooManyOptions(n));
    }
    if (q.type === 'scale') {
      const min = q.min ?? 0;
      const max = q.max ?? 10;
      if (!(max > min) || max - min > 20) out.push(V.scale(n));
    }
    if (q.type === 'number' && q.min !== null && q.max !== null && q.max < q.min) out.push(V.range(n));
  });
  if (!out.length && !cleanForm(form as unknown as Record<string, unknown>)) out.push(V.other);
  return out;
}

/* ── Gotowe formularze ─────────────────────────────────────────────────────────────── */

export type TemplateKey = 'intake' | 'diet' | 'checkin' | 'pain' | 'after';

export interface FormTemplate {
  key: TemplateKey;
  name: string;
  /** Jednym zdaniem: dla kogo i kiedy. */
  desc: string;
  body: FormBody;
}

type Spec = [QuestionType, string, Partial<Pick<FormQuestion, 'help' | 'required' | 'unit' | 'min' | 'max' | 'options'>>?];

function tpl(
  key: TemplateKey,
  name: string,
  desc: string,
  form: { title: string; intro: string; repeat: FormRepeat; weekday?: number; intake?: boolean },
  specs: Spec[],
): FormTemplate {
  const questions: FormQuestion[] = specs.map(([type, label, extra], i) => {
    const base = retype({ id: `q${i + 1}`, type: 'text', label, help: '', required: false, unit: '', min: null, max: null, options: [] }, type);
    return { ...base, ...extra };
  });
  return {
    key,
    name,
    desc,
    body: {
      kind: 'form',
      title: form.title,
      intro: form.intro,
      questions,
      repeat: form.repeat,
      weekday: form.repeat === 'weekly' ? (form.weekday ?? 1) : null,
      intake: form.repeat === 'once' && !!form.intake,
    },
  };
}

const req = { required: true };

export const FORM_TEMPLATES: readonly FormTemplate[] = text({
  pl: [
    tpl(
      'intake',
      'Wywiad startowy',
      'Trening: cel, doświadczenie, kontuzje, czas i sprzęt. Na pierwszy tydzień współpracy.',
      {
        title: 'Wywiad na start',
        intro: 'Kilka pytań, zanim ułożę plan. Odpowiedz szczerze — nie ma złych odpowiedzi. Zajmie to około 5 minut.',
        repeat: 'once',
        intake: true,
      },
      [
        ['choice', 'Jaki jest twój główny cel?', { ...req, options: ['Schudnąć', 'Zbudować mięśnie', 'Więcej siły', 'Lepsza kondycja', 'Zdrowie i samopoczucie', 'Inny'] }],
        ['text', 'Opisz swój cel własnymi słowami', { help: 'Co chcesz osiągnąć i do kiedy? Po czym poznasz, że się udało?' }],
        ['choice', 'Jak długo trenujesz?', { ...req, options: ['Dopiero zaczynam', 'Do roku', '1–3 lata', 'Ponad 3 lata', 'Wracam po przerwie'] }],
        ['number', 'Ile dni w tygodniu możesz trenować?', { ...req, unit: 'dni', min: 1, max: 7 }],
        ['choice', 'Ile czasu masz na jeden trening?', { options: ['Do 30 minut', '30–45 minut', '45–60 minut', 'Ponad godzinę'] }],
        ['multi', 'Gdzie i z czym możesz trenować?', { help: 'Zaznacz wszystko, co pasuje.', options: ['Siłownia', 'Hantle', 'Kettlebell', 'Drążek', 'Gumy oporowe', 'Bez sprzętu, w domu', 'Na zewnątrz'] }],
        ['text', 'Kontuzje, urazy albo dolegliwości, które mogą przeszkadzać w treningu', { ...req, help: 'Także dawne: kolano, kręgosłup, bark… Jeśli nic — wpisz „brak”.' }],
        ['yesno', 'Czy masz od lekarza zalecenie, żeby ograniczać wysiłek?'],
        ['number', 'Ile godzin zwykle śpisz?', { unit: 'h', min: 0, max: 14 }],
        ['scale', 'Jak duży jest teraz twój stres?', { help: '0 — spokój, 10 — bardzo duży stres', min: 0, max: 10 }],
        ['text', 'Co do tej pory przeszkadzało ci w regularnym treningu?'],
        ['text', 'Jaki ruch lubisz, a jakiego nie znosisz?'],
      ],
    ),
    tpl(
      'diet',
      'Wywiad dietetyczny',
      'Żywienie: posiłki, alergie i nietolerancje, preferencje, nawodnienie, gotowanie.',
      {
        title: 'Wywiad dietetyczny',
        intro: 'Te odpowiedzi pomogą ułożyć jadłospis, który da się utrzymać na co dzień. Opisz, jak jesz teraz — nie jak „powinno się” jeść.',
        repeat: 'once',
        intake: true,
      },
      [
        ['choice', 'Jaki jest twój cel?', { ...req, options: ['Redukcja masy ciała', 'Utrzymanie masy ciała', 'Budowa masy mięśniowej', 'Lepsze nawyki i samopoczucie', 'Inny'] }],
        ['choice', 'Ile posiłków jesz zwykle w ciągu dnia?', { ...req, options: ['1–2', '3', '4', '5 lub więcej'] }],
        ['text', 'Alergie i nietolerancje pokarmowe', { ...req, help: 'Jeśli nie masz — wpisz „brak”.' }],
        ['multi', 'Czego nie jesz?', { help: 'Z wyboru, przekonań albo z innego powodu.', options: ['Mięsa', 'Ryb', 'Nabiału', 'Jaj', 'Glutenu', 'Jem wszystko'] }],
        ['text', 'Czego nie lubisz jeść?'],
        ['text', 'Ulubione produkty i dania'],
        ['number', 'Ile wody i innych napojów pijesz dziennie?', { unit: 'l', min: 0, max: 8, help: 'Mniej więcej, bez kawy i alkoholu.' }],
        ['choice', 'Jak często jesz poza domem?', { options: ['Rzadko', '1–2 razy w tygodniu', '3–5 razy w tygodniu', 'Codziennie'] }],
        ['yesno', 'Czy podjadasz między posiłkami?'],
        ['choice', 'Ile czasu dziennie możesz poświęcić na gotowanie?', { options: ['Do 15 minut', '15–30 minut', '30–60 minut', 'Ponad godzinę'] }],
        ['text', 'O której zwykle jesz pierwszy i ostatni posiłek?'],
        ['choice', 'Jak często pijesz alkohol?', { options: ['Wcale', 'Raz w tygodniu albo rzadziej', '2–3 razy w tygodniu', 'Częściej'] }],
        ['text', 'Coś jeszcze, o czym warto wiedzieć?'],
      ],
    ),
    tpl(
      'checkin',
      'Cotygodniowy check-in',
      'Co tydzień: waga, energia, sen, stres, głód, treningi i to, co było trudne.',
      {
        title: 'Check-in tygodniowy',
        intro: 'Krótkie podsumowanie tygodnia — 2 minuty. Na tej podstawie poprawiamy plan.',
        repeat: 'weekly',
        weekday: 1,
      },
      [
        ['number', 'Waga', { unit: 'kg', min: 30, max: 300, help: 'Rano, na czczo, po toalecie. Jeśli się nie ważysz — zostaw puste.' }],
        ['scale', 'Energia w tym tygodniu', { ...req, help: '0 — zero sił, 10 — pełno energii', min: 0, max: 10 }],
        ['number', 'Sen — średnio godzin na dobę', { ...req, unit: 'h', min: 0, max: 14 }],
        ['scale', 'Stres', { ...req, help: '0 — spokój, 10 — bardzo duży stres', min: 0, max: 10 }],
        ['scale', 'Głód', { help: '0 — wcale, 10 — przez większość dnia', min: 0, max: 10 }],
        ['yesno', 'Czy treningi szły zgodnie z planem?', req],
        ['text', 'Co było trudne w tym tygodniu?'],
        ['text', 'Co poszło dobrze?'],
      ],
    ),
    tpl(
      'pain',
      'Skala bólu',
      'Codziennie: jak mocno boli, gdzie i czy po ćwiczeniach jest gorzej.',
      {
        title: 'Skala bólu',
        intro: 'Codziennie, najlepiej o tej samej porze. Jeśli ból jest silny, nagły albo narasta — przerwij ćwiczenia i napisz do prowadzącego.',
        repeat: 'daily',
      },
      [
        ['scale', 'Jak mocny był dziś ból?', { ...req, help: '0 — bez bólu, 10 — najsilniejszy, jaki sobie wyobrażasz', min: 0, max: 10 }],
        ['text', 'Gdzie czujesz ból?', { help: 'Np. prawe kolano, dół pleców.' }],
        ['yesno', 'Czy po ćwiczeniach było gorzej?', req],
        ['yesno', 'Czy ból przeszkadzał w codziennych czynnościach?'],
        ['text', 'Uwagi'],
      ],
    ),
    tpl(
      'after',
      'Samopoczucie po treningu',
      'Po każdym treningu: jak ciężko było, jak się czujesz, czy coś bolało.',
      {
        title: 'Po treningu',
        intro: 'Wypełnij w dni treningowe, zaraz po treningu — wystarczy minuta.',
        repeat: 'daily',
      },
      [
        ['scale', 'Jak ciężki był trening?', { ...req, help: '0 — jak spacer, 10 — maksymalny wysiłek', min: 0, max: 10 }],
        ['scale', 'Jak się czujesz po treningu?', { ...req, help: '0 — fatalnie, 10 — świetnie', min: 0, max: 10 }],
        ['yesno', 'Czy coś bolało w trakcie albo po?'],
        ['text', 'Jeśli tak — co i przy którym ćwiczeniu?'],
        ['text', 'Komentarz do treningu'],
      ],
    ),
  ],
  en: [
    tpl(
      'intake',
      'Starting interview',
      'Training: goal, experience, injuries, time and equipment. For the first week of coaching.',
      {
        title: 'Starting interview',
        intro: 'A few questions before I build your plan. Answer honestly — there are no wrong answers. It takes about 5 minutes.',
        repeat: 'once',
        intake: true,
      },
      [
        ['choice', 'What is your main goal?', { ...req, options: ['Lose weight', 'Build muscle', 'Get stronger', 'Better fitness', 'Health and well-being', 'Other'] }],
        ['text', 'Describe your goal in your own words', { help: 'What do you want to achieve, and by when? How will you know it worked?' }],
        ['choice', 'How long have you been training?', { ...req, options: ['Just starting', 'Under a year', '1–3 years', 'Over 3 years', 'Coming back after a break'] }],
        ['number', 'How many days a week can you train?', { ...req, unit: 'days', min: 1, max: 7 }],
        ['choice', 'How much time do you have per workout?', { options: ['Up to 30 minutes', '30–45 minutes', '45–60 minutes', 'Over an hour'] }],
        ['multi', 'Where and with what can you train?', { help: 'Tick everything that fits.', options: ['Gym', 'Dumbbells', 'Kettlebell', 'Pull-up bar', 'Resistance bands', 'No equipment, at home', 'Outdoors'] }],
        ['text', 'Injuries or aches that may get in the way of training', { ...req, help: 'Old ones too: knee, back, shoulder… If none — write “none”.' }],
        ['yesno', 'Has a doctor advised you to limit physical effort?'],
        ['number', 'How many hours do you usually sleep?', { unit: 'h', min: 0, max: 14 }],
        ['scale', 'How high is your stress right now?', { help: '0 — calm, 10 — very high stress', min: 0, max: 10 }],
        ['text', 'What has kept you from training regularly so far?'],
        ['text', 'What kind of exercise do you enjoy, and what do you hate?'],
      ],
    ),
    tpl(
      'diet',
      'Nutrition interview',
      'Nutrition: meals, allergies and intolerances, preferences, hydration, cooking.',
      {
        title: 'Nutrition interview',
        intro: 'Your answers help build a meal plan you can keep up day to day. Describe how you eat now — not how you “should”.',
        repeat: 'once',
        intake: true,
      },
      [
        ['choice', 'What is your goal?', { ...req, options: ['Lose weight', 'Maintain weight', 'Build muscle', 'Better habits and well-being', 'Other'] }],
        ['choice', 'How many meals do you usually eat a day?', { ...req, options: ['1–2', '3', '4', '5 or more'] }],
        ['text', 'Food allergies and intolerances', { ...req, help: 'If you have none — write “none”.' }],
        ['multi', 'What do you not eat?', { help: 'By choice, belief or any other reason.', options: ['Meat', 'Fish', 'Dairy', 'Eggs', 'Gluten', 'I eat everything'] }],
        ['text', 'What foods do you dislike?'],
        ['text', 'Favourite foods and dishes'],
        ['number', 'How much water and other drinks do you have a day?', { unit: 'l', min: 0, max: 8, help: 'Roughly, not counting coffee and alcohol.' }],
        ['choice', 'How often do you eat out?', { options: ['Rarely', '1–2 times a week', '3–5 times a week', 'Every day'] }],
        ['yesno', 'Do you snack between meals?'],
        ['choice', 'How much time a day can you spend cooking?', { options: ['Up to 15 minutes', '15–30 minutes', '30–60 minutes', 'Over an hour'] }],
        ['text', 'When do you usually eat your first and last meal?'],
        ['choice', 'How often do you drink alcohol?', { options: ['Never', 'Once a week or less', '2–3 times a week', 'More often'] }],
        ['text', 'Anything else worth knowing?'],
      ],
    ),
    tpl(
      'checkin',
      'Weekly check-in',
      'Every week: weight, energy, sleep, stress, hunger, workouts and what was hard.',
      {
        title: 'Weekly check-in',
        intro: 'A short summary of your week — 2 minutes. We adjust the plan based on it.',
        repeat: 'weekly',
        weekday: 1,
      },
      [
        ['number', 'Weight', { unit: 'kg', min: 30, max: 300, help: 'In the morning, before eating, after the toilet. If you don’t weigh yourself — leave it empty.' }],
        ['scale', 'Energy this week', { ...req, help: '0 — no energy at all, 10 — full of energy', min: 0, max: 10 }],
        ['number', 'Sleep — average hours a night', { ...req, unit: 'h', min: 0, max: 14 }],
        ['scale', 'Stress', { ...req, help: '0 — calm, 10 — very high stress', min: 0, max: 10 }],
        ['scale', 'Hunger', { help: '0 — not at all, 10 — most of the day', min: 0, max: 10 }],
        ['yesno', 'Did your workouts go to plan?', req],
        ['text', 'What was hard this week?'],
        ['text', 'What went well?'],
      ],
    ),
    tpl(
      'pain',
      'Pain scale',
      'Daily: how much it hurts, where, and whether it is worse after exercise.',
      {
        title: 'Pain scale',
        intro: 'Every day, ideally at the same time. If the pain is severe, sudden or getting worse — stop the exercises and message your coach.',
        repeat: 'daily',
      },
      [
        ['scale', 'How strong was the pain today?', { ...req, help: '0 — no pain, 10 — the worst pain you can imagine', min: 0, max: 10 }],
        ['text', 'Where do you feel the pain?', { help: 'E.g. right knee, lower back.' }],
        ['yesno', 'Was it worse after the exercises?', req],
        ['yesno', 'Did the pain get in the way of everyday activities?'],
        ['text', 'Notes'],
      ],
    ),
    tpl(
      'after',
      'How you feel after training',
      'After each workout: how hard it was, how you feel, whether anything hurt.',
      {
        title: 'After training',
        intro: 'Fill it in on training days, right after the workout — a minute is enough.',
        repeat: 'daily',
      },
      [
        ['scale', 'How hard was the workout?', { ...req, help: '0 — like a walk, 10 — maximum effort', min: 0, max: 10 }],
        ['scale', 'How do you feel after the workout?', { ...req, help: '0 — awful, 10 — great', min: 0, max: 10 }],
        ['yesno', 'Did anything hurt during or after?'],
        ['text', 'If so — what, and during which exercise?'],
        ['text', 'Comment on the workout'],
      ],
    ),
  ],
});

/** Świeża kopia szablonu — edycja w kreatorze nie zmienia wzoru. */
export const fromTemplate = (t: FormTemplate): FormBody => ({ ...t.body, questions: t.body.questions.map((q) => ({ ...q, options: [...q.options] })) });

/* ── Odpowiedzi: okresy i stan ─────────────────────────────────────────────────────── */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_RE = /^(\d{4})-W(\d{2})$/;

/** Dzień `YYYY-MM-DD` w danej strefie (strefa telefonu z paczki). Strefa spoza listy — strefa przeglądarki. */
export function dayIn(tz: string, at: number): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const day = `${get('year')}-${get('month')}-${get('day')}`;
    return DAY_RE.test(day) ? day : localDay(at);
  } catch {
    return localDay(at);
  }
}

/** Poniedziałek tygodnia, w którym leży dzień. */
export const mondayOf = (day: string): string => addDays(day, 1 - weekdayOf(day));

/** Poniedziałek tygodnia ISO `YYYY-Www` (4 stycznia zawsze leży w pierwszym tygodniu). */
export function weekStart(period: string): string | null {
  const m = period.match(WEEK_RE);
  if (!m) return null;
  return addDays(mondayOf(`${m[1]}-01-04`), (Number(m[2]) - 1) * 7);
}

/** Pierwszy dzień okresu (do osi wykresu); `once` — `null`. */
export const periodDay = (period: string): string | null => (DAY_RE.test(period) ? period : weekStart(period));

const utc = (day: string) => new Date(`${day}T00:00:00Z`);

/** „17–23 lis” dla tygodnia, „25 lis” dla dnia, pusty napis dla `once`. */
export function periodLabel(period: string, locale: string = LOCALE): string {
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (DAY_RE.test(period)) return fmt.format(utc(period));
  const from = weekStart(period);
  return from ? fmt.formatRange(utc(from), utc(addDays(from, 6))) : '';
}

/** Dzień z dniem tygodnia: „pon., 30 lis”. */
export const dayLabel = (day: string, locale: string = LOCALE): string =>
  new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(utc(day));

export type FormStatusKind = 'answered' | 'waiting' | 'overdue' | 'upcoming';

export interface FormStatus {
  kind: FormStatusKind;
  /** Cotygodniowy: dzień, od którego czeka odpowiedź (ten tydzień, a po odpowiedzi — następny). */
  due: string | null;
}

/**
 * Stan formularza „na dziś” po stronie prowadzącego, liczony jak `formDue` na telefonie.
 *
 * - jednorazowy: jest odpowiedź albo czeka;
 * - codzienny: jest odpowiedź za dziś; bez niej — zaległy, gdy wczoraj (po wysłaniu) też jej nie było;
 * - cotygodniowy: jest odpowiedź za ten tydzień ISO; bez niej — przed dniem tygodnia „następny od”,
 *   w ten dzień czeka, po nim zaległy (chyba że formularz przyszedł już po tym dniu).
 */
export function formStatus(form: Pick<FormBody, 'repeat' | 'weekday'>, answered: ReadonlySet<string>, today: string, sentDay: string): FormStatus {
  if (form.repeat === 'once') return { kind: answered.has('once') ? 'answered' : 'waiting', due: null };
  if (form.repeat === 'daily') {
    if (answered.has(today)) return { kind: 'answered', due: null };
    const yesterday = addDays(today, -1);
    return { kind: yesterday >= sentDay && !answered.has(yesterday) ? 'overdue' : 'waiting', due: null };
  }
  const due = addDays(mondayOf(today), (form.weekday ?? 1) - 1);
  if (answered.has(isoWeek(today))) return { kind: 'answered', due: addDays(due, 7) };
  if (today < due) return { kind: 'upcoming', due };
  if (today === due || due < sentDay) return { kind: 'waiting', due };
  return { kind: 'overdue', due };
}

/** Okno paczki (`SNAPSHOT_DAYS`) — starszych odpowiedzi telefon już nie wysyła. */
const WINDOW_DAYS = 180;

/**
 * Okresy, za które odpowiedź już się należała: od wysłania (najdalej pół roku wstecz) do dziś.
 * Bieżący okres liczy się dopiero, gdy jest odpowiedź albo termin minął — „5 z 7 tygodni”.
 */
export function expectedPeriods(form: Pick<FormBody, 'repeat' | 'weekday'>, answered: ReadonlySet<string>, today: string, sentDay: string): string[] {
  if (form.repeat === 'once') return ['once'];
  const oldest = addDays(today, -WINDOW_DAYS + 1);
  // Zegar telefonu i przeglądarki prowadzącego mogą się rozjechać: odpowiedź sprzed „wysłania” też się liczy.
  const first = [...answered].map(periodDay).filter((d): d is string => !!d).sort()[0];
  const from = first && first < sentDay ? first : sentDay;
  const start = from > oldest ? from : oldest;
  const out: string[] = [];
  if (form.repeat === 'daily') {
    for (let d = start; d < today; d = addDays(d, 1)) out.push(d);
    if (answered.has(today)) out.push(today);
    return out;
  }
  const wd = (form.weekday ?? 1) - 1;
  for (let d = mondayOf(start); d < mondayOf(today); d = addDays(d, 7)) {
    // Tydzień wysłania liczy się, gdy formularz przyszedł najpóźniej w swój dzień tygodnia (albo i tak jest odpowiedź).
    if (d === mondayOf(start) && addDays(d, wd) < start && !answered.has(isoWeek(d))) continue;
    out.push(isoWeek(d));
  }
  const now = formStatus(form, answered, today, sentDay).kind;
  if (now === 'answered' || now === 'overdue') out.push(isoWeek(today));
  return out;
}

/** Formularz wysłany temu podopiecznemu (bez wycofanych i nieczytelnych), sprawdzony jak na telefonie. */
export interface SentForm {
  id: string;
  form: FormBody;
  sentAt: number;
}

export function sentForms(sent: readonly SentAssignment[]): SentForm[] {
  return sent
    .flatMap((a) => {
      if (a.withdrawnAt || !a.envelope || a.envelope.body.kind !== 'form') return [];
      // Ta sama treść, którą widzi telefon: puste odpowiedzi do wyboru wypadają tam przed numeracją.
      const form = cleanForm(a.envelope.body as unknown as Record<string, unknown>);
      return form ? [{ id: a.id, form, sentAt: a.envelope.sentAt }] : [];
    })
    .sort((x, y) => Number(y.form.intake) - Number(x.form.intake) || y.sentAt - x.sentAt);
}

export interface AnswerRow {
  period: string;
  at: number;
  values: Record<string, AnswerValue>;
}

const periodFits = (repeat: FormRepeat, period: string): boolean =>
  repeat === 'once' ? period === 'once' : repeat === 'daily' ? DAY_RE.test(period) : WEEK_RE.test(period);

/**
 * Odpowiedzi na jeden formularz z części `coaching` paczki: tylko jego, wartości sprawdzone pytaniami
 * (`cleanAnswers`, częściowo — brak wymaganej nie wyrzuca reszty), jedna na okres (najnowsza),
 * najnowszy okres pierwszy.
 */
export function answerRows(form: FormBody, assignmentId: string, coaching: unknown): AnswerRow[] {
  const by = new Map<string, AnswerRow>();
  for (const a of cleanCoaching(coaching).answers) {
    if (a.assignmentId !== assignmentId || !periodFits(form.repeat, a.period)) continue;
    const values = cleanAnswers(form, a.values, { partial: true });
    if (!values) continue;
    const prev = by.get(a.period);
    if (!prev || prev.at < a.at) by.set(a.period, { period: a.period, at: a.at, values });
  }
  return [...by.values()].sort((x, y) => (x.period < y.period ? 1 : x.period > y.period ? -1 : 0));
}

const A = text({ pl: { yes: 'Tak', no: 'Nie' }, en: { yes: 'Yes', no: 'No' } });

/** Odpowiedź słowami: wybór — treść odpowiedzi, kilka — po przecinku, tak/nie, liczba z jednostką. */
export function answerText(q: FormQuestion, v: AnswerValue | undefined): string {
  if (v === null || v === undefined) return '';
  switch (q.type) {
    case 'choice':
      return typeof v === 'number' ? (q.options[v] ?? '') : '';
    case 'multi':
      return Array.isArray(v) ? v.map((i) => q.options[i]).filter(Boolean).join(', ') : '';
    case 'yesno':
      return typeof v === 'boolean' ? (v ? A.yes : A.no) : '';
    case 'number':
      return typeof v === 'number' ? `${v.toLocaleString(LOCALE, { maximumFractionDigits: 2 })}${q.unit ? ` ${q.unit}` : ''}` : '';
    case 'scale':
      return typeof v === 'number' ? String(v) : '';
    case 'text':
      return typeof v === 'string' ? v : '';
  }
}

export interface SeriesPoint {
  period: string;
  /** Pierwszy dzień okresu — oś czasu wykresu. */
  day: string;
  value: number;
}

/** Wartości pytania liczbowego albo skali przez okresy, od najstarszego. */
export function chartSeries(q: FormQuestion, rows: readonly AnswerRow[]): SeriesPoint[] {
  if (q.type !== 'number' && q.type !== 'scale') return [];
  return rows
    .flatMap((r) => {
      const v = r.values[q.id];
      const day = periodDay(r.period);
      return typeof v === 'number' && day ? [{ period: r.period, day, value: v }] : [];
    })
    .sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
}
