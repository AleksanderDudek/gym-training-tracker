import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A text field's own value, committed after a pause. Typing stays instant,
 * and the URL is not rewritten on every keystroke (Safari rate-limits the
 * history API). When the committed value changes from OUTSIDE — "clear all",
 * Back — the draft follows it, unless the two already mean the same thing,
 * which is what keeps "10." from being rewritten to "10" mid-typing.
 *
 * `flush` commits a pending draft at once. Call it on blur: a click elsewhere
 * (opening a product, say) must not land before the text it follows, or the
 * text is committed into the wrong history entry and lost on the way back.
 */
export function useDebouncedDraft(
  committed: string,
  commit: (draft: string) => void,
  same: (draft: string, committed: string) => boolean = (a, b) => a === b,
  delayMs = 250,
): [string, (draft: string) => void, () => void] {
  const [draft, setDraft] = useState(committed);
  const latest = useRef({ draft, committed, commit, same });
  useEffect(() => {
    latest.current = { draft, committed, commit, same };
  });

  useEffect(() => {
    setDraft((current) => (latest.current.same(current, committed) ? current : committed));
  }, [committed]);

  useEffect(() => {
    if (latest.current.same(draft, committed)) return;
    const timer = setTimeout(() => latest.current.commit(draft), delayMs);
    return () => clearTimeout(timer);
  }, [draft, committed, delayMs]);

  const flush = useCallback(() => {
    const { draft: pending, committed: current, commit: commitNow, same: isSame } = latest.current;
    if (!isSame(pending, current)) commitNow(pending);
  }, []);

  return [draft, setDraft, flush];
}
