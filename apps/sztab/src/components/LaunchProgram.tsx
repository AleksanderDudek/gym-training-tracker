import type { Connection, LibraryItem } from '../lib/data';

/**
 * „Uruchom program”: wybór podopiecznych i dnia startu, potem każdy krok programu idzie jako zalecenie
 * z datą „pokaż od”. Kontrakt rdzenia dla części „Harmonogram i programy” (implementacja) i „Lista
 * podopiecznych” (wołanie z akcji grupowych) — spec 2026-11-25.
 *
 * `program` — element biblioteki rodzaju `program`; `connections` — wstępnie zaznaczeni podopieczni
 * (z listy), pusta lista — wybór w oknie.
 */
export function LaunchProgramDialog({ program, connections, onClose }: { program: LibraryItem | null; connections: Connection[]; onClose: () => void }) {
  void program;
  void connections;
  void onClose;
  return null;
}
