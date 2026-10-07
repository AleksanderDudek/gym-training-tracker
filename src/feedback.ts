import { API_URL } from './api';
import { trail } from './trail';
import type { TrailSnapshot } from './trail';
import type { AppState } from './types';

/**
 * Wiadomość do autora: uwaga, pomysł albo zgłoszenie błędu.
 *
 * Do treści dochodzi kontekst, który pozwala odtworzyć problem: ekran, z którego ktoś pisze,
 * czas wizyty, ślad ekranów i stuknięć (`trail.ts`), przeglądarka i rozmiar ekranu. Bez
 * wyników, wag i historii — tylko liczby, które mówią, ile czego jest (zapisanych treningów,
 * który plan), bo bez nich „nie działa plan” nie da się odtworzyć.
 */

export interface FeedbackContext extends TrailSnapshot {
  path: string;
  ua: string;
  lang: string;
  tz: string;
  viewport: string;
  standalone: boolean;
  online: boolean;
  plan: string | null;
  workouts: number;
  sessionOpen: boolean;
}

export function feedbackContext(state: AppState | null, snap: TrailSnapshot = trail.snapshot()): FeedbackContext {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    /* bez strefy */
  }
  return {
    ...snap,
    path: location.hash || '#/sesja',
    ua: navigator.userAgent,
    lang: navigator.language,
    tz,
    viewport: `${innerWidth}×${innerHeight} @${devicePixelRatio}`,
    standalone: matchMedia?.('(display-mode: standalone)').matches ?? false,
    online: navigator.onLine,
    plan: state?.plan?.templateId ?? null,
    workouts: state?.log.length ?? 0,
    sessionOpen: !!state?.session,
  };
}

/** Najdłuższy bok zrzutu i obrazu z galerii — więcej nie widać, a wiadomość rośnie. */
export const SHOT_MAX_SIDE = 1600;

/**
 * Zrzut tego, co widać na ekranie — bez okna wiadomości (`data-capture="off"`). Biblioteka
 * ładuje się dopiero tutaj, więc nikt, kto nie pisze do autora, jej nie pobiera. Gdy się nie
 * uda (stara przeglądarka, obce czcionki), zostaje dołączenie obrazu z galerii.
 */
export async function captureScreen(): Promise<string | null> {
  try {
    const root = document.getElementById('root');
    if (!root) return null;
    const { toCanvas } = await import('html-to-image');
    const ratio = Math.min(1.5, devicePixelRatio || 1);
    const full = await toCanvas(root, {
      pixelRatio: ratio,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      filter: (n) => !(n instanceof HTMLElement && n.dataset.capture === 'off'),
    });
    // Tylko to, co jest teraz na ekranie — cała długa strona to dużo pikseli i mało treści.
    // Górna krawędź okna w układzie korzenia: korzeń zaczyna się `rect.top` od góry ekranu.
    const top = Math.max(0, Math.round(-root.getBoundingClientRect().top * ratio));
    const h = Math.min(full.height - top, Math.round(innerHeight * ratio));
    const out = document.createElement('canvas');
    out.width = full.width;
    out.height = Math.max(1, h);
    out.getContext('2d')!.drawImage(full, 0, top, full.width, out.height, 0, 0, full.width, out.height);
    return shrink(out);
  } catch {
    return null;
  }
}

/** Płótno do JPEG-a o najdłuższym boku najwyżej `SHOT_MAX_SIDE`. */
function shrink(src: HTMLCanvasElement | HTMLImageElement): string {
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const k = Math.min(1, SHOT_MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

/** Obraz z galerii, zmniejszony jak zrzut. */
export function imageFromFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        resolve(shrink(img));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export type SendResult = 'ok' | 'offline' | 'limit' | 'invalid' | 'error';

export async function sendFeedback(msg: {
  email: string;
  text: string;
  screenshot: string | null;
  context: FeedbackContext;
  website: string;
}): Promise<SendResult> {
  if (!navigator.onLine) return 'offline';
  try {
    const res = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });
    if (res.ok) return 'ok';
    if (res.status === 429) return 'limit';
    if (res.status === 400) return 'invalid';
    return 'error';
  } catch {
    return 'error';
  }
}
