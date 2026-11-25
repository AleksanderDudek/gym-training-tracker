import { useEffect, useState } from 'react';
import { text } from '../../i18n';
import { coachPushState, disableCoachPush, enableCoachPush, keepCoachPush } from '../../link/notify';
import type { CoachPushState } from '../../link/notify';
import { connectionOf, linkState } from '../../link/store';
import type { LinkConnection } from '../../link/store';
import type { AppState } from '../../types';

/**
 * Powiadomienia od prowadzącego na ekranach współpracy: pole przy przyjmowaniu zaproszenia i sekcja na
 * stronie współpracy. Logika (zgoda, subskrypcja, rejestracja, token w Sztabie) jest w `src/link/notify.ts`.
 */

const T = text({
  pl: {
    title: 'Powiadomienia',
    check: 'Powiadamiaj mnie o wiadomościach, zaleceniach i wizytach',
    checkHint: 'Telefon zapyta jeszcze o zgodę na powiadomienia.',
    privacy: 'Powiadomienie mówi tylko „nowa wiadomość” albo „nowe zalecenie” — bez treści i bez nazwiska.',
    on: 'Włączone: nowa wiadomość, nowe zalecenie, zmiana wizyty i przypomnienie 2 godziny przed wizytą.',
    off: 'Wyłączone — nowości od prowadzącego zobaczysz po otwarciu aplikacji.',
    denied:
      'Powiadomienia dla tej aplikacji są zablokowane. Odblokujesz je w ustawieniach telefonu albo przeglądarki (uprawnienia strony → Powiadomienia), a potem wrócisz tutaj.',
    iosInstall:
      'Na iPhonie powiadomienia działają tylko w aplikacji dodanej do ekranu początkowego: w Safari stuknij Udostępnij → Do ekranu początkowego i otwórz GYM TRACKER z ikony. Potrzebny iOS 16.4 albo nowszy.',
    iosInvite:
      'Na iPhonie powiadomienia działają tylko w aplikacji dodanej do ekranu początkowego (Udostępnij → Do ekranu początkowego, iOS 16.4 albo nowszy). Bez nich współpraca działa tak samo — nowości zobaczysz po otwarciu aplikacji.',
    deniedInvite: 'Powiadomienia są zablokowane w ustawieniach przeglądarki — współpraca działa bez nich.',
    enable: 'Włącz powiadomienia',
    disable: 'Wyłącz powiadomienia',
    enabled: 'Powiadomienia od prowadzącego włączone.',
    disabled: 'Powiadomienia od prowadzącego wyłączone.',
    noPermission: 'Bez zgody na powiadomienia telefon nie da znać. Możesz spróbować jeszcze raz.',
    failed: 'Nie udało się — sprawdź połączenie i spróbuj jeszcze raz.',
  },
  en: {
    title: 'Notifications',
    check: 'Notify me about messages, recommendations and appointments',
    checkHint: 'Your phone will still ask for permission to show notifications.',
    privacy: 'A notification only says “new message” or “new recommendation” — no content and no names.',
    on: 'On: new message, new recommendation, appointment change and a reminder 2 hours before an appointment.',
    off: 'Off — you’ll see news from your coach when you open the app.',
    denied:
      'Notifications for this app are blocked. Unblock them in your phone’s or browser’s settings (site permissions → Notifications), then come back here.',
    iosInstall:
      'On iPhone, notifications only work in an app added to the Home Screen: in Safari tap Share → Add to Home Screen and open GYM TRACKER from the icon. You need iOS 16.4 or later.',
    iosInvite:
      'On iPhone, notifications only work in an app added to the Home Screen (Share → Add to Home Screen, iOS 16.4 or later). Without them the connection works just the same — you’ll see news when you open the app.',
    deniedInvite: 'Notifications are blocked in your browser settings — the connection works without them.',
    enable: 'Turn on notifications',
    disable: 'Turn off notifications',
    enabled: 'Notifications from your coach are on.',
    disabled: 'Notifications from your coach are off.',
    noPermission: 'Without permission for notifications your phone won’t let you know. You can try again.',
    failed: 'That didn’t work — check your connection and try again.',
  },
});

/** Da się włączyć (albo już włączone) — w przeciwieństwie do stanów, w których nie ma o czym mówić. */
export const pushPossible = (st: CoachPushState | null): boolean => st === 'off' || st === 'on';

/** Stan powiadomień jednej współpracy albo ogólny (`null` — jeszcze nie wiadomo); `dep` — kiedy sprawdzić znów. */
export function useCoachPushState(connectionId?: string, dep?: unknown): [CoachPushState | null, (s: CoachPushState) => void] {
  const [st, setSt] = useState<CoachPushState | null>(null);
  useEffect(() => {
    let live = true;
    void coachPushState(connectionId).then((s) => live && setSt(s));
    return () => {
      live = false;
    };
  }, [connectionId, dep]);
  return [st, setSt];
}

/**
 * Pole „Powiadamiaj mnie…” przy przyjmowaniu zaproszenia. Bez serwera w buildzie i w przeglądarce bez
 * powiadomień — nic; na iPhonie poza aplikacją z ikony — wskazówka zamiast pola.
 */
export function NotifyCheck({ st, checked, onChange }: { st: CoachPushState | null; checked: boolean; onChange: (v: boolean) => void }) {
  if (st === 'ios-install')
    return (
      <div className="grp">
        <h2>{T.title}</h2>
        <p className="hint">{T.iosInvite}</p>
      </div>
    );
  if (st === 'denied')
    return (
      <div className="grp">
        <h2>{T.title}</h2>
        <p className="hint">{T.deniedInvite}</p>
      </div>
    );
  if (!pushPossible(st)) return null;
  return (
    <div className="grp">
      <h2>{T.title}</h2>
      <label className="check-row">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{T.check}</span>
      </label>
      {checked && typeof Notification !== 'undefined' && Notification.permission === 'default' && <p className="hint">{T.checkHint}</p>}
      <p className="hint">{T.privacy}</p>
    </div>
  );
}

/**
 * Po przyjęciu zaproszenia: `asked` — pytanie o zgodę zadane jeszcze w stuknięciu (`askCoachPermission`).
 * Odmowa albo zamknięte pytanie — nic więcej; drugi raz, już bez gestu, się nie pyta.
 */
export async function enableAfterAccept(connectionId: string, state: AppState, asked: Promise<NotificationPermission> | null): Promise<void> {
  if (asked && (await asked) !== 'granted') return;
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') await enableCoachPush(connectionId, state);
}

const LINE: Partial<Record<CoachPushState, string>> = { on: T.on, off: T.off, denied: T.denied, 'ios-install': T.iosInstall };

/**
 * Sekcja „Powiadomienia” na stronie współpracy: stan i przełącznik. Po zakończonej współpracy nic nie
 * pokazuje, za to sprząta: serwer aplikacji zapomina jej token.
 */
export function NotifySection({ c, state, onToast }: { c: LinkConnection; state: AppState; onToast: (m: string) => void }) {
  const token = c.notify?.token ?? null;
  const [st, setSt] = useCoachPushState(c.id, token);
  const [busy, setBusy] = useState(false);
  const ended = c.status !== 'active';

  // Zakończona współpraca z tokenem: serwer aplikacji ma go zapomnieć (raz na zmianę, nie przy każdym zapisie).
  useEffect(() => {
    const fresh = connectionOf(linkState(), c.id);
    if (ended && token && fresh?.notify) void keepCoachPush(fresh);
  }, [ended, token, c.id]);

  if (ended || st === null || !LINE[st]) return null;

  const toggle = async () => {
    setBusy(true);
    if (st === 'on') {
      const r = await disableCoachPush(c.id);
      setSt(r);
      onToast(r === 'on' ? T.failed : T.disabled);
    } else {
      const r = await enableCoachPush(c.id, state);
      setSt(r);
      // Odmowa albo zamknięte pytanie o zgodę — co innego niż serwer, który nie odpowiedział.
      const asked = typeof Notification !== 'undefined' && Notification.permission !== 'granted';
      onToast(r === 'on' ? T.enabled : asked ? T.noPermission : T.failed);
    }
    setBusy(false);
  };

  return (
    <div className="grp">
      <h2>{T.title}</h2>
      <p className="tight" role="status">
        {LINE[st]}
      </p>
      {pushPossible(st) && (
        <div className="btnrow">
          <button className={`btn sm${st === 'on' ? ' ghost' : ''}`} disabled={busy} aria-busy={busy} onClick={() => void toggle()}>
            {st === 'on' ? T.disable : T.enable}
          </button>
        </div>
      )}
      <p className="hint" style={{ marginTop: 10 }}>
        {T.privacy}
      </p>
    </div>
  );
}
