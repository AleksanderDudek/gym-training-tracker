import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

export const scenario: Scenario = {
  slug: '05-ruch-przy-biurku',
  title: 'Moving more at a desk job',
  titlePl: 'Ruch przy biurku',
  needPl: 'Siedzę cały dzień przy biurku',
  needEn: 'I sit at a desk all day',
  persona: 'Office worker with no time for the gym today, who still wants to move.',
  problem: 'A whole workout feels out of reach on a busy day, so nothing happens at all.',
  solution:
    'Movement snacks: a short set between meetings, logged in seconds, counted toward the character’s experience and badges. Steps from the phone become calories from your weight — and badges too.',
  keyMessagePl: '15 przysiadów też się liczy.',
  keyMessageEn: '15 squats count too.',
  features: ['Dziś: movement snack card', 'Snack entry', 'Badge celebration', 'Steps entry with calories'],
  clock: '2026-10-15T11:20:00+02:00',
  seed: 'fresh',
  hookPl: 'Nie masz godziny? Masz minutę.',
  hookEn: 'No hour to spare? You have a minute.',
  ctaPl: 'GYM TRACKER — każdy ruch się liczy',
  ctaEn: 'GYM TRACKER — every move counts',
  music: 'Playful, bouncy pop around 120 BPM; celebratory sting on each badge.',
  async setup(page) {
    await open(page, '#/sesja');
  },
  async run(s) {
    const { page } = s;
    s.beat('desk');
    await s.pause(1600);
    await s.reveal(page.getByRole('heading', { name: 'Krótka seria poza treningiem' }), { block: 'start' });
    await s.pause(1800);

    s.beat('snack');
    await s.tap(page.getByRole('button', { name: 'Przysiad bez obciążenia. Zapisz przekąskę.' }), 'Przysiad bez obciążenia', {
      after: 1000,
    });
    await s.type(page.getByRole('spinbutton', { name: 'ile powtórzeń' }), '15', { after: 500 });
    await s.tap(page.getByRole('button', { name: 'Zapisz przekąskę' }), 'Zapisz przekąskę', { after: 300 });

    s.beat('badge');
    await page.getByRole('heading', { name: 'Zdobyte!' }).waitFor();
    await s.pause(3200);
    await s.tap(page.getByRole('button', { name: 'Nieźle' }), 'Nieźle', { after: 700 });

    s.beat('xp');
    await s.reveal(page.getByRole('heading', { name: /^Dziś 1 przekąska/ }), { block: 'start' });
    await s.pause(2200);

    s.beat('steps');
    await s.tap(page.getByRole('button', { name: 'Kroki z telefonu. Wpisz.' }), 'Kroki z telefonu', { after: 1000 });
    await s.type(page.getByRole('spinbutton', { name: 'kroki z całego dnia' }), '8600', { delay: 140, after: 1800 });
    await s.tap(page.getByRole('button', { name: 'Zapisz', exact: true }), 'Zapisz', { after: 300 });

    s.beat('badges');
    await page.getByRole('heading', { name: /^Zdobyte: / }).waitFor();
    await s.pause(3400);
    await s.tap(page.getByRole('button', { name: 'Nieźle' }), 'Nieźle', { after: 600 });

    s.beat('levelup');
    await page.getByText('Awans postaci').waitFor();
    await s.pause(2800);
    await s.tap(page.getByRole('button', { name: 'Dalej' }), 'Dalej', { after: 1600 });
  },
  beats: {
    desk: {
      shows: 'Dziś at 11:20 on a work day; scroll to the movement snack card (Przysiad, Pompki, Deska, Burpee).',
      captionPl: 'Przerwa między spotkaniami',
      captionEn: 'A break between meetings',
      voPl: 'Jedenasta dwadzieścia, praca przy biurku. Minuta przerwy.',
      voEn: 'Eleven twenty at the desk. A one-minute break.',
      edit: 'Hook caption here.',
    },
    snack: {
      shows: 'Tap „Przysiad bez obciążenia”, type 15, „Zapisz przekąskę”.',
      captionPl: '15 przysiadów — zapisane',
      captionEn: '15 squats — logged',
      voPl: 'Piętnaście przysiadów. Dwa stuknięcia i zapisane.',
      voEn: 'Fifteen squats. Two taps, logged.',
    },
    badge: {
      shows: 'Badge celebration „Zdobyte!” — bronze „Przekąski ruchowe”, with rays and the line „Przerwy na nic stały się przerwami na coś”.',
      captionPl: 'Pierwsza odznaka',
      captionEn: 'First badge',
      voPl: 'Pierwsza odznaka: przerwy na nic stały się przerwami na coś.',
      voEn: 'First badge: breaks for nothing became breaks for something.',
      edit: 'Celebration sting; small zoom on the medal.',
    },
    xp: {
      shows: 'Snack card now says „Dziś 1 przekąska · +15 XP”.',
      captionPl: '+15 XP dla postaci',
      captionEn: '+15 XP for your character',
      voPl: 'Postać rośnie od każdej przekąski.',
      voEn: 'Your character grows with every snack.',
    },
    steps: {
      shows: 'Tap „Kroki z telefonu”, type 8600 — the calorie estimate appears from your weight; tap „Zapisz”.',
      captionPl: 'Kroki z telefonu → kalorie',
      captionEn: 'Phone steps → calories',
      voPl: 'Kroki z telefonu: osiem tysięcy sześćset. Kalorie liczą się z mojej wagi.',
      voEn: 'Steps from my phone: eight thousand six hundred. Calories from my weight.',
      edit: 'Zoom on the calorie estimate while typing.',
    },
    badges: {
      shows: 'Celebration „Zdobyte: 3” — „Dzień na nogach”, „Osiem tysięcy” and more; tap „Nieźle”.',
      captionPl: 'Trzy odznaki naraz',
      captionEn: 'Three badges at once',
      voPl: 'I trzy kolejne odznaki. Bez siłowni.',
      voEn: 'And three more badges. No gym needed.',
    },
    levelup: {
      shows: 'Level-up card „Awans postaci — Poziom 2 · Świeżo z dżungli” with the gorilla; tap „Dalej”.',
      captionPl: 'Awans: poziom 2',
      captionEn: 'Level up: 2',
      voPl: 'I awans postaci. Stado zauważyło.',
      voEn: 'And a level up. The troop noticed.',
      edit: 'Celebration sting; closing card over the last 2 s.',
    },
  },
};
