import type { SnapshotV1 } from '@gymtracker/link';
import type { Connection, SentAssignment } from '../../lib/data';

/**
 * Zakładka „Odpowiedzi” podopiecznego: czyta część `coaching` paczki (`cleanCoaching`) razem z
 * wysłanymi zaleceniami. Zaczep rdzenia — wypełnia ją osobna część (spec 2026-11-25).
 */
export function AnswersTab({ c, s, sent }: { c: Connection; s: SnapshotV1; sent: SentAssignment[] | undefined }) {
  void c;
  void s;
  void sent;
  return null;
}
