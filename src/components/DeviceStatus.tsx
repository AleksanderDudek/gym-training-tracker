import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { SAID, aboutText, agoText, atText, lastPackText, nextText, shortAtText, sinceText } from '../deviceStatus';
import type { Device, DeviceStatus, Level } from '../deviceStatus';
import { hashPath, hashQuery, hashWith } from '../food/hash';
import { lastPullAt, onWatchCheck, watchConnected, watchStatus } from '../garmin';
import { LOCALE, text } from '../i18n';
import { lastPhoneAt, onPhoneCheck, phoneConnected, phoneStatus } from '../phone';
import { SETTINGS_PATH, WATCH_PATH } from '../routing';
import type { AppState } from '../types';

/**
 * Stan połączenia z zegarkiem i telefonem słowami — wspólny dla karty w ustawieniach, linii na
 * ekranie kroków i uwagi na ekranie Dziś. Kolor kropki tylko podpowiada; wszystko, co ważne,
 * stoi w zdaniu, bo kropki nie widać na czytniku ekranu ani przy daltonizmie.
 */

type Os = 'ios' | 'android';

const T = text({
  pl: {
    name: { watch: 'Zegarek', phone: 'Telefon' } as Record<Device, string>,
    setup: {
      watch:
        'Wklej klucz w ustawieniach GYM TRACKER na zegarku i otwórz tam aplikację raz — pierwsza paczka przyjdzie po kilku minutach, gdy telefon jest w pobliżu.',
      phone:
        'Otwórz GYM TRACKER Zdrowie, wklej klucz i zezwól na dostęp do danych — pierwsza paczka wyjdzie od razu.',
    } as Record<Device, string>,
    reason: {
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
    } as Record<Device, Record<'late' | 'stale', string>>,
    statusOk: (last: string | null, next: string) => `Działa — ostatnia paczka ${last}, ${next}.`,
    statusLate: (about: string, last: string | null) =>
      `Kolejna paczka się spóźnia — miała przyjść ${about}. Ostatnia: ${last}.`,
    statusStale: (since: string, at: string) => `Brak danych od ${since} — ostatnia paczka ${at}.`,
    statusSetup: (setup: string) => `Czeka na pierwszą paczkę. ${setup}`,
    statusBad: (bad: string, last: string | null) => `Zły klucz. ${bad}${last ? ` Ostatnia dobra paczka: ${last}.` : ''}`,
    statusOffline: (last: string | null) =>
      `Nie mogę teraz zapytać serwera — sprawdź internet w tym urządzeniu.${last ? ` Ostatnio znane: paczka ${last}.` : ''}`,
    lineOk: (who: string, ago: string | null, next: string) => `${who} działa — ostatnia paczka ${ago}, ${next}.`,
    lineLate: (who: string, about: string) => `${who}: kolejna paczka się spóźnia — miała przyjść ${about}.`,
    lineStale: (who: string, since: string) => `${who}: brak danych od ${since}.`,
    lineSetup: (who: string) => `${who}: czeka na pierwszą paczkę.`,
    lineBad: (who: string) => `${who}: zły klucz — paczka się nie otwiera.`,
    lineOffline: (who: string, ago: string | null) =>
      `${who}: nie mogę teraz zapytać serwera${ago ? ` — ostatnia paczka ${ago}` : ''}.`,
    todaySteps: (from: string, steps: string, at: string) =>
      `Dzisiejsze kroki ${from}: ${steps} (stan z ${at} — rosną z każdą paczką).`,
    noToday: (from: string) => `Dzisiejszych danych ${from} jeszcze nie ma.`,
    checked: (ago: string) => `Sprawdzone ${ago}.`,
    notArriving: 'Dane nie przychodzą?',
    watchChecks: {
      key: (
        <>
          <b>Klucz z tej karty wklejony w ustawieniach GYM TRACKER.</b> W Garmin Connect: zegarek → Aktywności
          i aplikacje → GYM TRACKER → Ustawienia. Te same ustawienia są też w aplikacji Connect IQ Store:
          urządzenie → GYM TRACKER → Ustawienia.
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
    } as Record<WatchCheck, ReactNode>,
    perm: {
      android:
        'Android: Ustawienia → Health Connect → Uprawnienia aplikacji → GYM TRACKER Zdrowie — kroki, sen, tętno, waga i „dostęp w tle”. Bez dostępu w tle paczka wychodzi tylko przy otwarciu aplikacji.',
      ios: 'iPhone: Zdrowie → zdjęcie profilu → Aplikacje → GYM TRACKER Zdrowie — włącz wszystkie dane.',
    } as Record<Os, string>,
    battery: {
      android:
        'Android: Ustawienia → Aplikacje → GYM TRACKER Zdrowie → Bateria → Bez ograniczeń (wyłączona optymalizacja baterii) — inaczej system usypia wysyłkę co godzinę.',
      ios: 'iPhone: Ustawienia → Ogólne → Odświeżanie w tle → GYM TRACKER Zdrowie włączone. Zablokowany iPhone nie oddaje danych zdrowia — paczka wyjdzie po odblokowaniu.',
    } as Record<Os, string>,
    store: { android: 'Health Connect', ios: 'Apple Zdrowie' } as Record<Os, string>,
    or: ' albo ',
    phoneKey: (
      <>
        <b>Klucz z tej karty wklejony w GYM TRACKER Zdrowie</b> przyciskiem „Wklej klucz”.
      </>
    ) as ReactNode,
    phonePerm: (per: string): ReactNode => (
      <>
        <b>GYM TRACKER Zdrowie ma dostęp do danych.</b> {per}
      </>
    ),
    phoneBattery: (per: string): ReactNode => (
      <>
        <b>Aplikacja może działać w tle.</b> {per}
      </>
    ),
    phoneSource: (stores: string): ReactNode => (
      <>
        <b>Garmin Connect (albo inna aplikacja zegarka czy wagi) zapisuje dane w{' '}
        {stores}.</b> W Garmin Connect: Ustawienia → Połączone aplikacje.
        Bez tego telefon ma tylko własne kroki.
      </>
    ),
    phoneOpen: (
      <>
        <b>Otwórz GYM TRACKER Zdrowie i naciśnij „Wyślij teraz”</b> — ekran aplikacji powie, czy paczka wyszła.
      </>
    ) as ReactNode,
    phoneNet: (
      <>
        <b>Telefon ma internet</b> (Wi‑Fi albo dane komórkowe).
      </>
    ) as ReactNode,
    statusLink: 'Stan połączenia →',
    lateNote: (d: Device, since: string) =>
      `${d === 'watch' ? 'Zegarek' : 'Telefon'} nie przysłał danych od ${since} — sprawdź połączenie →`,
  },
  en: {
    name: { watch: 'Watch', phone: 'Phone' },
    setup: {
      watch:
        'Paste the key into the GYM TRACKER settings for your watch and open the app on the watch once — the first upload arrives a few minutes later, with your phone nearby.',
      phone:
        'Open GYM TRACKER Zdrowie, paste the key and allow access to your data — the first upload goes out straight away.',
    },
    reason: {
      watch: {
        late: 'Usually the phone is too far from the watch, Bluetooth is off or the phone has put Garmin Connect to sleep to save battery. Days from the past week won’t be lost — the watch sends the whole week every time.',
        stale:
          'The watch hasn’t sent anything for a few hours. Usually the phone has put Garmin Connect to sleep or Bluetooth is off — go through the “Data not arriving?” list. Days from the past week won’t be lost: the watch sends the whole week.',
      },
      phone: {
        late: 'Usually the phone has put GYM TRACKER Zdrowie to sleep to save battery, or the app can’t read your data in the background. Days from the past two weeks won’t be lost — the phone sends two weeks every time.',
        stale:
          'The phone hasn’t sent anything for a few hours. Usually the system has put GYM TRACKER Zdrowie to sleep or taken away its access to your data — go through the “Data not arriving?” list. Days from the past two weeks won’t be lost.',
      },
    },
    statusOk: (last: string | null, next: string) => `Working — last upload ${last}, ${next}.`,
    statusLate: (about: string, last: string | null) => `The next upload is late — it was due ${about}. Last one: ${last}.`,
    statusStale: (since: string, at: string) => `No data for ${since} — last upload ${at}.`,
    statusSetup: (setup: string) => `Waiting for the first upload. ${setup}`,
    statusBad: (bad: string, last: string | null) => `Wrong key. ${bad}${last ? ` Last good upload: ${last}.` : ''}`,
    statusOffline: (last: string | null) =>
      `Can’t reach the server right now — check this device’s internet connection.${last ? ` Last known: upload ${last}.` : ''}`,
    lineOk: (who: string, ago: string | null, next: string) => `${who}: working — last upload ${ago}, ${next}.`,
    lineLate: (who: string, about: string) => `${who}: the next upload is late — it was due ${about}.`,
    lineStale: (who: string, since: string) => `${who}: no data for ${since}.`,
    lineSetup: (who: string) => `${who}: waiting for the first upload.`,
    lineBad: (who: string) => `${who}: wrong key — the upload won’t open.`,
    lineOffline: (who: string, ago: string | null) =>
      `${who}: can’t reach the server right now${ago ? ` — last upload ${ago}` : ''}.`,
    todaySteps: (from: string, steps: string, at: string) =>
      `Today’s steps ${from}: ${steps} (as of ${at} — they grow with every upload).`,
    noToday: (from: string) => `No data ${from} for today yet.`,
    checked: (ago: string) => `Checked ${ago}.`,
    notArriving: 'Data not arriving?',
    watchChecks: {
      key: (
        <>
          <b>The key from this card is pasted into the GYM TRACKER settings.</b> In Garmin Connect: watch → Activities
          &amp; Apps → GYM TRACKER → Settings. The same settings are also in the Connect IQ Store app: device → GYM
          TRACKER → Settings.
        </>
      ),
      opened: (
        <>
          <b>GYM TRACKER has been opened on the watch at least once.</b> Without that, the watch doesn’t schedule
          background uploads.
        </>
      ),
      bt: (
        <>
          <b>Your phone’s Bluetooth is on, and the watch is paired with Garmin Connect and close to the phone.</b>{' '}
          Uploads go from the watch through the phone — without a connection they wait for the next try.
        </>
      ),
      gc: (
        <>
          <b>Garmin Connect is installed, signed in and allowed to run in the background.</b> Android: Settings → Apps
          → Garmin Connect → Battery → Unrestricted (battery optimisation off). iPhone: Settings → General →
          Background App Refresh → Garmin Connect on.
        </>
      ),
      net: (
        <>
          <b>Your phone has internet</b> (Wi‑Fi or mobile data) — Garmin Connect passes the upload on over the
          phone’s connection.
        </>
      ),
      modes: (
        <>
          <b>On the watch, airplane mode, battery saver and Do Not Disturb are off.</b> Any of them can pause the
          connection to the phone.
        </>
      ),
      screen: (
        <>
          <b>The GYM TRACKER screen on the watch says how the last upload went</b> and when the next one is due:
          “Sent 14:32” — it got through; “No phone - Bluetooth?” — the watch couldn’t see your phone; “Wrong key -
          paste it again” — paste the key again. START sends straight away.
        </>
      ),
    },
    perm: {
      android:
        'Android: Settings → Health Connect → App permissions → GYM TRACKER Zdrowie — steps, sleep, heart rate, weight and “background access”. Without background access, uploads only go out when you open the app.',
      ios: 'iPhone: Health → profile picture → Apps → GYM TRACKER Zdrowie — turn on all data.',
    },
    battery: {
      android:
        'Android: Settings → Apps → GYM TRACKER Zdrowie → Battery → Unrestricted (battery optimisation off) — otherwise the system puts the hourly upload to sleep.',
      ios: 'iPhone: Settings → General → Background App Refresh → GYM TRACKER Zdrowie on. A locked iPhone doesn’t hand over health data — the upload goes out once you unlock it.',
    },
    store: { android: 'Health Connect', ios: 'Apple Health' },
    or: ' or ',
    phoneKey: (
      <>
        <b>The key from this card is pasted into GYM TRACKER Zdrowie</b> with the “Wklej klucz” (Paste key) button.
      </>
    ),
    phonePerm: (per: string): ReactNode => (
      <>
        <b>GYM TRACKER Zdrowie has access to your data.</b> {per}
      </>
    ),
    phoneBattery: (per: string): ReactNode => (
      <>
        <b>The app is allowed to run in the background.</b> {per}
      </>
    ),
    phoneSource: (stores: string): ReactNode => (
      <>
        <b>Garmin Connect (or another watch or scale app) saves data to {stores}.</b> In Garmin Connect: Settings →
        Connected Apps. Without that, the phone only has its own steps.
      </>
    ),
    phoneOpen: (
      <>
        {/* i18n-ignore: przycisk w aplikacji GYM TRACKER Zdrowie, która mówi tylko po polsku */}
        <b>Open GYM TRACKER Zdrowie and tap “Wyślij teraz” (Send now)</b> — the app’s screen will tell you whether the
        upload went out.
      </>
    ),
    phoneNet: (
      <>
        <b>Your phone has internet</b> (Wi‑Fi or mobile data).
      </>
    ),
    statusLink: 'Connection status →',
    lateNote: (d: Device, since: string) =>
      `Your ${d === 'watch' ? 'watch' : 'phone'} hasn’t sent data for ${since} — check the connection →`,
  },
});

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

/** Czy adres wskazuje kartę: `?karta=…`, a karta zegarka także samym `#/zegarek`. */
const pointsAt = (device: Device, hash: string): boolean => {
  const card = hashQuery(hash).get('karta');
  if (card) return card === CARD_ID[device];
  return device === 'watch' && hashPath(hash) === WATCH_PATH;
};

/**
 * Karta przewija się do siebie, gdy przyszło się z linku „Stan połączenia” albo „Czy mój zegarek
 * jest obsługiwany?” (`#/zegarek`). Trasy siedzą w części hash adresu, więc zwykła kotwica
 * (`#zegarek`) zgubiłaby ekran ustawień — kartę wskazuje zapytanie albo adres zegarka.
 * Z opóźnieniem, bo router po zmianie ekranu sam przewija na górę (dwie klatki).
 */
export function useScrollHere(device: Device) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pointsAt(device, window.location.hash)) return;
    const t = window.setTimeout(() => ref.current?.scrollIntoView?.({ block: 'start' }), 150);
    return () => window.clearTimeout(t);
  }, [device]);
  return ref;
}

/**
 * Przejście do karty na tym samym ekranie ustawień („Zdrowie z telefonu” → z wyniku sprawdzania
 * zegarka, „Sprawdź swój model” z karty telefonu). Router pomija zmianę samego zapytania, więc
 * zwykły link by nie przewinął — przewija się tu, a adres dostaje `?karta=…` bez nowego wpisu
 * w historii i bez `hashchange` (jak strony jedzenia), żeby odświeżenie wróciło do tej karty.
 */
export function goToCard(device: Device): void {
  document.getElementById(CARD_ID[device])?.scrollIntoView?.({ block: 'start' });
  const hash = window.location.hash;
  const path = hashPath(hash) === WATCH_PATH ? WATCH_PATH : SETTINGS_PATH;
  const query = hashQuery(hash);
  query.set('karta', CARD_ID[device]);
  const next = hashWith(path, query);
  if (next !== hash) window.history.replaceState(window.history.state, '', next);
}

const NAME: Record<Device, string> = T.name;

/** Co zrobić, zanim przyjdzie pierwsza paczka. */
const SETUP: Record<Device, string> = T.setup;

/** Najczęstsze przyczyny spóźnienia i pocieszenie, że dni nie przepadają. */
const REASON: Record<Device, Record<'late' | 'stale', string>> = T.reason;

/** Jedno zdanie o stanie połączenia — nagłówek karty w ustawieniach. */
export function statusText(device: Device, s: DeviceStatus, now: number): string {
  const last = s.lastAt === null ? null : lastPackText(s.lastAt, now);
  switch (s.level) {
    case 'ok':
      return T.statusOk(last, nextText(s, now));
    case 'late':
      return T.statusLate(aboutText(s.nextAt!, now), last);
    case 'stale':
      return T.statusStale(sinceText(s.minutesSince!), atText(s.lastAt!, now));
    case 'setup':
      return T.statusSetup(SETUP[device]);
    case 'bad':
      return T.statusBad(SAID[device].bad, last);
    case 'offline':
      return T.statusOffline(last);
  }
}

/** Krótka wersja — linia na ekranie kroków i cardio. */
export function lineText(device: Device, s: DeviceStatus, now: number): string {
  const who = NAME[device];
  const ago = s.lastAt === null ? null : agoText(s.lastAt, now);
  switch (s.level) {
    case 'ok':
      return T.lineOk(who, ago, nextText(s, now));
    case 'late':
      return T.lineLate(who, aboutText(s.nextAt!, now));
    case 'stale':
      return T.lineStale(who, sinceText(s.minutesSince!));
    case 'setup':
      return T.lineSetup(who);
    case 'bad':
      return T.lineBad(who);
    case 'offline':
      return T.lineOffline(who, ago);
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
            ? T.todaySteps(from, todaySteps.toLocaleString(LOCALE), shortAtText(s.lastAt, now))
            : T.noToday(from)}
        </p>
      )}
      {checkedAt !== null && <p className="hint dev-checked">{T.checked(agoText(checkedAt, now))}</p>}
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
      <summary>{T.notArriving}</summary>
      <ol className="watch-steps" aria-label={T.notArriving}>
        {items.map((x) => (
          <li key={x.id}>{x.text}</li>
        ))}
      </ol>
    </details>
  );
}

/* ---------------- Lista: zegarek ---------------- */

type WatchCheck = 'key' | 'opened' | 'bt' | 'gc' | 'net' | 'modes' | 'screen';

const WATCH_CHECKS: Record<WatchCheck, ReactNode> = T.watchChecks;

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

const PERM: Record<Os, string> = T.perm;

const BATTERY: Record<Os, string> = T.battery;

const STORE_NAME: Record<Os, string> = T.store;

function phoneCheck(id: PhoneCheck, systems: Os[]): ReactNode {
  const per = (m: Record<Os, string>) => systems.map((os) => m[os]).join(' ');
  switch (id) {
    case 'key':
      return T.phoneKey;
    case 'perm':
      return T.phonePerm(per(PERM));
    case 'battery':
      return T.phoneBattery(per(BATTERY));
    case 'source':
      return T.phoneSource(systems.map((os) => STORE_NAME[os]).join(T.or));
    case 'open':
      return T.phoneOpen;
    case 'net':
      return T.phoneNet;
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
        {lineText(device, status, now)} <a href={deviceCardPath(device)}>{T.statusLink}</a>
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
          {T.lateNote(device, sinceText(s.minutesSince!))}
        </a>
      ))}
    </>
  );
}
