// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { INVITE_PATH, inviteLink, newIdSecret, parseInviteQuery } from '@gymtracker/link';
import { hashQuery } from '../food/hash';
import { LINK_INVITE_PATH, activeTab, isLinkInvite, isLinkRoute, linkAssignmentPath, linkConnectionPath, parseHash, screenOf } from '../routing';
import { LINK_KEY, clearLink, cleanLinkState, hasLinkWork, linkState, reloadLink, updateLink, validLinkSecret } from './store';

/** Zapis współprac poza kopią zapasową, sekret ID w kopii, trasy współpracy. */

const conn = {
  id: 'c1',
  inviteId: 'i1',
  coachId: 'k1',
  coach: { name: 'Anna', profession: 'trainer' },
  areas: ['training'],
  scopes: ['training'],
  pseudonym: '0123456789ABCDEFGHJK',
  attempt: 0,
  token: 't',
  privateJwk: {},
  coachKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
  createdAt: 1,
  lastPushAt: null,
  lastPullAt: null,
  status: 'active',
  endedBy: null,
  endedAt: null,
};

beforeEach(() => {
  localStorage.clear();
  reloadLink();
});

describe('zapis współprac', () => {
  it('leży pod własnym kluczem w pamięci strony i przeżywa wczytanie od nowa', () => {
    updateLink((s) => {
      s.connections.push(conn as never);
    });
    expect(JSON.parse(localStorage.getItem(LINK_KEY)!).connections).toHaveLength(1);
    reloadLink();
    expect(linkState().connections[0]!.coach.name).toBe('Anna');
    expect(hasLinkWork()).toBe(true);
  });

  it('zepsuty wpis odpada, zalecenie bez swojej współpracy też', () => {
    const s = cleanLinkState({
      connections: [conn, { id: 'x' }, null, 'tekst'],
      assignments: [
        { id: 'a1', connectionId: 'c1', a: { body: { kind: 'note' } }, status: 'new' },
        { id: 'a2', connectionId: 'obca', a: { body: {} } },
        { id: 'a3', connectionId: 'c1' },
      ],
      broken: [{ id: 'b', connectionId: 'c1' }, 7],
    });
    expect(s.connections.map((c) => c.id)).toEqual(['c1']);
    expect(s.assignments.map((a) => a.id)).toEqual(['a1']);
    expect(s.assignments[0]!.ticked).toEqual([]);
    expect(s.broken).toHaveLength(1);
    expect(cleanLinkState('śmieci')).toEqual({ connections: [], assignments: [], broken: [] });
  });

  it('„Usuń wszystkie dane” zapomina współprace', () => {
    updateLink((s) => {
      s.connections.push(conn as never);
    });
    clearLink();
    expect(localStorage.getItem(LINK_KEY)).toBeNull();
    expect(linkState().connections).toEqual([]);
    expect(hasLinkWork()).toBe(false);
  });

  it('sekret ID: 32 bajty base64url albo nic', () => {
    expect(validLinkSecret(newIdSecret())).toBe(true);
    expect(validLinkSecret('za-krotki')).toBe(false);
    expect(validLinkSecret(42)).toBe(false);
    expect(validLinkSecret(`${newIdSecret()}=`)).toBe(false);
  });
});

describe('trasy współpracy', () => {
  it('link zaproszenia z pakietu prowadzi na stronę zaproszenia, z numerem i odciskiem w zapytaniu', () => {
    expect(LINK_INVITE_PATH).toBe(INVITE_PATH);
    const id = '1a2b3c4d-1234-4abc-8def-000000000001';
    const link = inviteLink('https://example.org/app/', id, 'AAAAAAAAAAAAAAAAAAAAAA');
    const hash = link.slice(link.indexOf('#'));
    expect(parseHash(hash)).toEqual({ kind: 'linkInvite' });
    expect(isLinkInvite(hash)).toBe(true);
    expect(parseInviteQuery(hashQuery(hash))).toEqual({ inviteId: id, fingerprint: 'AAAAAAAAAAAAAAAAAAAAAA' });
  });

  it('lista, współpraca i zalecenie mają własne adresy i należą do profilu', () => {
    expect(parseHash('#/wspolpraca')).toEqual({ kind: 'link' });
    expect(parseHash(linkConnectionPath('c1'))).toEqual({ kind: 'linkConnection', id: 'c1' });
    expect(parseHash(linkAssignmentPath('a1'))).toEqual({ kind: 'linkAssignment', id: 'a1' });
    expect(parseHash('#/wspolpraca/zalecenie')).toEqual({ kind: 'link' });
    for (const r of [parseHash('#/wspolpraca'), parseHash('#/wspolpraca/zaproszenie'), parseHash('#/wspolpraca/c1')]) {
      expect(isLinkRoute(r)).toBe(true);
      expect(activeTab(r)).toBe('prog');
    }
    expect(screenOf({ kind: 'link' }).parent).toBe('#/profil');
    expect(screenOf({ kind: 'linkConnection', id: 'c1' }).parent).toBe('#/wspolpraca');
    expect(isLinkRoute(parseHash('#/profil'))).toBe(false);
  });
});
