import { useState } from 'react';
import { whenText } from '../mailbox';
import { HEALTH_ANDROID_URL, HEALTH_IOS_URL, forgetPhone, lastPhoneKind, phoneConfigured, phoneKey, platformOf, savePhoneKey } from '../phone';
import type { PhonePull } from '../phone';
import { cleanKey, newKey } from '../watchseal';
import type { AppState } from '../types';

/**
 * Karta „Zdrowie z telefonu” w ustawieniach: połączenie z aplikacją GYM TRACKER Zdrowie, klucz
 * do skopiowania, stan i odłączenie.
 *
 * Klucz przechodzi przez schowek, jak do zegarka. Link z kluczem otwierający aplikację byłby
 * wygodniejszy o jedno stuknięcie, ale własny schemat adresu może zarejestrować każda inna
 * aplikacja i dostałaby klucz do danych o zdrowiu.
 */

/** Klucz w grupach po osiem znaków — łatwiej porównać na dwóch ekranach. Aplikacja spacje pomija. */
const grouped = (k: string): string => k.match(/.{1,8}/g)!.join(' ');

const SAID: Partial<Record<PhonePull['kind'], string>> = {
  empty:
    'Telefon jeszcze nic nie przysłał. Otwórz GYM TRACKER Zdrowie, wklej klucz i zezwól na dostęp do danych — pierwsza paczka wyjdzie od razu.',
  bad: 'Paczka z telefonu nie otwiera się tym kluczem — w aplikacji na telefonie jest pewnie inny. Wklej klucz z tej karty jeszcze raz.',
  offline: 'Serwer nie odpowiada albo nie ma sieci. Spróbuję znów przy następnym otwarciu aplikacji.',
};

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
  const [kind, setKind] = useState<PhonePull['kind'] | null>(() => lastPhoneKind());
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);

  if (!phoneConfigured()) return null;

  const here = platformOf(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const systems: ('ios' | 'android')[] = here === 'other' ? ['ios', 'android'] : [here];
  const got = state.phone?.got;
  const source = state.phone ? STORE[state.phone.os].data : null;

  const connect = (raw: string) => {
    if (!savePhoneKey(raw)) {
      onToast('Nie udało się zapisać klucza w tej przeglądarce.');
      return;
    }
    bump((n) => n + 1);
    setShowKey(true);
    setPaste(null);
    setKind(null);
  };

  const check = async () => {
    setBusy(true);
    try {
      const r = await onSync();
      setKind(r.kind);
      onToast(r.kind === 'ok' ? 'Dane z telefonu sprawdzone.' : (SAID[r.kind] ?? 'Spróbuj za chwilę.'));
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
    setKind(null);
    onToast('Telefon odłączony. Dane, które już przyszły, zostają w historii. W aplikacji na telefonie naciśnij też „Odłącz”.');
  };

  return (
    <div className="grp">
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
          <p className="tight">
            {got ? `Ostatnie dane z telefonu (${source}): ${whenText(got)}.` : 'Telefon jeszcze nic nie przysłał.'}
          </p>
          {kind === 'bad' && <p className="tight cardio-note warn">{SAID.bad}</p>}
          {(!got || showKey) && (
            <ol className="watch-steps">
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
