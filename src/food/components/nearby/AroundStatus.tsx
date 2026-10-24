import { useSecondClock } from '../../hooks/useNearbyShops';
import { aroundNotes, type AroundNotesState } from './aroundText';

interface Props {
  state: AroundNotesState;
  /** What the items are, in the words of the view („lokale”, „sklepy”). */
  what: string;
  /** The view's own status sentence. */
  status: string;
  /** The words about the server only once there is a place to search around. */
  showServer: boolean;
  /**
   * How far the answer is complete while it arrives in pieces („Na razie: 7 miejsc z menu w promieniu
   * 300 m.”) — outside the live region: it changes with every batch, a screen reader would read it
   * out each time.
   */
  progress?: string | null;
}

/**
 * The status line with the server's state after it, and the countdown under it. A component of its
 * own because the countdown ticks every second: the view around it - the map with every pin - must
 * not render again with it (a re-render rebuilt the pins and closed an open popup).
 */
export function AroundStatus({ state, what, status, showServer, progress = null }: Props) {
  const now = useSecondClock(showServer && (state.status === 'loading' || state.retryAt !== null));
  const server = showServer ? aroundNotes(state, what, now) : { status: '', clock: null };
  return (
    <>
      <p role="status">{[status, server.status].filter(Boolean).join(' ')}</p>
      {progress && <p className="fd-near-clock">{progress}</p>}
      {server.clock && <p className="fd-near-clock">{server.clock}</p>}
    </>
  );
}
