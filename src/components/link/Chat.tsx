import type { AppState } from '../../types';

/**
 * Rozmowa z prowadzącym (`#/wspolpraca/<id>/wiadomosci`). Zaczep rdzenia — wypełnia go część
 * „Wiadomości” (spec 2026-11-25). Logika w `link/sync.ts`: `sendMessage`, `markMessagesRead`,
 * `refreshMessages`; odczyt w `link/store.ts`: `messagesOf`.
 */
export function ChatPage({ id, state, onToast }: { id: string; state: AppState; onToast: (m: string) => void }) {
  void id;
  void state;
  void onToast;
  return null;
}
