import type { Page } from 'playwright';
import type { Scenario } from '../lib/types';

/**
 * The watch and phone cards exist only in a build that knows the app's server (`VITE_API_URL`)
 * and the phone app (`VITE_HEALTH_ANDROID_URL`) — the deploy sets both, a local `npm run build`
 * does not. The take serves the app's main chunk with those two settings filled in, as on the
 * live site: a server address nobody reaches (the page's CSP blocks it, nothing is connected)
 * and the Android app's address. No iPhone address: that app is not out yet.
 */
const API_URL = 'https://api.demo.invalid';
const HEALTH_ANDROID_URL = 'https://example.invalid/gym-tracker-zdrowie.apk';

/** The main chunk with the deploy's settings; null when its minified shape is not the expected one. */
function deployed(code: string): string | null {
  // `const API_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')` and `apiConfigured`.
  const api = /var (\w+)=``\.replace\(\/\\\/\+\$\/,``\),(\w+)=\(\)=>\1!==``/;
  const configured = code.match(api)?.[2];
  if (!configured) return null;
  // `HEALTH_IOS_URL`, `HEALTH_ANDROID_URL` and `phoneConfigured` right after them.
  const phone = new RegExp(`var (\\w+)=\`\`,(\\w+)=\`\`,(\\w+)=\\(\\)=>${configured}\\(\\)&&\\(\\1!==\`\`\\|\\|\\2!==\`\`\\)`);
  if (!phone.test(code)) return null;
  return code
    .replace(api, (m) => m.replace('``', `\`${API_URL}\``))
    .replace(phone, (m, ios: string, android: string) =>
      m.replace(`${ios}=\`\`,${android}=\`\``, `${ios}=\`\`,${android}=\`${HEALTH_ANDROID_URL}\``),
    );
}

/** Serves the main chunk as the deploy builds it; throws later in `setup` if that was not possible. */
async function asDeployed(page: Page): Promise<() => void> {
  let failure: string | null = 'the main chunk was never requested';
  await page.route(/\/assets\/index-[\w-]+\.js$/, async (route) => {
    try {
      const response = await route.fetch();
      const body = deployed(await response.text());
      if (!body) {
        failure = 'the main chunk has no API_URL / HEALTH_*_URL in the expected shape';
        await route.fulfill({ response });
        return;
      }
      // `text()` is already decoded: the patched body goes out without the original encoding.
      const headers = Object.fromEntries(
        Object.entries(response.headers()).filter(([k]) => !['content-encoding', 'content-length', 'transfer-encoding', 'etag'].includes(k)),
      );
      await route.fulfill({ status: response.status(), headers, body });
      failure = null;
    } catch (e) {
      failure = (e as Error).message;
      await route.continue().catch(() => {});
    }
  });
  return () => {
    if (failure) throw new Error(`asDeployed: ${failure}`);
  };
}

/** The connection keys are blurred like in post-production: a pairing key never goes on a video. */
const HIDE_KEYS = '.watch-key{filter:blur(7px)}';

export const scenario: Scenario = {
  slug: '19-czy-moj-zegarek',
  title: 'Does my watch work? Steps that arrive by themselves',
  titlePl: 'Czy mój zegarek jest obsługiwany? Kroki same',
  needPl: 'Mam Garmina (albo tylko telefon) — czy to się połączy i policzy kroki samo?',
  needEn: 'I have a Garmin (or just a phone) — will it connect and count my steps by itself?',
  persona: 'Runner with a Garmin Forerunner on the wrist who refuses to retype the step count every evening.',
  problem:
    'Retyping steps from the watch is a daily chore, and before installing anything you want to know if your model will work at all — Garmin has dozens of models with confusing names.',
  solution:
    'Right where you type steps, the app asks „Masz zegarek?”. You type your model — even misspelled — and get an answer from Garmin’s list of 118 Connect IQ watches: supported or not, and what will arrive by itself. One tap shows how to connect it; without a supported watch, an Android phone brings the data through Health Connect.',
  keyMessagePl: 'Sprawdzisz swój zegarek w kilka sekund — a kroki przyjdą same.',
  keyMessageEn: 'Check your watch in seconds — and let your steps arrive by themselves.',
  features: [
    'Kroki: „Masz zegarek? Sprawdź, czy kroki mogą przychodzić same →”',
    'Ustawienia → Zegarek Garmin: „Jaki masz zegarek?” — suggestions, typo tolerance, verdict, what arrives',
    '„Połącz zegarek”: connection status and steps (Connect IQ Store, Garmin Connect, key)',
    'Zdrowie z telefonu: Android via Health Connect, iPhone app not out yet',
  ],
  clock: '2026-10-15T18:00:00+02:00',
  seed: 'full',
  hookPl: 'Przepisujesz kroki z zegarka?',
  hookEn: 'Still retyping steps from your watch?',
  ctaPl: 'GYM TRACKER — kroki przychodzą same',
  ctaEn: 'GYM TRACKER — your steps arrive by themselves',
  music: 'Light, driving running-playlist electro around 120 BPM.',
  async setup(page) {
    const check = await asDeployed(page);
    await page.goto('/#/cardio/kroki');
    await page.getByRole('heading', { name: 'Kroki', level: 1 }).waitFor({ timeout: 20_000 });
    check();
    await page.addStyleTag({ content: HIDE_KEYS });
    await page.getByRole('link', { name: /^Masz zegarek\?/ }).waitFor();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(900);
  },
  async run(s) {
    const { page } = s;
    s.beat('steps');
    await s.pause(2200);
    await s.tap(page.getByRole('link', { name: /^Masz zegarek\?/ }), 'Masz zegarek? Sprawdź', { after: 600 });

    s.beat('card');
    await s.pause(3200);

    s.beat('typo');
    const field = page.getByRole('combobox', { name: 'Jaki masz zegarek?' });
    await s.type(field, 'forerunr 265', { delay: 120, after: 1700 });
    await s.tap(page.getByRole('option', { name: /^Forerunner® 265 / }), 'Forerunner 265', { after: 400 });

    s.beat('answer');
    await s.pause(4000);

    s.beat('connect');
    await s.tap(page.getByRole('button', { name: 'Połącz zegarek' }), 'Połącz zegarek', { after: 2600 });

    s.beat('howto');
    await s.scroll(330, { ms: 1200 });
    await s.pause(3500);

    s.beat('phone');
    await s.reveal(page.getByRole('heading', { name: 'Zdrowie z telefonu' }), { block: 'start', ms: 1100 });
    await s.pause(2400);
    await s.tap(page.getByRole('button', { name: 'Połącz telefon' }), 'Połącz telefon', { after: 1000 });

    s.beat('android');
    await s.scroll(150, { ms: 900 });
    await s.pause(3800);
  },
  beats: {
    steps: {
      shows: 'Kroki form at 18:00: „Przepisz kroki z telefonu albo zegarka”, field „kroki z całego dnia” with „ostatnio 8780”; under it the quiet link „Masz zegarek? Sprawdź, czy kroki mogą przychodzić same →” — tap it.',
      captionPl: 'Masz zegarek? Sprawdź',
      captionEn: 'Got a watch? Check it',
      voPl: 'Codziennie przepisuję kroki z zegarka. Po co?',
      voEn: 'Every day I copy my steps from the watch. Why?',
      edit: 'Hook caption here; highlight the „Masz zegarek?” link before the tap.',
    },
    card: {
      shows: 'Ustawienia → „Zegarek Garmin”: what arrives from the watch, the field „Jaki masz zegarek?”, „Popularne” chips (Forerunner 55/165/265, Venu 3, vívoactive 5, fēnix 7) and „Wszystkie obsługiwane zegarki — 118 modeli”.',
      captionPl: '118 zegarków Garmina',
      captionEn: '118 Garmin watches',
      voPl: 'Karta zegarka. Lista stu osiemnastu modeli Garmina.',
      voEn: 'The watch card. A list of 118 Garmin models.',
      edit: 'Zoom on „118 modeli”.',
    },
    typo: {
      shows: 'Ustawienia → Zegarek Garmin: „Jaki masz zegarek?”. Typed with a typo, „forerunr 265” — suggestions „Forerunner® 265 · obsługiwany” and „Forerunner® 265s · obsługiwany”; tap the first.',
      captionPl: 'Nawet z literówką',
      captionEn: 'Even with a typo',
      voPl: 'Wpisuję model — nawet z literówką aplikacja wie, o który chodzi.',
      voEn: 'I type my model — even with a typo, the app knows which one I mean.',
      edit: 'Zoom on the field and the two suggestions with their green „obsługiwany” tags.',
    },
    answer: {
      shows: 'Answer: „Forerunner® 265 · Obsługiwany” — „Przyjdą same: kroki, przejazdy rowerem, tętno, stres i Body Battery.” and the „Połącz zegarek” button.',
      captionPl: 'Obsługiwany. Kroki przyjdą same',
      captionEn: 'Supported. Steps arrive on their own',
      voPl: 'Obsługiwany. Przyjdą same: kroki, rower, tętno, stres i Body Battery.',
      voEn: 'Supported. Steps, rides, heart rate, stress and Body Battery arrive on their own.',
      edit: 'Highlight the green „Obsługiwany” and the „Przyjdą same” line.',
    },
    connect: {
      shows: 'Tap „Połącz zegarek”: the card switches to the connection — status „Czeka na pierwszą paczkę…”, „Wybrany model: Forerunner® 265 — obsługiwany”, step 1 install from Connect IQ Store.',
      captionPl: 'Połączenie krok po kroku',
      captionEn: 'Connecting, step by step',
      voPl: 'Jedno stuknięcie — i wiem, co dalej.',
      voEn: 'One tap — and I know what to do next.',
      edit: 'Zoom on the status line „Czeka na pierwszą paczkę”.',
    },
    howto: {
      shows: 'Steps 2–4: Garmin Connect → GYM TRACKER settings, paste the key (blurred), open the app on the watch once — data every half hour; „Sprawdź teraz”, „Dane nie przychodzą?”.',
      captionPl: 'Sklep Connect IQ, jeden klucz',
      captionEn: 'Connect IQ Store, one key',
      voPl: 'Aplikacja z Connect IQ, jeden klucz — i dane co pół godziny.',
      voEn: 'An app from Connect IQ, one key — and data every half hour.',
      edit: 'The key is blurred on purpose — keep it blurred. Highlight „potem co pół godziny”.',
    },
    phone: {
      shows: 'Further down, the „Zdrowie z telefonu” card: steps, rides, heart rate, sleep and weight from Apple Zdrowie or Health Connect, also from other brands’ watches; tap „Połącz telefon” — status „Czeka na pierwszą paczkę”.',
      captionPl: 'Inny zegarek? Telefon',
      captionEn: 'Another watch? Your phone',
      voPl: 'Inny zegarek albo sam telefon? Dane przyniesie telefon.',
      voEn: 'Another watch, or just a phone? Your phone brings the data.',
      edit: 'Zoom on the card title and „przyjdą same”.',
    },
    android: {
      shows: 'Phone connection steps: Garmin Connect → Health Connect; „iPhone: aplikacji jeszcze nie ma — na razie dane przyjdą tylko z Androida”; „Android: zainstaluj GYM TRACKER Zdrowie z pliku APK”; key blurred.',
      captionPl: 'Android przez Health Connect',
      captionEn: 'Android via Health Connect',
      voPl: 'Na Androidzie przez Health Connect. Wersja na iPhone’a jeszcze powstaje.',
      voEn: 'On Android, through Health Connect. The iPhone version is still on its way.',
      edit: 'Highlight the honest „iPhone: aplikacji jeszcze nie ma” line; key stays blurred; closing card over the last 2 s.',
    },
  },
};
