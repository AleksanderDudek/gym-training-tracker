import { useState } from 'react';
import type { ReactNode } from 'react';
import { checkSaid } from '../deviceStatus';
import { localDayOf } from '../engine/watch';
import {
  HEALTH_ANDROID_URL,
  HEALTH_IOS_URL,
  forgetPhone,
  lastPhoneAt,
  onPhoneCheck,
  phoneConfigured,
  phoneKey,
  phoneStatus,
  platformOf,
  savePhoneKey,
} from '../phone';
import type { PhonePull } from '../phone';
import { text } from '../i18n';
import { cleanKey, newKey } from '../watchseal';
import type { AppState } from '../types';
import { CARD_ID, Checklist, StatusBlock, phoneChecks, useNow, useScrollHere } from './DeviceStatus';

/**
 * Karta „Zdrowie z telefonu” w ustawieniach: połączenie z aplikacją GYM TRACKER Zdrowie, klucz
 * do skopiowania, stan i odłączenie.
 *
 * Klucz przechodzi przez schowek, jak do zegarka. Link z kluczem otwierający aplikację byłby
 * wygodniejszy o jedno stuknięcie, ale własny schemat adresu może zarejestrować każda inna
 * aplikacja i dostałaby klucz do danych o zdrowiu.
 *
 * Po połączeniu karta mówi to samo co karta zegarka: kiedy ostatnia paczka, kiedy następna, czy
 * „Sprawdź teraz” przyniosło nową — i co sprawdzić na telefonie, gdy nie.
 */

const T = text({
  pl: {
    iosData: 'Zdrowie',
    appleHealth: 'Apple Zdrowie',
    whereIos: 'App Store',
    whereAndroid: 'pliku APK',
    or: ' albo ',
    garminStep: (stores: string): ReactNode => (
      <>
        Masz zegarek Garmin? W aplikacji Garmin Connect na telefonie włącz udostępnianie do{' '}
        {stores} (Ustawienia → Połączone aplikacje). Garmin
        Connect przekaże tam kroki, sen, tętno, wagę i treningi z zegarka.
      </>
    ),
    install: (phone: string, link: ReactNode): ReactNode => (
      <>
        {phone}: zainstaluj GYM TRACKER Zdrowie z{' '}
        {link}
        .
      </>
    ),
    noApp: (phone: string, os: 'ios' | 'android') =>
      `${phone}: aplikacji jeszcze nie ma — na razie dane przyjdą tylko z ${os === 'ios' ? 'Androida' : 'iPhone’a'}.`,
    saveFailed: 'Nie udało się zapisać klucza w tej przeglądarce.',
    copied: 'Klucz skopiowany — wklej go w aplikacji GYM TRACKER Zdrowie.',
    copyFailed: 'Nie udało się skopiować — zaznacz klucz w polu i skopiuj go ręcznie.',
    disconnected: 'Telefon odłączony. Dane, które już przyszły, zostają w historii. W aplikacji na telefonie naciśnij też „Odłącz”.',
    title: 'Zdrowie z telefonu',
    intro: (
      <>
        Kroki, przejazdy rowerem, tętno, sen i waga z Apple Zdrowie (iPhone) albo Health Connect (Android)
        przyjdą same — razem z tym, co zapisują tam zegarki i wagi innych firm.{' '}
        <b>Masz zegarek Garmin? To najprostsza droga:</b> aplikacja Garmin Connect przekaże jego dane przez
        telefon. Strona nie ma dostępu do tych danych, więc czyta je mała aplikacja GYM TRACKER Zdrowie.
      </>
    ) as ReactNode,
    connect: 'Połącz telefon',
    haveKey: 'Mam już klucz z innego urządzenia',
    badKey: 'Klucz to 64 znaki: cyfry i litery od a do f.',
    otherKey: 'klucz z drugiego urządzenia',
    saveKey: 'Zapisz klucz',
    cancel: 'Anuluj',
    from: (source: string | null) => (source ? `z telefonu (${source})` : 'z telefonu'),
    steps: 'Kroki połączenia',
    pasteKey: 'Skopiuj ten klucz i wklej go w aplikacji przyciskiem „Wklej klucz”:',
    keyLabel: 'Klucz do aplikacji na telefonie',
    copyKey: 'Kopiuj klucz',
    allow: (stores: string): ReactNode => (
      <>
        Zezwól aplikacji na odczyt danych ({stores}). Pierwsza
        paczka wyjdzie od razu, potem mniej więcej co godzinę.
      </>
    ),
    check: 'Sprawdź teraz',
    hideKey: 'Schowaj klucz',
    showKey: 'Pokaż klucz',
    sure: 'Na pewno odłączyć?',
    disconnect: 'Odłącz telefon',
    privacy: (
      <>
        Aplikacja szyfruje dane tym kluczem, zanim wyjdą z telefonu. Serwer przechowuje tylko ostatnią zaszyfrowaną
        paczkę, najwyżej przez tydzień, i nie zna klucza — otworzy ją wyłącznie przeglądarka, w której klucz jest
        zapisany. Klucz nie trafia do eksportu danych; na drugim urządzeniu wklej go przez „Mam już klucz”. Kroki
        z telefonu i zegarka się nie sumują: liczy się wyższa liczba.
      </>
    ) as ReactNode,
    policy: 'Polityka prywatności',
  },
  en: {
    iosData: 'Health',
    appleHealth: 'Apple Health',
    whereIos: 'the App Store',
    whereAndroid: 'the APK file',
    or: ' or ',
    garminStep: (stores: string): ReactNode => (
      <>
        Got a Garmin watch? In the Garmin Connect app on your phone, turn on sharing with {stores} (Settings →
        Connected Apps). Garmin Connect will pass on steps, sleep, heart rate, weight and workouts from the watch.
      </>
    ),
    install: (phone: string, link: ReactNode): ReactNode => (
      <>
        {phone}: install GYM TRACKER Zdrowie from {link}.
      </>
    ),
    noApp: (phone: string, os: 'ios' | 'android') =>
      `${phone}: the app isn’t out yet — for now data only comes from ${os === 'ios' ? 'Android' : 'iPhone'}.`,
    saveFailed: 'Couldn’t save the key in this browser.',
    copied: 'Key copied — paste it into the GYM TRACKER Zdrowie app.',
    copyFailed: 'Couldn’t copy — select the key in the box and copy it by hand.',
    // i18n-ignore: przycisk w aplikacji GYM TRACKER Zdrowie, która mówi tylko po polsku
    disconnected: 'Phone disconnected. Data that has already arrived stays in your history. Also tap “Odłącz” (Disconnect) in the app on your phone.',
    title: 'Health from your phone',
    intro: (
      <>
        Steps, bike rides, heart rate, sleep and weight from Apple Health (iPhone) or Health Connect (Android) arrive
        by themselves — along with whatever other brands’ watches and scales save there.{' '}
        <b>Got a Garmin watch? This is the simplest way:</b> the Garmin Connect app passes its data on through your
        phone. The website can’t read this data, so a small app, GYM TRACKER Zdrowie (Health), reads it instead.
      </>
    ),
    connect: 'Connect phone',
    haveKey: 'I already have a key from another device',
    badKey: 'The key is 64 characters: digits and the letters a to f.',
    otherKey: 'key from your other device',
    saveKey: 'Save key',
    cancel: 'Cancel',
    from: (source: string | null) => (source ? `from the phone (${source})` : 'from the phone'),
    steps: 'Connection steps',
    pasteKey: 'Copy this key and paste it into the app with the “Wklej klucz” (Paste key) button:',
    keyLabel: 'Key for the phone app',
    copyKey: 'Copy key',
    allow: (stores: string): ReactNode => (
      <>
        Allow the app to read your data ({stores}). The first upload goes out straight away, then roughly every
        hour.
      </>
    ),
    check: 'Check now',
    hideKey: 'Hide key',
    showKey: 'Show key',
    sure: 'Really disconnect?',
    disconnect: 'Disconnect phone',
    privacy: (
      <>
        The app encrypts your data with this key before it leaves the phone. The server keeps only the latest
        encrypted upload, for a week at most, and doesn’t know the key — only a browser with the key saved can open
        it. The key isn’t included in data exports; on another device, paste it via “I already have a key”. Steps
        from the phone and the watch don’t add up: the higher number counts.
      </>
    ),
    policy: 'Privacy policy',
  },
});

/** Klucz w grupach po osiem znaków — łatwiej porównać na dwóch ekranach. Aplikacja spacje pomija. */
const grouped = (k: string): string => k.match(/.{1,8}/g)!.join(' ');

const STORE = {
  ios: { url: HEALTH_IOS_URL, phone: 'iPhone', data: T.iosData, where: T.whereIos, garmin: T.appleHealth },
  android: { url: HEALTH_ANDROID_URL, phone: 'Android', data: 'Health Connect', where: T.whereAndroid, garmin: 'Health Connect' },
} as const;

/**
 * Najprostsza droga dla zegarka Garmin: aplikacja Garmin Connect, którą i tak ma na telefonie,
 * zapisuje kroki, sen, tętno, wagę i treningi w Apple Zdrowie albo Health Connect — wystarczy
 * jej na to pozwolić. Własna aplikacja na zegarek (karta „Zegarek Garmin”) dokłada tylko stres
 * i Body Battery, a oficjalne API Garmina („Zaloguj przez Garmin”) jest zamknięte dla nowych.
 */
function GarminStep({ systems }: { systems: ('ios' | 'android')[] }) {
  return (
    <li>{T.garminStep(systems.map((os) => STORE[os].garmin).join(T.or))}</li>
  );
}

function Install({ os }: { os: 'ios' | 'android' }) {
  const s = STORE[os];
  return (
    <li>
      {s.url
        ? T.install(
            s.phone,
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.where}
            </a>,
          )
        : T.noApp(s.phone, os)}
    </li>
  );
}

export function PhoneCard({
  state,
  onSync,
  onToast,
}: {
  state: AppState;
  onSync: () => Promise<PhonePull>;
  onToast: (m: string) => void;
}) {
  // Klucz czytany przy każdym rysowaniu, nie zapamiętany: „Usuń wszystkie dane” kasuje go spod
  // karty, a karta ma to od razu pokazać. `bump` tylko przerysowuje po zmianie tutaj.
  const [, bump] = useState(0);
  const key = phoneKey();
  const [showKey, setShowKey] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  // Co powiedziało ostatnie „Sprawdź teraz” w tej karcie — w linii ze stanem, nie tylko w dymku.
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const now = useNow(onPhoneCheck);
  const ref = useScrollHere('phone');

  if (!phoneConfigured()) return null;

  const here = platformOf(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const systems: ('ios' | 'android')[] = here === 'other' ? ['ios', 'android'] : [here];
  const got = state.phone?.got;
  const source = state.phone ? STORE[state.phone.os].data : null;
  const status = phoneStatus(state, now);
  // Dzień telefonu, nie dzień UTC aplikacji: telefon liczy kroki od swojej północy.
  const todaySteps = state.phone?.days.find((d) => d.day === localDayOf(new Date(now)))?.steps ?? null;
  // Lista na telefon, z którego przychodzą paczki; przed pierwszą — na ten, na którym otwarto stronę.
  const checkOn: ('ios' | 'android')[] = state.phone ? [state.phone.os] : systems;

  const connect = (raw: string) => {
    if (!savePhoneKey(raw)) {
      onToast(T.saveFailed);
      return;
    }
    bump((n) => n + 1);
    setShowKey(true);
    setPaste(null);
    setResult('');
  };

  const check = async () => {
    setBusy(true);
    // Paczka, którą karta pokazuje teraz: ta sama po sprawdzeniu to „bez nowej paczki”.
    const before = state.phone?.t ?? null;
    try {
      const r = await onSync();
      const said = checkSaid('phone', before, r, Date.now());
      setResult(said);
      onToast(said);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(key!);
      onToast(T.copied);
    } catch {
      onToast(T.copyFailed);
    }
  };

  const disconnect = async () => {
    if (!sure) {
      setSure(true);
      return;
    }
    setBusy(true);
    await forgetPhone();
    setBusy(false);
    setSure(false);
    bump((n) => n + 1);
    setShowKey(false);
    setResult('');
    onToast(T.disconnected);
  };

  return (
    <div className="grp dev-card" id={CARD_ID.phone} ref={ref}>
      <h2>{T.title}</h2>
      {!key ? (
        <>
          <p className="tight">{T.intro}</p>
          {paste === null ? (
            <div className="watch-actions">
              <button className="btn" onClick={() => connect(newKey())}>
                {T.connect}
              </button>
              <button className="btn ghost sm" onClick={() => setPaste('')}>
                {T.haveKey}
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (cleanKey(paste)) connect(paste);
                else onToast(T.badKey);
              }}
            >
              <label className="fld">
                <span>{T.otherKey}</span>
                <textarea
                  className="watch-key"
                  rows={3}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                />
              </label>
              <div className="watch-actions">
                <button className="btn sm" type="submit">
                  {T.saveKey}
                </button>
                <button className="btn ghost sm" type="button" onClick={() => setPaste(null)}>
                  {T.cancel}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <>
          <StatusBlock
            device="phone"
            status={status}
            now={now}
            from={T.from(source)}
            todaySteps={todaySteps}
            checkedAt={lastPhoneAt()}
          />
          <p className="tight dev-result" role="status">
            {result}
          </p>
          {(!got || showKey) && (
            <ol className="watch-steps" aria-label={T.steps}>
              <GarminStep systems={systems} />
              {systems.map((os) => (
                <Install key={os} os={os} />
              ))}
              <li>
                {T.pasteKey}
                <textarea
                  readOnly
                  className="watch-key"
                  rows={3}
                  value={grouped(key)}
                  aria-label={T.keyLabel}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button className="btn sm" onClick={() => void copy()}>
                  {T.copyKey}
                </button>
              </li>
              <li>{T.allow(systems.map((os) => STORE[os].data).join(T.or))}</li>
            </ol>
          )}
          <div className="watch-actions">
            <button className="btn sm" disabled={busy} onClick={() => void check()}>
              {T.check}
            </button>
            {got && (
              <button className="btn ghost sm" onClick={() => setShowKey(!showKey)}>
                {showKey ? T.hideKey : T.showKey}
              </button>
            )}
            <button className="btn ghost sm" disabled={busy} onClick={() => void disconnect()}>
              {sure ? T.sure : T.disconnect}
            </button>
          </div>
          <Checklist level={status.level} checked={lastPhoneAt() !== null} items={phoneChecks(status.level, checkOn)} />
        </>
      )}
      <p className="hint" style={{ marginTop: 10 }}>
        {T.privacy}{' '}
        <a href="privacy.html" target="_blank" rel="noopener">
          {T.policy}
        </a>
        .
      </p>
    </div>
  );
}
