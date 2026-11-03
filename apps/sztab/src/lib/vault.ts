import {
  exportPrivate,
  fingerprint,
  generateIdentity,
  importPrivate,
  newRecoveryCode,
  openPrivate,
  sealPrivate,
} from '@gymtracker/link';
import type { Profession, PublicJwk } from '@gymtracker/link';

/**
 * Sejf prowadzącego: klucz prywatny, którym odszyfrowuje paczki podopiecznych.
 *
 * - Na serwerze leży tylko zapieczętowany kodem odzyskiwania (`coaches.sealed_key`).
 * - Na tym komputerze leży w IndexedDB jako klucz **nieeksportowalny**: przeglądarka liczy nim,
 *   ale nie wyda go żadnemu skryptowi. Na co dzień kod nie jest więc potrzebny.
 * - Na nowym komputerze kod wpisuje się raz (`unlock`).
 *
 * Bez kodu i bez tego komputera danych nikt nie odczyta — także autorzy Sztabu. Podopieczni
 * nic przez to nie tracą: ich dane leżą na ich telefonach, nowe zaproszenie łączy na nowo.
 */

const DB = 'sztab-vault';
const STORE = 'keys';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export interface DeviceKey {
  privateKey: CryptoKey;
  fingerprint: string;
}

export const loadDeviceKey = (userId: string): Promise<DeviceKey | undefined> =>
  tx<DeviceKey | undefined>('readonly', (s) => s.get(userId) as IDBRequest<DeviceKey | undefined>);

const saveDeviceKey = (userId: string, key: DeviceKey): Promise<IDBValidKey> => tx('readwrite', (s) => s.put(key, userId));

export const forgetDeviceKey = (userId: string): Promise<undefined> => tx('readwrite', (s) => s.delete(userId));

/** Kopia klucza, której nie da się wyeksportować — tylko ta trafia do pamięci przeglądarki. */
const lockDown = async (key: CryptoKey): Promise<CryptoKey> => importPrivate(await exportPrivate(key), false);

export interface CoachProfile {
  display_name: string;
  profession: Profession;
  bio: string | null;
}

/** Gotowy do zapisu wiersz `coaches` i kod do pokazania — klucz trafia na komputer dopiero przy `commitVault`. */
export interface VaultDraft {
  code: string;
  publicJwk: PublicJwk;
  fingerprint: string;
  sealed: string;
  privateKey: CryptoKey;
}

export async function draftVault(userId: string, iterations?: number): Promise<VaultDraft> {
  const me = await generateIdentity(true);
  const code = newRecoveryCode();
  return {
    code,
    publicJwk: me.publicJwk,
    fingerprint: await fingerprint(me.publicJwk),
    sealed: await sealPrivate(me.privateKey, code, userId, iterations),
    privateKey: me.privateKey,
  };
}

export async function commitVault(userId: string, draft: VaultDraft): Promise<void> {
  await saveDeviceKey(userId, { privateKey: await lockDown(draft.privateKey), fingerprint: draft.fingerprint });
}

/** Kod z kartki otwiera sejf na tym komputerze. `false` — zły kod. */
export async function unlock(userId: string, sealed: string, code: string, fp: string): Promise<boolean> {
  const key = await openPrivate(sealed, code, userId, false);
  if (!key) return false;
  await saveDeviceKey(userId, { privateKey: key, fingerprint: fp });
  return true;
}

/** Nowy kod odzyskiwania: stary otwiera sejf, nowy go zamyka. Zwraca nowy zapieczętowany klucz i kod. */
export async function rekey(
  userId: string,
  sealed: string,
  oldCode: string,
  iterations?: number,
): Promise<{ sealed: string; code: string } | null> {
  const key = await openPrivate(sealed, oldCode, userId, true);
  if (!key) return null;
  const code = newRecoveryCode();
  return { sealed: await sealPrivate(key, code, userId, iterations), code };
}

/** Plik z kodem do pobrania — tekst, który da się wydrukować albo schować w menedżerze haseł. */
export function recoveryFile(code: string, email: string): string {
  return [
    'GYM TRACKER Sztab — kod odzyskiwania sejfu',
    '',
    `Konto: ${email}`,
    `Kod:   ${code}`,
    '',
    'Kod otwiera dane podopiecznych na nowym komputerze. Bez niego nikt ich nie odczyta,',
    'także autorzy Sztabu. Trzymaj go poza komputerem: na kartce albo w menedżerze haseł.',
    '',
  ].join('\n');
}
