// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  AAD,
  fingerprint,
  generateIdentity,
  linkKey,
  newIdSecret,
  newRecoveryCode,
  newToken,
  openJson,
  pseudonymFor,
  sealJson,
  sealPrivate,
} from '@gymtracker/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { anon, coachClient } from './env';

/**
 * Baza na żywo (lokalny Supabase): polityki RLS widziane z obu stron i funkcje telefonu.
 * Każdy test zakłada własnego prowadzącego, więc kolejność i powtórki niczego nie psują.
 */

async function coachWithProfile() {
  const c = await coachClient();
  const me = await generateIdentity();
  const code = newRecoveryCode();
  const row = {
    id: c.id,
    display_name: 'Anna Kowalczyk',
    profession: 'trainer',
    public_key: me.publicJwk,
    key_fingerprint: await fingerprint(me.publicJwk),
    sealed_key: await sealPrivate(me.privateKey, code, c.id, 1000),
  };
  const ins = await c.client.from('coaches').insert(row);
  expect(ins.error).toBeNull();
  return { ...c, me };
}

async function invite(client: SupabaseClient, coachId: string, areas = ['training', 'nutrition']) {
  const { data, error } = await client
    .from('invites')
    .insert({ coach_id: coachId, areas, scopes: ['training', 'body'], message: 'Cześć!' })
    .select('id')
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

async function accept(inviteId: string, coachId: string, areas = ['training']) {
  const phone = await generateIdentity();
  const token = newToken();
  const pseudonym = await pseudonymFor(newIdSecret(), coachId);
  const { data, error } = await anon().rpc('invite_accept', {
    p_invite: inviteId,
    p_pseudonym: pseudonym,
    p_public_key: phone.publicJwk,
    p_token: token,
    p_areas: areas,
    p_scopes: ['training', 'body'],
  });
  return { id: data as string | null, error, phone, token, pseudonym };
}

describe('Zaproszenie i przyjęcie', () => {
  it('telefon widzi podgląd bez konta, przyjmuje raz, prowadzący widzi współpracę', async () => {
    const coach = await coachWithProfile();
    const inviteId = await invite(coach.client, coach.id);

    const preview = await anon().rpc('invite_preview', { p_invite: inviteId });
    expect(preview.error).toBeNull();
    expect(preview.data).toMatchObject({ status: 'open', coachName: 'Anna Kowalczyk', areas: ['training', 'nutrition'] });
    expect(await fingerprint(preview.data.publicKey)).toBe(await fingerprint(coach.me.publicJwk));

    const ok = await accept(inviteId, coach.id);
    expect(ok.error).toBeNull();
    const again = await accept(inviteId, coach.id);
    expect(again.error?.message).toBe('invite_used');

    const list = await coach.client.from('connections').select('id, pseudonym, areas, status');
    expect(list.data).toEqual([{ id: ok.id, pseudonym: ok.pseudonym, areas: ['training'], status: 'active' }]);
    expect((await anon().rpc('invite_preview', { p_invite: inviteId })).data.status).toBe('accepted');
  });

  it('obszar spoza zaproszenia i zajęte ID — odmowa', async () => {
    const coach = await coachWithProfile();
    const bad = await accept(await invite(coach.client, coach.id, ['insight']), coach.id, ['training']);
    expect(bad.error?.message).toBe('bad_areas');

    const first = await accept(await invite(coach.client, coach.id), coach.id);
    const phone = await generateIdentity();
    const dup = await anon().rpc('invite_accept', {
      p_invite: await invite(coach.client, coach.id),
      p_pseudonym: first.pseudonym,
      p_public_key: phone.publicJwk,
      p_token: newToken(),
      p_areas: ['training'],
      p_scopes: [],
    });
    expect(dup.error?.message).toBe('pseudonym_taken');
  });

  it('wycofane zaproszenie nie przechodzi', async () => {
    const coach = await coachWithProfile();
    const id = await invite(coach.client, coach.id);
    expect((await coach.client.from('invites').update({ revoked_at: new Date().toISOString() }).eq('id', id)).error).toBeNull();
    expect((await accept(id, coach.id)).error?.message).toBe('invite_revoked');
  });

  it('prowadzący nie zmieni zaproszenia poza wycofaniem', async () => {
    const coach = await coachWithProfile();
    const id = await invite(coach.client, coach.id);
    const r = await coach.client.from('invites').update({ areas: ['rehab'] }).eq('id', id);
    expect(r.error).not.toBeNull();
  });
});

describe('Paczka i zalecenia', () => {
  it('telefon wysyła szyfrogram, prowadzący go odczytuje; zły token — odmowa', async () => {
    const coach = await coachWithProfile();
    const inviteId = await invite(coach.client, coach.id);
    const c = await accept(inviteId, coach.id);
    const kPhone = await linkKey(c.phone.privateKey, coach.me.publicJwk, inviteId);
    const sealed = await sealJson(kPhone, AAD.snapshot(c.id!), { v: 1, at: 1, scopes: ['body'] });

    const push = await anon().rpc('client_push', { p_connection: c.id, p_token: c.token, p_ciphertext: sealed, p_bytes: sealed.length });
    expect(push.data).toEqual({ ok: true });
    const tooSoon = await anon().rpc('client_push', { p_connection: c.id, p_token: c.token, p_ciphertext: sealed, p_bytes: 1 });
    expect(tooSoon.data).toMatchObject({ ok: false, retryAfter: 30 });
    const bad = await anon().rpc('client_push', { p_connection: c.id, p_token: newToken(), p_ciphertext: sealed, p_bytes: 1 });
    expect(bad.error?.message).toBe('bad_token');

    const snap = await coach.client.from('snapshots').select('ciphertext').eq('connection_id', c.id).single();
    const kCoach = await linkKey(coach.me.privateKey, c.phone.publicJwk, inviteId);
    expect(await openJson(kCoach, AAD.snapshot(c.id!), snap.data!.ciphertext)).toEqual({ v: 1, at: 1, scopes: ['body'] });

    // Telefon bez tokenu nie zobaczy niczego wprost z tabel.
    expect((await anon().from('snapshots').select('*')).data ?? []).toEqual([]);
  });

  it('zalecenie tylko w obszarze współpracy; telefon je pobiera i potwierdza', async () => {
    const coach = await coachWithProfile();
    const inviteId = await invite(coach.client, coach.id);
    const c = await accept(inviteId, coach.id, ['training']);
    const k = await linkKey(coach.me.privateKey, c.phone.publicJwk, inviteId);
    const aid = crypto.randomUUID();
    const ct = await sealJson(k, AAD.assignment(c.id!, aid), { hello: 1 });

    const wrongArea = await coach.client
      .from('assignments')
      .insert({ id: crypto.randomUUID(), connection_id: c.id, kind: 'targets', area: 'nutrition', ciphertext: ct });
    expect(wrongArea.error).not.toBeNull();
    const ok = await coach.client.from('assignments').insert({ id: aid, connection_id: c.id, kind: 'note', area: 'training', ciphertext: ct });
    expect(ok.error).toBeNull();

    const pull = await anon().rpc('client_pull', { p_connection: c.id, p_token: c.token });
    expect(pull.data.status).toBe('active');
    expect(pull.data.assignments.map((a: { id: string }) => a.id)).toEqual([aid]);

    const rct = await sealJson(k, AAD.receipt(c.id!, aid), { v: 1, status: 'seen' });
    expect((await anon().rpc('client_receipt', { p_connection: c.id, p_token: c.token, p_assignment: aid, p_ciphertext: rct })).error).toBeNull();
    const rec = await coach.client.from('receipts').select('assignment_id').eq('connection_id', c.id);
    expect(rec.data).toEqual([{ assignment_id: aid }]);
  });

  it('obcy prowadzący nie widzi cudzych współprac ani nie wyśle zalecenia', async () => {
    const a = await coachWithProfile();
    const b = await coachWithProfile();
    const c = await accept(await invite(a.client, a.id), a.id);
    expect((await b.client.from('connections').select('id')).data).toEqual([]);
    const r = await b.client
      .from('assignments')
      .insert({ id: crypto.randomUUID(), connection_id: c.id, kind: 'note', area: 'training', ciphertext: 'v1.AAAA' });
    expect(r.error).not.toBeNull();
  });
});

describe('Zgoda i zakończenie', () => {
  it('węższy zakres kasuje paczkę od razu; obszarów nie da się dodać', async () => {
    const coach = await coachWithProfile();
    const inviteId = await invite(coach.client, coach.id);
    const c = await accept(inviteId, coach.id, ['training', 'nutrition']);
    await anon().rpc('client_push', { p_connection: c.id, p_token: c.token, p_ciphertext: 'v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', p_bytes: 40 });
    const narrower = await anon().rpc('client_update', { p_connection: c.id, p_token: c.token, p_areas: ['training'], p_scopes: ['training'] });
    expect(narrower.error).toBeNull();
    expect((await coach.client.from('snapshots').select('connection_id').eq('connection_id', c.id)).data).toEqual([]);
    const wider = await anon().rpc('client_update', { p_connection: c.id, p_token: c.token, p_areas: ['training', 'rehab'], p_scopes: [] });
    expect(wider.error?.message).toBe('bad_areas');
  });

  it('podopieczny kończy: znika paczka i zalecenia, token przestaje działać, stan mówi kto', async () => {
    const coach = await coachWithProfile();
    const inviteId = await invite(coach.client, coach.id);
    const c = await accept(inviteId, coach.id);
    await anon().rpc('client_push', { p_connection: c.id, p_token: c.token, p_ciphertext: 'v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', p_bytes: 40 });
    await coach.client.from('assignments').insert({ id: crypto.randomUUID(), connection_id: c.id, kind: 'note', area: 'training', ciphertext: 'v1.AAAA' });

    expect((await anon().rpc('client_end', { p_connection: c.id, p_token: c.token })).error).toBeNull();
    expect((await coach.client.from('snapshots').select('connection_id').eq('connection_id', c.id)).data).toEqual([]);
    expect((await coach.client.from('assignments').select('id').eq('connection_id', c.id)).data).toEqual([]);
    expect((await anon().rpc('client_pull', { p_connection: c.id, p_token: c.token })).error?.message).toBe('bad_token');
    expect((await anon().rpc('client_status', { p_connection: c.id })).data).toMatchObject({ status: 'ended', endedBy: 'client' });

    // To samo ID może wrócić do tego prowadzącego z nowym zaproszeniem.
    const phone = await generateIdentity();
    const back = await anon().rpc('invite_accept', {
      p_invite: await invite(coach.client, coach.id),
      p_pseudonym: c.pseudonym,
      p_public_key: phone.publicJwk,
      p_token: newToken(),
      p_areas: ['training'],
      p_scopes: [],
    });
    expect(back.error).toBeNull();
  });

  it('prowadzący kończy przez funkcję; obcy prowadzący — nie', async () => {
    const a = await coachWithProfile();
    const b = await coachWithProfile();
    const c = await accept(await invite(a.client, a.id), a.id);
    expect((await b.client.rpc('coach_end_connection', { p_connection: c.id })).error?.message).toBe('not_found');
    expect((await a.client.rpc('coach_end_connection', { p_connection: c.id })).error).toBeNull();
    expect((await anon().rpc('client_status', { p_connection: c.id })).data).toMatchObject({ status: 'ended', endedBy: 'coach' });
  });

  it('usunięcie konta zabiera wszystko', async () => {
    const a = await coachWithProfile();
    const c = await accept(await invite(a.client, a.id), a.id);
    expect((await a.client.rpc('coach_delete_account')).error).toBeNull();
    expect((await anon().rpc('client_status', { p_connection: c.id })).data).toBeNull();
  });
});
