import { useState } from 'react';
import type { ReactNode } from 'react';
import { checkSaid } from '../deviceStatus';
import { localDayOf } from '../engine/watch';
import { GARMIN_APP_URL, forgetWatch, garminConfigured, garminKey, lastPullAt, onWatchCheck, saveGarminKey, watchStatus } from '../garmin';
import type { PullResult } from '../garmin';
import { text } from '../i18n';
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

const T = text({
  pl: {
    saveFailed: 'Nie udało się zapisać klucza w tej przeglądarce.',
    copied: 'Klucz skopiowany — wklej go w ustawieniach aplikacji na zegarku.',
    copyFailed: 'Nie udało się skopiować — zaznacz klucz w polu i skopiuj go ręcznie.',
    disconnected:
      'Zegarek odłączony. Dane, które już przyszły, zostają w historii. Klucz usuń też z ustawień aplikacji na zegarku.',
    title: 'Zegarek Garmin',
    intro: (
      <>
        Kroki, przejazdy rowerem, tętno, stres i Body Battery przyjdą z zegarka same — bez
        przepisywania. Potrzebna jest mała aplikacja GYM TRACKER na zegarku i jeden klucz wklejony
        w jej ustawienia.
      </>
    ) as ReactNode,
    viaPhone: (
      <>
        Prościej przez telefon: karta „Zdrowie z telefonu” bierze dane, które Garmin Connect zapisuje
        w Apple Zdrowie albo Health Connect — razem ze snem i wagą. Ta karta dokłada stres i Body Battery.
      </>
    ) as ReactNode,
    connect: 'Połącz zegarek',
    haveKey: 'Mam już klucz z innego urządzenia',
    badKey: 'Klucz to 64 znaki: cyfry i litery od a do f.',
    otherKey: 'klucz z drugiego urządzenia',
    saveKey: 'Zapisz klucz',
    cancel: 'Anuluj',
    from: 'z zegarka',
    steps: 'Kroki połączenia',
    install: (link: ReactNode): ReactNode => (
      <>
        Zainstaluj na zegarku aplikację GYM TRACKER z{' '}
        {link}
        .
      </>
    ),
    settings: (
      <>
        W aplikacji Garmin Connect na telefonie otwórz ustawienia GYM TRACKER: zegarek →
        Aktywności i aplikacje → GYM TRACKER → Ustawienia.
      </>
    ) as ReactNode,
    pasteHere: 'Wklej tam ten klucz:',
    keyLabel: 'Klucz do zegarka',
    copyKey: 'Kopiuj klucz',
    openOnce: (
      <>
        Otwórz raz GYM TRACKER na zegarku. Pierwsze dane przyjdą po chwili, potem co pół godziny,
        gdy telefon jest w pobliżu.
      </>
    ) as ReactNode,
    check: 'Sprawdź teraz',
    hideKey: 'Schowaj klucz',
    showKey: 'Pokaż klucz',
    sure: 'Na pewno odłączyć?',
    disconnect: 'Odłącz zegarek',
    privacy: (
      <>
        Zegarek szyfruje dane tym kluczem, zanim wyjdą z telefonu. Serwer przechowuje tylko ostatnią
        zaszyfrowaną paczkę, najwyżej przez tydzień, i nie zna klucza — otworzy ją wyłącznie
        przeglądarka, w której klucz jest zapisany. Klucz nie trafia do eksportu danych; na drugim
        urządzeniu wklej go przez „Mam już klucz”.
      </>
    ) as ReactNode,
    policy: 'Polityka prywatności',
  },
  en: {
    saveFailed: 'Couldn’t save the key in this browser.',
    copied: 'Key copied — paste it into the watch app’s settings.',
    copyFailed: 'Couldn’t copy — select the key in the box and copy it by hand.',
    disconnected:
      'Watch disconnected. Data that has already arrived stays in your history. Remove the key from the watch app’s settings too.',
    title: 'Garmin watch',
    intro: (
      <>
        Steps, bike rides, heart rate, stress and Body Battery come from your watch by themselves — no retyping. You
        need the small GYM TRACKER app on the watch and one key pasted into its settings.
      </>
    ),
    viaPhone: (
      <>
        Simpler through your phone: the “Health from your phone” card takes the data Garmin Connect saves to Apple
        Health or Health Connect — sleep and weight included. This card adds stress and Body Battery.
      </>
    ),
    connect: 'Connect watch',
    haveKey: 'I already have a key from another device',
    badKey: 'The key is 64 characters: digits and the letters a to f.',
    otherKey: 'key from your other device',
    saveKey: 'Save key',
    cancel: 'Cancel',
    from: 'from the watch',
    steps: 'Connection steps',
    install: (link: ReactNode): ReactNode => <>Install the GYM TRACKER app on your watch from the {link}.</>,
    settings: (
      <>
        In the Garmin Connect app on your phone, open the GYM TRACKER settings: watch → Activities &amp; Apps → GYM
        TRACKER → Settings.
      </>
    ),
    pasteHere: 'Paste this key there:',
    keyLabel: 'Key for the watch',
    copyKey: 'Copy key',
    openOnce: (
      <>
        Open GYM TRACKER on the watch once. The first data arrives shortly, then every half hour while your phone is
        nearby.
      </>
    ),
    check: 'Check now',
    hideKey: 'Hide key',
    showKey: 'Show key',
    sure: 'Really disconnect?',
    disconnect: 'Disconnect watch',
    privacy: (
      <>
        The watch encrypts your data with this key before it leaves the phone. The server keeps only the latest
        encrypted upload, for a week at most, and doesn’t know the key — only a browser with the key saved can open
        it. The key isn’t included in data exports; on another device, paste it via “I already have a key”.
      </>
    ),
    policy: 'Privacy policy',
  },
});

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
    await forgetWatch();
    setBusy(false);
    setSure(false);
    bump((n) => n + 1);
    setShowKey(false);
    setResult('');
    onToast(T.disconnected);
  };

  return (
    <div className="grp dev-card" id={CARD_ID.watch} ref={ref}>
      <h2>{T.title}</h2>
      {!key ? (
        <>
          <p className="tight">{T.intro}</p>
          <p className="tight">{T.viaPhone}</p>
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
            device="watch"
            status={status}
            now={now}
            from={T.from}
            todaySteps={todaySteps}
            checkedAt={lastPullAt()}
          />
          <p className="tight dev-result" role="status">
            {result}
          </p>
          {(!got || showKey) && (
            <ol className="watch-steps" aria-label={T.steps}>
              <li>
                {T.install(
                  <a href={GARMIN_APP_URL} target="_blank" rel="noopener noreferrer">
                    Connect IQ Store
                  </a>,
                )}
              </li>
              <li>{T.settings}</li>
              <li>
                {T.pasteHere}
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
              <li>{T.openOnce}</li>
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
          <Checklist level={status.level} checked={lastPullAt() !== null} items={watchChecks(status.level)} />
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
