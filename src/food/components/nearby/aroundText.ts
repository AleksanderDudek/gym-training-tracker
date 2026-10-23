import { LOCALE, text } from '../../../i18n';
import type { AroundState } from '../../hooks/useNearbyShops';

/** What both views say about a slow or busy map server and an older answer on screen. */
const T = text({
  pl: {
    slow: (s: number) => `Serwer map odpowiada wolno — czekam (${s} s)…`,
    wait: (s: number) => `Serwer map jest zajęty — ponawiam za ${s} s…`,
    again: (s: number) => `Ponowię sam za ${s} s.`,
    meanwhile: (what: string, age: string) => `Na razie pokazuję ${what} zapisane ${age}.`,
    showing: (what: string, age: string) => `Pokazuję ${what} zapisane ${age}.`,
  },
  en: {
    slow: (s: number) => `The map server is slow — waiting (${s} s)…`,
    wait: (s: number) => `The map server is busy — trying again in ${s} s…`,
    again: (s: number) => `I’ll try again in ${s} s.`,
    meanwhile: (what: string, age: string) => `Meanwhile showing ${what} saved ${age}.`,
    showing: (what: string, age: string) => `Showing ${what} saved ${age}.`,
  },
});

/** A search this long is called slow on screen. */
const SLOW_MS = 12_000;
/** While a new answer loads, an older one on screen is pointed out only past this age (fresh ones are). */
const OLD_MS = 24 * 3600 * 1000;

const RELATIVE = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/** „5 minut temu”, „2 godziny temu”, „wczoraj”. */
export function ageText(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return RELATIVE.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return RELATIVE.format(-hours, 'hour');
  return RELATIVE.format(-Math.round(hours / 24), 'day');
}

export interface AroundNotes {
  /** Appended to the status line, a live region: it changes only when the situation does. */
  status: string;
  /** A countdown or a stopwatch, refreshed every second - kept out of the live region, so it is not read out each time. */
  clock: string | null;
}

/**
 * The words about the server and the data behind the list: an older answer on screen and its age,
 * a pause before the next try, a search that takes long. `what` names the items („lokale”, „sklepy”).
 */
export function aroundNotes(
  state: Pick<AroundState<unknown>, 'status' | 'items' | 'savedAt' | 'since' | 'retryAt'>,
  what: string,
  now: number,
): AroundNotes {
  const left = state.retryAt ? Math.ceil((state.retryAt - now) / 1000) : 0;
  const age = state.savedAt !== null && state.items.length > 0 ? now - state.savedAt : null;
  if (state.status === 'loading') {
    const elapsed = state.since === null ? 0 : now - state.since;
    return {
      status: age !== null && age >= OLD_MS ? T.meanwhile(what, ageText(age)) : '',
      clock: left > 0 ? T.wait(left) : elapsed >= SLOW_MS ? T.slow(Math.round(elapsed / 1000)) : null,
    };
  }
  if (state.status === 'error') {
    return { status: age !== null ? T.showing(what, ageText(age)) : '', clock: left > 0 ? T.again(left) : null };
  }
  return { status: '', clock: null };
}
