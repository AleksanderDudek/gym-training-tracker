import { useState } from 'react';
import { checkSaid } from '../deviceStatus';
import { localDayOf } from '../engine/watch';
import { GARMIN_APP_URL, forgetWatch, garminConfigured, garminKey, lastPullAt, onWatchCheck, saveGarminKey, watchStatus } from '../garmin';
import type { PullResult } from '../garmin';
import { cleanKey, newKey } from '../watchseal';
import type { AppState } from '../types';
import { CARD_ID, Checklist, StatusBlock, useNow, useScrollHere, watchChecks } from './DeviceStatus';

/**
 * Karta zegarka w ustawieniach: połączenie, klucz do wklejenia, stan i odłączenie.
 *
 * Połączenie to jeden klucz, który znają tylko ta przeglądarka i zegarek. Wkleja się go raz,
 * w ustawieniach aplikacji GYM TRACKER na zegarku — w Garmin Connect na telefonie jest
 * klawiatura i schowek, a na zegarku nie ma ani jednego, ani drugiego.
 *
 * Po połączeniu karta odpowiada na pytanie „czy to działa”: kiedy przyszła ostatnia paczka,
 * kiedy następna, czy „Sprawdź teraz” przyniosło coś nowego — i co sprawdzić, gdy nie.
 */

/** Klucz w grupach po osiem znaków — łatwiej porównać na dwóch ekranach. Zegarek spacje pomija. */
const grouped = (k: string): string => k.match(/.{1,8}/g)!.join(' ');

export function GarminCard({
  state,
  onSync,
  onToast,
}: {
  state: AppState;
  onSync: () => Promise<PullResult>;
  onToast: (m: string) => void;
}) {
  // Klucz czytany przy każdym rysowaniu, nie zapamiętany: „Usuń wszystkie dane” kasuje go spod
  // karty, a karta ma to od razu pokazać. `bump` tylko przerysowuje po zmianie tutaj.
  const [, bump] = useState(0);
  const key = garminKey();
  const [showKey, setShowKey] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  // Co powiedziało ostatnie „Sprawdź teraz” w tej karcie — w linii ze stanem, nie tylko w dymku.
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const now = useNow(onWatchCheck);
  const ref = useScrollHere('watch');

  if (!garminConfigured()) return null;

  const got = state.watch?.got;
  const status = watchStatus(state, now);
  // Dzień zegarka, nie dzień UTC aplikacji: zegarek liczy kroki od swojej północy.
  const todaySteps = state.watch?.days.find((d) => d.day === localDayOf(new Date(now)))?.steps ?? null;

  const connect = (raw: string) => {
    if (!saveGarminKey(raw)) {
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
    const before = state.watch?.t ?? null;
    try {
      const r = await onSync();
      const said = checkSaid('watch', before, r, Date.now());
      setResult(said);
      onToast(said);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(key!);
      onToast('Klucz skopiowany — wklej go w ustawieniach aplikacji na zegarku.');
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
    await forgetWatch();
    setBusy(false);
    setSure(false);
    bump((n) => n + 1);
    setShowKey(false);
    setResult('');
    onToast('Zegarek odłączony. Dane, które już przyszły, zostają w historii. Klucz usuń też z ustawień aplikacji na zegarku.');
  };

  return (
    <div className="grp dev-card" id={CARD_ID.watch} ref={ref}>
      <h2>Zegarek Garmin</h2>
      {!key ? (
        <>
          <p className="tight">
            Kroki, przejazdy rowerem, tętno, stres i Body Battery przyjdą z zegarka same — bez
            przepisywania. Potrzebna jest mała aplikacja GYM TRACKER na zegarku i jeden klucz wklejony
            w jej ustawienia.
          </p>
          <p className="tight">
            Prościej przez telefon: karta „Zdrowie z telefonu” bierze dane, które Garmin Connect zapisuje
            w Apple Zdrowie albo Health Connect — razem ze snem i wagą. Ta karta dokłada stres i Body Battery.
          </p>
          {paste === null ? (
            <div className="watch-actions">
              <button className="btn" onClick={() => connect(newKey())}>
                Połącz zegarek
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
            device="watch"
            status={status}
            now={now}
            from="z zegarka"
            todaySteps={todaySteps}
            checkedAt={lastPullAt()}
          />
          <p className="tight dev-result" role="status">
            {result}
          </p>
          {(!got || showKey) && (
            <ol className="watch-steps" aria-label="Kroki połączenia">
              <li>
                Zainstaluj na zegarku aplikację GYM TRACKER z{' '}
                <a href={GARMIN_APP_URL} target="_blank" rel="noopener noreferrer">
                  Connect IQ Store
                </a>
                .
              </li>
              <li>
                W aplikacji Garmin Connect na telefonie otwórz ustawienia GYM TRACKER: zegarek →
                Aktywności i aplikacje → GYM TRACKER → Ustawienia.
              </li>
              <li>
                Wklej tam ten klucz:
                <textarea
                  readOnly
                  className="watch-key"
                  rows={3}
                  value={grouped(key)}
                  aria-label="Klucz do zegarka"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button className="btn sm" onClick={() => void copy()}>
                  Kopiuj klucz
                </button>
              </li>
              <li>
                Otwórz raz GYM TRACKER na zegarku. Pierwsze dane przyjdą po chwili, potem co pół godziny,
                gdy telefon jest w pobliżu.
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
              {sure ? 'Na pewno odłączyć?' : 'Odłącz zegarek'}
            </button>
          </div>
          <Checklist level={status.level} checked={lastPullAt() !== null} items={watchChecks(status.level)} />
        </>
      )}
      <p className="hint" style={{ marginTop: 10 }}>
        Zegarek szyfruje dane tym kluczem, zanim wyjdą z telefonu. Serwer przechowuje tylko ostatnią
        zaszyfrowaną paczkę, najwyżej przez tydzień, i nie zna klucza — otworzy ją wyłącznie
        przeglądarka, w której klucz jest zapisany. Klucz nie trafia do eksportu danych; na drugim
        urządzeniu wklej go przez „Mam już klucz”.{' '}
        <a href="privacy.html" target="_blank" rel="noopener">
          Polityka prywatności
        </a>
        .
      </p>
    </div>
  );
}
