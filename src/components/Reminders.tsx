import { useEffect, useState } from 'react';
import { EVENING_AT, MORNING_AT, WEIGH_AT, remindersOf } from '../engine/reminders';
import { currentPushState, disablePush, enablePush, pushConfigured } from '../push';
import { text } from '../i18n';
import type { PushState } from '../push';
import { Segmented } from './ui';
import type { AppState, ReminderPrefs } from '../types';

/**
 * Karta przypomnień w ustawieniach. Zgoda na powiadomienia pada dopiero po stuknięciu
 * w „Włącz” — nigdy przy starcie aplikacji: pytanie bez kontekstu przeglądarki karzą
 * wyciszeniem, a ludzie odmawiają, zanim wiedzą, o co chodzi.
 */

const T = text({
  pl: {
    on: 'Wł.',
    off: 'Wył.',
    blocked: {
      'ios-install':
        'Na iPhonie powiadomienia działają tylko w aplikacji dodanej do ekranu początkowego: w Safari stuknij Udostępnij → Do ekranu początkowego, otwórz GYM TRACKER z ikony i wróć tutaj. Potrzebny iOS 16.4 albo nowszy.',
      unsupported: 'Ta przeglądarka nie obsługuje powiadomień ze stron. Na Androidzie działają w Chrome, na iPhonie — w Safari po dodaniu aplikacji do ekranu początkowego.',
      'no-worker': 'Powiadomienia działają w opublikowanej wersji aplikacji — tej otwieranej z adresu w sieci albo z ikony na telefonie.',
      denied:
        'Powiadomienia dla tej aplikacji są zablokowane. Odblokujesz je w ustawieniach telefonu albo przeglądarki (uprawnienia strony → Powiadomienia), a potem wrócisz tutaj.',
    } as Partial<Record<PushState, string>>,
    failed: 'Nie udało się — sprawdź połączenie i spróbuj jeszcze raz.',
    title: 'Przypomnienia',
    intro: (morning: string, evening: string, weigh: string) =>
      `Rano o ${morning} — w dni, w które plan ma trening. Wieczorem o ${evening} — żeby wpisać kroki, bieżnię, rower albo taniec z całego dnia. Na życzenie o ${weigh} — o porannym ważeniu. Godziny według zegara telefonu.`,
    enabled: 'Przypomnienia włączone.',
    noPermission: 'Bez zgody na powiadomienia przypomnień nie będzie. Możesz spróbować jeszcze raz.',
    enable: 'Włącz przypomnienia',
    morning: (at: string) => `rano, ${at} — trening z planu`,
    morningLabel: (at: string) => `Przypomnienie rano o ${at} w dni treningu`,
    noPlan: 'Planu teraz nie ma, więc rano nie będzie o czym przypominać — przypomnienie ruszy razem z planem.',
    evening: (at: string) => `wieczorem, ${at} — kroki i ruch z dnia`,
    eveningLabel: (at: string) => `Przypomnienie wieczorem o ${at} o krokach i ruchu`,
    weigh: (at: string) => `rano, ${at} — ważenie`,
    weighLabel: (at: string) => `Przypomnienie o ważeniu o ${at}`,
    disabled: 'Przypomnienia wyłączone na tym telefonie.',
    disable: 'Wyłącz przypomnienia na tym telefonie',
    how: 'Przypomnienia wysyła mały serwer, bo strona sama nie umie obudzić telefonu o konkretnej godzinie. Dostaje adres powiadomień tego telefonu, strefę czasową i teksty przypomnień na trzy tygodnie naprzód — bez historii treningów i bez danych o tobie. Gdy przestaniesz otwierać aplikację, przypomnienia same się skończą.',
  },
  en: {
    on: 'On',
    off: 'Off',
    blocked: {
      'ios-install':
        'On iPhone, notifications only work in an app added to the Home Screen: in Safari tap Share → Add to Home Screen, open GYM TRACKER from the icon and come back here. You need iOS 16.4 or later.',
      unsupported: 'This browser doesn’t support notifications from websites. On Android they work in Chrome; on iPhone, in Safari once the app is added to the Home Screen.',
      'no-worker': 'Notifications work in the published version of the app — the one opened from its web address or from the icon on your phone.',
      denied:
        'Notifications for this app are blocked. Unblock them in your phone’s or browser’s settings (site permissions → Notifications), then come back here.',
    },
    failed: 'That didn’t work — check your connection and try again.',
    title: 'Reminders',
    intro: (morning: string, evening: string, weigh: string) =>
      `In the morning at ${morning} — on days your plan has a workout. In the evening at ${evening} — to log steps, treadmill, bike or dance from the whole day. On request at ${weigh} — for your morning weigh-in. Times follow your phone’s clock.`,
    enabled: 'Reminders on.',
    noPermission: 'Without permission for notifications there won’t be any reminders. You can try again.',
    enable: 'Turn on reminders',
    morning: (at: string) => `morning, ${at} — workout from your plan`,
    morningLabel: (at: string) => `Morning reminder at ${at} on training days`,
    noPlan: 'There’s no plan right now, so there’s nothing to remind you of in the morning — the reminder starts with your plan.',
    evening: (at: string) => `evening, ${at} — steps and activity from the day`,
    eveningLabel: (at: string) => `Evening reminder at ${at} about steps and activity`,
    weigh: (at: string) => `morning, ${at} — weigh-in`,
    weighLabel: (at: string) => `Weigh-in reminder at ${at}`,
    disabled: 'Reminders off on this phone.',
    disable: 'Turn off reminders on this phone',
    how: 'Reminders are sent by a small server, because a website can’t wake your phone at a set time on its own. It gets this phone’s notification address, your time zone and the reminder texts for three weeks ahead — no workout history and no data about you. If you stop opening the app, the reminders stop by themselves.',
  },
});

export const ON_OFF: { key: 'on' | 'off'; label: string }[] = [
  { key: 'on', label: T.on },
  { key: 'off', label: T.off },
];

const hhmm = (t: string): string => t.replace(/^0/, '');

/** Dlaczego się nie da — i co z tym zrobić — dla każdego stanu poza „wyłączone” i „włączone”. */
const BLOCKED: Partial<Record<PushState, string>> = T.blocked;

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
      onToast(T.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grp">
      <h2>{T.title}</h2>
      <p className="tight">{T.intro(hhmm(MORNING_AT), hhmm(EVENING_AT), hhmm(WEIGH_AT))}</p>

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
              T.enabled,
              T.noPermission,
            )
          }
        >
          {T.enable}
        </button>
      )}

      {status === 'on' && (
        <>
          <span className="seg-label" aria-hidden="true">
            {T.morning(hhmm(MORNING_AT))}
          </span>
          <Segmented
            label={T.morningLabel(hhmm(MORNING_AT))}
            options={ON_OFF}
            value={prefs.morning ? 'on' : 'off'}
            onChange={(v) => onPrefs({ ...prefs, morning: v === 'on' })}
          />
          {prefs.morning && !state.plan && (
            <p className="tight cardio-note">{T.noPlan}</p>
          )}
          <span className="seg-label" aria-hidden="true">
            {T.evening(hhmm(EVENING_AT))}
          </span>
          <Segmented
            label={T.eveningLabel(hhmm(EVENING_AT))}
            options={ON_OFF}
            value={prefs.evening ? 'on' : 'off'}
            onChange={(v) => onPrefs({ ...prefs, evening: v === 'on' })}
          />
          <span className="seg-label" aria-hidden="true">
            {T.weigh(hhmm(WEIGH_AT))}
          </span>
          <Segmented
            label={T.weighLabel(hhmm(WEIGH_AT))}
            options={ON_OFF}
            value={prefs.weigh ? 'on' : 'off'}
            onChange={(v) => onPrefs({ ...prefs, weigh: v === 'on' })}
          />
          <button
            className="btn ghost sm"
            disabled={busy}
            onClick={() => void run(disablePush, 'off', T.disabled)}
          >
            {T.disable}
          </button>
        </>
      )}

      <p className="hint" style={{ marginTop: 10 }}>
        {T.how}
      </p>
    </div>
  );
}
