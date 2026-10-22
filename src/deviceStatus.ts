import { LOCALE, pluralEn, text } from './i18n';
import type { BoxResult } from './mailbox';

/**
 * Stan połączenia z urządzeniem — zegarkiem albo telefonem — jednym modelem dla każdego miejsca,
 * które o nim mówi: karty w ustawieniach, linii na ekranie kroków i uwagi na ekranie Dziś.
 *
 * Liczy się czas, w którym urządzenie zrobiło ostatnią paczkę (`t` z paczki), a nie to, kiedy
 * ta przeglądarka ją odebrała: paczka sprzed ośmiu godzin odebrana przed chwilą to nadal dane
 * sprzed ośmiu godzin. Do tego wynik ostatniego pytania serwera — zły klucz i brak sieci mówią
 * więcej niż sam zegar.
 */

export type Level = 'setup' | 'ok' | 'late' | 'stale' | 'bad' | 'offline';

/** Co ile minut wysyła urządzenie: zegarek co pół godziny, aplikacja na telefonie co godzinę. */
export const WATCH_EVERY_MIN = 30;
export const PHONE_EVERY_MIN = 60;

/**
 * Zapas na spóźnienie, zanim cokolwiek nazwiemy spóźnieniem. Zegarek planuje przebieg w tle
 * „nie wcześniej niż za 30 min”, a system potrafi go przesunąć o kilka minut — kwadrans
 * spokoju to mniej fałszywych alarmów niż ostrzeżenie co drugą godzinę.
 */
export const GRACE_MIN = 15;

/** Spóźnienie dłuższe niż sześć godzin to już nie „za chwilę przyjdzie”, tylko coś się zepsuło. */
export const STALE_AFTER_MIN = 6 * 60;

export interface DeviceInput {
  /** Kiedy urządzenie zrobiło ostatnią paczkę — sekundy, według jego zegara. */
  lastT: number | null;
  /** Kiedy ta przeglądarka ją odebrała — zapas, gdyby czasu paczki zabrakło. */
  got: string | null;
  /** Wynik ostatniego pytania serwera w tej karcie przeglądarki. */
  kind: BoxResult<unknown>['kind'] | null;
  hasKey: boolean;
  nowMs: number;
  cadenceMin: number;
}

export interface DeviceStatus {
  level: Level;
  /** Ostatnia paczka (ms) albo `null`, gdy jeszcze nic nie przyszło. */
  lastAt: number | null;
  /** Kiedy powinna przyjść następna (ms). */
  nextAt: number | null;
  minutesSince: number | null;
  /** O ile minut następna paczka już się spóźnia — 0, gdy jeszcze na nią za wcześnie. */
  overdueMin: number;
}

const MIN = 60_000;

export function deviceStatus(i: DeviceInput): DeviceStatus {
  const gotMs = i.got ? Date.parse(i.got) : NaN;
  const lastAt = i.lastT !== null ? i.lastT * 1000 : Number.isNaN(gotMs) ? null : gotMs;
  const nextAt = lastAt === null ? null : lastAt + i.cadenceMin * MIN;
  // Zegar urządzenia może się spieszyć — paczka „z przyszłości” jest po prostu świeża.
  const minutesSince = lastAt === null ? null : Math.max(0, Math.floor((i.nowMs - lastAt) / MIN));
  const overdueMin = nextAt === null ? 0 : Math.max(0, Math.floor((i.nowMs - nextAt) / MIN));
  const base = { lastAt, nextAt, minutesSince, overdueMin };
  // Zły klucz i brak sieci przed zegarem: przy nich czas ostatniej paczki niczego nie wyjaśnia,
  // ale zostaje do pokazania — „ostatnio znane”.
  if (!i.hasKey) return { level: 'setup', ...base };
  if (i.kind === 'bad') return { level: 'bad', ...base };
  if (i.kind === 'offline') return { level: 'offline', ...base };
  if (lastAt === null) return { level: 'setup', ...base };
  if (overdueMin <= GRACE_MIN) return { level: 'ok', ...base };
  if (overdueMin <= STALE_AFTER_MIN) return { level: 'late', ...base };
  return { level: 'stale', ...base };
}

/* ---------------- Słowa ---------------- */

const pad = (n: number): string => String(n).padStart(2, '0');

interface Said {
  who: string;
  every: string;
  sendNow: string;
  empty: string;
  bad: string;
  offline: string;
}

const T = text({
  pl: {
    today: 'dziś',
    yesterday: 'wczoraj',
    tomorrow: 'jutro',
    date: (d: Date) => `${d.getDate()}.${pad(d.getMonth() + 1)}`,
    about: (clock: string, day: string | null) => (day === null ? `ok. ${clock}` : `${day} ok. ${clock}`),
    justNow: 'przed chwilą',
    minAgo: (min: number) => `${min} min temu`,
    hoursAgo: (h: number) => `${h} godz. temu`,
    sinceMin: (min: number) => `${min} min`,
    sinceHours: (h: number) => `${h} godz.`,
    sinceDays: (days: number) => (days === 1 ? 'doby' : `${days} dni`),
    nextSoon: 'następna lada chwila',
    next: (about: string) => `następna ${about}`,
    said: {
      watch: {
        who: 'zegarek',
        every: 'zegarek wysyła co ok. 30 min',
        sendNow: 'Otwórz GYM TRACKER na zegarku i naciśnij START.',
        empty:
          'Zegarek jeszcze nic nie przysłał. Dane przychodzą kilka minut po otwarciu aplikacji na zegarku, gdy telefon jest w pobliżu.',
        bad: 'Paczka z zegarka nie otwiera się tym kluczem — na zegarku jest pewnie inny. Wklej klucz z tej karty jeszcze raz.',
        offline: 'Serwer nie odpowiada albo nie ma sieci. Spróbuję znów przy następnym otwarciu aplikacji.',
      },
      phone: {
        who: 'telefon',
        every: 'telefon wysyła mniej więcej co godzinę',
        sendNow: 'Otwórz GYM TRACKER Zdrowie i naciśnij „Wyślij teraz”.',
        empty:
          'Telefon jeszcze nic nie przysłał. Otwórz GYM TRACKER Zdrowie, wklej klucz i zezwól na dostęp do danych — pierwsza paczka wyjdzie od razu.',
        bad: 'Paczka z telefonu nie otwiera się tym kluczem — w aplikacji na telefonie jest pewnie inny. Wklej klucz z tej karty jeszcze raz.',
        offline: 'Serwer nie odpowiada albo nie ma sieci. Spróbuję znów przy następnym otwarciu aplikacji.',
      },
    } as Record<Device, Said>,
    arrived: (at: string) => `Przyszła nowa paczka (${at}).`,
    noNew: (at: string, s: Said) => `Bez nowej paczki — ostatnia z ${at}, ${s.every}. Chcesz teraz? ${s.sendNow}`,
    serverEmpty: (s: Said) =>
      `Na serwerze nie ma żadnej paczki — ${s.who} nic nie wysłał od ponad tygodnia. Zajrzyj do „Dane nie przychodzą?”.`,
    later: 'Spróbuj za chwilę.',
  },
  en: {
    today: 'today',
    yesterday: 'yesterday',
    tomorrow: 'tomorrow',
    date: (d: Date) => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }),
    about: (clock: string, day: string | null) => (day === null ? `around ${clock}` : `${day} around ${clock}`),
    justNow: 'just now',
    minAgo: (min: number) => `${min} min ago`,
    hoursAgo: (h: number) => `${h} ${pluralEn(h, 'hour', 'hours')} ago`,
    sinceMin: (min: number) => `${min} min`,
    sinceHours: (h: number) => `${h} ${pluralEn(h, 'hour', 'hours')}`,
    sinceDays: (days: number) => (days === 1 ? 'a day' : `${days} days`),
    nextSoon: 'next one any moment',
    next: (about: string) => `next ${about}`,
    said: {
      watch: {
        who: 'the watch',
        every: 'the watch sends every 30 min or so',
        sendNow: 'Open GYM TRACKER on the watch and press START.',
        empty:
          'The watch hasn’t sent anything yet. Data arrives a few minutes after you open the app on the watch, with your phone nearby.',
        bad: 'The watch’s upload won’t open with this key — the watch probably has a different one. Paste the key from this card again.',
        offline: 'The server isn’t responding or you’re offline. I’ll try again next time you open the app.',
      },
      phone: {
        who: 'the phone',
        every: 'the phone sends roughly every hour',
        // i18n-ignore: przycisk w aplikacji GYM TRACKER Zdrowie, która mówi tylko po polsku
        sendNow: 'Open GYM TRACKER Zdrowie and tap “Wyślij teraz” (Send now).',
        empty:
          'The phone hasn’t sent anything yet. Open GYM TRACKER Zdrowie, paste the key and allow access to your data — the first upload goes out straight away.',
        bad: 'The phone’s upload won’t open with this key — the app on your phone probably has a different one. Paste the key from this card again.',
        offline: 'The server isn’t responding or you’re offline. I’ll try again next time you open the app.',
      },
    },
    arrived: (at: string) => `A new upload arrived (${at}).`,
    noNew: (at: string, s: Said) => `No new upload — the last one is from ${at}; ${s.every}. Want one now? ${s.sendNow}`,
    serverEmpty: (s: Said) =>
      `There’s no upload on the server — ${s.who} hasn’t sent anything for over a week. Check “Data not arriving?”.`,
    later: 'Try again in a moment.',
  },
});

/** „14:05” według zegara tej przeglądarki. */
export const clockText = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getHours()}:${pad(d.getMinutes())}`;
};

/** Ile dni kalendarzowych dzieli dwie chwile — `-1` to wczoraj, `1` jutro. */
const dayDiff = (ms: number, nowMs: number): number => {
  const a = new Date(ms);
  const b = new Date(nowMs);
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(a) - day(b)) / 86_400_000);
};

const dayWord = (ms: number, nowMs: number): string => {
  const diff = dayDiff(ms, nowMs);
  if (diff === 0) return T.today;
  if (diff === -1) return T.yesterday;
  if (diff === 1) return T.tomorrow;
  return T.date(new Date(ms));
};

/** „dziś 14:32”, „wczoraj 21:40”, „1.10 21:40”. */
export const atText = (ms: number, nowMs: number): string => `${dayWord(ms, nowMs)} ${clockText(ms)}`;

/** „14:32” dla dzisiejszej chwili, „wczoraj 21:40” dla innej — gdy dzień jest oczywisty z kontekstu. */
export const shortAtText = (ms: number, nowMs: number): string =>
  dayDiff(ms, nowMs) === 0 ? clockText(ms) : atText(ms, nowMs);

/** „ok. 15:02”, a dla innego dnia „jutro ok. 0:20” albo „wczoraj ok. 23:40”. */
export const aboutText = (ms: number, nowMs: number): string =>
  T.about(clockText(ms), dayDiff(ms, nowMs) === 0 ? null : dayWord(ms, nowMs));

/**
 * Czas względny: „przed chwilą”, „12 min temu”, „2 godz. temu”, a od wczoraj już data z godziną
 * („wczoraj 21:40”) — „26 godz. temu” trzeba by przeliczać w głowie.
 */
export function agoText(ms: number, nowMs: number): string {
  const min = Math.floor((nowMs - ms) / MIN);
  if (min < 1) return T.justNow;
  if (min < 60) return T.minAgo(min);
  if (dayDiff(ms, nowMs) === 0) return T.hoursAgo(Math.floor(min / 60));
  return atText(ms, nowMs);
}

/**
 * Ostatnia paczka z godziną i czasem względnym: „dziś 14:32 (12 min temu)”. Od wczoraj sama data
 * z godziną — „wczoraj 21:40 (wczoraj 21:40)” byłoby tym samym dwa razy.
 */
export function lastPackText(ms: number, nowMs: number): string {
  const at = atText(ms, nowMs);
  const ago = agoText(ms, nowMs);
  return ago === at ? at : `${at} (${ago})`;
}

/** Jak długo nic nie przyszło: „7 godz.”, „doby”, „3 dni” — do „Brak danych od …”. */
export function sinceText(minutes: number): string {
  const hours = Math.round(minutes / 60);
  if (hours < 1) return T.sinceMin(Math.max(1, minutes));
  if (hours < 24) return T.sinceHours(hours);
  return T.sinceDays(Math.floor(minutes / 1440));
}

/** „następna ok. 15:02” albo „następna lada chwila”, gdy jej pora już minęła. */
export function nextText(s: DeviceStatus, nowMs: number): string {
  if (s.nextAt === null) return T.nextSoon;
  return s.nextAt <= nowMs ? T.nextSoon : T.next(aboutText(s.nextAt, nowMs));
}

/* ---------------- Po „Sprawdź teraz” ---------------- */

export type Device = 'watch' | 'phone';

/** Teksty, które różnią zegarek od telefonu — reszta zdań jest wspólna. */
export const SAID: Record<Device, Said> = T.said;

/**
 * Co powiedzieć po „Sprawdź teraz”. Samo „sprawdzone” nic nie mówi — ważne, czy przyszła NOWA
 * paczka. `beforeT` to czas paczki, którą karta pokazywała przed naciśnięciem: ta sama paczka
 * drugi raz to „bez nowej”, nawet jeśli serwer odpowiedział poprawnie.
 */
export function checkSaid(device: Device, beforeT: number | null, r: BoxResult<{ t: number }>, nowMs: number): string {
  const s = SAID[device];
  switch (r.kind) {
    case 'ok': {
      const at = shortAtText(r.payload.t * 1000, nowMs);
      return beforeT === null || r.payload.t > beforeT ? T.arrived(at) : T.noNew(at, s);
    }
    case 'empty':
      // Pusta skrzynka przy danych w zapisie: serwer trzyma paczkę najwyżej tydzień od ostatniej
      // wysyłki, więc urządzenie milczy od ponad tygodnia.
      return beforeT === null ? s.empty : T.serverEmpty(s);
    case 'bad':
      return s.bad;
    case 'offline':
      return s.offline;
    default:
      return T.later;
  }
}
