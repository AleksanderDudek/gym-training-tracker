/**
 * Wizyty u prowadzącego (`#/wspolpraca/<id>/wizyty`): wolne terminy, rezerwacja, odwołanie, plik .ics.
 * Zaczep rdzenia — wypełnia go część „Kalendarz wizyt” (spec 2026-11-25). Sieć w `link/rpc.ts`:
 * `clientSlots`, `clientBook`, `clientCancelBooking`.
 */
export function VisitsPage({ id, onToast }: { id: string; onToast: (m: string) => void }) {
  void id;
  void onToast;
  return null;
}
