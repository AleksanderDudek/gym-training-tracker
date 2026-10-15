import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

export const scenario: Scenario = {
  slug: '03-technika-cwiczenia',
  title: 'How to do the exercise right',
  titlePl: 'Jak dobrze zrobić ćwiczenie',
  needPl: 'Nie wiem, jak dobrze zrobić to ćwiczenie',
  needEn: "I'm not sure I'm doing the exercise right",
  persona: 'Beginner afraid of doing a move wrong — or of looking silly at the gym.',
  problem:
    'Form advice is scattered over long videos full of ads; a beginner needs the two cues that matter and to see the movement, now.',
  solution:
    'Every exercise in the atlas has its key cues („Na co uważać”), difficulty stages that show where you are, and an animated figure drawn in the app — play, pause and scrub through the movement frame by frame.',
  keyMessagePl: 'Technika w kieszeni: dwie wskazówki i ruch klatka po klatce.',
  keyMessageEn: 'Form in your pocket: the cues that matter, the movement frame by frame.',
  features: ['Ćwiczenia (exercise atlas) with the „bez sprzętu” filter', 'Exercise page: cues, stages, animated movement', 'Movement snack'],
  clock: '2026-10-15T19:10:00+02:00',
  seed: 'fresh',
  hookPl: 'Robisz pompki dobrze?',
  hookEn: 'Are your push-ups right?',
  ctaPl: 'GYM TRACKER — 114 ćwiczeń z techniką',
  ctaEn: 'GYM TRACKER — 114 exercises with form cues',
  music: 'Calm, focused lo-fi around 85 BPM; soft hit when the figure is paused.',
  async setup(page) {
    await open(page, '#/cwiczenia');
  },
  async run(s) {
    const { page } = s;
    s.beat('atlas');
    await s.pause(2000);
    await s.tap(page.getByRole('button', { name: 'bez sprzętu', exact: true }), 'bez sprzętu', { after: 1400 });

    s.beat('open');
    await s.tap(page.getByRole('button', { name: /^ETAP \d+ Pompki kettlebell/ }), 'Pompki', { after: 1600 });
    await s.pause(1600);

    s.beat('stages');
    await s.reveal(page.getByRole('heading', { name: 'Etapy trudności' }), { block: 'start' });
    await s.pause(2600);

    s.beat('motion');
    await s.reveal(page.getByRole('img', { name: /^Ciało w jednej linii/ }), { block: 'center' });
    await s.pause(4200);

    s.beat('scrub');
    await s.tap(page.getByRole('button', { name: 'Zatrzymaj' }), 'Zatrzymaj', { after: 600 });
    await s.drag(page.getByRole('slider', { name: 'klatka ruchu' }), 'suwak: klatka ruchu', { ms: 2600 });
    await s.pause(700);
    await s.tap(page.getByRole('button', { name: 'Odtwórz', exact: true }), 'Odtwórz', { after: 1500 });

    s.beat('try');
    await s.tap(page.getByRole('button', { name: 'Zapisz jako przekąskę ruchową' }), 'Zapisz jako przekąskę ruchową', {
      after: 1100,
    });
    await s.type(page.getByRole('spinbutton', { name: 'ile powtórzeń' }), '10', { after: 400 });
    await s.tap(page.getByRole('button', { name: 'Zapisz przekąskę' }), 'Zapisz przekąskę', { after: 400 });

    s.beat('done');
    await page.getByRole('heading', { name: /^Zdobyte/ }).waitFor();
    await s.pause(3000);
  },
  beats: {
    atlas: {
      shows: 'Exercise atlas (114 exercises, grouped by movement); tap the filter „bez sprzętu”.',
      captionPl: '114 ćwiczeń, 30 bez sprzętu',
      captionEn: '114 exercises, 30 with no equipment',
      voPl: 'Atlas ćwiczeń. Filtr: bez sprzętu.',
      voEn: 'The exercise atlas. Filter: no equipment.',
      edit: 'Hook caption here.',
    },
    open: {
      shows: 'Open „Pompki”: „Na co uważać — ciało w jednej linii, łokcie 45° od tułowia”.',
      captionPl: 'Dwie rzeczy, które się liczą',
      captionEn: 'The two cues that matter',
      voPl: 'Najważniejsze: ciało w jednej linii, łokcie czterdzieści pięć stopni od tułowia.',
      voEn: 'What matters most: body in one line, elbows at forty-five degrees.',
      edit: 'Zoom on the „Na co uważać” paragraph.',
    },
    stages: {
      shows: 'Difficulty stages from push-ups on a raised surface to deficit push-ups, with „tutaj jesteś”.',
      captionPl: 'Etapy: od łatwych do trudnych',
      captionEn: 'Stages: easy to hard',
      voPl: 'Pięć etapów — wiesz, na którym jesteś.',
      voEn: 'Five stages — you know where you are.',
      edit: 'Highlight the „tutaj jesteś” item.',
    },
    motion: {
      shows: 'Animated figure doing a push-up, drawn in the app (gorilla mannequin, sweat at the hardest point).',
      captionPl: 'Ruch narysowany w aplikacji',
      captionEn: 'The movement, drawn in the app',
      voPl: 'Sylwetka pokazuje tor ruchu i tempo — bez reklam i bez czekania na film.',
      voEn: 'The figure shows the path and tempo — no ads, no waiting for a video.',
      edit: 'Slow zoom-in on the figure; keep it loop-friendly.',
    },
    scrub: {
      shows: 'Tap „Zatrzymaj”, drag the „klatka ruchu” slider through the movement, then „Odtwórz”.',
      captionPl: 'Klatka po klatce',
      captionEn: 'Frame by frame',
      voPl: 'Zatrzymaj i przewiń klatka po klatce — zobacz, gdzie jest najtrudniej.',
      voEn: 'Pause and scrub frame by frame — see where it gets hardest.',
      edit: 'Zoom on the figure while the slider moves.',
    },
    try: {
      shows: '„Zapisz jako przekąskę ruchową” → snack screen with Pompki selected; type 10; „Zapisz przekąskę”.',
      captionPl: 'Spróbuj od razu: 10 pompek',
      captionEn: 'Try it now: 10 push-ups',
      voPl: 'A teraz spróbuj: dziesięć pompek, zapisane.',
      voEn: 'Now try it: ten push-ups, logged.',
    },
    done: {
      shows: 'Badge celebration „Zdobyte!” — bronze „Przekąski ruchowe”.',
      captionPl: 'Pierwsza odznaka',
      captionEn: 'First badge',
      voPl: 'I pierwsza odznaka.',
      voEn: 'And the first badge.',
      edit: 'Closing card over the last 2 s.',
    },
  },
};
