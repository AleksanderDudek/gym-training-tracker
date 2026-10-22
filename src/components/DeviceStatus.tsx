import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { SAID, aboutText, agoText, atText, lastPackText, nextText, shortAtText, sinceText } from '../deviceStatus';
import type { Device, DeviceStatus, Level } from '../deviceStatus';
import { hashQuery } from '../food/hash';
import { lastPullAt, onWatchCheck, watchConnected, watchStatus } from '../garmin';
import { lastPhoneAt, onPhoneCheck, phoneConnected, phoneStatus } from '../phone';
import { SETTINGS_PATH } from '../routing';
import type { AppState } from '../types';

/**
 * Stan połączenia z zegarkiem i telefonem słowami — wspólny dla karty w ustawieniach, linii na
 * ekranie kroków i uwagi na ekranie Dziś. Kolor kropki tylko podpowiada; wszystko, co ważne,
 * stoi w zdaniu, bo kropki nie widać na czytniku ekranu ani przy daltonizmie.
 */

type Subscribe = (f: () => void) => () => void;

/**
 * Bieżący czas dla „12 min temu”: odświeżany co pół minuty i po każdym pytaniu serwera. Bez
 * tego karta otwarta przez kwadrans dalej mówiłaby „przed chwilą”, a odbiór bez nowej paczki
 * (zapis się nie zmienia) nie przerysowałby niczego.
 */
export function useNow(subscribe: Subscribe, everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = window.setInterval(tick, everyMs);
    const off = subscribe(tick);
    return () => {
      window.clearInterval(t);
      off();
    };
  }, [subscribe, everyMs]);
  return now;
}

/** Oba urządzenia naraz — dla ekranów, które mówią o każdym z nich. */
export const onAnyCheck: Subscribe = (f) => {
  const a = onWatchCheck(f);
  const b = onPhoneCheck(f);
  return () => {
    a();
    b();
  };
};

/** Kotwica karty w ustawieniach — w adresie jako `#/ustawienia?karta=zegarek`. */
export const CARD_ID: Record<Device, string> = { watch: 'zegarek', phone: 'telefon' };

export const deviceCardPath = (d: Device): string => `${SETTINGS_PATH}?karta=${CARD_ID[d]}`;

/**
 * Karta przewija się do siebie, gdy przyszło się z linku „Stan połączenia”. Trasy siedzą w
 * części hash adresu, więc zwykła kotwica (`#zegarek`) zgubiłaby ekran ustawień — kartę wskazuje
 * zapytanie. Z opóźnieniem, bo router po zmianie ekranu sam przewija na górę (dwie klatki).
 */
export function useScrollHere(device: Device) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hashQuery(window.location.hash).get('karta') !== CARD_ID[device]) return;
    const t = window.setTimeout(() => ref.current?.scrollIntoView?.({ block: 'start' }), 150);
    return () => window.clearTimeout(t);
  }, [device]);
  return ref;
}

const NAME: Record<Device, string> = { watch: 'Zegarek', phone: 'Telefon' };

/** Co zrobić, zanim przyjdzie pierwsza paczka. */
const SETUP: Record<Device, string> = {
  watch:
    'Wklej klucz w ustawieniach GYM TRACKER na zegarku i otwórz tam aplikację raz — pierwsza paczka przyjdzie po kilku minutach, gdy telefon jest w pobliżu.',
  phone:
    'Otwórz GYM TRACKER Zdrowie, wklej klucz i zezwól na dostęp do danych — pierwsza paczka wyjdzie od razu.',
};

/** Najczęstsze przyczyny spóźnienia i pocieszenie, że dni nie przepadają. */
const REASON: Record<Device, Record<'late' | 'stale', string>> = {
  watch: {
    late: 'Najczęściej telefon jest za daleko od zegarka, Bluetooth jest wyłączony albo telefon uśpił Garmin Connect, żeby oszczędzać baterię. Dni z ostatniego tygodnia nie przepadną — zegarek za każdym razem wysyła cały tydzień.',
    stale:
      'Zegarek od kilku godzin nic nie wysłał. Najczęściej telefon uśpił Garmin Connect albo Bluetooth jest wyłączony — przejdź po liście „Dane nie przychodzą?”. Dni z ostatniego tygodnia nie przepadną: zegarek wysyła cały tydzień.',
  },
  phone: {
    late: 'Najczęściej telefon uśpił GYM TRACKER Zdrowie, żeby oszczędzać baterię, albo aplikacja nie ma dostępu do danych w tle. Dni z ostatnich dwóch tygodni nie przepadną — telefon za każdym razem wysyła dwa tygodnie.',
    stale:
      'Telefon od kilku godzin nic nie wysłał. Najczęściej system uśpił GYM TRACKER Zdrowie albo cofnął jej dostęp do danych — przejdź po liście „Dane nie przychodzą?”. Dni z ostatnich dwóch tygodni nie przepadną.',
  },
};

/** Jedno zdanie o stanie połączenia — nagłówek karty w ustawieniach. */
export function statusText(device: Device, s: DeviceStatus, now: number): string {
  const last = s.lastAt === null ? null : lastPackText(s.lastAt, now);
  switch (s.level) {
    case 'ok':
      return `Działa — ostatnia paczka ${last}, ${nextText(s, now)}.`;
    case 'late':
      return `Kolejna paczka się spóźnia — miała przyjść ${aboutText(s.nextAt!, now)}. Ostatnia: ${last}.`;
    case 'stale':
      return `Brak danych od ${sinceText(s.minutesSince!)} — ostatnia paczka ${atText(s.lastAt!, now)}.`;
    case 'setup':
      return `Czeka na pierwszą paczkę. ${SETUP[device]}`;
    case 'bad':
      return `Zły klucz. ${SAID[device].bad}${last ? ` Ostatnia dobra paczka: ${last}.` : ''}`;
    case 'offline':
      return `Nie mogę teraz zapytać serwera — sprawdź internet w tym urządzeniu.${last ? ` Ostatnio znane: paczka ${last}.` : ''}`;
  }
}

/** Krótka wersja — linia na ekranie kroków i cardio. */
export function lineText(device: Device, s: DeviceStatus, now: number): string {
  const who = NAME[device];
  const ago = s.lastAt === null ? null : agoText(s.lastAt, now);
  switch (s.level) {
    case 'ok':
      return `${who} działa — ostatnia paczka ${ago}, ${nextText(s, now)}.`;
    case 'late':
      return `${who}: kolejna paczka się spóźnia — miała przyjść ${aboutText(s.nextAt!, now)}.`;
    case 'stale':
      return `${who}: brak danych od ${sinceText(s.minutesSince!)}.`;
    case 'setup':
      return `${who}: czeka na pierwszą paczkę.`;
    case 'bad':
      return `${who}: zły klucz — paczka się nie otwiera.`;
    case 'offline':
      return `${who}: nie mogę teraz zapytać serwera${ago ? ` — ostatnia paczka ${ago}` : ''}.`;
  }
}

function Dot() {
  return <span className="dev-dot" aria-hidden="true" />;
}

/**
 * Stan na górze karty: kropka i zdanie, przy spóźnieniu przyczyny, dzisiejsze kroki z urządzenia
 * i to, kiedy ostatnio pytaliśmy serwer.
 */
export function StatusBlock({
  device,
  status,
  now,
  from,
  todaySteps,
  checkedAt,
}: {
  device: Device;
  status: DeviceStatus;
  now: number;
  /** „z zegarka”, „z telefonu (Zdrowie)” — skąd są dzisiejsze kroki. */
  from: string;
  todaySteps: number | null;
  checkedAt: number | null;
}) {
  const s = status;
  return (
    <>
      <div className={`dev-status ${s.level}`}>
        <Dot />
        <p className="tight">{statusText(device, s, now)}</p>
      </div>
      {(s.level === 'late' || s.level === 'stale') && <p className="tight">{REASON[device][s.level]}</p>}
      {s.lastAt !== null && (
        <p className="tight">
          {todaySteps !== null
            ? `Dzisiejsze kroki ${from}: ${todaySteps.toLocaleString('pl-PL')} (stan z ${shortAtText(s.lastAt, now)} — rosną z każdą paczką).`
            : `Dzisiejszych danych ${from} jeszcze nie ma.`}
        </p>
      )}
      {checkedAt !== null && <p className="hint dev-checked">Sprawdzone {agoText(checkedAt, now)}.</p>}
    </>
  );
}

/**
 * Lista „Dane nie przychodzą?” — rozwinięta, gdy dane się spóźniają albo jeszcze nie przyszły.
 * Przed pierwszą paczką dopiero wtedy, gdy serwer już raz zapytano: tuż po „Połącz” obok stoją
 * kroki połączenia, a rozwinięte „nie przychodzą?” straszyłoby, zanim ktokolwiek coś wysłał.
 */
export function Checklist({
  level,
  checked,
  items,
}: {
  level: Level;
  checked: boolean;
  items: { id: string; text: ReactNode }[];
}) {
  return (
    <details className="dev-check" open={level === 'late' || level === 'stale' || (level === 'setup' && checked)}>
      <summary>Dane nie przychodzą?</summary>
      <ol className="watch-steps" aria-label="Dane nie przychodzą?">
        {items.map((x) => (
          <li key={x.id}>{x.text}</li>
        ))}
      </ol>
    </details>
  );
}

/* ---------------- Lista: zegarek ---------------- */

type WatchCheck = 'key' | 'opened' | 'bt' | 'gc' | 'net' | 'modes' | 'screen';

const WATCH_CHECKS: Record<WatchCheck, ReactNode> = {
  key: (
    <>
      <b>Klucz z tej karty wklejony w ustawieniach GYM TRACKER.</b> W Garmin Connect: zegarek → Aktywności
      i aplikacje → GYM TRACKER → Ustawienia. W wersji testowej (beta) te ustawienia są w aplikacji Connect IQ
      Store: urządzenie → GYM TRACKER → Ustawienia.
    </>
  ),
  opened: (
    <>
      <b>GYM TRACKER otwarty choć raz na zegarku.</b> Bez tego zegarek nie planuje wysyłek w tle.
    </>
  ),
  bt: (
    <>
      <b>Bluetooth na telefonie włączony, zegarek połączony z Garmin Connect i blisko telefonu.</b> Paczka idzie
      z zegarka przez telefon — bez połączenia czeka na następną próbę.
    </>
  ),
  gc: (
    <>
      <b>Garmin Connect zainstalowany, zalogowany i może działać w tle.</b> Android: Ustawienia → Aplikacje →
      Garmin Connect → Bateria → Bez ograniczeń (wyłączona optymalizacja baterii). iPhone: Ustawienia → Ogólne →
      Odświeżanie w tle → Garmin Connect włączone.
    </>
  ),
  net: (
    <>
      <b>Telefon ma internet</b> (Wi‑Fi albo dane komórkowe) — Garmin Connect wysyła paczkę dalej przez sieć
      telefonu.
    </>
  ),
  modes: (
    <>
      <b>Na zegarku wyłączone: tryb samolotowy, oszczędzanie energii i Nie przeszkadzać.</b> Każdy z nich potrafi
      wstrzymać połączenie z telefonem.
    </>
  ),
  screen: (
    <>
      <b>Ekran GYM TRACKER na zegarku mówi, jak poszła ostatnia wysyłka</b> i kiedy następna: „Wysłane 14:32”
      (Sent) — doszła; „Brak telefonu - Bluetooth?” (No phone) — zegarek nie widział telefonu; „Zły klucz” (Wrong
      key) — wklej klucz jeszcze raz. START wysyła od razu.
    </>
  ),
};

/** Najbardziej prawdopodobna przyczyna na górze — inna, gdy nic jeszcze nie przyszło, a inna, gdy przestało. */
const WATCH_ORDER: Record<Level, WatchCheck[]> = {
  setup: ['key', 'opened', 'bt', 'gc', 'net', 'screen', 'modes'],
  late: ['bt', 'gc', 'screen', 'net', 'modes', 'opened', 'key'],
  stale: ['gc', 'bt', 'modes', 'screen', 'opened', 'net', 'key'],
  bad: ['key', 'screen', 'bt', 'gc', 'net', 'modes', 'opened'],
  ok: ['screen', 'bt', 'gc', 'net', 'modes', 'opened', 'key'],
  offline: ['screen', 'bt', 'gc', 'net', 'modes', 'opened', 'key'],
};

export const watchChecks = (level: Level) => WATCH_ORDER[level].map((id) => ({ id, text: WATCH_CHECKS[id] }));

/* ---------------- Lista: telefon ---------------- */

type PhoneCheck = 'key' | 'perm' | 'battery' | 'source' | 'open' | 'net';
type Os = 'ios' | 'android';

const PERM: Record<Os, string> = {
  android:
    'Android: Ustawienia → Health Connect → Uprawnienia aplikacji → GYM TRACKER Zdrowie — kroki, sen, tętno, waga i „dostęp w tle”. Bez dostępu w tle paczka wychodzi tylko przy otwarciu aplikacji.',
  ios: 'iPhone: Zdrowie → zdjęcie profilu → Aplikacje → GYM TRACKER Zdrowie — włącz wszystkie dane.',
};

const BATTERY: Record<Os, string> = {
  android:
    'Android: Ustawienia → Aplikacje → GYM TRACKER Zdrowie → Bateria → Bez ograniczeń (wyłączona optymalizacja baterii) — inaczej system usypia wysyłkę co godzinę.',
  ios: 'iPhone: Ustawienia → Ogólne → Odświeżanie w tle → GYM TRACKER Zdrowie włączone. Zablokowany iPhone nie oddaje danych zdrowia — paczka wyjdzie po odblokowaniu.',
};

const STORE_NAME: Record<Os, string> = { android: 'Health Connect', ios: 'Apple Zdrowie' };

function phoneCheck(id: PhoneCheck, systems: Os[]): ReactNode {
  const per = (m: Record<Os, string>) => systems.map((os) => m[os]).join(' ');
  switch (id) {
    case 'key':
      return (
        <>
          <b>Klucz z tej karty wklejony w GYM TRACKER Zdrowie</b> przyciskiem „Wklej klucz”.
        </>
      );
    case 'perm':
      return (
        <>
          <b>GYM TRACKER Zdrowie ma dostęp do danych.</b> {per(PERM)}
        </>
      );
    case 'battery':
      return (
        <>
          <b>Aplikacja może działać w tle.</b> {per(BATTERY)}
        </>
      );
    case 'source':
      return (
        <>
          <b>Garmin Connect (albo inna aplikacja zegarka czy wagi) zapisuje dane w{' '}
          {systems.map((os) => STORE_NAME[os]).join(' albo ')}.</b> W Garmin Connect: Ustawienia → Połączone aplikacje.
          Bez tego telefon ma tylko własne kroki.
        </>
      );
    case 'open':
      return (
        <>
          <b>Otwórz GYM TRACKER Zdrowie i naciśnij „Wyślij teraz”</b> — ekran aplikacji powie, czy paczka wyszła.
        </>
      );
    case 'net':
      return (
        <>
          <b>Telefon ma internet</b> (Wi‑Fi albo dane komórkowe).
        </>
      );
  }
}

const PHONE_ORDER: Record<Level, PhoneCheck[]> = {
  setup: ['key', 'perm', 'open', 'source', 'net', 'battery'],
  late: ['battery', 'net', 'open', 'perm', 'source', 'key'],
  stale: ['battery', 'perm', 'open', 'source', 'net', 'key'],
  bad: ['key', 'open', 'perm', 'battery', 'source', 'net'],
  ok: ['open', 'perm', 'battery', 'source', 'net', 'key'],
  offline: ['open', 'perm', 'battery', 'source', 'net', 'key'],
};

export const phoneChecks = (level: Level, systems: Os[]) =>
  PHONE_ORDER[level].map((id) => ({ id, text: phoneCheck(id, systems) }));

/* ---------------- Poza ustawieniami ---------------- */

/** Jedna linia stanu nad danymi z urządzenia na ekranie kroków i cardio — z drogą do karty. */
export function DeviceLine({ device, status, now }: { device: Device; status: DeviceStatus; now: number }) {
  return (
    <div className={`dev-status dev-line ${status.level}`}>
      <Dot />
      <p className="tight">
        {lineText(device, status, now)} <a href={deviceCardPath(device)}>Stan połączenia →</a>
      </p>
    </div>
  );
}

/**
 * Uwaga na karcie „Kroki i cardio” na ekranie Dziś — tylko przy spóźnieniu, nigdy „wszystko
 * w porządku”. I dopiero po pytaniu serwera w tej wizycie: zaraz po otwarciu zapis ma jeszcze
 * wczorajszą paczkę, a nowa może właśnie czekać na serwerze.
 */
export function LateNotes({ state, now }: { state: AppState; now: number }) {
  const notes: { device: Device; s: DeviceStatus }[] = [];
  if (watchConnected() && lastPullAt() !== null) notes.push({ device: 'watch', s: watchStatus(state, now) });
  if (phoneConnected() && lastPhoneAt() !== null) notes.push({ device: 'phone', s: phoneStatus(state, now) });
  const late = notes.filter((n) => n.s.level === 'late' || n.s.level === 'stale');
  if (!late.length) return null;
  return (
    <>
      {late.map(({ device, s }) => (
        <a key={device} className="vidlink dev-late" href={deviceCardPath(device)}>
          {NAME[device]} nie przysłał danych od {sinceText(s.minutesSince!)} — sprawdź połączenie →
        </a>
      ))}
    </>
  );
}
