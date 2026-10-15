import { open, tab } from '../lib/app';
import type { Scenario } from '../lib/types';

export const scenario: Scenario = {
  slug: '02-start-od-zera-w-domu',
  title: 'Starting from zero, at home, no equipment',
  titlePl: 'Start od zera — w domu, bez sprzętu',
  needPl: 'Chcę zacząć od zera, w domu, bez sprzętu',
  needEn: 'I want to start from zero — at home, with no equipment',
  persona: 'Beginner who installed the app yesterday. No gym membership, no gear, no idea where to start.',
  problem:
    'Beginners do not know which workouts to do, how often, or for how long — and random YouTube routines rarely survive the second week.',
  solution:
    'Ready 30/60/90-day goal plans filtered by equipment. A plan shows its week, what to expect after 30 days and an advisor check; one tap schedules every session on real dates.',
  keyMessagePl: 'Plan na 30 dni w domu — gotowy w trzy stuknięcia.',
  keyMessageEn: 'A 30-day home plan — ready in three taps.',
  features: ['Dziś (no plan yet)', 'Plan catalog with the „Bez sprzętu” filter', 'Plan detail', 'Plan start and calendar'],
  clock: '2026-10-15T19:00:00+02:00',
  seed: 'fresh',
  hookPl: 'Zero sprzętu. Zero wymówek.',
  hookEn: 'No equipment. No excuses.',
  ctaPl: 'GYM TRACKER — plan, który mówi, co dziś',
  ctaEn: 'GYM TRACKER — a plan that tells you what’s today',
  music: 'Warm, upbeat acoustic-pop around 100 BPM; light and encouraging.',
  async setup(page) {
    await open(page, '#/sesja');
  },
  async run(s) {
    const { page } = s;
    s.beat('empty');
    await s.pause(2600);

    s.beat('catalog');
    await s.tap(page.getByRole('button', { name: 'Ustaw plan' }), 'Ustaw plan', { after: 1300 });
    await s.tap(page.getByRole('group', { name: 'Sprzęt' }).getByRole('button', { name: 'Bez sprzętu' }), 'Bez sprzętu', {
      after: 1800,
    });

    s.beat('plan');
    await s.tap(page.getByRole('button', { name: 'Zobacz plan' }).first(), 'Zobacz plan', { after: 1800 });
    await s.reveal(page.getByRole('heading', { name: 'Tydzień', exact: true }), { block: 'start' });
    await s.pause(2200);

    s.beat('expect');
    await s.reveal(page.getByRole('heading', { name: 'Czego się spodziewać' }), { block: 'start' });
    await s.pause(2600);
    await s.reveal(page.getByRole('heading', { name: 'Doradca' }), { block: 'start' });
    await s.pause(2000);

    s.beat('start');
    await s.tap(page.getByRole('button', { name: 'Zacznij ten plan' }), 'Zacznij ten plan', { after: 2600 });
    await s.tap(page.getByRole('button', { name: 'OK', exact: true }), 'OK', { after: 1200 });

    s.beat('calendar');
    await s.pause(1800);
    await s.reveal(page.getByRole('heading', { name: 'Najbliższy termin' }), { block: 'start' });
    await s.pause(2200);

    s.beat('tomorrow');
    await s.tap(tab(page, 'Dziś'), 'Dziś', { after: 3200 });
  },
  beats: {
    empty: {
      shows: 'Dziś for someone new: level 1 „Świeżo z dżungli”, „Bez planu — Nikt nie pilnuje terminów”.',
      captionPl: 'Pierwszy dzień. Bez planu.',
      captionEn: 'Day one. No plan.',
      voPl: 'Pierwszy dzień. Bez planu, bez sprzętu.',
      voEn: 'Day one. No plan, no equipment.',
      edit: 'Hook caption here.',
    },
    catalog: {
      shows: 'Tap „Ustaw plan” → plan catalog; tap the equipment filter „Bez sprzętu”. Cards with comic scenes and „30 DNI / 60 DNI / 90 DNI”.',
      captionPl: 'Plany z celem — bez sprzętu',
      captionEn: 'Goal plans — no equipment',
      voPl: 'Filtr „bez sprzętu” — plany na miesiąc, dwa, trzy.',
      voEn: 'One filter — and there are one, two and three-month plans.',
    },
    plan: {
      shows: '„Bez sprzętu — start, 30 dni”: scene, 3× a week, the week Mon / Wed / Fri with the workouts.',
      captionPl: '3 razy w tygodniu, po 25 minut',
      captionEn: '3 times a week, 25 minutes',
      voPl: 'Trzy treningi w tygodniu, po dwadzieścia pięć minut. Poniedziałek, środa, piątek.',
      voEn: 'Three workouts a week, twenty-five minutes each. Monday, Wednesday, Friday.',
      edit: 'Hold on the week row; highlight the three days.',
    },
    expect: {
      shows: '„Czego się spodziewać” (what 30 days really give) and the advisor: „Plan trzyma się zasad”.',
      captionPl: 'Uczciwie: czego się spodziewać',
      captionEn: 'Honest: what to expect',
      voPl: 'Plan mówi uczciwie, czego się spodziewać po miesiącu, a doradca sprawdza, czy tydzień ma sens.',
      voEn: 'It tells you honestly what a month will do, and an advisor checks the week makes sense.',
      edit: 'Zoom on the „Czego się spodziewać” paragraph for ~2 s.',
    },
    start: {
      shows: 'Tap „Zacznij ten plan” → dialog „Plan ustawiony” (start today, first session tomorrow) → „OK”.',
      captionPl: 'Jedno stuknięcie — plan ustawiony',
      captionEn: 'One tap — plan set',
      voPl: 'Jedno stuknięcie. Plan ustawiony, pierwszy trening jutro.',
      voEn: 'One tap. The plan is set; the first session is tomorrow.',
    },
    calendar: {
      shows: 'Plan page: week 1 of 4, rank „Gość z ulicy”, 0 points, „Najbliższy termin: pt 16.10 — Całe ciało bez sprzętu A”.',
      captionPl: 'Terminy na konkretne dni',
      captionEn: 'Sessions on real dates',
      voPl: 'Każdy trening ma swój dzień — i punkty za to, że przyjdziesz.',
      voEn: 'Every session has its date — and points for showing up.',
    },
    tomorrow: {
      shows: 'Back on Dziś: the plan now says what comes next and when.',
      captionPl: 'Jutro: pierwszy trening',
      captionEn: 'Tomorrow: your first workout',
      voPl: 'Jutro wystarczy otworzyć aplikację.',
      voEn: 'Tomorrow, just open the app.',
      edit: 'Closing card over the last 2 s.',
    },
  },
};
