import type { Page } from 'playwright';
import { open } from '../lib/app';
import type { Scenario } from '../lib/types';

/** What the fake back camera can hold in front of the lens: real products of the app's dataset. */
interface Pack {
  code: string;
  /** Big print on the label. */
  brand: string;
  /** Small print under it. */
  line: string;
  /** Label colour, its darker shade, the print colour. */
  colors: [string, string, string];
}

const MULLER: Pack = { code: '4025500132446', brand: 'Müllermilch', line: 'napój mleczny · 400 g', colors: ['#cfe3b4', '#93b06d', '#2d4a1c'] };
const SKYR: Pack = { code: '5901939103068', brand: 'SKYR pitny', line: 'mango & marakuja · 355 g', colors: ['#ffd27a', '#e59a2f', '#5a2d0c'] };
const YOPRO: Pack = { code: '5900643051108', brand: 'YoPRO', line: 'truskawka malina · 270 g', colors: ['#f3f4f8', '#c9cede', '#c2183f'] };
const PACKS = [MULLER, SKYR, YOPRO];

const MULLER_NAME = 'Müllermilch';
const SKYR_NAME = 'Skyr jogurt pitny typu islandzkiego mango & marakuja';
const YOPRO_NAME = 'YoPRO (Smak Truskawka Malina)';

/**
 * Headless Chromium has no camera: the scanner gets a canvas instead — a fridge shelf out of focus
 * and, on `__demoCamera.show(i)`, a pack brought up to the lens with a real EAN-13 on its label
 * (drawn bar by bar), a slight tilt and hand shake, and a focus pull once it stops. The app's own
 * reader decodes it like any camera picture.
 */
function fakeCamera(packs: Pack[]) {
  const W = 1280;
  const H = 960;
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const flip = (bits: string) => [...bits].map((b) => (b === '1' ? '0' : '1')).join('');

  /** The 95 modules of an EAN-13 and which of them are guard bars (drawn longer). */
  function ean13(code: string): { bits: string; guard: boolean[] } {
    const d = [...code].map(Number);
    const parity = PARITY[d[0]!]!;
    let bits = '101';
    for (let i = 1; i <= 6; i++) {
      const l = L[d[i]!]!;
      bits += parity[i - 1] === 'L' ? l : [...flip(l)].reverse().join('');
    }
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += flip(L[d[i]!]!);
    bits += '101';
    const guard = [...bits].map((_, i) => i < 3 || (i >= 45 && i < 50) || i >= 92);
    return { bits, guard };
  }

  const canvasOf = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')!] as const;
  };

  /** A chilled shelf out of focus: rows of bottles and price rails. */
  function shelf(): HTMLCanvasElement {
    const [c, g] = canvasOf(W, H);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#eef1f2');
    bg.addColorStop(1, '#a9b1b5');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.filter = 'blur(22px)';
    const hues = ['#f4f4f0', '#d6e7f2', '#f6d3dc', '#ffe08a', '#cfe3b4', '#fbfbfb', '#9cc3e6', '#f2b48a'];
    let k = 0;
    for (const [top, h] of [
      [-60, 300],
      [330, 330],
      [760, 300],
    ] as const) {
      for (let x = -40; x < W + 80; x += 150) {
        g.fillStyle = hues[k++ % hues.length]!;
        g.beginPath();
        g.roundRect(x, top + ((k * 37) % 40), 120, h, 40);
        g.fill();
      }
      g.fillStyle = '#e7e9ea';
      g.fillRect(0, top + h + 10, W, 46);
      g.fillStyle = '#f2c94c';
      for (let x = 60; x < W; x += 300) g.fillRect(x, top + h + 16, 110, 34);
    }
    g.filter = 'none';
    return c;
  }

  /** The front of a bottle seen close up: brand, a white panel with the barcode, the flavour. */
  function label(pack: Pack): HTMLCanvasElement {
    const LW = 980;
    const LH = 1000;
    const [c, g] = canvasOf(LW, LH);
    const [base, shade, ink] = pack.colors;
    // A cylinder: darker towards both edges.
    const body = g.createLinearGradient(0, 0, LW, 0);
    body.addColorStop(0, shade);
    body.addColorStop(0.18, base);
    body.addColorStop(0.62, base);
    body.addColorStop(1, shade);
    g.fillStyle = body;
    g.beginPath();
    g.roundRect(0, 0, LW, LH, 90);
    g.fill();
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.font = '800 120px system-ui, -apple-system, Helvetica, Arial, sans-serif';
    g.fillText(pack.brand, LW / 2, 190);
    g.font = '600 46px system-ui, -apple-system, Helvetica, Arial, sans-serif';
    g.fillText(pack.line, LW / 2, 770);

    // The barcode panel: 95 modules, 7 px each, quiet zones, digits under the bars.
    const { bits, guard } = ean13(pack.code);
    const m = 7;
    const pw = 95 * m + 2 * 84;
    const ph = 400;
    const px = (LW - pw) / 2;
    const py = 290;
    g.fillStyle = '#fff';
    g.beginPath();
    g.roundRect(px, py, pw, ph, 18);
    g.fill();
    const bx = px + 84;
    const by = py + 40;
    const bh = 270;
    g.fillStyle = '#111';
    [...bits].forEach((b, i) => {
      if (b === '1') g.fillRect(bx + i * m, by, m, bh + (guard[i] ? 26 : 0));
    });
    g.font = '500 44px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center';
    g.fillText(pack.code[0]!, bx - 34, by + bh + 50);
    for (let i = 0; i < 6; i++) {
      g.fillText(pack.code[1 + i]!, bx + (3 + 7 * i + 3.5) * m, by + bh + 50);
      g.fillText(pack.code[7 + i]!, bx + (50 + 7 * i + 3.5) * m, by + bh + 50);
    }
    // Light on the plastic.
    const gloss = g.createLinearGradient(0, 0, LW, 0);
    gloss.addColorStop(0.68, 'rgba(255,255,255,0)');
    gloss.addColorStop(0.76, 'rgba(255,255,255,.28)');
    gloss.addColorStop(0.84, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(0, 0, LW, LH);
    return c;
  }

  let view: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; shelf: HTMLCanvasElement; labels: HTMLCanvasElement[] } | null = null;
  /** What is in front of the lens, and since when; what is leaving it. */
  let current = { index: -1, at: 0 };
  let leaving = { index: -1, at: 0 };

  const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

  function draw() {
    if (!view) return;
    const { ctx, labels } = view;
    const now = performance.now();
    ctx.filter = 'none';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(view.shelf, 0, 0);
    const put = (index: number, dx: number, blur: number) => {
      const img = labels[index];
      if (!img) return;
      ctx.save();
      ctx.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
      const sx = 7 * Math.sin(now / 760) + 3 * Math.sin(now / 310);
      const sy = 6 * Math.sin(now / 880) + 2 * Math.sin(now / 270);
      ctx.translate(W / 2 + dx + sx, H / 2 + 40 + sy);
      ctx.rotate(-0.05 + 0.008 * Math.sin(now / 1200));
      ctx.transform(1, 0.018, -0.03, 1, 0, 0);
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 40;
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    };
    if (leaving.index >= 0) {
      const t = (now - leaving.at) / 420;
      if (t >= 1) leaving.index = -1;
      else put(leaving.index, -W * 1.1 * ease(t), 10 * t);
    }
    if (current.index >= 0) {
      const t = (now - current.at) / 520;
      // In from the right, then the autofocus catches up.
      const focus = Math.max(0, 1 - (now - current.at - 520) / 380);
      put(current.index, W * 1.1 * (1 - ease(t)), t < 1 ? 9 : 9 * focus);
    }
    // Lens vignette.
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.32)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function ensure() {
    if (view) return view;
    const [canvas, ctx] = canvasOf(W, H);
    view = { canvas, ctx, shelf: shelf(), labels: packs.map(label) };
    setInterval(draw, 33);
    draw();
    return view;
  }

  const camera = {
    /** Brings pack `index` up to the lens (the one there goes away first). */
    show(index: number) {
      if (current.index >= 0) leaving = { index: current.index, at: performance.now() };
      current = { index, at: performance.now() };
    },
    /** Takes the pack away: the shelf alone. */
    hide() {
      if (current.index >= 0) leaving = { index: current.index, at: performance.now() };
      current = { index: -1, at: 0 };
    },
  };
  (window as unknown as { __demoCamera: typeof camera }).__demoCamera = camera;

  const devices = navigator.mediaDevices ?? ({} as MediaDevices);
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: devices });
  devices.getUserMedia = async () => ensure().canvas.captureStream(30);
  devices.enumerateDevices = async () =>
    [{ deviceId: 'back', groupId: 'phone', kind: 'videoinput', label: 'Aparat tylny', toJSON: () => ({}) }] as MediaDeviceInfo[];
}

const camera = {
  show: (page: Page, pack: Pack) =>
    page.evaluate((i) => (window as unknown as { __demoCamera: { show(i: number): void } }).__demoCamera.show(i), PACKS.indexOf(pack)),
  hide: (page: Page) => page.evaluate(() => (window as unknown as { __demoCamera: { hide(): void } }).__demoCamera.hide()),
};

export const scenario: Scenario = {
  slug: '14-skaner-porownanie-w-sklepie',
  title: 'Which of these is better for my goal? Scan and compare',
  titlePl: 'Który z tych jest lepszy pod mój cel? Skanuję i porównuję',
  needPl: 'Stoję przed półką — który z tych trzech jogurtów jest lepszy pod mój cel?',
  needEn: 'I’m standing at the shelf — which of these three yogurts is better for my goal?',
  persona: 'Label reader in the shop after work, three drinkable yogurts in hand, wants the answer in seconds.',
  problem:
    'Labels give 100 g values in tiny print, packs differ in size, and „protein” on the front says nothing about how much protein per calorie — comparing three bottles by eye takes minutes and still guesses.',
  solution:
    'Point the camera at a barcode: macros per 100 g and per pack, the verdict for your diet profile and what one pack means for what is left today appear at once. Each scan lands in a comparison ranked for your goal (protein per 100 kcal for an athletic diet) with the winner named, per 100 g or per pack — and „Zjadłem” logs it.',
  keyMessagePl: 'Skanujesz kody — aplikacja mówi, który produkt jest najlepszy pod Twój cel.',
  keyMessageEn: 'Scan the barcodes — the app tells you which product is best for your goal.',
  features: [
    'Produkty → „Skanuj”: barcode scanner sheet (#/produkty?skan=1), camera with the browser’s own reader',
    'Result card: per 100 g and per pack, diet-profile verdict, „Na dziś” line, standing in the comparison',
    '„Porównanie”: ranking for the goal, winner and why, per 100 g / per pack, price per 10 g protein',
    '„Zjadłem 270 g” straight from the scanner',
  ],
  clock: '2026-10-15T17:40:00+02:00',
  seed: 'full',
  hookPl: 'Trzy jogurty. Który wziąć?',
  hookEn: 'Three yogurts. Which one?',
  ctaPl: 'GYM TRACKER — zakupy pod Twój cel',
  ctaEn: 'GYM TRACKER — shopping for your goal',
  music: 'Bright, snappy electronic beat around 116 BPM; a soft blip on each scan.',
  async setup(page) {
    // tsx keeps function names with `__name(...)`; the page needs the helper before the camera script.
    await page.addInitScript('globalThis.__name ??= (fn) => fn;');
    await page.addInitScript(fakeCamera, PACKS);
    await open(page, '#/produkty');
    await page.getByRole('list', { name: 'Lista produktów' }).waitFor({ timeout: 30_000 });
    // The products dataset loads in the background; the scanner looks codes up in it.
    await page.waitForTimeout(3000);
  },
  async run(s) {
    const { page } = s;
    const sheet = page.getByRole('dialog', { name: 'Skaner kodów' });
    const result = (name: string) => sheet.getByRole('heading', { name, level: 3 }).waitFor({ timeout: 15_000 });
    /** The pack in hand goes back on the shelf, the next one comes up to the lens. */
    const next = async (pack: Pack, name: string) => {
      await camera.hide(page);
      await s.pause(600);
      await camera.show(page, pack);
      await result(name);
    };

    s.beat('scan');
    await s.pause(900);
    // The camera opens on the shelf; a moment later the first bottle is in front of it.
    await s.tap(page.getByRole('button', { name: 'Skanuj kod kreskowy' }), 'Skanuj kod kreskowy', { after: 1100 });
    await camera.show(page, MULLER);
    await result(MULLER_NAME);
    await s.pause(900);

    s.beat('first');
    await s.pause(4000);

    s.beat('second');
    await next(SKYR, SKYR_NAME);
    await s.pause(2600);

    s.beat('third');
    await next(YOPRO, YOPRO_NAME);
    await s.pause(3000);

    s.beat('ranking');
    await camera.hide(page);
    await s.reveal(sheet.getByRole('heading', { name: /^Porównanie/ }), { block: 'start', ms: 900 });
    await s.pause(3800);

    s.beat('pack');
    await s.tap(sheet.getByRole('button', { name: 'Na opakowanie' }), 'Na opakowanie', { after: 3800 });

    s.beat('eat');
    await s.tap(sheet.getByRole('button', { name: 'Zjadłem 270 g' }), 'Zjadłem 270 g', { after: 3600 });
  },
  beats: {
    scan: {
      shows: 'Produkty at 17:40; tap „Skanuj” — the scanner opens on the camera, a Müllermilch bottle comes up to the lens and its EAN-13 is read in about a second (green flash).',
      captionPl: 'Kod pod aparat — i gotowe',
      captionEn: 'Barcode to the camera — done',
      voPl: 'Trzy jogurty w sklepie. Skanuję pierwszy.',
      voEn: 'Three yogurts in the shop. I scan the first.',
      edit: 'Hook caption here; keep the camera box big — the read is the moment.',
    },
    first: {
      shows: 'Result card: Müllermilch — „może być” (białko 19%), 68 kcal · 3,2 g protein per 100 g, pack 400 g: 272 kcal · 12,8 g; „Na dziś: mieści się — zostało ok. 1650 kcal.”',
      captionPl: 'Makro na 100 g i na butelkę',
      captionEn: 'Macros per 100 g and per bottle',
      voPl: 'Makro na całą butelkę — i ile zostało na dziś.',
      voEn: 'Macros for the whole bottle — and what’s left for today.',
      edit: 'Zoom on the table (pack row) and the „Na dziś” line.',
    },
    second: {
      shows: 'Skyr pitny mango & marakuja scanned: „pasuje”, 80 kcal · 6,5 g per 100 g, pack 355 g: 284 kcal · 23,1 g; „Najlepszy na Twój cel z 2 zeskanowanych.”',
      captionPl: 'Drugi: lepszy na Twój cel',
      captionEn: 'Second: better for your goal',
      voPl: 'Drugi — skyr pitny. Pasuje, na razie najlepszy.',
      voEn: 'Second — drinkable skyr. It fits, best so far.',
      edit: 'Highlight the green standing line.',
    },
    third: {
      shows: 'YoPRO truskawka malina scanned: „pasuje”, 59 kcal · 8,5 g per 100 g, pack 270 g: 160 kcal · 23 g; „Najlepszy na Twój cel z 3 zeskanowanych.”',
      captionPl: 'Najlepszy z 3 zeskanowanych',
      captionEn: 'Best of the 3 scanned',
      voPl: 'Trzeci — YoPRO. Najlepszy z trzech na mój cel.',
      voEn: 'Third — YoPRO. The best of three for my goal.',
      edit: 'Zoom on „Najlepszy na Twój cel z 3 zeskanowanych.”',
    },
    ranking: {
      shows: '„Porównanie (3)”: „Na Twój cel (Sportowa) najlepszy: YoPRO — 14,4 g białka na 100 kcal”; ranked 1 YoPRO (najlepszy, pasuje, 1,86 zł za 10 g białka), 2 Skyr (8,1 g), 3 Müllermilch (4,7 g); „Zniknie samo o 18:40”.',
      captionPl: '14,4 g białka na 100 kcal',
      captionEn: '14.4 g protein per 100 kcal',
      voPl: 'Ranking pod mój cel: najwięcej białka na kalorię. Lista zniknie za godzinę.',
      voEn: 'Ranked for my goal: most protein per calorie. The list clears in an hour.',
      edit: 'Highlight the winner row and the „14,4 g białka na 100 kcal” line.',
    },
    pack: {
      shows: 'Tap „Na opakowanie”: per pack — YoPRO 160 kcal · B 23, Skyr 284 kcal · B 23,1, Müllermilch 272 kcal · B 12,8.',
      captionPl: 'Tyle samo białka, −124 kcal',
      captionEn: 'Same protein, 124 kcal less',
      voPl: 'Tyle samo białka co skyr — sto dwadzieścia cztery kalorie mniej.',
      voEn: 'As much protein as the skyr — 124 calories fewer.',
      edit: 'Zoom on the kcal of rows 1 and 2.',
    },
    eat: {
      shows: 'Back up on the YoPRO card: tap „Zjadłem 270 g” — „Zapisane w dzienniku: YoPRO (Smak Truskawka Malina) · 160 kcal.”',
      captionPl: 'Biorę. Zapisane w dzienniku',
      captionEn: 'Taking it. Logged',
      voPl: 'Biorę ten. Jedno stuknięcie — i jest w dzienniku.',
      voEn: 'I’ll take this one. One tap — it’s in the diary.',
      edit: 'Zoom on the confirmation; closing card over the last 2 s.',
    },
  },
};
