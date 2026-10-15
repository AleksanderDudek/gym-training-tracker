import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

export const scenario: Scenario = {
  slug: '08-redukcja-kalorie-bialko',
  title: 'Cutting: calories and protein under control',
  titlePl: 'Redukcja: kalorie i białko pod kontrolą',
  needPl: 'Jestem na redukcji — muszę trafić w kalorie i białko',
  needEn: "I'm cutting — I need to hit my calories and protein",
  persona: 'Lifter on a cut, 3 kg down, who must keep protein high to keep the muscle.',
  problem:
    'Counting calories is tedious, and a plain counter does not say what to eat next to close the protein gap — nor whether the weight trend is on track.',
  solution:
    'The diary shows the day’s balance against a target that adapts to the week, says what is missing, suggests what to eat now from foods at hand, and the progress page forecasts the goal date from real weigh-ins.',
  keyMessagePl: 'Wiesz, co zjeść teraz — i kiedy dojdziesz do celu.',
  keyMessageEn: 'Know what to eat now — and when you’ll reach your goal.',
  features: ['Jedzenie → Dziennik: balance, weekly adjustment, macros', '„Co teraz?” suggestions', 'Postęp: weight chart with forecast'],
  clock: '2026-10-15T13:05:00+02:00',
  seed: 'full',
  hookPl: 'Brakuje 107 g białka. Co teraz?',
  hookEn: '107 g of protein to go. What now?',
  ctaPl: 'GYM TRACKER — dieta, która się dopasowuje',
  ctaEn: 'GYM TRACKER — a diet that adapts',
  music: 'Clean, positive electro-pop around 108 BPM.',
  async setup(page) {
    await open(page, '#/jedzenie');
    await page.getByRole('region', { name: 'Bilans dnia' }).waitFor();
    await page.waitForTimeout(2500);
  },
  async run(s) {
    const { page } = s;
    s.beat('balance');
    await s.pause(3200);

    s.beat('adapt');
    await s.pause(2600);

    s.beat('whatnow');
    await s.reveal(page.getByRole('heading', { name: 'Co teraz?' }), { block: 'start' });
    await s.pause(3400);

    s.beat('log');
    await s.tap(page.getByRole('region', { name: 'Co teraz?' }).getByRole('button', { name: /^Zjadłem/ }).first(), 'Zjadłem', {
      after: 1200,
    });
    await s.reveal(page.getByRole('region', { name: 'Bilans dnia' }), { block: 'start', ms: 900 });
    await s.pause(2600);

    s.beat('progress');
    await s.tap(page.getByRole('navigation', { name: 'Dieta' }).getByRole('link', { name: 'Postęp' }), 'Postęp', {
      after: 2600,
    });

    s.beat('forecast');
    await s.scroll(150, { ms: 700 });
    await s.pause(3600);

    s.beat('days');
    await s.scroll(380, { ms: 1100 });
    await s.pause(3000);

    s.beat('macros');
    await s.scroll(520, { ms: 1200 });
    await s.pause(3200);
  },
  beats: {
    balance: {
      shows: 'Jedzenie → Dziennik at 13:05: 651 / 2390 kcal, bars for protein (41 / 148 g), carbs and fat.',
      captionPl: 'Bilans dnia na jednym ekranie',
      captionEn: 'The day’s balance at a glance',
      voPl: 'Trzynasta. Białka brakuje jeszcze sto siedem gramów.',
      voEn: 'One p.m. Still 107 grams of protein to go.',
      edit: 'Hook caption here; zoom on „brakuje 107 g białka”.',
    },
    adapt: {
      shows: 'The line „Cel na dziś podniesiony o 90 kcal. W tym tygodniu 373 kcal mniej niż w planie…”.',
      captionPl: 'Cel dopasowuje się do tygodnia',
      captionEn: 'The target adapts to the week',
      voPl: 'Cel nagina się do całego tygodnia.',
      voEn: 'The target bends to the whole week.',
      edit: 'Zoom on the weekly-adjustment line.',
    },
    whatnow: {
      shows: '„Co teraz?”: ranked suggestions — „Obiad: kurczak, ryż i warzywa · uzupełnia białko: 52 g z brakujących 107 g”.',
      captionPl: 'Co teraz? Gotowa podpowiedź',
      captionEn: 'What now? A ready answer',
      voPl: 'Co teraz? Co uzupełni białko — z tego, co mam pod ręką.',
      voEn: 'What now? A suggestion that fills the protein gap — from what’s at hand.',
      edit: 'Highlight the „uzupełnia białko” reason.',
    },
    log: {
      shows: 'Tap „Zjadłem” on the top suggestion; back at the top the bars jump (≈1290 kcal, ≈93 g protein).',
      captionPl: 'Jedno stuknięcie — zapisane',
      captionEn: 'One tap — logged',
      voPl: 'Jedno stuknięcie i paski się przesuwają.',
      voEn: 'One tap, and the bars move.',
      edit: 'Before/after: freeze the old bar value for a split second.',
    },
    progress: {
      shows: 'Postęp: start 88.1 kg, now 85 kg, 3.1 kg down, 3 kg to the goal of 82 kg.',
      captionPl: '−3,1 kg od 1 września',
      captionEn: '−3.1 kg since September 1',
      voPl: 'A w postępie: minus trzy kilo od pierwszego września.',
      voEn: 'And on the progress page: three kilos down since September first.',
    },
    forecast: {
      shows: 'Weight chart: weigh-ins, the plan line, the forecast and the goal; the goal date „19 gru 2026”.',
      captionPl: 'Prognoza: cel w grudniu',
      captionEn: 'Forecast: goal in December',
      voPl: 'Prognoza z prawdziwych ważeń: cel w grudniu.',
      voEn: 'A forecast from real weigh-ins: the goal in December.',
      edit: 'Zoom on the chart; draw attention to the forecast line.',
    },
    days: {
      shows: 'Calories for the last 14 days against each day’s target; over-target days in orange.',
      captionPl: '14 dni na jednym wykresie',
      captionEn: '14 days on one chart',
      voPl: 'Czternaście dni — widać, który weekend poszedł w pizzę.',
      voEn: 'Fourteen days — you can see which weekend went to pizza.',
    },
    macros: {
      shows: 'Weekly macro averages against the „Sportowa” profile targets.',
      captionPl: 'Makro z tygodnia vs cel',
      captionEn: 'Weekly macros vs targets',
      voPl: 'I średnie makro z tygodnia wobec celu.',
      voEn: 'And the week’s average macros against the target.',
      edit: 'Closing card over the last 2 s.',
    },
  },
};
