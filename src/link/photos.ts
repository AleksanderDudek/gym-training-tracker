import type { LinkConnection } from './store';

/**
 * Zdjęcia sylwetki dla prowadzącego (zakres `photos`): telefon wysyła zaszyfrowane, zmniejszone
 * zdjęcia z „Sylwetki” i kasuje te, których już nie ma. Wołane z `syncAll` tylko przy zgodzie.
 *
 * Zaczep rdzenia — wypełnia go część „Zdjęcia” (spec 2026-11-25).
 */
export async function syncPhotos(c: LinkConnection): Promise<'ok' | 'offline' | 'ended'> {
  void c;
  return 'ok';
}
