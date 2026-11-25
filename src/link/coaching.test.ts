import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanCoaching, newIdSecret } from '@gymtracker/link';
import type { SnapshotV1 } from '@gymtracker/link';
import { freshState } from '../engine/plan';
import { fakeSztab } from '../test/linkServer';
import type { FakeSztab } from '../test/linkServer';
import { acceptInvite } from './accept';
import { invitePreview } from './rpc';
import { coachingFor } from './snapshot';
import { clearLink, linkState, messagesOf, unreadMessages, updateLink } from './store';
import type { LinkConnection } from './store';
import { forgetKeys, markMessagesRead, pushOne, refreshMessages, saveAnswer, sendMessage, setDayTicks, syncAll } from './sync';

/**
 * Prowadzenie na telefonie: rodzaje nowsze niż aplikacja, rozmowa z prowadzącym (szyfrowana
 * w obie strony, z kolejką bez sieci) i odpowiedzi z odhaczeniami w paczce (`coaching`).
 */

let server: FakeSztab;
let conn: LinkConnection;
const state = freshState();
const from = { name: 'Anna Kowalska', profession: 'trainer' as const };

beforeEach(async () => {
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  const inv = await server.invite(['training', 'nutrition'], ['training']);
  const r = await acceptInvite({
    preview: (await invitePreview(inv.id))!,
    fingerprint: inv.fingerprint,
    chosen: ['training', 'nutrition'],
    replace: [],
    scopes: ['training'],
    secret: newIdSecret(),
  });
  if (!r.ok) throw new Error(r.reason);
  conn = r.connection;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('rodzaj nowszy niż aplikacja', () => {
  it('nie jest „zepsuty”, tylko czeka na aktualizację', async () => {
    const id = await server.send(conn.id, { area: 'training', sentAt: Date.now(), from, body: { kind: 'note', title: 'x', text: 'y', checklist: [] } });
    server.connections.get(conn.id)!.assignments[0]!.kind = 'hologram';
    await syncAll(() => state);
    expect(linkState().broken).toEqual([]);
    expect(linkState().unsupported).toEqual([{ id, connectionId: conn.id, kind: 'hologram' }]);
    // Drugi odbiór nie dubluje.
    await syncAll(() => state);
    expect(linkState().unsupported).toHaveLength(1);
  });

  it('formularz, nawyki i jadłospis ta wersja już zna', async () => {
    await server.send(conn.id, {
      area: 'nutrition',
      sentAt: Date.now(),
      from,
      body: { kind: 'habits', title: 'Nawyki', note: '', until: null, items: [{ label: 'Woda 2 l', dose: '', when: 'any', days: [1, 2, 3, 4, 5, 6, 7] }] },
    });
    await syncAll(() => state);
    expect(linkState().assignments.map((a) => a.a.body.kind)).toEqual(['habits']);
    expect(linkState().unsupported).toEqual([]);
  });
});

describe('rozmowa', () => {
  it('wiadomość prowadzącego przychodzi odszyfrowana, a otwarta rozmowa oznacza ją jako przeczytaną', async () => {
    await server.message(conn.id, 'Jak poszedł trening?');
    await syncAll(() => state);
    expect(unreadMessages(linkState()).map((m) => m.text)).toEqual(['Jak poszedł trening?']);
    await markMessagesRead(conn.id);
    expect(unreadMessages(linkState())).toEqual([]);
    expect(server.connections.get(conn.id)!.messages[0]!.readAt).not.toBeNull();
    // Następne pobranie prosi tylko o nowsze.
    await server.message(conn.id, 'I jak sen?');
    await refreshMessages(conn.id);
    expect(messagesOf(linkState(), conn.id).map((m) => m.text)).toEqual(['Jak poszedł trening?', 'I jak sen?']);
    const last = server.calls.filter((c) => c.name === 'client_messages').at(-1)!;
    expect(last.args.p_since).not.toBeNull();
  });

  it('nasza wiadomość doczytuje się u prowadzącego; bez sieci czeka i idzie przy synchronizacji', async () => {
    expect(await sendMessage(conn.id, '  Kolano lepiej  ', { kind: 'session', at: '2026-11-25T18:00:00.000Z', label: 'Góra A' })).toBe('sent');
    const sent = messagesOf(linkState(), conn.id)[0]!;
    expect(sent.serverAt).not.toBeNull();
    expect(await server.readMessage(conn.id, sent.id)).toMatchObject({ text: 'Kolano lepiej', ref: { kind: 'session', label: 'Góra A' } });

    server.setOffline(true);
    expect(await sendMessage(conn.id, 'Bez zasięgu')).toBe('later');
    expect(messagesOf(linkState(), conn.id).at(-1)!.serverAt).toBeNull();
    server.setOffline(false);
    await syncAll(() => state);
    const queued = messagesOf(linkState(), conn.id).at(-1)!;
    expect(queued.serverAt).not.toBeNull();
    expect(server.connections.get(conn.id)!.messages).toHaveLength(2);

    // Prowadzący przeczytał — telefon wie, do kiedy.
    server.readByCoach(conn.id);
    await refreshMessages(conn.id);
    expect(linkState().connections[0]!.readUpTo).toBe(server.connections.get(conn.id)!.messages.at(-1)!.createdAt);
  });

  it('wiadomość pod cudzym numerem się nie otwiera i nie trafia na ekran', async () => {
    const id = await server.message(conn.id, 'x');
    server.connections.get(conn.id)!.messages[0]!.id = id.replace(/^.{8}/, 'eeeeeeee');
    await syncAll(() => state);
    expect(messagesOf(linkState(), conn.id)).toEqual([]);
  });
});

describe('odpowiedzi i odhaczenia w paczce', () => {
  const formBody = {
    kind: 'form' as const,
    title: 'Check-in',
    intro: '',
    repeat: 'weekly' as const,
    weekday: 1,
    intake: false,
    questions: [{ id: 'q1', type: 'scale' as const, label: 'Energia', help: '', required: true, unit: '', min: 0, max: 10, options: [] }],
  };

  it('idą do prowadzącego swojej współpracy, w oknie dni', async () => {
    const formId = await server.send(conn.id, { area: 'training', sentAt: Date.now(), from, body: formBody });
    const habitsId = await server.send(conn.id, {
      area: 'training',
      sentAt: Date.now(),
      from,
      body: { kind: 'habits', title: 'Sen', note: '', until: null, items: [{ label: '8 h', dose: '', when: 'evening', days: [1, 2, 3, 4, 5, 6, 7] }] },
    });
    await syncAll(() => state);
    const fa = linkState().assignments.find((a) => a.id === formId)!;
    const ha = linkState().assignments.find((a) => a.id === habitsId)!;
    saveAnswer(fa, '2026-W48', { q1: 7 }, () => state, Date.now());
    saveAnswer(fa, '2026-W48', { q1: 8 }, () => state, Date.now()); // poprawka zastępuje
    setDayTicks(ha, '2026-11-25', [0], () => state);
    setDayTicks(ha, '2026-11-26', [], () => state); // puste — dzień znika
    // Obca odpowiedź (zalecenie innej współpracy) nie wycieka.
    updateLink((s) => {
      s.answers.push({ assignmentId: 'cudze', period: 'once', at: Date.now(), values: { q1: 1 } });
    });

    expect(linkState().connections[0]!.pushDue).toBe(true);
    await pushOne(linkState().connections[0]!, state, { force: true });
    const snap = (await server.readSnapshot(conn.id)) as SnapshotV1;
    const c = cleanCoaching(snap.coaching);
    expect(c.answers).toEqual([expect.objectContaining({ assignmentId: formId, period: '2026-W48', values: { q1: 8 } })]);
    expect(c.habits).toEqual([{ assignmentId: habitsId, days: { '2026-11-25': [0] } }]);
  });

  it('odpowiedź starsza niż okno nie idzie', () => {
    updateLink((s) => {
      s.assignments.push({
        id: 'f1',
        connectionId: conn.id,
        a: { v: 1, id: 'f1', area: 'training', sentAt: 0, from, body: formBody },
        receivedAt: 0,
        status: 'seen',
        ticked: [],
        sent: 'seen',
      });
      s.answers.push({ assignmentId: 'f1', period: '2026-W01', at: Date.parse('2026-01-02T10:00:00Z'), values: { q1: 5 } });
      s.answers.push({ assignmentId: 'f1', period: '2026-W48', at: Date.parse('2026-11-24T10:00:00Z'), values: { q1: 6 } });
    });
    const c = coachingFor(linkState(), conn.id, Date.parse('2026-11-25T12:00:00Z'), 30);
    expect(c.answers.map((a) => a.period)).toEqual(['2026-W48']);
  });

  it('kilka odhaczeń pod rząd składa się w jedną wysyłkę', async () => {
    const habitsId = await server.send(conn.id, {
      area: 'training',
      sentAt: Date.now(),
      from,
      body: { kind: 'habits', title: 'Sen', note: '', until: null, items: [{ label: '8 h', dose: '', when: 'evening', days: [1, 2, 3, 4, 5, 6, 7] }] },
    });
    await syncAll(() => state);
    const ha = linkState().assignments.find((a) => a.id === habitsId)!;
    // Poprzednia paczka dawno temu — odstęp 30 s nie gra tu roli.
    updateLink((s) => {
      s.connections[0]!.lastPushAt = Date.now() - 60_000;
    });
    vi.useFakeTimers();
    const before = server.names().filter((n) => n === 'client_push').length;
    setDayTicks(ha, '2026-11-25', [0], () => state);
    setDayTicks(ha, '2026-11-26', [0], () => state);
    setDayTicks(ha, '2026-11-27', [0], () => state);
    await vi.advanceTimersByTimeAsync(3000);
    vi.useRealTimers();
    await vi.waitFor(() => expect(server.names().filter((n) => n === 'client_push').length).toBe(before + 1));
  });
});

describe('wizyty w tle', () => {
  it('zapamiętane rezerwacje odświeżają się przy synchronizacji, gdy mają ponad 3 h — świeże nie', async () => {
    const slot = server.slot();
    updateLink((s) => {
      s.connections[0]!.visits = { at: Date.now() - 4 * 3_600_000, bookings: [] };
    });
    // Rezerwacja „z innego urządzenia” — telefon dowie się o niej z odświeżenia.
    server.connections.get(conn.id)!.bookings.push({ id: crypto.randomUUID(), slotId: slot.id, cancelledAt: null, cancelledBy: null });
    await syncAll(() => state);
    expect(linkState().connections[0]!.visits?.bookings.map((b) => b.slotId)).toEqual([slot.id]);
    const calls = server.names().filter((n) => n === 'client_slots').length;
    await syncAll(() => state);
    expect(server.names().filter((n) => n === 'client_slots').length).toBe(calls);
  });

  it('bez zapisu (nigdy nie otwierał wizyt) nie pyta o terminy', async () => {
    await syncAll(() => state);
    expect(server.names()).not.toContain('client_slots');
  });
});

describe('poprawki po przeglądzie', () => {
  it('serwer nie poszerzy zgody: dopisane „photos” nie trafia do zakresu na telefonie', async () => {
    server.connections.get(conn.id)!.scopes = ['training', 'photos'];
    await syncAll(() => state);
    expect(linkState().connections[0]!.scopes).toEqual(['training']);
    // Zwężenie przechodzi.
    server.connections.get(conn.id)!.scopes = [];
    await syncAll(() => state);
    expect(linkState().connections[0]!.scopes).toEqual([]);
  });

  it('otwiera się, ale nie przechodzi sprawdzenia → „zaktualizuj”, nie „zepsute”; zepsute próbujemy jeszcze raz', async () => {
    const id = await server.send(conn.id, { area: 'training', sentAt: Date.now(), from, body: { kind: 'note', title: 'x', text: 'y', checklist: [] } });
    const row = server.connections.get(conn.id)!.assignments[0]!;
    const good = row.ciphertext;
    // Kształt, którego ta wersja nie przyjmuje (np. pole z przyszłości) — szyfrogram poprawny.
    const bad = await server.send(conn.id, { area: 'training', sentAt: Date.now(), from, body: { kind: 'note', title: '', text: '', checklist: [] } as never });
    row.ciphertext = 'v1.zepsuty';
    await syncAll(() => state);
    expect(linkState().unsupported.map((u) => u.id)).toEqual([bad]);
    expect(linkState().broken.map((b) => b.id)).toEqual([id]);
    row.ciphertext = good;
    await syncAll(() => state);
    expect(linkState().broken).toEqual([]);
    expect(linkState().assignments.map((a) => a.id)).toContain(id);
  });

  it('„przeczytane”, które nie doszło bez sieci, idzie przy następnym pobraniu', async () => {
    await server.message(conn.id, 'Hej');
    await syncAll(() => state);
    server.setOffline(true);
    await markMessagesRead(conn.id);
    expect(server.connections.get(conn.id)!.messages[0]!.readAt).toBeNull();
    server.setOffline(false);
    await refreshMessages(conn.id);
    expect(server.connections.get(conn.id)!.messages[0]!.readAt).not.toBeNull();
  });

  it('odhaczenie w 30 s po paczce czeka na swoją kolej zamiast przepaść do następnej synchronizacji', async () => {
    const habitsId = await server.send(conn.id, {
      area: 'training',
      sentAt: Date.now(),
      from,
      body: { kind: 'habits', title: 'Sen', note: '', until: null, items: [{ label: '8 h', dose: '', when: 'evening', days: [1, 2, 3, 4, 5, 6, 7] }] },
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    await syncAll(() => state); // paczka właśnie poszła
    const ha = linkState().assignments.find((a) => a.id === habitsId)!;
    const pushes = () => server.names().filter((n) => n === 'client_push').length;
    const before = pushes();
    setDayTicks(ha, '2026-11-25', [0], () => state);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(pushes()).toBe(before); // za wcześnie — telefon nawet nie próbuje
    await vi.advanceTimersByTimeAsync(30_000);
    vi.useRealTimers();
    await vi.waitFor(() => {
      expect(pushes()).toBe(before + 1);
      // Prośba skasowana dopiero po odpowiedzi serwera — licznik zapytań rośnie wcześniej.
      expect(linkState().connections[0]!.pushDue).toBeUndefined();
    });
  });

  it('wywiad (jednorazowy) idzie w paczce także po wyjściu poza okno dni', () => {
    updateLink((s) => {
      s.assignments.push({
        id: 'w1',
        connectionId: conn.id,
        a: {
          v: 1,
          id: 'w1',
          area: 'training',
          sentAt: 1,
          from,
          body: { kind: 'form', title: 'Wywiad', intro: '', repeat: 'once', weekday: null, intake: true, questions: [{ id: 'q1', type: 'text', label: 'Cel', help: '', required: true, unit: '', min: null, max: null, options: [] }] },
        },
        receivedAt: 0,
        status: 'done',
        ticked: [],
        sent: 'done',
      });
      s.answers.push({ assignmentId: 'w1', period: 'once', at: Date.parse('2025-01-02T10:00:00Z'), values: { q1: 'siła' } });
    });
    expect(coachingFor(linkState(), conn.id, Date.parse('2026-11-25T12:00:00Z'), 30).answers.map((a) => a.assignmentId)).toEqual(['w1']);
  });
});
