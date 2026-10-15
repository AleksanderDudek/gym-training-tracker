import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

const SUBWAY = 'Kurczak w stylu Rotisserie (Subway)';
const KEFIR = 'Kefir z białkiem i truskawkami';

export const scenario: Scenario = {
  slug: '12-ulubione-szybki-wybor',
  title: 'Favourites: what I eat most, one tap away',
  titlePl: 'Ulubione: to, co jem najczęściej, pod ręką',
  needPl: 'Jem ciągle to samo — nie chcę tego za każdym razem szukać',
  needEn: 'I eat the same things — I don’t want to search for them every time',
  persona: 'Creature of habit: same breakfast, same shake, same lunch spot.',
  problem: 'Logging food is the chore that kills diet tracking — especially typing the same five meals every day.',
  solution:
    'Star anything — a product, a recipe, a restaurant item, your own set. Favourites sit in the diary with „+ Zjadłem” for one-tap logging, sorted by what you eat most, and come first in „Dodaj zjedzone”.',
  keyMessagePl: 'To, co jesz najczęściej — jedno stuknięcie.',
  keyMessageEn: 'What you eat most — one tap.',
  features: ['Dziennik: „Ulubione” quick pick', '„Dodaj zjedzone”: favourites first, star, quick add'],
  clock: '2026-10-15T13:10:00+02:00',
  seed: 'full',
  hookPl: 'Ten sam lunch co zawsze?',
  hookEn: 'Same lunch as always?',
  ctaPl: 'GYM TRACKER — dziennik bez wpisywania',
  ctaEn: 'GYM TRACKER — logging without typing',
  music: 'Breezy, minimal pop around 110 BPM; a soft pop on each star.',
  async setup(page) {
    await open(page, '#/jedzenie');
    await page.getByRole('region', { name: 'Ulubione' }).waitFor();
    // Baza produktów wczytuje się w tle; wyszukiwarka ma ją mieć, zanim ruszy kamera.
    await page.waitForTimeout(4000);
  },
  async run(s) {
    const { page } = s;
    s.beat('card');
    await s.reveal(page.getByRole('heading', { name: 'Ulubione', exact: true }), { block: 'start' });
    await s.pause(3300);

    s.beat('quick');
    await s.tap(page.getByRole('button', { name: `Zjadłem z ulubionych: ${SUBWAY}` }), `Zjadłem: ${SUBWAY}`, { after: 1400 });
    await s.reveal(page.getByRole('region', { name: 'Bilans dnia' }), { block: 'start', ms: 900 });
    await s.pause(2700);

    s.beat('picker');
    await s.tap(page.getByRole('button', { name: 'Dodaj zjedzone' }), 'Dodaj zjedzone', { after: 2600 });

    s.beat('star');
    const picker = page.getByRole('dialog', { name: 'Dodaj zjedzone' });
    await s.type(picker.getByRole('searchbox', { name: 'Szukaj jedzenia' }), 'kefir', { delay: 120, after: 1400 });
    await s.tap(picker.getByRole('button', { name: `Ulubione: ${KEFIR}` }), 'gwiazdka: Kefir z białkiem', { after: 2600 });

    s.beat('add');
    await s.tap(picker.getByRole('button', { name: `Dodaj od razu: ${KEFIR}` }), 'Dodaj od razu', { after: 1600 });
    await s.reveal(page.getByRole('heading', { name: 'Ulubione', exact: true }), { block: 'start' });
    await s.pause(2600);

    s.beat('counts');
    await s.tap(page.getByRole('navigation', { name: 'Dieta' }).getByRole('link', { name: 'Profil diety' }), 'Profil diety', {
      after: 1200,
    });
    await s.reveal(page.getByRole('heading', { name: 'Ulubione', level: 3 }), { block: 'start' });
    await s.pause(3900);
  },
  beats: {
    card: {
      shows: 'Dziennik: the „Ulubione” card — five favourites sorted by how often they are eaten, each with „+ Zjadłem”.',
      captionPl: 'Ulubione — najczęstsze na górze',
      captionEn: 'Favourites — most eaten first',
      voPl: 'Ulubione. Najczęściej jedzone same idą na górę.',
      voEn: 'Favourites. The most eaten rise to the top.',
      edit: 'Hook caption here.',
    },
    quick: {
      shows: 'Tap „Zjadłem” on the Subway sandwich — logged at once; the day’s bars at the top move.',
      captionPl: 'Lunch zapisany jednym stuknięciem',
      captionEn: 'Lunch logged in one tap',
      voPl: 'Lunch jak zwykle — jedno stuknięcie i zapisane.',
      voEn: 'The usual lunch — one tap, logged.',
      edit: 'Zoom on the kcal number changing.',
    },
    picker: {
      shows: '„Dodaj zjedzone”: with no query, favourites come first under „ULUBIONE”, each with a quick „+”.',
      captionPl: 'Ulubione zawsze pierwsze',
      captionEn: 'Favourites always first',
      voPl: 'W wyszukiwarce ulubione też są pierwsze.',
      voEn: 'In the search, favourites come first too.',
    },
    star: {
      shows: 'Type „kefir”; tap the star next to „Kefir z białkiem i truskawkami” — the row moves under „ULUBIONE” and gets a „+”.',
      captionPl: 'Gwiazdka — i jest w ulubionych',
      captionEn: 'Star it — it’s a favourite',
      voPl: 'Nowy przysmak? Gwiazdka — i od teraz jest pod ręką.',
      voEn: 'A new favourite? Star it — from now on it’s at hand.',
      edit: 'Highlight the row jumping to the favourites group.',
    },
    add: {
      shows: 'Tap „+” (Dodaj od razu) — logged without opening; back in the diary the new favourite is on the card.',
      captionPl: 'Zjedzone, bez wpisywania',
      captionEn: 'Logged, no typing',
      voPl: 'I zapisane — bez wpisywania ani jednej liczby.',
      voEn: 'Logged — without typing a single number.',
    },
    counts: {
      shows: 'Profil diety → Twoje dane → Ulubione: each favourite with „zjedzone N×” (Owsianka ze skyrem 26×…), with remove.',
      captionPl: 'Owsianka: zjedzona 26 razy',
      captionEn: 'Oatmeal: eaten 26 times',
      voPl: 'A w profilu widać, co naprawdę jem najczęściej. Owsianka: dwadzieścia sześć razy.',
      voEn: 'And the profile shows what I really eat most. Oatmeal: twenty-six times.',
      edit: 'Zoom on the „zjedzone 26×” line; closing card over the last 2 s.',
    },
  },
};
