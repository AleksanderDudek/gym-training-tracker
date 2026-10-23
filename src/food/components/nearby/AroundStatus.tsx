import { useSecondClock, type AroundState } from '../../hooks/useNearbyShops';
import { aroundNotes } from './aroundText';

interface Props {
  state: Pick<AroundState<unknown>, 'status' | 'items' | 'savedAt' | 'since' | 'retryAt'>;
  /** What the items are, in the words of the view („lokale”, „sklepy”). */
  what: string;
  /** The view's own status sentence. */
  status: string;
  /** The words about the server only once there is a place to search around. */
  showServer: boolean;
}

/**
 * The status line with the server's state after it, and the countdown under it. A component of its
 * own because the countdown ticks every second: the view around it - the map with every pin - must
 * not render again with it (a re-render rebuilt the pins and closed an open popup).
 */
export function AroundStatus({ state, what, status, showServer }: Props) {
  const now = useSecondClock(showServer && (state.status === 'loading' || state.retryAt !== null));
  const server = showServer ? aroundNotes(state, what, now) : { status: '', clock: null };
  return (
    <>
      <p role="status">{[status, server.status].filter(Boolean).join(' ')}</p>
      {server.clock && <p className="fd-near-clock">{server.clock}</p>}
    </>
  );
}
