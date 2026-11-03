import { buf, crockford, fromBase64Url, groups, normalizeCrockford, randomBytes, toBase64Url, utf8 } from './codec';

/**
 * ID podopiecznego — jedyne, po czym prowadzący go zna.
 *
 * **Liczone, nie losowane z bazy.** `HMAC-SHA256(sekret telefonu, "id|<prowadzący>|<licznik>")`,
 * pierwsze 100 bitów zapisane 20 znakami Crockforda. Telefon nie pyta serwera, czy ID jest
 * wolne, a i tak:
 *
 * - ten sam prowadzący zawsze widzi to samo ID, także po zakończeniu współpracy i nowym
 *   zaproszeniu — historia u niego się nie rozpada;
 * - dwóch prowadzących widzi dwa różne ID tej samej osoby i nie dopasuje ich do siebie;
 * - bez sekretu telefonu nikt nie wyliczy ID z niczego, co leży na serwerze.
 *
 * **Kolizje.** Dla miliona podopiecznych jednego prowadzącego szansa, że dwóch dostanie to samo
 * ID, to n²/2^101 ≈ 4·10⁻¹⁹. Baza i tak ma unikalny indeks na (prowadzący, ID) wśród trwających
 * współprac; gdyby trafiło, serwer odmawia (`pseudonym_taken`), a telefon liczy ID z licznikiem
 * o jeden większym. Licznik zostaje zapisany przy współpracy, więc nowe zaproszenie od tego
 * samego prowadzącego zaczyna od zera i trafia w to samo ID.
 */

export const ID_CHARS = 20;
export const ID_PREFIX = 'GT';

/** Sekret telefonu: 32 losowe bajty, base64url. Leży w zapisie aplikacji, więc idzie z kopią. */
export const newIdSecret = (): string => toBase64Url(randomBytes(32));

export async function pseudonymFor(secret: string, coachId: string, attempt = 0): Promise<string> {
  const raw = fromBase64Url(secret);
  if (!raw || raw.length < 16) throw new Error('pseudonymFor: zły sekret');
  const key = await crypto.subtle.importKey('raw', buf(raw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf(utf8(`id|${coachId}|${attempt}`))));
  return crockford(mac, ID_CHARS);
}

/** `GT-7K4Q-9XM2-HT3P-ZR8W-E5NA` — pełne, do karty podopiecznego i eksportu do CRM. */
export const formatPseudonym = (raw: string): string => `${ID_PREFIX}-${groups(raw)}`;

/** `GT-7K4Q-9XM2` — na listach. 40 bitów: w jednej liście wystarczy, do wyszukania służy pełne. */
export const shortPseudonym = (raw: string): string => `${ID_PREFIX}-${groups(raw.slice(0, 8))}`;

/**
 * ID przepisane ręcznie albo wklejone z CRM, w dowolnej postaci: z prefiksem lub bez, z myślnikami,
 * małymi literami, z „O” zamiast zera. Pełne 20 znaków albo `null`.
 */
export function parsePseudonym(input: string): string | null {
  const s = normalizeCrockford(input.trim().replace(/^gt[\s-]*/i, ''));
  return s && s.length === ID_CHARS ? s : null;
}

/** Ten sam wzorzec co w bazie (`connections.pseudonym`). */
export const PSEUDONYM_PATTERN = /^[0-9A-HJKMNP-TV-Z]{20}$/;
