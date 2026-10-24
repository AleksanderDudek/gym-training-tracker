import type { Profile } from '../diet/types';
import type { Clock } from './useDiet';

/**
 * The Monday check, triggered from the Today card, the diary and „Zjedz teraz” (spec §2.4).
 * `pending` while this week's check may still change today's target — the screens show a
 * placeholder for at most 3 s — then `ready`.
 *
 * Stub until package A, which runs the check once per Monday per tab with the bridge's weigh-ins
 * (no bridge: no check), falls back to `ready` after 3 s and logs a failing check. Until then
 * nothing runs and the stored target is final.
 */
export function useWeeklyCheck(_profile: Profile | null | undefined, _clock: Clock): 'ready' | 'pending' {
  return 'ready';
}
