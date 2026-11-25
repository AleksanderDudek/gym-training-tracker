import { linkKey } from '@gymtracker/link';
import type { PublicJwk } from '@gymtracker/link';

/**
 * Klucz współpracy po stronie prowadzącego: ECDH(klucz prywatny z sejfu, klucz publiczny telefonu) z numerem
 * zaproszenia — liczony raz na współpracę. Osobny moduł, żeby `notify.ts` (pieczęć tokenu powiadomień) nie
 * importował całego `data.ts`, które samo woła powiadomienia.
 */

const keys = new Map<string, Promise<CryptoKey>>();

export function connectionKey(privateKey: CryptoKey, c: { id: string; clientKey: PublicJwk; inviteId: string }): Promise<CryptoKey> {
  let k = keys.get(c.id);
  if (!k) {
    k = linkKey(privateKey, c.clientKey, c.inviteId);
    keys.set(c.id, k);
  }
  return k;
}
