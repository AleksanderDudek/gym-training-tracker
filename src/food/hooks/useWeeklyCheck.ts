import { useContext, useEffect, useState } from 'react';
import { BridgeContext } from '../bridge';
import { checkDue } from '../diet/calibrate';
import { mondayOf } from '../diet/model';
import { runWeeklyCheck } from '../diet/store';
import type { Profile } from '../diet/types';
import type { Clock } from './useDiet';

/** The longest a screen waits for this week's check before it shows the stored target. */
export const CHECK_WAIT_MS = 3000;

interface Run {
  /** Settles when the check is done — or failed (logged). */
  done: Promise<void>;
  /** When the screens stop waiting for it (ms since the epoch). */
  until: number;
}

/**
 * This tab's run of the week's check, keyed by its Monday and the week the stored check was for: the
 * Today card, the diary and „Zjedz teraz” share one run, and a failed run is not repeated in the tab.
 * A restored backup with an older check is a new key.
 */
const runs = new Map<string, Run>();

/** Forgets this tab's runs (tests). */
export function forgetWeeklyChecks(): void {
  runs.clear();
}

/**
 * The Monday check, triggered from the Today card, the diary and „Zjedz teraz” (spec §2.4): runs
 * this week's check once per tab when it is due, with the gym weight log's weigh-ins. `pending`
 * while it may still change today's target — the screens show a placeholder — then `ready`; after
 * 3 s it is `ready` anyway (the stored target), and a failing check is logged, never shown. Without
 * a bridge (no weigh-ins to read) nothing runs.
 */
export function useWeeklyCheck(profile: Profile | null | undefined, clock: Clock): 'ready' | 'pending' {
  const bridge = useContext(BridgeContext);
  const due = !!bridge && !!profile && checkDue(profile, clock.date, clock.hour);
  const key = due ? `${mondayOf(clock.date)}|${profile.lastCheck?.week ?? '-'}` : null;
  const [settled, setSettled] = useState<string | null>(null);

  useEffect(() => {
    if (!key || !bridge) return;
    let live = true;
    let run = runs.get(key);
    if (!run) {
      run = {
        done: runWeeklyCheck({ weighIns: bridge.weights, today: clock.date, hour: clock.hour }).then(
          () => undefined,
          (error: unknown) => console.error(error),
        ),
        until: Date.now() + CHECK_WAIT_MS,
      };
      runs.set(key, run);
    }
    const ready = () => {
      if (live) setSettled(key);
    };
    const timer = window.setTimeout(ready, Math.max(0, run.until - Date.now()));
    void run.done.then(ready);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [key, bridge, clock.date, clock.hour]);

  return key !== null && settled !== key ? 'pending' : 'ready';
}
