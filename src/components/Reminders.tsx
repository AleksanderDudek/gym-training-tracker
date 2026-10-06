import { useEffect, useState } from 'react';
import { EVENING_AT, MORNING_AT, remindersOf } from '../engine/reminders';
import { currentPushState, disablePush, enablePush, pushConfigured } from '../push';
import type { PushState } from '../push';
import { Segmented } from './ui';
import type { AppState, ReminderPrefs } from '../types';

/**
 * Karta przypomnień w ustawieniach. Zgoda na powiadomienia pada dopiero po stuknięciu
 * w „Włącz” — nigdy przy starcie aplikacji: pytanie bez kontekstu przeglądarki karzą
 * wyciszeniem, a ludzie odmawiają, zanim wiedzą, o co chodzi.
 */

const ON_OFF: { key: 'on' | 'off'; label: string }[] = [
  { key: 'on', label: 'Wł.' },
  { key: 'off', label: 'Wył.' },
];

const hhmm = (t: string): string => t.replace(/^0/, '');

/** Dlaczego się nie da — i co z tym zrobić — dla każdego stanu poza „wyłączone” i „włączone”. */
const BLOCKED: Partial<Record<PushState, string>> = {
  'ios-install':
    'Na iPhonie powiadomienia działają tylko w aplikacji dodanej do ekranu początkowego: w Safari stuknij Udostępnij → Do ekranu początkowego, otwórz GYM TRACKER z ikony i wróć tutaj. Potrzebny iOS 16.4 albo nowszy.',
  unsupported: 'Ta przeglądarka nie obsługuje powiadomień ze stron. Na Androidzie działają w Chrome, na iPhonie — w Safari po dodaniu aplikacji do ekranu początkowego.',
  'no-worker': 'Powiadomienia działają w opublikowanej wersji aplikacji — tej otwieranej z adresu w sieci albo z ikony na telefonie.',
  denied:
    'Powiadomienia dla tej aplikacji są zablokowane. Odblokujesz je w ustawieniach telefonu albo przeglądarki (uprawnienia strony → Powiadomienia), a potem wrócisz tutaj.',
};

export function RemindersCard({
  state,
  onPrefs,
  onToast,
}: {
  state: AppState;
  onPrefs: (p: ReminderPrefs) => void;
  onToast: (m: string) => void;
}) {
  const [status, setStatus] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void currentPushState().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);

  if (!pushConfigured() || status === null || status === 'unconfigured') return null;

  const prefs = remindersOf(state);
  /** Komunikat tylko wtedy, gdy telefon naprawdę doszedł do stanu, o który chodziło. */
  const run = async (job: () => Promise<PushState>, want: PushState, ok: string, otherwise?: string) => {
    setBusy(true);
    try {
      const s = await job();
      setStatus(s);
      if (s === want) onToast(ok);
      else if (otherwise) onToast(otherwise);
    } catch {
      onToast('Nie udało się — sprawdź połączenie i spróbuj jeszcze raz.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grp">
      <h2>Przypomnienia</h2>
      <p className="tight">
        Rano o {hhmm(MORNING_AT)} — w dni, w które plan ma trening. Wieczorem o {hhmm(EVENING_AT)} —
        żeby wpisać kroki, bieżnię, rower albo taniec z całego dnia. Godziny według zegara telefonu.
      </p>

      {BLOCKED[status] && <p className="tight cardio-note">{BLOCKED[status]}</p>}

      {status === 'off' && (
        <button
          className="btn wide"
          style={{ marginTop: 10 }}
          disabled={busy}
          onClick={() =>
            void run(
              () => enablePush(state),
              'on',
              'Przypomnienia włączone.',
              'Bez zgody na powiadomienia przypomnień nie będzie. Możesz spróbować jeszcze raz.',
            )
          }
        >
          Włącz przypomnienia
        </button>
      )}

      {status === 'on' && (
        <>
          <span className="seg-label" aria-hidden="true">
            rano, {hhmm(MORNING_AT)} — trening z planu
          </span>
          <Segmented
            label={`Przypomnienie rano o ${hhmm(MORNING_AT)} w dni treningu`}
            options={ON_OFF}
            value={prefs.morning ? 'on' : 'off'}
            onChange={(v) => onPrefs({ ...prefs, morning: v === 'on' })}
          />
          {prefs.morning && !state.plan && (
            <p className="tight cardio-note">
              Planu teraz nie ma, więc rano nie będzie o czym przypominać — przypomnienie ruszy
              razem z planem.
            </p>
          )}
          <span className="seg-label" aria-hidden="true">
            wieczorem, {hhmm(EVENING_AT)} — kroki i ruch z dnia
          </span>
          <Segmented
            label={`Przypomnienie wieczorem o ${hhmm(EVENING_AT)} o krokach i ruchu`}
            options={ON_OFF}
            value={prefs.evening ? 'on' : 'off'}
            onChange={(v) => onPrefs({ ...prefs, evening: v === 'on' })}
          />
          <button
            className="btn ghost sm"
            disabled={busy}
            onClick={() => void run(disablePush, 'off', 'Przypomnienia wyłączone na tym telefonie.')}
          >
            Wyłącz przypomnienia na tym telefonie
          </button>
        </>
      )}

      <p className="hint" style={{ marginTop: 10 }}>
        Przypomnienia wysyła mały serwer, bo strona sama nie umie obudzić telefonu o konkretnej
        godzinie. Dostaje adres powiadomień tego telefonu, strefę czasową i teksty przypomnień na
        trzy tygodnie naprzód — bez historii treningów i bez danych o tobie. Gdy przestaniesz
        otwierać aplikację, przypomnienia same się skończą.
      </p>
    </div>
  );
}
