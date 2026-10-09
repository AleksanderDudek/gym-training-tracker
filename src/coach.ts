/**
 * Prowadzenie sesji w przeglądarce: ekran, który nie gaśnie, i sygnał końca przerwy.
 *
 * - **Ekran** — Screen Wake Lock. Bez niego telefon gaśnie w połowie przerwy, a zgaszona karta
 *   nie odlicza na głos. Przeglądarka zdejmuje blokadę, gdy karta znika z ekranu, więc wraca
 *   ona przy każdym powrocie. Gdzie API nie ma (starsze Safari), ekran gaśnie jak zwykle,
 *   a przerwa i tak liczy się dalej — jej koniec jest zapisany jako chwila.
 * - **Sygnał** — dwa krótkie piknięcia z Web Audio i wibracja (Android; iPhone nie wibruje
 *   ze stron). Dźwięk w przeglądarce wolno włączyć dopiero po stuknięciu, dlatego `unlock`
 *   woła się przy „Zaczynam” i „Zrobione”.
 */

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

export function unlockSound(): void {
  try {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* Bez dźwięku zostaje wibracja i licznik na ekranie. */
  }
}

/** Koniec przerwy: dwa piknięcia i wibracja. */
export function signal(): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* brak wibracji */
  }
  const c = ctx;
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime;
  [0, 0.28].forEach((dt) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.2);
    o.connect(g).connect(c.destination);
    o.start(t0 + dt);
    o.stop(t0 + dt + 0.22);
  });
}

/** Trzyma ekran włączony; zwraca funkcję, która go puszcza. */
export function keepAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let alive = true;
  const take = async () => {
    try {
      if (alive && document.visibilityState === 'visible' && 'wakeLock' in navigator)
        lock = await navigator.wakeLock.request('screen');
    } catch {
      /* Oszczędzanie baterii albo brak zgody — ekran zgaśnie jak zwykle. */
    }
  };
  const back = () => {
    if (document.visibilityState === 'visible') void take();
  };
  void take();
  document.addEventListener('visibilitychange', back);
  return () => {
    alive = false;
    document.removeEventListener('visibilitychange', back);
    void lock?.release().catch(() => undefined);
  };
}
