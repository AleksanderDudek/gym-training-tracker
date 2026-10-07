/**
 * Ślad tej wizyty — do wiadomości z uwagą albo zgłoszeniem błędu.
 *
 * Trzyma po kolei odwiedzone ekrany, stuknięcia i błędy aplikacji, razem z czasem od
 * otwarcia. **Tylko w pamięci**: nie zapisuje się w przeglądarce, nie wychodzi do sieci
 * i znika po zamknięciu karty. Do autora trafia wyłącznie razem z wiadomością, którą ktoś
 * sam wysyła — tak dalej obowiązuje obietnica z wprowadzenia: bez śledzenia.
 *
 * Etykiety stuknięć mają liczby zamienione na „#”: przycisk „Usuń wpis: 8 421 kroków” mówi,
 * co ktoś zrobił, ale nie zdradza wyników.
 */

export interface TrailEvent {
  /** Sekundy od otwarcia aplikacji. */
  t: number;
  kind: 'view' | 'tap' | 'error';
  name: string;
}

/** Ostatnie zdarzenia — więcej nie mieści się w uwadze, a odtwarzanie błędu i tak patrzy na koniec. */
export const TRAIL_MAX = 80;

const masked = (s: string): string =>
  s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\d+(?:[ .,]\d+)*/g, '#')
    .slice(0, 80);

export interface Trail {
  view: (name: string) => void;
  tap: (label: string) => void;
  error: (message: string) => void;
  /** Aplikacja na ekranie albo w tle — z niej liczy się czas aktywny. */
  visible: (on: boolean, now?: number) => void;
  /** Kopia śladu i liczniki czasu na teraz. */
  snapshot: (now?: number) => TrailSnapshot;
  /** Ekran, na którym ktoś teraz jest. */
  current: () => string;
}

export interface TrailSnapshot {
  view: string;
  /** Sekundy od otwarcia aplikacji. */
  sessionSec: number;
  /** Z tego — z aplikacją na ekranie (bez czasu w tle). */
  activeSec: number;
  events: TrailEvent[];
}

/** Ślad z własnym zegarem — test podaje go z ręki, aplikacja bierze `Date.now`. */
export function createTrail(start: number = Date.now(), visible: () => boolean = () => true): Trail {
  const events: TrailEvent[] = [];
  let view = '';
  let active = 0;
  let since: number | null = visible() ? start : null;

  const t = (now: number) => Math.round((now - start) / 1000);
  const push = (e: Omit<TrailEvent, 't'>, now = Date.now()) => {
    const last = events[events.length - 1];
    if (last && last.kind === e.kind && last.name === e.name) return;
    events.push({ t: t(now), ...e });
    if (events.length > TRAIL_MAX) events.splice(0, events.length - TRAIL_MAX);
  };

  return {
    view: (name) => {
      view = name;
      push({ kind: 'view', name: masked(name) });
    },
    tap: (label) => {
      const name = masked(label);
      if (name) push({ kind: 'tap', name });
    },
    error: (message) => push({ kind: 'error', name: masked(message) }),
    visible: (on, now = Date.now()) => {
      if (on && since === null) since = now;
      if (!on && since !== null) {
        active += now - since;
        since = null;
      }
    },
    current: () => view,
    snapshot: (now = Date.now()) => ({
      view,
      sessionSec: t(now),
      activeSec: Math.round((active + (since !== null ? now - since : 0)) / 1000),
      events: events.map((e) => ({ ...e })),
    }),
  };
}

/** Ślad tej wizyty w aplikacji. */
export const trail = createTrail(Date.now(), () => typeof document === 'undefined' || document.visibilityState === 'visible');

/**
 * Podpina ślad pod stronę: stuknięcia w przyciski i odnośniki, zmianę widoczności i błędy.
 * Jedno nasłuchiwanie w fazie przechwytywania zamiast dopisywania się do każdej akcji —
 * ślad nie rozjedzie się z aplikacją, gdy dojdzie nowy przycisk.
 */
export function attachTrail(t: Trail = trail): () => void {
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.('button, a, summary, [role="button"]');
    if (!el || el.closest('[data-trail="off"]')) return;
    t.tap(el.getAttribute('aria-label') || el.textContent || el.tagName.toLowerCase());
  };
  const onVis = () => t.visible(document.visibilityState === 'visible');
  const onError = (e: ErrorEvent) => t.error(e.message || 'błąd');
  const onReject = (e: PromiseRejectionEvent) =>
    t.error(e.reason instanceof Error ? e.reason.message : String(e.reason ?? 'odrzucona obietnica'));
  document.addEventListener('click', onClick, true);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onReject);
  return () => {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onReject);
  };
}
