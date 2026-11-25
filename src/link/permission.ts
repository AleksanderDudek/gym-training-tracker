import { hasPush, isIos, isStandalone, pushConfigured } from '../push';
import { linkConfigured } from './config';

/**
 * Pytanie o zgodę na powiadomienia od prowadzącego — osobno od `notify.ts`, bo musi paść wprost
 * w stuknięciu, zanim cokolwiek na coś poczeka: przeglądarki (Safari najostrzej) pytają tylko w geście
 * użytkownika, a `await import('../link/notify')` z ekranu Dziś ten gest by zgubił. Moduł bez rozmowy
 * ze Sztabem i bez kryptografii, więc ekran Dziś (główna paczka) wczytuje go od razu.
 */

/** `null` — nie ma o co pytać (odpowiedź już jest albo powiadomień tu nie będzie). Nigdy nie rzuca. */
export function askCoachPermission(): Promise<NotificationPermission> | null {
  try {
    if (!pushConfigured() || !linkConfigured() || !hasPush() || (isIos() && !isStandalone()) || Notification.permission !== 'default') return null;
    return Promise.resolve(Notification.requestPermission()).then(
      () => Notification.permission,
      () => Notification.permission,
    );
  } catch {
    return null;
  }
}
