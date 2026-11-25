/**
 * Co o powiadomieniach od prowadzącego pamięta samo urządzenie — poza zapisem współprac (`gt-link`), bo
 * dotyczy subskrypcji i zaległości wobec serwerów, a nie współpracy. Dlatego przeżywa też „Usuń wszystkie
 * dane”: wyrejestrowanie, które wtedy nie doszło (brak sieci), czeka tu na następną synchronizację.
 *
 * Moduł bez sieci i bez kryptografii: czyta go też główna paczka (czy jest po co wczytać synchronizację,
 * „Nie teraz” na ekranie Dziś). Logika jest w `notify.ts`.
 */

/**
 * - `ep` — subskrypcja, z którą token ostatnio się zarejestrował: numer kolejnej subskrypcji urządzenia
 *   (`subscriptionEpoch`) i jej adres. Inna — rejestracja od nowa, bo serwer mógł ją skasować razem z tokenami
 *   (wypisanie, 404/410 z usługi powiadomień), a nowa subskrypcja tokenów jeszcze nie zna;
 * - `drop` — tokeny wyłączone bez sieci, których serwer aplikacji jeszcze nie zapomniał;
 * - `cancel` — odwołane wizyty, których przypomnienie wciąż czeka w kolejce serwera (`ref` już policzony,
 *   `notifyRef`);
 * - `unset` — współprace, w których powiadomienia wyłączono, a Sztab (bez sieci) wciąż trzyma ich token
 *   i pokazuje prowadzącemu „powiadomienia włączone”.
 */
export interface NotifyMemo {
  ep: Record<string, string>;
  drop: string[];
  cancel: { token: string; ref: string }[];
  unset: string[];
}

export const NOTIFY_MEMO_KEY = 'gt-coach-push';

/** „Nie teraz” przy powiadomieniach na ekranie Dziś — osobno dla każdej współpracy. */
export const LATER_KEY = 'gt-coach-push-later';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : []);

export function notifyMemo(): NotifyMemo {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIFY_MEMO_KEY) ?? 'null') as Partial<NotifyMemo> | null;
    const ep: Record<string, string> = {};
    if (raw?.ep && typeof raw.ep === 'object') for (const [k, v] of Object.entries(raw.ep)) if (typeof v === 'string') ep[k] = v;
    return {
      ep,
      drop: strings(raw?.drop),
      cancel: Array.isArray(raw?.cancel)
        ? raw.cancel.filter((x): x is NotifyMemo['cancel'][number] => !!x && typeof x.token === 'string' && typeof x.ref === 'string')
        : [],
      unset: strings(raw?.unset),
    };
  } catch {
    return { ep: {}, drop: [], cancel: [], unset: [] };
  }
}

export function changeNotifyMemo(f: (m: NotifyMemo) => void): void {
  const m = notifyMemo();
  f(m);
  try {
    if (!Object.keys(m.ep).length && !m.drop.length && !m.cancel.length && !m.unset.length) localStorage.removeItem(NOTIFY_MEMO_KEY);
    else localStorage.setItem(NOTIFY_MEMO_KEY, JSON.stringify(m));
  } catch {
    /* Bez pamięci strony: rejestracja pójdzie przy następnej synchronizacji jeszcze raz. */
  }
}

/** Czy coś czeka na serwer (wyrejestrowanie, odwołanie, token do skasowania w Sztabie) — wtedy synchronizacja ma po co ruszyć. */
export function hasNotifyChores(): boolean {
  const m = notifyMemo();
  return m.drop.length > 0 || m.cancel.length > 0 || m.unset.length > 0;
}

export function laterIds(): string[] {
  try {
    return strings(JSON.parse(localStorage.getItem(LATER_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export function rememberLater(id: string): void {
  try {
    localStorage.setItem(LATER_KEY, JSON.stringify([...new Set([...laterIds(), id])]));
  } catch {
    // Bez pamięci strony linia wróci przy następnym otwarciu — nic gorszego.
  }
}
