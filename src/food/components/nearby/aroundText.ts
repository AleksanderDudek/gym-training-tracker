import { LOCALE, text } from '../../../i18n';
import type { AroundState } from '../../hooks/useNearbyShops';
import type { OsmState } from '../../hooks/useOsmAround';
import { dataDate } from './nearbyText';

/** What both views say about a slow or busy map server and an older answer on screen. */
const T = text({
  pl: {
    slow: (s: number) => `Serwer map odpowiada wolno — czekam (${s} s)…`,
    wait: (s: number) => `Serwer map jest zajęty — ponawiam za ${s} s…`,
    again: (s: number) => `Ponowię sam za ${s} s.`,
    meanwhile: (what: string, age: string) => `Na razie pokazuję ${what} zapisane ${age}.`,
    showing: (what: string, age: string) => `Pokazuję ${what} zapisane ${age}.`,
    slowData: (s: number) => `Wolne połączenie — pobieram dane okolicy (${s} s)…`,
    abroad: (what: string) => `Poza Polską ${what} pobieram z serwera map — może to chwilę potrwać.`,
    border: (what: string) => `Przy granicy: ${what} po polskiej stronie mam w aplikacji, o resztę pytam serwer map…`,
    borderFailed: (what: string) => `Po drugiej stronie granicy nie udało się pobrać danych — pokazuję ${what} po polskiej stronie.`,
    older: 'Część danych okolicy jest z poprzedniej aktualizacji.',
    stale: (date: string) => `Dane okolicy są z ${date} — część miejsc mogła się zmienić.`,
  },
  en: {
    slow: (s: number) => `The map server is slow — waiting (${s} s)…`,
    wait: (s: number) => `The map server is busy — trying again in ${s} s…`,
    again: (s: number) => `I’ll try again in ${s} s.`,
    meanwhile: (what: string, age: string) => `Meanwhile showing ${what} saved ${age}.`,
    showing: (what: string, age: string) => `Showing ${what} saved ${age}.`,
    slowData: (s: number) => `Slow connection — loading this area’s data (${s} s)…`,
    abroad: (what: string) => `Outside Poland I get ${what} from the map server — this may take a while.`,
    border: (what: string) => `Near the border: ${what} on the Polish side are in the app, the rest comes from the map server…`,
    borderFailed: (what: string) => `Couldn’t get the data across the border — showing ${what} on the Polish side.`,
    older: 'Part of this area’s data is from the previous update.',
    stale: (date: string) => `This area’s data is from ${date} — some places may have changed.`,
  },
});

/** A search this long is called slow on screen. */
const SLOW_MS = 12_000;
/** The app's own files are small: past this a connection is called slow. */
const SLOW_DATA_MS = 5000;
/** The app's copy of the data is refreshed by hand: past this age the page says it may be out of date. */
const STALE_DATA_MS = 60 * 24 * 3600 * 1000;
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
export type AroundNotesState = Pick<AroundState<unknown>, 'status' | 'items' | 'savedAt' | 'since' | 'retryAt'> &
  Partial<Pick<OsmState, 'source' | 'coverage' | 'dataAsOf' | 'olderLeaves'>>;

export function aroundNotes(state: AroundNotesState, what: string, now: number): AroundNotes {
  const left = state.retryAt ? Math.ceil((state.retryAt - now) / 1000) : 0;
  const elapsed = state.since === null ? 0 : now - state.since;
  if (state.source === 'static') {
    // The app's own data: no server to wait for, only the connection.
    if (state.status === 'loading') return { status: '', clock: elapsed >= SLOW_DATA_MS ? T.slowData(Math.round(elapsed / 1000)) : null };
    if (state.status === 'error') return { status: '', clock: left > 0 ? T.again(left) : null };
    const asOf = state.dataAsOf ? Date.parse(state.dataAsOf) : NaN;
    const date = now - asOf > STALE_DATA_MS ? dataDate(state.dataAsOf ?? null) : null;
    return { status: [state.olderLeaves ? T.older : null, date ? T.stale(date) : null].filter(Boolean).join(' '), clock: null };
  }
  const live = liveNotes(state, what, now, left, elapsed);
  if (state.source === 'mixed') {
    if (state.status === 'loading') return { status: T.border(what), clock: live.clock };
    if (state.status === 'error') return { status: T.borderFailed(what), clock: live.clock };
    return live;
  }
  if (state.coverage === 'none' && state.status === 'loading') return { status: [T.abroad(what), live.status].filter(Boolean).join(' '), clock: live.clock };
  return live;
}

/** Overpass: an older answer on screen and its age, a pause before the next try, a long search. */
function liveNotes(state: AroundNotesState, what: string, now: number, left: number, elapsed: number): AroundNotes {
  const age = state.savedAt !== null && state.items.length > 0 ? now - state.savedAt : null;
  if (state.status === 'loading') {
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
