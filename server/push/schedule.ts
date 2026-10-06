/**
 * Kiedy wysłać przypomnienie.
 *
 * Serwer nic nie wie o treningach. Aplikacja na telefonie sama wylicza, co i kiedy ma
 * przypomnieć — poranny trening z planu, wieczorne kroki — i przysyła listę gotowych
 * wiadomości z datą i godziną w swoim czasie lokalnym na najbliższe trzy tygodnie. Serwer
 * tylko pilnuje zegara: co kilka minut sprawdza, czy u kogoś wybiła godzina, i wysyła.
 *
 * Dlatego przy każdym otwarciu aplikacji lista jest świeża, a gdy ktoś przestanie ją
 * otwierać, przypomnienia same się kończą — nie ma czego wyłączać.
 */

export interface ReminderItem {
  /** Rodzaj, np. `trening` albo `ruch`. Jedno przypomnienie danego rodzaju na dzień. */
  tag: string;
  /** Dzień w czasie lokalnym użytkownika, `yyyy-mm-dd`. */
  date: string;
  /** Godzina w czasie lokalnym, `HH:MM`. */
  time: string;
  title: string;
  body: string;
  /** Trasa aplikacji otwierana po stuknięciu, np. `#/cardio`. */
  url: string;
}

export interface SubRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Strefa IANA telefonu, np. `Europe/Warsaw`. */
  tz: string;
  items: ReminderItem[];
  /** Wysłane: `yyyy-mm-dd|tag`. Przeżywa ponowne przesłanie listy tego samego dnia. */
  sent: string[];
  /** Ostatnie przesłanie listy, ms. */
  updated: number;
}

/**
 * Okno wysyłki w minutach. Cron chodzi co pięć minut i bywa opóźniony; telefon bywa poza
 * zasięgiem. Półtorej godziny wystarczy, żeby „dziś trening” doszło rano, a nie w południe.
 */
export const WINDOW_MIN = 90;

/** Po tylu dniach bez otwarcia aplikacji subskrypcja jest kasowana. */
export const STALE_DAYS = 45;

/** Ile dni wstecz trzymać listę wysłanych — dłużej nic się nie powtórzy, bo listy są na przód. */
const SENT_DAYS = 2;

const minutesOf = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Dzień i minuta doby w strefie użytkownika. */
export function localParts(now: Date, tz: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export const sentKey = (i: Pick<ReminderItem, 'date' | 'tag'>): string => `${i.date}|${i.tag}`;

/** Przypomnienia, którym wybiła godzina i których jeszcze nie wysłano. */
export function dueItems(r: SubRecord, now: Date): ReminderItem[] {
  const { date, minutes } = localParts(now, r.tz);
  const sent = new Set(r.sent);
  return r.items.filter((i) => {
    if (i.date !== date || sent.has(sentKey(i))) return false;
    const from = minutesOf(i.time);
    return minutes >= from && minutes < from + WINDOW_MIN;
  });
}

const dayMs = 86_400_000;

export function pruneSent(sent: string[], today: string): string[] {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - SENT_DAYS * dayMs).toISOString().slice(0, 10);
  return sent.filter((k) => k.slice(0, 10) >= from);
}

export const isStale = (r: Pick<SubRecord, 'updated'>, now: number): boolean => now - r.updated > STALE_DAYS * dayMs;
