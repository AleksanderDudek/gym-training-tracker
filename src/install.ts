import { isIos, isStandalone } from './push';

/**
 * Aplikacja na ekranie początkowym iPhone'a.
 *
 * Android sam proponuje instalację (Chrome czyta manifest), a iOS nie zrobi tego nigdy: nie ma
 * okna „zainstaluj” ani zdarzenia, które strona mogłaby wywołać. Zostaje „Udostępnij → Do ekranu
 * początkowego” — i trzeba o tym powiedzieć, bo na iPhonie to więcej niż wygoda:
 *
 * - Safari kasuje dane strony, której nie otwiera się przez tydzień (WebKit, limit 7 dni dla
 *   wszystkiego, co zapisuje skrypt) — a tu cała historia treningów i dziennik jedzenia leżą
 *   w przeglądarce. Aplikacja z ekranu początkowego tego limitu nie ma.
 * - Przypomnienia (Web Push) działają na iPhonie tylko w aplikacji z ekranu początkowego.
 * - Aplikacja z ikony ma własne miejsce na dane, osobne od karty Safari — zapisy z karty
 *   przenosi się kopią (eksport tu, import tam).
 */

/**
 * Gdzie ktoś jest, a od tego zależy pierwszy krok:
 * - `safari` — Safari: „Udostępnij” (w nowszym iOS pod „⋯”);
 * - `browser` — inna przeglądarka (Chrome, Firefox, Edge — od iOS 16.4 też dodają do ekranu);
 * - `in-app` — przeglądarka wbudowana w Instagram, Facebooka, TikToka… — stamtąd się nie da,
 *   najpierw trzeba otworzyć stronę w Safari.
 */
export type InstallPlace = 'safari' | 'browser' | 'in-app';

export interface InstallEnv {
  ios: boolean;
  standalone: boolean;
  ua: string;
}

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|musical_ly|BytedanceWebview|Snapchat|Pinterest|GSA\//;
const OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/;

/** Czy i skąd podpowiadać dodanie do ekranu: tylko iOS i tylko poza aplikacją z ikony. */
export function installPlaceOf(e: InstallEnv): InstallPlace | null {
  if (!e.ios || e.standalone) return null;
  if (IN_APP.test(e.ua)) return 'in-app';
  return OTHER_BROWSER.test(e.ua) ? 'browser' : 'safari';
}

export const currentInstallPlace = (): InstallPlace | null =>
  installPlaceOf({ ios: isIos(), standalone: isStandalone(), ua: navigator.userAgent });
