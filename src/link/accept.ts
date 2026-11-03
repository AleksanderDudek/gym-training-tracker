import {
  checkAreas,
  cleanPublicJwk,
  exportPrivate,
  fingerprint,
  generateIdentity,
  newToken,
  planAcceptance,
  pseudonymFor,
} from '@gymtracker/link';
import type { AcceptPlan, Area, AreaCheck, Held, InvitePreview, Scope } from '@gymtracker/link';
import { clientEnd, inviteAccept, invitePreview, isRpcError } from './rpc';
import { activeConnections, linkState, updateLink } from './store';
import type { LinkConnection, LinkState } from './store';
import { endConnection, markEnded, shrinkAreas } from './sync';

/**
 * Przyjęcie zaproszenia. Kolejność ma znaczenie:
 *
 * 1. **Klucz z linku.** Odcisk z linku (za `#`, więc serwer go nie widział) musi pasować do klucza,
 *    który podał serwer — inaczej ktoś podstawił własny klucz i czytałby dane. Wtedy odmawiamy.
 * 2. **Wyłączność** (`planAcceptance`): jeden prowadzący na trening, żywienie i rehabilitację,
 *    wgląd do trzech. Zajęty obszar trzeba albo zamienić (zgoda per obszar), albo pominąć.
 * 3. **Dawna współpraca z tym samym prowadzącym** kończy się przed przyjęciem — to samo ID może mieć
 *    u niego tylko jedną trwającą współpracę, a ma zostać to samo ID.
 * 4. Przyjęcie: nowa para kluczy, token, ID z sekretu telefonu. `pseudonym_taken` (kolizja,
 *    ≈ 4·10⁻¹⁹) — ID z licznikiem o jeden większym, najwyżej pięć prób.
 * 5. **Dopiero po udanym przyjęciu** zamiany u innych prowadzących (koniec albo mniej obszarów):
 *    nieudane przyjęcie nie może zabrać nikomu jego obszaru. Bez sieci w tej chwili — zaległa zmiana.
 */

export type AcceptFailure =
  | 'fingerprint'
  | 'missing'
  | 'used'
  | 'revoked'
  | 'expired'
  | 'exclusive'
  | 'no_areas'
  | 'offline'
  | 'taken'
  | 'error';

export type AcceptResult = { ok: true; connection: LinkConnection } | { ok: false; reason: AcceptFailure };

export const MAX_ATTEMPTS = 5;

/** Trwające współprace tak, jak widzi je wyłączność. */
export const heldOf = (s: LinkState): Held[] =>
  activeConnections(s).map((c) => ({ id: c.id, coachId: c.coachId, coachName: c.coach.name, areas: c.areas }));

export const areaChecks = (s: LinkState, preview: InvitePreview): AreaCheck[] => checkAreas(heldOf(s), preview.coachId, preview.areas);

/** Plan przyjęcia albo `null`, gdy wybór łamie wyłączność bez zgody na zamianę. */
export const acceptPlan = (s: LinkState, preview: InvitePreview, chosen: readonly Area[], replace: readonly Area[]): AcceptPlan | null =>
  planAcceptance(heldOf(s), preview.coachId, chosen.filter((a) => preview.areas.includes(a)), replace);

/** Czy klucz od serwera to ten, którego odcisk przyszedł w linku. */
export async function keyMatches(preview: InvitePreview, expected: string): Promise<boolean> {
  const jwk = cleanPublicJwk(preview.publicKey);
  if (!jwk) return false;
  try {
    return (await fingerprint(jwk)) === expected;
  } catch {
    return false;
  }
}

const STATUS_FAIL: Record<string, AcceptFailure> = {
  accepted: 'used',
  revoked: 'revoked',
  expired: 'expired',
};

const CODE_FAIL: Record<string, AcceptFailure> = {
  invite_missing: 'missing',
  invite_used: 'used',
  invite_revoked: 'revoked',
  invite_expired: 'expired',
  bad_areas: 'no_areas',
  offline: 'offline',
};

export async function acceptInvite(input: {
  preview: InvitePreview;
  /** Odcisk klucza z linku (`f=`). */
  fingerprint: string;
  chosen: readonly Area[];
  replace: readonly Area[];
  scopes: readonly Scope[];
  /** Sekret telefonu (`cfg.linkSecret`). */
  secret: string;
  now?: number;
}): Promise<AcceptResult> {
  const now = input.now ?? Date.now();
  if (!(await keyMatches(input.preview, input.fingerprint))) return { ok: false, reason: 'fingerprint' };

  // Świeży stan zaproszenia tuż przed przyjęciem: ekran mógł stać otwarty kilka dni, a klucz
  // sprawdzamy jeszcze raz, bo to on zaszyfruje każdą paczkę.
  let preview: InvitePreview | null;
  try {
    preview = await invitePreview(input.preview.id);
  } catch (e) {
    return { ok: false, reason: isRpcError(e, 'offline') ? 'offline' : 'error' };
  }
  if (!preview) return { ok: false, reason: 'missing' };
  if (!(await keyMatches(preview, input.fingerprint))) return { ok: false, reason: 'fingerprint' };
  if (preview.status !== 'open') return { ok: false, reason: STATUS_FAIL[preview.status] ?? 'error' };

  const chosen = input.chosen.filter((a) => preview.areas.includes(a));
  if (!chosen.length) return { ok: false, reason: 'no_areas' };
  const plan = acceptPlan(linkState(), preview, chosen, input.replace);
  if (!plan) return { ok: false, reason: 'exclusive' };

  // Dawna współpraca z tym samym prowadzącym — przed przyjęciem (to samo ID).
  const before = linkState();
  const same = plan.end.filter((id) => before.connections.find((c) => c.id === id)?.coachId === preview.coachId);
  for (const id of same) {
    const c = before.connections.find((x) => x.id === id)!;
    if (!c.token) {
      markEnded(id, 'client');
      continue;
    }
    try {
      await clientEnd(id, c.token);
    } catch (e) {
      if (!isRpcError(e, 'bad_token')) return { ok: false, reason: isRpcError(e, 'offline') ? 'offline' : 'error' };
    }
    markEnded(id, 'client');
  }

  const identity = await generateIdentity(true);
  const privateJwk = await exportPrivate(identity.privateKey);
  const token = newToken();
  let connectionId: string | null = null;
  let pseudonym = '';
  let attempt = 0;
  for (; attempt < MAX_ATTEMPTS; attempt++) {
    pseudonym = await pseudonymFor(input.secret, preview.coachId, attempt);
    try {
      connectionId = await inviteAccept({
        inviteId: preview.id,
        pseudonym,
        publicKey: identity.publicJwk,
        token,
        areas: plan.areas,
        scopes: input.scopes,
      });
      break;
    } catch (e) {
      if (isRpcError(e, 'pseudonym_taken')) continue;
      const code = isRpcError(e) ? e.code : '';
      return { ok: false, reason: CODE_FAIL[code] ?? 'error' };
    }
  }
  if (!connectionId) return { ok: false, reason: 'taken' };

  const connection: LinkConnection = {
    id: connectionId,
    inviteId: preview.id,
    coachId: preview.coachId,
    coach: { name: preview.coachName, profession: preview.profession },
    areas: plan.areas,
    scopes: [...input.scopes],
    pseudonym,
    attempt,
    token,
    privateJwk,
    coachKey: preview.publicKey,
    createdAt: now,
    lastPushAt: null,
    lastPullAt: null,
    status: 'active',
    endedBy: null,
    endedAt: null,
  };
  updateLink((s) => {
    s.connections = s.connections.filter((c) => c.id !== connectionId);
    s.connections.push(connection);
  });

  // Zamiany u innych prowadzących — dopiero teraz, gdy nowa współpraca na pewno istnieje.
  for (const id of plan.end) if (!same.includes(id)) await endConnection(id);
  for (const s of plan.shrink) await shrinkAreas(s.id, s.areas);

  return { ok: true, connection };
}
