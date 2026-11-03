import type { Area, Scope } from './areas';
import type { PublicJwk } from './crypto';

/**
 * Link zaproszenia: `<adres GYM TRACKERa>#/wspolpraca/zaproszenie?i=<numer>&f=<odcisk>`.
 *
 * Oba parametry stoją za `#`, więc przeglądarka nie wysyła ich nigdzie — ani do GitHub Pages,
 * ani do serwera Sztabu. Numer (UUID v4, 122 losowe bity) wystarczy, żeby zobaczyć zaproszenie
 * i je przyjąć — jak link do dokumentu; po przyjęciu jest zużyty. Odcisk to kontrola klucza:
 * telefon porównuje go z kluczem, który poda serwer, więc nawet przejęty serwer nie podstawi
 * własnego klucza i nie odczyta danych.
 */

export const INVITE_PATH = '#/wspolpraca/zaproszenie';

export function inviteLink(appUrl: string, inviteId: string, fingerprint: string): string {
  const base = appUrl.replace(/#.*$/, '');
  return `${base}${INVITE_PATH}?i=${encodeURIComponent(inviteId)}&f=${encodeURIComponent(fingerprint)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Z zapytania w hashu (`i=…&f=…`). `null`, gdy link jest ucięty albo przepisany z błędem. */
export function parseInviteQuery(query: URLSearchParams): { inviteId: string; fingerprint: string } | null {
  const inviteId = query.get('i')?.trim().toLowerCase() ?? '';
  const fingerprint = query.get('f')?.trim() ?? '';
  if (!isUuid(inviteId) || !/^[A-Za-z0-9_-]{22}$/.test(fingerprint)) return null;
  return { inviteId, fingerprint };
}

export const PROFESSIONS = ['trainer', 'dietitian', 'physio', 'doctor', 'other'] as const;
export type Profession = (typeof PROFESSIONS)[number];

export type InviteStatus = 'open' | 'expired' | 'revoked' | 'accepted';

/** Odpowiedź `invite_preview` — to, co telefon pokazuje przed przyjęciem. */
export interface InvitePreview {
  id: string;
  status: InviteStatus;
  coachId: string;
  coachName: string;
  profession: Profession;
  bio: string | null;
  publicKey: PublicJwk;
  areas: Area[];
  scopes: Scope[];
  message: string | null;
  expiresAt: string;
}
