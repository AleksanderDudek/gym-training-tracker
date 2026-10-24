import { Component, Suspense, lazy, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { checkSaid } from '../deviceStatus';
import { localDayOf } from '../engine/watch';
import { hashQuery } from '../food/hash';
import { GARMIN_APP_URL, forgetWatch, garminConfigured, garminKey, lastPullAt, onWatchCheck, saveGarminKey, watchStatus } from '../garmin';
import type { PullResult } from '../garmin';
import { text } from '../i18n';
import { trail } from '../trail';
import { rememberedWatch } from '../watches/remember';
import { cleanKey, newKey } from '../watchseal';
import type { AppState } from '../types';
import { CARD_ID, Checklist, StatusBlock, useNow, useScrollHere, watchChecks } from './DeviceStatus';
import { W, lacksText } from './WatchCheck.words';

/**
 * Karta zegarka w ustawieniach: sprawdzenie modelu, połączenie, klucz do wklejenia, stan i odłączenie.
 *
 * Bez klucza pierwsze, co widać, to „Jaki masz zegarek?” — odpowiedź, zanim ktoś zainstaluje
 * aplikację na zegarku, który jej nie uruchomi. Nikogo to nie blokuje: „Połącz bez sprawdzania”
 * i „Mam już klucz” stoją pod spodem. Samo sprawdzanie (lista modeli i wyszukiwarka) jest w osobnej
 * paczce; karta zna tylko zapamiętany model i kilka słów.
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
        Kroki, przejazdy rowerem i tętno — a na większości zegarków także stres i Body Battery — przyjdą
        z zegarka same, bez przepisywania. Potrzebna jest mała aplikacja GYM TRACKER na zegarku i jeden
        klucz wklejony w jej ustawienia.
      </>
    ) as ReactNode,
    connectNoCheck: 'Połącz bez sprawdzania',
    connectAnyway: 'Połącz mimo to',
    checking: 'Wczytuję listę zegarków…',
    checkFailed: 'Nie udało się wczytać listy zegarków — sprawdź internet i odśwież stronę.',
    storeList: 'Zgodne urządzenia w Connect IQ Store',
    yourWatch: (name: string, short: string) => `Wybrany model: ${name} — ${short}.`,
    change: 'Zmień model',
    hideCheck: 'Zwiń',
    modelLacks: (list: string) => `Ten model nie udostępnia aplikacjom ${list} — w „Z zegarka” ich nie będzie.`,
    modelNo: (name: string) =>
      `${name} nie działa z aplikacją na zegarek — dane może przynieść telefon („Zdrowie z telefonu”).`,
    updateFirst:
      'Najpierw zaktualizuj oprogramowanie zegarka: zsynchronizuj go z Garmin Connect (nowe oprogramowanie instaluje się samo) albo podłącz do Garmin Express na komputerze.',
    checkModel: 'Czy Twój model jest obsługiwany? Sprawdź →',
    bg32: 'Ten model ma mało pamięci na pracę w tle i nie był jeszcze sprawdzony na prawdziwym zegarku. Jeśli dane nie przychodzą, napisz — to pomoże.',
    bg32Write: 'Napisz do autora',
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
        . Jeśli sklep pisze, że zegarek trzeba zaktualizować, zsynchronizuj go z Garmin Connect albo
        podłącz do Garmin Express na komputerze.
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
        Steps, bike rides and heart rate — and on most watches stress and Body Battery too — arrive from your watch by
        themselves, no retyping. You need the small GYM TRACKER app on the watch and one key pasted into its settings.
      </>
    ),
    connectNoCheck: 'Connect without checking',
    connectAnyway: 'Connect anyway',
    checking: 'Loading the watch list…',
    checkFailed: 'Couldn’t load the watch list — check your internet connection and refresh the page.',
    storeList: 'Compatible devices in the Connect IQ Store',
    yourWatch: (name: string, short: string) => `Chosen model: ${name} — ${short}.`,
    change: 'Change model',
    hideCheck: 'Close',
    modelLacks: (list: string) =>
      `This model doesn’t share ${list} with apps — they won’t appear under “From your watch”.`,
    modelNo: (name: string) =>
      `${name} doesn’t work with the watch app — your phone can bring the data (“Health from your phone”).`,
    updateFirst:
      'First update the watch’s software: sync it with Garmin Connect (new software installs by itself) or connect it to Garmin Express on a computer.',
    checkModel: 'Is your model supported? Check →',
    bg32: 'This model has little memory for background work and hasn’t been tested on a real watch yet. If data isn’t arriving, write — it helps.',
    bg32Write: 'Write to the author',
    haveKey: 'I already have a key from another device',
    badKey: 'The key is 64 characters: digits and the letters a to f.',
    otherKey: 'key from your other device',
    saveKey: 'Save key',
    cancel: 'Cancel',
    from: 'from the watch',
    steps: 'Connection steps',
    install: (link: ReactNode): ReactNode => (
      <>
        Install the GYM TRACKER app on your watch from the {link}. If the store says the watch needs an update, sync it
        with Garmin Connect or connect it to Garmin Express on a computer.
      </>
    ),
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

/** Sprawdzanie modelu: lista zegarków, wyszukiwarka i ikony w osobnej paczce. */
const WatchCheck = lazy(() => import('./WatchCheck'));

type Shown = 'supported' | 'unsupported' | null;

/** Model z adresu (`#/zegarek?model=fr265`): identyfikator albo tekst do sprawdzenia. */
const modelParam = (): string | null => hashQuery(window.location.hash).get('model')?.trim() || null;

/**
 * Gdy paczka sprawdzania nie przyjdzie (brak sieci przed pierwszym wczytaniem) albo się wywróci,
 * znika tylko ona: zdanie i link do listy zgodnych urządzeń w sklepie, a „Połącz bez sprawdzania”
 * zostaje pod spodem.
 */
class CheckBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    trail.error(error instanceof Error ? error.message : String(error));
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <p className="tight wc-failed">
        {T.checkFailed}{' '}
        <a href={GARMIN_APP_URL} target="_blank" rel="noopener noreferrer">
          {T.storeList}
        </a>
      </p>
    );
  }
}

function CheckSlot(props: ComponentProps<typeof WatchCheck>) {
  return (
    <CheckBoundary>
      <Suspense fallback={<p className="hint wc-loading">{T.checking}</p>}>
        <WatchCheck {...props} />
      </Suspense>
    </CheckBoundary>
  );
}

/** Klucz w grupach po osiem znaków — łatwiej porównać na dwóch ekranach. Zegarek spacje pomija. */
const grouped = (k: string): string => k.match(/.{1,8}/g)!.join(' ');

export function GarminCard({
  state,
  onSync,
  onToast,
  onFeedback,
}: {
  state: AppState;
  onSync: () => Promise<PullResult>;
  onToast: (m: string) => void;
  /** Okno uwag — „Napisz do autora” w sprawdzaniu i przy modelu niesprawdzonym na prawdziwym zegarku. */
  onFeedback?: (() => void) | undefined;
}) {
  // Klucz i wybrany model czytane przy każdym rysowaniu, nie zapamiętane: „Usuń wszystkie dane”
  // kasuje je spod karty, a karta ma to od razu pokazać. `bump` tylko przerysowuje po zmianie tutaj.
  const [, bump] = useState(0);
  const key = garminKey();
  const [showKey, setShowKey] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  // Co powiedziało ostatnie „Sprawdź teraz” w tej karcie — w linii ze stanem, nie tylko w dymku.
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  // Model z linku — z chwili otwarcia karty, do pierwszego zwinięcia sprawdzania.
  const [linked, setLinked] = useState(modelParam);
  // Co pokazuje sprawdzanie: od tego zależą ciche przyciski pod nim — jedna główna akcja na stan.
  const [shown, setShown] = useState<Shown>(null);
  // Sprawdzanie przy połączonym zegarku: „Zmień model”, „Sprawdź →” z listy albo link z modelem.
  const [checkOpen, setCheckOpen] = useState(() => linked !== null);
  const inline = useRef<HTMLDivElement>(null);
  const now = useNow(onWatchCheck);
  const ref = useScrollHere('watch');

  if (!garminConfigured()) return null;

  const mine = rememberedWatch();
  const got = state.watch?.got;
  const status = watchStatus(state, now);
  // Dzień zegarka, nie dzień UTC aplikacji: zegarek liczy kroki od swojej północy.
  const todaySteps = state.watch?.days.find((d) => d.day === localDayOf(new Date(now)))?.steps ?? null;

  /** Wynik sprawdzania się zmienił: inne ciche przyciski, a może inny zapamiętany model. */
  const onShown = (s: Shown) => {
    setShown(s);
    bump((n) => n + 1);
  };

  const openCheck = () => {
    // Już otwarte — fokus wraca do pola; nowe — pole dostaje fokus samo, przy wejściu.
    if (checkOpen) inline.current?.querySelector('input')?.focus();
    else setCheckOpen(true);
  };

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

  // „Dane nie przychodzą?”: przy modelu niesprawdzonym na zegarku z małą pamięcią — najpierw on;
  // bez wybranego modelu — najpierw pytanie, czy model w ogóle jest obsługiwany.
  const checks = [
    ...(mine?.bg === 32 && status.level === 'setup'
      ? [
          {
            id: 'bg32',
            text: (
              <>
                {T.bg32}
                {onFeedback && (
                  <>
                    {' '}
                    <button type="button" className="wc-linkbtn" onClick={onFeedback}>
                      {T.bg32Write}
                    </button>
                  </>
                )}
              </>
            ),
          },
        ]
      : []),
    ...(mine
      ? []
      : [
          {
            id: 'model',
            text: (
              <button type="button" className="wc-linkbtn" onClick={openCheck}>
                {T.checkModel}
              </button>
            ),
          },
        ]),
    ...watchChecks(status.level),
  ];

  return (
    <div className="grp dev-card" id={CARD_ID.watch} ref={ref}>
      <h2>{T.title}</h2>
      {!key ? (
        <>
          <p className="tight">{T.intro}</p>
          {paste === null ? (
            <>
              <CheckSlot
                onConnect={() => connect(newKey())}
                onFeedback={onFeedback}
                onShown={onShown}
                initial={linked ?? mine?.key}
              />
              <div className="watch-actions">
                {/* Obsługiwany model ma „Połącz zegarek” w wyniku — tu zostaje tylko klucz z innego urządzenia. */}
                {shown !== 'supported' && (
                  <button className="btn ghost sm" onClick={() => connect(newKey())}>
                    {shown === 'unsupported' ? T.connectAnyway : T.connectNoCheck}
                  </button>
                )}
                <button className="btn ghost sm" onClick={() => setPaste('')}>
                  {T.haveKey}
                </button>
              </div>
            </>
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
          {mine && (
            <p className="tight wc-mine">
              {T.yourWatch(mine.name, W.short[mine.v])}
              {!checkOpen && (
                <>
                  {' '}
                  <button type="button" className="wc-linkbtn" onClick={openCheck}>
                    {T.change}
                  </button>
                </>
              )}
            </p>
          )}
          {mine?.lacks && <p className="tight">{T.modelLacks(lacksText(mine.lacks))}</p>}
          {mine && mine.v !== 'ok' && mine.v !== 'part' && <p className="tight">{T.modelNo(mine.name)}</p>}
          {checkOpen && (
            <div className="wc-inline" ref={inline}>
              <CheckSlot compact onFeedback={onFeedback} onShown={onShown} initial={linked ?? undefined} />
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setCheckOpen(false);
                  setLinked(null);
                }}
              >
                {T.hideCheck}
              </button>
            </div>
          )}
          {(!got || showKey) && (
            <ol className="watch-steps" aria-label={T.steps}>
              {/* Część danych przychodzi dopiero z najnowszym oprogramowaniem zegarka. */}
              {mine?.newest && <li>{T.updateFirst}</li>}
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
          <Checklist level={status.level} checked={lastPullAt() !== null} items={checks} />
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
