import { describe, expect, it } from 'vitest';
import {
  AAD,
  checkAreas,
  cleanPublicJwk,
  crockford,
  fingerprint,
  formatPseudonym,
  generateIdentity,
  inviteLink,
  linkKey,
  newIdSecret,
  newRecoveryCode,
  normalizeRecoveryCode,
  openJson,
  openPrivate,
  parseAssignment,
  parseInviteQuery,
  parsePseudonym,
  planAcceptance,
  pseudonymFor,
  PSEUDONYM_PATTERN,
  sealJson,
  sealPrivate,
  sha256Hex,
  shortPseudonym,
  suggestScopes,
} from './index';
import type { Held } from './areas';

describe('ID podopiecznego', () => {
  it('ten sam sekret i prowadzący dają to samo ID, inny prowadzący — inne', async () => {
    const secret = newIdSecret();
    const a = await pseudonymFor(secret, 'coach-a');
    expect(await pseudonymFor(secret, 'coach-a')).toBe(a);
    expect(await pseudonymFor(secret, 'coach-b')).not.toBe(a);
    expect(await pseudonymFor(secret, 'coach-a', 1)).not.toBe(a);
    expect(a).toMatch(PSEUDONYM_PATTERN);
  });

  it('inny telefon u tego samego prowadzącego — inne ID', async () => {
    expect(await pseudonymFor(newIdSecret(), 'c')).not.toBe(await pseudonymFor(newIdSecret(), 'c'));
  });

  it('formaty i odczyt przepisanego ID', () => {
    const raw = '7K4Q9XM2HT3PZR8WE5NA';
    expect(formatPseudonym(raw)).toBe('GT-7K4Q-9XM2-HT3P-ZR8W-E5NA');
    expect(shortPseudonym(raw)).toBe('GT-7K4Q-9XM2');
    expect(parsePseudonym('gt-7k4q-9xm2-ht3p-zr8w-e5na')).toBe(raw);
    expect(parsePseudonym(' 7K4Q 9XM2 HT3P ZR8W E5NA ')).toBe(raw);
    expect(parsePseudonym('GT-7K4Q-9XM2')).toBeNull();
    expect(parsePseudonym('GT-7K4Q-9XM2-HT3P-ZR8W-E5NU')).toBeNull();
  });

  it('I, L i O czytają się jako cyfry', () => {
    expect(parsePseudonym('IL0OIL0OIL0OIL0OIL0O')).toBe('11001100110011001100');
  });

  it('base32 bez bajtów z powietrza', () => {
    expect(crockford(new Uint8Array([0xff, 0xff]), 3)).toBe('ZZZ');
    expect(() => crockford(new Uint8Array(2), 4)).toThrow();
  });
});

describe('Szyfrowanie współpracy', () => {
  it('obie strony liczą ten sam klucz; paczka otwiera się tylko w swoim miejscu', async () => {
    const coach = await generateIdentity();
    const phone = await generateIdentity();
    const invite = '6f1c7a52-6a0b-4b7e-9a45-0c3d9e2b1f10';
    const k1 = await linkKey(phone.privateKey, coach.publicJwk, invite);
    const k2 = await linkKey(coach.privateKey, phone.publicJwk, invite);
    const sealed = await sealJson(k1, AAD.snapshot('c1'), { hello: 'świat', n: [1, 2, 3] });
    expect(await openJson(k2, AAD.snapshot('c1'), sealed)).toEqual({ hello: 'świat', n: [1, 2, 3] });
    expect(await openJson(k2, AAD.snapshot('c2'), sealed)).toBeNull();
    const other = await linkKey(coach.privateKey, phone.publicJwk, '00000000-0000-4000-8000-000000000000');
    expect(await openJson(other, AAD.snapshot('c1'), sealed)).toBeNull();
    expect(await openJson(k2, AAD.snapshot('c1'), sealed.slice(0, -4) + 'AAAA')).toBeNull();
    expect(await openJson(k2, AAD.snapshot('c1'), 'nonsense')).toBeNull();
  });

  it('odcisk klucza jest stały i krótki; podmieniony klucz ma inny', async () => {
    const a = await generateIdentity();
    const b = await generateIdentity();
    const fp = await fingerprint(a.publicJwk);
    expect(fp).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await fingerprint({ ...a.publicJwk })).toBe(fp);
    expect(await fingerprint(b.publicJwk)).not.toBe(fp);
  });

  it('klucz publiczny z sieci: same pola punktu', async () => {
    const a = await generateIdentity();
    expect(cleanPublicJwk({ ...a.publicJwk, ext: true, key_ops: [] })).toEqual(a.publicJwk);
    expect(cleanPublicJwk({ ...a.publicJwk, crv: 'P-384' })).toBeNull();
    expect(cleanPublicJwk({ ...a.publicJwk, x: 'AAAA' })).toBeNull();
  });
});

describe('Sejf prowadzącego', () => {
  it('kod otwiera sejf, zły kod i cudze konto — nie', async () => {
    const me = await generateIdentity();
    const code = newRecoveryCode();
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/);
    const sealed = await sealPrivate(me.privateKey, code, 'user-1', 1000);
    const opened = await openPrivate(sealed, code.toLowerCase().replace(/-/g, ' '), 'user-1');
    expect(opened).not.toBeNull();
    expect(await openPrivate(sealed, newRecoveryCode(), 'user-1')).toBeNull();
    expect(await openPrivate(sealed, code, 'user-2')).toBeNull();
    // Klucz z sejfu liczy ten sam klucz współpracy co oryginał.
    const phone = await generateIdentity();
    const k1 = await linkKey(opened!, phone.publicJwk, 'i');
    const k2 = await linkKey(phone.privateKey, me.publicJwk, 'i');
    expect(await openJson(k1, 'x', await sealJson(k2, 'x', 42))).toBe(42);
  });

  it('kod przepisany z kartki', () => {
    expect(normalizeRecoveryCode('abcd-efgh-jkmn-pqrs-tvwx-yz01')).toBe('ABCDEFGHJKMNPQRSTVWXYZ01');
    expect(normalizeRecoveryCode('abcd')).toBeNull();
  });

  it('token: skrót SHA-256 w hex', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('Zaproszenie', () => {
  it('link i jego odczyt', () => {
    const link = inviteLink('https://x.github.io/gym/#/sesja', '6F1C7A52-6A0B-4B7E-9A45-0C3D9E2B1F10', 'A'.repeat(22));
    expect(link).toBe(`https://x.github.io/gym/#/wspolpraca/zaproszenie?i=6F1C7A52-6A0B-4B7E-9A45-0C3D9E2B1F10&f=${'A'.repeat(22)}`);
    const q = new URLSearchParams(link.split('?')[1]);
    expect(parseInviteQuery(q)).toEqual({ inviteId: '6f1c7a52-6a0b-4b7e-9a45-0c3d9e2b1f10', fingerprint: 'A'.repeat(22) });
    expect(parseInviteQuery(new URLSearchParams('i=abc&f=x'))).toBeNull();
  });
});

describe('Obszary i wyłączność', () => {
  const anna: Held = { id: 'c-anna', coachId: 'anna', coachName: 'Anna', areas: ['training', 'nutrition'] };
  const doc: Held = { id: 'c-doc', coachId: 'doc', coachName: 'Dr', areas: ['insight'] };

  it('trening zajęty przez kogoś innego, rehabilitacja wolna', () => {
    const c = checkAreas([anna, doc], 'marek', ['training', 'rehab']);
    expect(c.map((x) => [x.area, x.free])).toEqual([['training', false], ['rehab', true]]);
    expect(c[0]!.holders.map((h) => h.id)).toEqual(['c-anna']);
  });

  it('przyjęcie bez zgody na zamianę zajętego obszaru — odmowa', () => {
    expect(planAcceptance([anna], 'marek', ['training'], [])).toBeNull();
  });

  it('zamiana trenera: Anna traci tylko trening, żywienie zostaje', () => {
    expect(planAcceptance([anna], 'marek', ['training'], ['training'])).toEqual({
      areas: ['training'],
      end: [],
      shrink: [{ id: 'c-anna', areas: ['nutrition'] }],
    });
  });

  it('zamiana w obu obszarach kończy całą współpracę z Anną', () => {
    expect(planAcceptance([anna], 'marek', ['nutrition', 'training'], ['training', 'nutrition'])).toEqual({
      areas: ['training', 'nutrition'],
      end: ['c-anna'],
      shrink: [],
    });
  });

  it('nowe zaproszenie od tej samej osoby zastępuje dawną współpracę', () => {
    expect(planAcceptance([anna], 'anna', ['training'], [])).toEqual({ areas: ['training'], end: ['c-anna'], shrink: [] });
  });

  it('wgląd: do trzech naraz', () => {
    const held = [1, 2, 3].map((n): Held => ({ id: `c${n}`, coachId: `d${n}`, coachName: '', areas: ['insight'] }));
    expect(checkAreas(held.slice(0, 2), 'd9', ['insight'])[0]!.free).toBe(true);
    expect(checkAreas(held, 'd9', ['insight'])[0]!.free).toBe(false);
    expect(planAcceptance(held, 'd9', ['insight'], ['insight'])!.end).toEqual(['c1']);
  });

  it('proponowany zakres z obszarów', () => {
    expect(suggestScopes(['insight'])).toEqual(['body', 'labs']);
    expect(suggestScopes(['training', 'nutrition'])).toEqual(['training', 'movement', 'food', 'body', 'labs']);
  });
});

describe('Zalecenia z sieci', () => {
  const base = { v: 1, id: 'a1', sentAt: 1, from: { name: 'Anna', profession: 'trainer' } };

  it('plan z treningami przechodzi; plan do wglądu — nie', () => {
    const body = {
      kind: 'plan',
      plan: { id: 'p1', name: 'Siła', level: 'base', sex: 'any', daysPerWeek: 3, weeks: 8, loadFactor: 1, cycle: ['w1'], weekdays: [1, 3, 5], desc: '' },
      workouts: [{ id: 'w1', name: 'A', items: [{ ex: 'squat' }, { ex: 'row', pair: true }] }],
      videos: { squat: 'https://youtu.be/abc123', row: 'javascript:alert(1)' },
    };
    const a = parseAssignment({ ...base, area: 'training', body });
    expect(a?.body.kind).toBe('plan');
    if (a?.body.kind === 'plan') {
      expect(a.body.plan.kind).toBe('own');
      expect(a.body.videos).toEqual({ squat: 'https://youtu.be/abc123' });
      expect(a.body.workouts[0]!.items[1]).toEqual({ ex: 'row', pair: true });
    }
    expect(parseAssignment({ ...base, area: 'insight', body })).toBeNull();
  });

  it('cele: liczby spoza zakresu odpadają, puste cele — nie zalecenie', () => {
    const a = parseAssignment({ ...base, area: 'nutrition', body: { kind: 'targets', kcal: 2200, protein: 9000, steps: '10000' } });
    expect(a?.body).toMatchObject({ kind: 'targets', kcal: 2200, protein: null, steps: null });
    expect(parseAssignment({ ...base, area: 'nutrition', body: { kind: 'targets' } })).toBeNull();
  });

  it('nieznany rodzaj i zepsuty nadawca — odrzucone', () => {
    expect(parseAssignment({ ...base, area: 'training', body: { kind: 'exec', cmd: 'rm' } })).toBeNull();
    expect(parseAssignment({ ...base, from: {}, area: 'training', body: { kind: 'note', title: 'x', text: 'y' } })).toBeNull();
  });
});
