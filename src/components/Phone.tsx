import { useState } from 'react';
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

/** Klucz w grupach po osiem znaków — łatwiej porównać na dwóch ekranach. Aplikacja spacje pomija. */
const grouped = (k: string): string => k.match(/.{1,8}/g)!.join(' ');

const STORE = {
  ios: { url: HEALTH_IOS_URL, phone: 'iPhone', data: 'Zdrowie', where: 'App Store', garmin: 'Apple Zdrowie' },
  android: { url: HEALTH_ANDROID_URL, phone: 'Android', data: 'Health Connect', where: 'pliku APK', garmin: 'Health Connect' },
} as const;

/**
 * Najprostsza droga dla zegarka Garmin: aplikacja Garmin Connect, którą i tak ma na telefonie,
 * zapisuje kroki, sen, tętno, wagę i treningi w Apple Zdrowie albo Health Connect — wystarczy
 * jej na to pozwolić. Własna aplikacja na zegarek (karta „Zegarek Garmin”) dokłada tylko stres
 * i Body Battery, a oficjalne API Garmina („Zaloguj przez Garmin”) jest zamknięte dla nowych.
 */
function GarminStep({ systems }: { systems: ('ios' | 'android')[] }) {
  return (
    <li>
      Masz zegarek Garmin? W aplikacji Garmin Connect na telefonie włącz udostępnianie do{' '}
      {systems.map((os) => STORE[os].garmin).join(' albo ')} (Ustawienia → Połączone aplikacje). Garmin
      Connect przekaże tam kroki, sen, tętno, wagę i treningi z zegarka.
    </li>
  );
}

function Install({ os }: { os: 'ios' | 'android' }) {
  const s = STORE[os];
  return (
    <li>
      {s.url ? (
        <>
          {s.phone}: zainstaluj GYM TRACKER Zdrowie z{' '}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.where}
          </a>
          .
        </>
      ) : (
        `${s.phone}: aplikacji jeszcze nie ma — na razie dane przyjdą tylko z ${os === 'ios' ? 'Androida' : 'iPhone’a'}.`
      )}
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
      onToast('Nie udało się zapisać klucza w tej przeglądarce.');
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
      onToast('Klucz skopiowany — wklej go w aplikacji GYM TRACKER Zdrowie.');
    } catch {
      onToast('Nie udało się skopiować — zaznacz klucz w polu i skopiuj go ręcznie.');
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
    onToast('Telefon odłączony. Dane, które już przyszły, zostają w historii. W aplikacji na telefonie naciśnij też „Odłącz”.');
  };

  return (
    <div className="grp dev-card" id={CARD_ID.phone} ref={ref}>
      <h2>Zdrowie z telefonu</h2>
      {!key ? (
        <>
          <p className="tight">
            Kroki, przejazdy rowerem, tętno, sen i waga z Apple Zdrowie (iPhone) albo Health Connect (Android)
            przyjdą same — razem z tym, co zapisują tam zegarki i wagi innych firm.{' '}
            <b>Masz zegarek Garmin? To najprostsza droga:</b> aplikacja Garmin Connect przekaże jego dane przez
            telefon. Strona nie ma dostępu do tych danych, więc czyta je mała aplikacja GYM TRACKER Zdrowie.
          </p>
          {paste === null ? (
            <div className="watch-actions">
              <button className="btn" onClick={() => connect(newKey())}>
                Połącz telefon
              </button>
              <button className="btn ghost sm" onClick={() => setPaste('')}>
                Mam już klucz z innego urządzenia
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (cleanKey(paste)) connect(paste);
                else onToast('Klucz to 64 znaki: cyfry i litery od a do f.');
              }}
            >
              <label className="fld">
                <span>klucz z drugiego urządzenia</span>
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
                  Zapisz klucz
                </button>
                <button className="btn ghost sm" type="button" onClick={() => setPaste(null)}>
                  Anuluj
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
            from={source ? `z telefonu (${source})` : 'z telefonu'}
            todaySteps={todaySteps}
            checkedAt={lastPhoneAt()}
          />
          <p className="tight dev-result" role="status">
            {result}
          </p>
          {(!got || showKey) && (
            <ol className="watch-steps" aria-label="Kroki połączenia">
              <GarminStep systems={systems} />
              {systems.map((os) => (
                <Install key={os} os={os} />
              ))}
              <li>
                Skopiuj ten klucz i wklej go w aplikacji przyciskiem „Wklej klucz”:
                <textarea
                  readOnly
                  className="watch-key"
                  rows={3}
                  value={grouped(key)}
                  aria-label="Klucz do aplikacji na telefonie"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button className="btn sm" onClick={() => void copy()}>
                  Kopiuj klucz
                </button>
              </li>
              <li>
                Zezwól aplikacji na odczyt danych ({systems.map((os) => STORE[os].data).join(' albo ')}). Pierwsza
                paczka wyjdzie od razu, potem mniej więcej co godzinę.
              </li>
            </ol>
          )}
          <div className="watch-actions">
            <button className="btn sm" disabled={busy} onClick={() => void check()}>
              Sprawdź teraz
            </button>
            {got && (
              <button className="btn ghost sm" onClick={() => setShowKey(!showKey)}>
                {showKey ? 'Schowaj klucz' : 'Pokaż klucz'}
              </button>
            )}
            <button className="btn ghost sm" disabled={busy} onClick={() => void disconnect()}>
              {sure ? 'Na pewno odłączyć?' : 'Odłącz telefon'}
            </button>
          </div>
          <Checklist level={status.level} checked={lastPhoneAt() !== null} items={phoneChecks(status.level, checkOn)} />
        </>
      )}
      <p className="hint" style={{ marginTop: 10 }}>
        Aplikacja szyfruje dane tym kluczem, zanim wyjdą z telefonu. Serwer przechowuje tylko ostatnią zaszyfrowaną
        paczkę, najwyżej przez tydzień, i nie zna klucza — otworzy ją wyłącznie przeglądarka, w której klucz jest
        zapisany. Klucz nie trafia do eksportu danych; na drugim urządzeniu wklej go przez „Mam już klucz”. Kroki
        z telefonu i zegarka się nie sumują: liczy się wyższa liczba.{' '}
        <a href="privacy.html" target="_blank" rel="noopener">
          Polityka prywatności
        </a>
        .
      </p>
    </div>
  );
}
