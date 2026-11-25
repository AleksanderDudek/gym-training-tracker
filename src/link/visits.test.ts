import { describe, expect, it } from 'vitest';
import type { Booking, Slot } from './rpc';
import type { LinkConnection, LinkState } from './store';
import { freeSeats, localDay, plannedCount, slotDays, soonVisit, splitBookings, videoLink } from './visits';

const NOW = new Date(2026, 10, 25, 12, 0).getTime();
const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

const booking = (over: Partial<Booking> & { at: number }): Booking => ({
  id: over.id ?? `b-${over.at}`,
  slotId: over.slotId ?? `s-${over.at}`,
  startsAt: iso(over.at),
  endsAt: iso(over.at + H),
  title: over.title ?? 'Trening personalny',
  place: over.place ?? null,
  note: null,
  cancelledAt: over.cancelledAt ?? null,
  cancelledBy: over.cancelledBy ?? null,
});

const slot = (at: number, over: Partial<Slot> = {}): Slot => ({
  id: `s-${at}`,
  startsAt: iso(at),
  endsAt: iso(at + H),
  title: 'Konsultacja',
  place: null,
  note: null,
  capacity: 1,
  taken: 0,
  ...over,
});

describe('splitBookings', () => {
  it('nadchodzące (z trwającą) od najbliższej, minione od najświeższej', () => {
    const list = [booking({ at: NOW + 48 * H }), booking({ at: NOW - 30 * H }), booking({ at: NOW - H / 2 }), booking({ at: NOW + 2 * H }), booking({ at: NOW - 5 * 24 * H })];
    const { upcoming, past } = splitBookings(list, NOW);
    expect(upcoming.map((b) => b.startsAt)).toEqual([iso(NOW - H / 2), iso(NOW + 2 * H), iso(NOW + 48 * H)]);
    expect(past.map((b) => b.startsAt)).toEqual([iso(NOW - 30 * H), iso(NOW - 5 * 24 * H)]);
  });

  it('odwołana i ponownie zarezerwowana — zostaje tylko żywa; kilka odwołań — jedno, najnowsze', () => {
    const at = NOW + 24 * H;
    const list = [
      booking({ at, id: 'old', slotId: 's', cancelledAt: iso(NOW - 2 * H), cancelledBy: 'client' }),
      booking({ at, id: 'live', slotId: 's' }),
      booking({ at: at + 24 * H, id: 'c1', slotId: 't', cancelledAt: iso(NOW - 3 * H), cancelledBy: 'client' }),
      booking({ at: at + 24 * H, id: 'c2', slotId: 't', cancelledAt: iso(NOW - H), cancelledBy: 'coach' }),
    ];
    expect(splitBookings(list, NOW).upcoming.map((b) => b.id)).toEqual(['live', 'c2']);
  });
});

describe('slotDays', () => {
  it('po dniach telefonu, bez minionych i bez już zarezerwowanych', () => {
    const tomorrow9 = new Date(2026, 10, 26, 9, 0).getTime();
    const tomorrow18 = new Date(2026, 10, 26, 18, 0).getTime();
    const friday = new Date(2026, 10, 27, 7, 30).getTime();
    const slots = [slot(friday), slot(tomorrow18), slot(NOW - H), slot(tomorrow9)];
    const days = slotDays(slots, [booking({ at: tomorrow18, slotId: `s-${tomorrow18}` })], NOW);
    expect(days.map((d) => d.day)).toEqual(['2026-11-26', '2026-11-27']);
    expect(days[0]!.slots.map((s) => s.startsAt)).toEqual([iso(tomorrow9)]);
    // Odwołana przez nas rezerwacja nie ukrywa terminu.
    const again = slotDays(slots, [booking({ at: tomorrow18, slotId: `s-${tomorrow18}`, cancelledAt: iso(NOW), cancelledBy: 'client' })], NOW);
    expect(again[0]!.slots).toHaveLength(2);
  });

  it('wolne miejsca nigdy poniżej zera; zaplanowane liczy jak serwer', () => {
    expect(freeSeats(slot(NOW, { capacity: 3, taken: 1 }))).toBe(2);
    expect(freeSeats(slot(NOW, { capacity: 1, taken: 2 }))).toBe(0);
    expect(plannedCount([booking({ at: NOW + H }), booking({ at: NOW - H / 2 }), booking({ at: NOW + 2 * H, cancelledAt: iso(NOW), cancelledBy: 'coach' })], NOW)).toBe(1);
  });
});

describe('soonVisit', () => {
  const conn = (id: string, bookings: Booking[], status: 'active' | 'ended' = 'active') => ({ id, status, visits: { at: NOW, bookings } }) as unknown as LinkConnection;
  const state = (connections: LinkConnection[]) => ({ connections }) as unknown as LinkState;

  it('najbliższa nieodwołana w ciągu doby, ze słowem „jutro”, gdy to już następny dzień', () => {
    const tonight = booking({ at: NOW + 6 * H, title: 'Wieczorem' });
    const tomorrow = booking({ at: NOW + 20 * H, title: 'Rano' });
    const s = state([conn('a', [tomorrow]), conn('b', [tonight, booking({ at: NOW + H, cancelledAt: iso(NOW), cancelledBy: 'client' })])]);
    expect(soonVisit(s, NOW)).toMatchObject({ booking: { title: 'Wieczorem' }, tomorrow: false, connection: { id: 'b' } });
    expect(soonVisit(state([conn('a', [tomorrow])]), NOW)).toMatchObject({ tomorrow: true });
  });

  it('za ponad dobę, już trwająca albo u zakończonej współpracy — nic', () => {
    expect(soonVisit(state([conn('a', [booking({ at: NOW + 25 * H })])]), NOW)).toBeNull();
    expect(soonVisit(state([conn('a', [booking({ at: NOW - H / 2 })])]), NOW)).toBeNull();
    expect(soonVisit(state([conn('a', [booking({ at: NOW + H })], 'ended')]), NOW)).toBeNull();
    expect(soonVisit(state([{ id: 'x', status: 'active' } as LinkConnection]), NOW)).toBeNull();
  });
});

describe('videoLink i localDay', () => {
  it('tylko pełny https bez spacji', () => {
    expect(videoLink('https://meet.example.com/abc')).toBe('https://meet.example.com/abc');
    expect(videoLink('  https://zoom.us/j/123?pwd=x  ')).toBe('https://zoom.us/j/123?pwd=x');
    expect(videoLink('http://meet.example.com/abc')).toBeNull();
    expect(videoLink('https://localhost/x')).toBeNull();
    expect(videoLink('Studio, ul. Długa 5')).toBeNull();
    expect(videoLink('javascript:alert(1)')).toBeNull();
    expect(videoLink(null)).toBeNull();
  });

  it('dzień w czasie telefonu', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
});
