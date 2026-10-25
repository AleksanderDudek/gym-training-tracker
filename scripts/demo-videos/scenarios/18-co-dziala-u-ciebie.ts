import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

export const scenario: Scenario = {
  slug: '18-co-dziala-u-ciebie',
  title: 'The scale is stuck? Look at the trend, week by week',
  titlePl: 'Waga stoi? Zobacz trend, tydzień po tygodniu',
  needPl: 'Trzymam dietę, a waga stoi — co właściwie działa u mnie?',
  needEn: 'I stick to the diet and the scale won’t move — what actually works for me?',
  persona: 'Consistent dieter, six weeks in, frustrated by a scale that jumps a kilo overnight; wants evidence, not guesses.',
  problem:
    'Single weigh-ins swing by a kilo from water and salt, so a week of honest work can look like nothing — and most apps either ignore it or “explain” it with a guess.',
  solution:
    'Postęp shows progress from the weight trend, not from one weigh-in: the pace over 4 weeks with its uncertainty and when the target weight comes. „Tydzień po tygodniu” lines up weight, food from complete days, steps and workouts per week, and names what goes with progress only when the difference is clearly bigger than the scale’s noise. The calorie target itself is checked on Mondays against the last 4 weeks.',
  keyMessagePl: 'Widzisz trend i swoje tygodnie — zamiast zgadywać z jednego ważenia.',
  keyMessageEn: 'You see the trend and your own weeks — instead of guessing from one weigh-in.',
  features: [
    'Dziennik: „Ile dziś ważysz?” → Postęp',
    'Postęp: trend weight, pace ± uncertainty, goal date',
    '„Tydzień po tygodniu”: weight, food from complete days, steps, workouts; findings only above the noise',
    'Profil diety → „Jak liczę cel”: the Monday check from the last 4 weeks',
  ],
  clock: '2026-10-15T20:30:00+02:00',
  seed: 'full',
  hookPl: 'Trzymam dietę, a waga stoi?',
  hookEn: 'On a diet, and the scale won’t move?',
  ctaPl: 'GYM TRACKER — trend zamiast zgadywania',
  ctaEn: 'GYM TRACKER — the trend, not a guess',
  music: 'Calm, reflective lo-fi around 84 BPM that lifts slightly at the weekly table.',
  async setup(page) {
    await open(page, '#/jedzenie');
    await page.getByRole('region', { name: 'Ile dziś ważysz?' }).waitFor();
    await page.waitForTimeout(2000);
  },
  async run(s) {
    const { page } = s;
    s.beat('scale');
    await s.pause(2600);
    await s.tap(page.getByRole('region', { name: 'Ile dziś ważysz?' }).getByRole('link', { name: 'Postęp' }), 'Postęp', {
      after: 1200,
    });

    s.beat('trend');
    await page.getByRole('heading', { name: 'Postęp', level: 1 }).waitFor();
    await s.pause(3800);

    s.beat('pace');
    await s.scroll(170, { ms: 900 });
    await s.pause(3000);

    s.beat('weeks');
    await s.scroll(330, { ms: 1300 });
    await s.pause(2800);

    s.beat('alldown');
    await s.scroll(60, { ms: 700 });
    await s.pause(3000);

    s.beat('honest');
    await s.pause(3400);

    s.beat('monday');
    await s.tap(page.getByRole('button', { name: 'Wstecz' }), 'Wstecz', { after: 900 });
    await s.tap(page.getByRole('navigation', { name: 'Dieta' }).getByRole('link', { name: 'Profil diety' }), 'Profil diety', {
      after: 1000,
    });
    await s.tap(page.getByText('Jak liczę cel', { exact: true }), 'Jak liczę cel', { after: 600 });
    await s.reveal(page.getByRole('listitem').filter({ hasText: /^W poniedziałki porównuję/ }), { block: 'center', ms: 900 });
    await s.pause(3600);
  },
  beats: {
    scale: {
      shows: 'Jedzenie → Dziennik at 20:30: the card „Ile dziś ważysz?” — „Ostatnio 85 kg, wczoraj.” Tap „Postęp” in the card.',
      captionPl: 'Jedno ważenie mówi niewiele',
      captionEn: 'One weigh-in says little',
      voPl: 'Waga skacze z dnia na dzień. Zamiast zgadywać — postęp.',
      voEn: 'The scale jumps day to day. Instead of guessing — progress.',
      edit: 'Hook caption here; zoom on „Ostatnio 85 kg, wczoraj”.',
    },
    trend: {
      shows: 'Postęp: tiles „86 kg Teraz (trend)”, „−2,1 kg od 1 wrz 2026”, „4 kg do celu · waga docelowa 82 kg”; the chart: weigh-in dots scattered around a smooth falling trend line, the forecast to 82 kg.',
      captionPl: 'Ważenia skaczą, trend spada',
      captionEn: 'Weigh-ins jump, the trend falls',
      voPl: 'Kropki skaczą, a trend idzie w dół: minus dwa kilo.',
      voEn: 'The dots jump, but the trend goes down: minus two kilos.',
      edit: 'Zoom on the chart: highlight the scattered dots vs the smooth trend line, then the „−2,1 kg” tile.',
    },
    pace: {
      shows: 'Under the chart: „Tempo z ostatnich 4 tygodni: −0,4 kg na tydzień (±0,15).” and „W tym tempie waga docelowa: ok. grudzień 2026 – styczeń 2027.”',
      captionPl: '−0,4 kg na tydzień (±0,15)',
      captionEn: '−0.4 kg a week (±0.15)',
      voPl: 'Tempo z czterech tygodni: minus czterdzieści deko tygodniowo.',
      voEn: 'The pace over four weeks: minus 0.4 kg a week.',
      edit: 'Highlight both bullet lines; the ±0,15 deserves a small pop.',
    },
    weeks: {
      shows: '„Tydzień po tygodniu”: the table — Waga, Jedzenie (average of complete days), Kroki (with 8000+ days), Treningi; 5–11.10: −0,8 kg, 2371 kcal, 9671 steps, 4 workouts.',
      captionPl: 'Tydzień po tygodniu',
      captionEn: 'Week by week',
      voPl: 'Moje tygodnie: waga, jedzenie, kroki, treningi.',
      voEn: 'My weeks: weight, food, steps, workouts.',
      edit: 'Slow push-in on the table header and the first full row.',
    },
    alldown: {
      shows: 'The table down to 31.08–6.09: every week with enough weigh-ins is down — −0,8, −0,3, −0,4, −0,2, −0,6, −0,3 kg.',
      captionPl: 'Każdy pełny tydzień na minusie',
      captionEn: 'Every full week is down',
      voPl: 'I widać fakt: każdy pełny tydzień jest na minusie.',
      voEn: 'And the fact is plain: every full week is down.',
      edit: 'Highlight the Waga column top to bottom.',
    },
    honest: {
      shows: 'The lead: „Wnioski pokażę, gdy różnica między tygodniami będzie wyraźnie większa niż szum wagi.” — no findings yet with these 7 weeks.',
      captionPl: 'Wnioski dopiero, gdy są pewne',
      captionEn: 'Findings only when they hold',
      voPl: 'Wnioski? Dopiero gdy są większe niż szum wagi.',
      voEn: 'Conclusions? Only once they beat the scale’s noise.',
      edit: 'Highlight the sentence „Wnioski pokażę, gdy różnica… szum wagi”.',
    },
    monday: {
      shows: 'Back to the diary → Dieta → Profil diety; open „Jak liczę cel”: „W poniedziałki porównuję zapisane jedzenie z trendem wagi z ostatnich 4 tygodni… zmieniam cel najwyżej o 100 kcal na tydzień.”',
      captionPl: 'Cel sprawdzany w poniedziałki',
      captionEn: 'The target is checked on Mondays',
      voPl: 'A cel kalorii sprawdzany jest w poniedziałki — z czterech tygodni, nie z jednego ważenia.',
      voEn: 'And the calorie target is checked on Mondays — from four weeks, not one weigh-in.',
      edit: 'Zoom on the Monday paragraph; closing card over the last 2 s.',
    },
  },
};
