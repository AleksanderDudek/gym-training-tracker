import type { registerSW } from 'virtual:pwa-register';

/*
 * Service worker od strony aplikacji: rejestracja, „jest nowa wersja” i powrót po awarii.
 *
 * Rejestruje go `main.tsx`, poza Reactem i przed pierwszym renderem — nie komponent, który montuje
 * się dopiero po wczytaniu stanu. Wersja, która wywraca się na starcie, też więc pyta o nowszą,
 * a ekran awarii (`RootBoundary`) może ją wpuścić bez zamykania aplikacji. Stan „nowa wersja
 * czeka” leży tutaj, w małym magazynie dla `useSyncExternalStore`: czyta go pasek `UpdateBar`.
 *
 * Moduł nie importuje wirtualnego `virtual:pwa-register` — dostaje go od `main.tsx`. Testy (bez
 * service workera i bez wtyczki) podstawiają w to miejsce atrapę.
 */

/** Co ile pytać o nową wersję, gdy aplikacja wisi otwarta godzinami (telefon na stojaku przy ławce). */
const HOUR = 60 * 60 * 1000;

let waiting = false;
let started = false;
let update: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

/** Subskrypcja dla `useSyncExternalStore`. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Czy nowa wersja czeka na „Odśwież”. */
export function needRefresh(): boolean {
  return waiting;
}

/**
 * Rejestracja service workera — raz na życie strony: drugi interwał i drugi słuchacz powrotu
 * pytałyby o nową wersję podwójnie.
 */
export function startPwa(register: typeof registerSW): void {
  if (started) return;
  started = true;
  update = register({
    // Po wczytaniu strony, jak dotąd: zapisywanie powłoki nie konkuruje z pierwszym ekranem.
    immediate: false,
    onNeedRefresh() {
      waiting = true;
      listeners.forEach((listener) => listener());
    },
    // O nowe wersje pyta przy starcie (sama rejestracja), po powrocie do aplikacji i co godzinę.
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Bez sieci pytanie i tak się nie uda — nowa wersja poczeka do następnego razu.
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => undefined);
      };
      window.setInterval(check, HOUR);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}

/** „Odśwież” na pasku: nowa wersja przejmuje stronę, a ta się przeładowuje. */
export function applyUpdate(): Promise<void> {
  return update ? update(true) : Promise.resolve();
}

/*
 * Ekran awarii. Wersja, która się wywraca, nie pokaże paska nowej wersji — a nawigację obsługuje
 * zapisana strona, więc samo przeładowanie wczytałoby tę samą zepsutą wersję, dopóki aplikacja nie
 * zostanie zamknięta do końca. Dlatego ekran awarii od razu pyta o poprawkę, a jego „Odśwież”
 * wpuszcza czekającą wersję, zanim przeładuje stronę.
 */

/** Pytanie o nowszą wersję z ekranu awarii; jej instalacja rusza w tle, zanim ktoś stuknie. */
export function lookForFix(): void {
  if (!('serviceWorker' in navigator) || !navigator.onLine) return;
  navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.update())
    .catch(() => undefined);
}

/** Wersja, która właśnie się instaluje, gdy skończy — albo nic, gdy odpadnie lub nie zdąży. */
function installed(worker: ServiceWorker | null, timeout: number): Promise<ServiceWorker | null> {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeout);
    const onChange = () => {
      if (worker.state !== 'installed' && worker.state !== 'redundant') return;
      window.clearTimeout(timer);
      worker.removeEventListener('statechange', onChange);
      resolve(worker.state === 'installed' ? worker : null);
    };
    worker.addEventListener('statechange', onChange);
    onChange();
  });
}

/**
 * „Odśwież” na ekranie awarii. Gdy czeka nowa wersja (albo właśnie się instaluje), dostaje
 * `SKIP_WAITING` i strona przeładowuje się, kiedy ta wersja przejmie kontrolę — a gdyby nie
 * przejęła w porę, przeładowuje się i tak. Bez nowej wersji to zwykłe przeładowanie. Niczego nie
 * czyści: dane leżą w przeglądarce i czekają na wersję, która je otworzy.
 */
export async function reloadFresh(
  reload: () => void = () => window.location.reload(),
  timeout = 4000,
): Promise<void> {
  let gone = false;
  const once = () => {
    if (gone) return;
    gone = true;
    reload();
  };
  try {
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    const registration = await sw?.getRegistration();
    const next = registration ? (registration.waiting ?? (await installed(registration.installing, timeout))) : null;
    if (!sw || !next) {
      once();
      return;
    }
    sw.addEventListener('controllerchange', once, { once: true });
    window.setTimeout(once, timeout);
    next.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    once();
  }
}
