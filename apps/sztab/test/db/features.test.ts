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
 * Baza na żywo: funkcje prowadzenia z migracji `…_funkcje_prowadzenia` — harmonogram, wiadomości,
 * zdjęcia, kalendarz wizyt — z obu stron (prowadzący przez RLS, telefon przez funkcje).
 */

async function coachWithProfile() {
  const c = await coachClient();
  const me = await generateIdentity();
  const ins = await c.client.from('coaches').insert({
    id: c.id,
    display_name: 'Ola Trener',
    profession: 'trainer',
    public_key: me.publicJwk,
    key_fingerprint: await fingerprint(me.publicJwk),
    sealed_key: await sealPrivate(me.privateKey, newRecoveryCode(), c.id, 1000),
  });
  expect(ins.error).toBeNull();
  return { ...c, me };
}

async function connect(coach: { client: SupabaseClient; id: string }, scopes: string[] = ['training', 'body']) {
  const inv = await coach.client.from('invites').insert({ coach_id: coach.id, areas: ['training'], scopes }).select('id').single();
  expect(inv.error).toBeNull();
  const phone = await generateIdentity();
  const token = newToken();
  const { data, error } = await anon().rpc('invite_accept', {
    p_invite: inv.data!.id,
    p_pseudonym: await pseudonymFor(newIdSecret(), coach.id),
    p_public_key: phone.publicJwk,
    p_token: token,
    p_areas: ['training'],
    p_scopes: scopes,
  });
  expect(error).toBeNull();
  return { id: data as string, inviteId: inv.data!.id as string, phone, token };
}

describe('Harmonogram', () => {
  it('zalecenie z datą w przyszłości telefon dostaje dopiero, gdy przyjdzie jego czas', async () => {
    const coach = await coachWithProfile();
    const conn = await connect(coach);
    const now = crypto.randomUUID();
    const later = crypto.randomUUID();
    const past = crypto.randomUUID();
    const row = (id: string, visible_from: string | null) => ({ id, connection_id: conn.id, kind: 'note', area: 'training', ciphertext: 'v1.x', visible_from });
    expect((await coach.client.from('assignments').insert([
      row(now, null),
      row(later, new Date(Date.now() + 86_400_000).toISOString()),
      row(past, new Date(Date.now() - 60_000).toISOString()),
    ])).error).toBeNull();
    const pulled = await anon().rpc('client_pull', { p_connection: conn.id, p_token: conn.token });
    expect(pulled.error).toBeNull();
    const ids = (pulled.data.assignments as { id: string }[]).map((a) => a.id);
    expect(ids).toContain(now);
    expect(ids).toContain(past);
    expect(ids).not.toContain(later);
    // Prowadzący widzi wszystkie, także zaplanowane.
    expect((await coach.client.from('assignments').select('id').eq('connection_id', conn.id)).data).toHaveLength(3);
  });

  it('biblioteka przyjmuje program i nowe rodzaje', async () => {
    const coach = await coachWithProfile();
    for (const kind of ['form', 'habits', 'meals', 'program']) {
      const r = await coach.client.from('library_items').insert({ coach_id: coach.id, kind, title: kind, body: { kind } });
      expect(r.error).toBeNull();
    }
    expect((await coach.client.from('library_items').insert({ coach_id: coach.id, kind: 'shop', title: 'x', body: {} })).error).not.toBeNull();
  });
});

describe('Wiadomości', () => {
  it('obie strony piszą, czytają i oznaczają przeczytane — każda tylko swoje', async () => {
    const coach = await coachWithProfile();
    const conn = await connect(coach);
    const key = await linkKey(coach.me.privateKey, conn.phone.publicJwk, conn.inviteId);

    const fromCoach = crypto.randomUUID();
    const sealed = await sealJson(key, AAD.message(conn.id, fromCoach), { v: 1, id: fromCoach, at: Date.now(), text: 'Jak kolano?', ref: null });
    expect((await coach.client.from('messages').insert({ id: fromCoach, connection_id: conn.id, author: 'coach', ciphertext: sealed })).error).toBeNull();
    // Prowadzący nie podszyje się pod podopiecznego.
    const fake = await coach.client.from('messages').insert({ id: crypto.randomUUID(), connection_id: conn.id, author: 'client', ciphertext: 'v1.x' });
    expect(fake.error).not.toBeNull();

    const fromPhone = crypto.randomUUID();
    const phoneKey = await linkKey(conn.phone.privateKey, (await coach.client.from('coaches').select('public_key').single()).data!.public_key, conn.inviteId);
    const sent = await anon().rpc('client_message', {
      p_connection: conn.id,
      p_token: conn.token,
      p_id: fromPhone,
      p_ciphertext: await sealJson(phoneKey, AAD.message(conn.id, fromPhone), { v: 1, id: fromPhone, at: Date.now(), text: 'Lepiej!', ref: null }),
    });
    expect(sent.error).toBeNull();
    // Ponowienie tej samej wiadomości nie dubluje.
    const again = await anon().rpc('client_message', { p_connection: conn.id, p_token: conn.token, p_id: fromPhone, p_ciphertext: 'v1.x' });
    expect(again.error).toBeNull();

    const list = await anon().rpc('client_messages', { p_connection: conn.id, p_token: conn.token, p_since: null });
    expect(list.error).toBeNull();
    const msgs = list.data.messages as { id: string; author: string; ciphertext: string }[];
    expect(msgs.map((m) => m.author)).toEqual(['coach', 'client']);
    expect(await openJson(phoneKey, AAD.message(conn.id, fromCoach), msgs[0]!.ciphertext)).toMatchObject({ text: 'Jak kolano?' });
    expect(list.data.readUpTo).toBeNull();

    // Telefon czyta wiadomość prowadzącego; prowadzący — wiadomość telefonu, ale nie swoją.
    expect((await anon().rpc('client_read', { p_connection: conn.id, p_token: conn.token, p_upto: new Date().toISOString() })).error).toBeNull();
    const own = await coach.client.from('messages').update({ read_at: new Date().toISOString() }).eq('id', fromCoach).select('id');
    expect(own.data).toEqual([]);
    const theirs = await coach.client.from('messages').update({ read_at: new Date().toISOString() }).eq('id', fromPhone).select('id');
    expect(theirs.data).toEqual([{ id: fromPhone }]);
    const rows = await coach.client.from('messages').select('id, read_at').order('created_at');
    expect(rows.data!.every((r) => r.read_at)).toBe(true);
    expect((await anon().rpc('client_messages', { p_connection: conn.id, p_token: conn.token, p_since: null })).data.readUpTo).not.toBeNull();

    // Zły token — nic.
    expect((await anon().rpc('client_messages', { p_connection: conn.id, p_token: newToken(), p_since: null })).error?.message).toBe('bad_token');
  });

  it('zakończenie kasuje rozmowę', async () => {
    const coach = await coachWithProfile();
    const conn = await connect(coach);
    await anon().rpc('client_message', { p_connection: conn.id, p_token: conn.token, p_id: crypto.randomUUID(), p_ciphertext: 'v1.x' });
    expect((await coach.client.rpc('coach_end_connection', { p_connection: conn.id })).error).toBeNull();
    expect((await coach.client.from('messages').select('id').eq('connection_id', conn.id)).data).toEqual([]);
  });
});

describe('Zdjęcia sylwetki', () => {
  it('tylko za zgodą, z limitem, a cofnięta zgoda kasuje je od razu', async () => {
    const coach = await coachWithProfile();
    const without = await connect(coach);
    const denied = await anon().rpc('client_photo_put', { p_connection: without.id, p_token: without.token, p_id: crypto.randomUUID(), p_ciphertext: 'v1.x' });
    expect(denied.error?.message).toBe('no_scope');

    const conn = await connect(coach, ['training', 'photos']);
    const id = crypto.randomUUID();
    expect((await anon().rpc('client_photo_put', { p_connection: conn.id, p_token: conn.token, p_id: id, p_ciphertext: 'v1.a' })).error).toBeNull();
    expect((await anon().rpc('client_photo_put', { p_connection: conn.id, p_token: conn.token, p_id: id, p_ciphertext: 'v1.b' })).error).toBeNull();
    expect((await anon().rpc('client_photo_ids', { p_connection: conn.id, p_token: conn.token })).data).toEqual([id]);
    expect((await coach.client.from('photos').select('ciphertext').eq('id', id).single()).data!.ciphertext).toBe('v1.b');
    // Inna współpraca nie nadpisze cudzego numeru.
    const other = await connect(coach, ['photos']);
    expect((await anon().rpc('client_photo_put', { p_connection: other.id, p_token: other.token, p_id: id, p_ciphertext: 'v1.c' })).error?.message).toBe('bad_id');

    expect((await anon().rpc('client_update', { p_connection: conn.id, p_token: conn.token, p_areas: ['training'], p_scopes: ['training'] })).error).toBeNull();
    expect((await coach.client.from('photos').select('id').eq('connection_id', conn.id)).data).toEqual([]);
    expect((await anon().from('photos').select('id')).error).not.toBeNull();
  });
});

describe('Kalendarz wizyt', () => {
  const slot = (coachId: string, inHours: number, capacity = 1) => ({
    coach_id: coachId,
    starts_at: new Date(Date.now() + inHours * 3_600_000).toISOString(),
    ends_at: new Date(Date.now() + (inHours + 1) * 3_600_000).toISOString(),
    capacity,
    title: 'Trening personalny',
    place: 'https://meet.example.test/abc',
  });

  it('telefon widzi wolne terminy, rezerwuje raz, a pełny termin odmawia', async () => {
    const coach = await coachWithProfile();
    const a = await connect(coach);
    const b = await connect(coach);
    const s = await coach.client.from('slots').insert(slot(coach.id, 24)).select('id').single();
    expect(s.error).toBeNull();
    const past = await coach.client.from('slots').insert(slot(coach.id, -2)).select('id').single();

    const seen = await anon().rpc('client_slots', { p_connection: a.id, p_token: a.token });
    expect(seen.error).toBeNull();
    expect(seen.data.slots).toEqual([expect.objectContaining({ id: s.data!.id, taken: 0, capacity: 1, title: 'Trening personalny' })]);

    const booked = await anon().rpc('client_book', { p_connection: a.id, p_token: a.token, p_slot: s.data!.id });
    expect(booked.error).toBeNull();
    expect((await anon().rpc('client_book', { p_connection: a.id, p_token: a.token, p_slot: s.data!.id })).error?.message).toBe('already_booked');
    expect((await anon().rpc('client_book', { p_connection: b.id, p_token: b.token, p_slot: s.data!.id })).error?.message).toBe('slot_full');
    expect((await anon().rpc('client_book', { p_connection: b.id, p_token: b.token, p_slot: past.data!.id })).error?.message).toBe('slot_past');

    // Prowadzący widzi rezerwację, odwołuje termin — telefon widzi odwołanie przez prowadzącego.
    expect((await coach.client.from('bookings').select('connection_id')).data).toEqual([{ connection_id: a.id }]);
    expect((await coach.client.from('slots').update({ cancelled_at: new Date().toISOString() }).eq('id', s.data!.id)).error).toBeNull();
    const after = await anon().rpc('client_slots', { p_connection: a.id, p_token: a.token });
    expect(after.data.slots).toEqual([]);
    expect(after.data.bookings).toEqual([expect.objectContaining({ id: booked.data, cancelledBy: 'coach' })]);
  });

  it('podopieczny odwołuje swoją wizytę, a cudzy prowadzący jej nie widzi', async () => {
    const coach = await coachWithProfile();
    const stranger = await coachWithProfile();
    const a = await connect(coach);
    const s = await coach.client.from('slots').insert(slot(coach.id, 48, 3)).select('id').single();
    const booked = await anon().rpc('client_book', { p_connection: a.id, p_token: a.token, p_slot: s.data!.id });
    expect((await stranger.client.from('bookings').select('id')).data).toEqual([]);
    expect((await stranger.client.from('slots').select('id')).data).toEqual([]);
    expect((await anon().rpc('client_cancel_booking', { p_connection: a.id, p_token: a.token, p_booking: booked.data })).error).toBeNull();
    expect((await anon().rpc('client_cancel_booking', { p_connection: a.id, p_token: a.token, p_booking: booked.data })).error?.message).toBe('booking_missing');
    const row = await coach.client.from('bookings').select('cancelled_by').eq('id', booked.data).single();
    expect(row.data!.cancelled_by).toBe('client');
    // Termin innego prowadzącego jest dla tego telefonu „nie ma”.
    const foreign = await stranger.client.from('slots').insert(slot(stranger.id, 30)).select('id').single();
    expect((await anon().rpc('client_book', { p_connection: a.id, p_token: a.token, p_slot: foreign.data!.id })).error?.message).toBe('slot_missing');
  });

  it('anonimowy klient nie czyta żadnej nowej tabeli', async () => {
    for (const t of ['messages', 'photos', 'slots', 'bookings']) {
      expect((await anon().from(t).select('*').limit(1)).error?.code, t).toBe('42501');
    }
  });
});
