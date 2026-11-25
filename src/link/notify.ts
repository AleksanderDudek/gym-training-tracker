import type { AppState } from '../types';
import type { LinkConnection } from './store';

/**
 * Powiadomienia push od prowadzącego (spec 2026-11-25 „powiadomienia”). Kontrakt rdzenia — wypełnia go
 * część „Telefon: powiadomienia”.
 *
 * Jedna subskrypcja push urządzenia (ten sam klucz VAPID co przypomnienia, `src/push.ts`) — na serwerze
 * aplikacji GYM TRACKERa. Dla każdej trwającej współpracy telefon losuje token powiadomień, rejestruje go
 * tam (`POST /link/register` z subskrypcją, strefą i językiem) i podaje Sztabowi (`clientSetNotify`).
 * Sztab woła potem serwer tym tokenem i rodzajem zdarzenia; treści serwer nie zna.
 */

export type CoachPushState = 'unconfigured' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

/** Stan dla jednej współpracy (albo ogólnie, bez `connectionId`). */
export async function coachPushState(connectionId?: string): Promise<CoachPushState> {
  void connectionId;
  return 'unconfigured';
}

/** Włącza powiadomienia od prowadzącego tej współpracy (pyta o zgodę przeglądarki, gdy trzeba). */
export async function enableCoachPush(connectionId: string, state: AppState): Promise<CoachPushState> {
  void connectionId;
  void state;
  return 'unconfigured';
}

/** Wyłącza je: kasuje token na serwerze aplikacji i w Sztabie. */
export async function disableCoachPush(connectionId: string): Promise<CoachPushState> {
  void connectionId;
  return 'off';
}

/**
 * W synchronizacji: odświeża rejestrację (co kilka dni, żeby serwer nie skasował cichej subskrypcji),
 * ponawia to, co nie doszło do Sztabu, i sprząta po zakończonych współpracach.
 */
export async function keepCoachPush(c: LinkConnection): Promise<'ok' | 'offline'> {
  void c;
  return 'ok';
}
