import { describe, expect, it } from 'vitest';
import { STALE_DAYS, WINDOW_MIN, dueItems, isStale, localParts, pruneSent } from './schedule';
import type { ReminderItem, SubRecord } from './schedule';

const item = (over: Partial<ReminderItem> = {}): ReminderItem => ({
  tag: 'trening',
  date: '2026-10-07',
  time: '07:30',
  title: 'Dziś trening: Trening A',
  body: 'Plan ma na dziś termin.',
  url: '#/sesja',
  ...over,
});

const rec = (items: ReminderItem[], over: Partial<SubRecord> = {}): SubRecord => ({
  endpoint: 'https://fcm.googleapis.com/fcm/send/x',
  p256dh: 'p',
  auth: 'a',
  tz: 'Europe/Warsaw',
  items,
  sent: [],
  updated: Date.parse('2026-10-06T12:00:00Z'),
  ...over,
});

describe('czas lokalny użytkownika', () => {
  it('liczy dzień i minutę w strefie użytkownika, a nie serwera', () => {
    // 05:30 UTC to 07:30 w Warszawie (czas letni, UTC+2) i 06:30 w Londynie.
    const now = new Date('2026-10-07T05:30:00Z');
    expect(localParts(now, 'Europe/Warsaw')).toEqual({ date: '2026-10-07', minutes: 7 * 60 + 30 });
    expect(localParts(now, 'Europe/London')).toEqual({ date: '2026-10-07', minutes: 6 * 60 + 30 });
    // Po zmianie czasu na zimowy Warszawa to UTC+1.
    expect(localParts(new Date('2026-11-04T06:30:00Z'), 'Europe/Warsaw')).toEqual({ date: '2026-11-04', minutes: 450 });
    // Północ to 0, nie 24.
    expect(localParts(new Date('2026-10-06T22:00:00Z'), 'Europe/Warsaw')).toEqual({ date: '2026-10-07', minutes: 0 });
  });
});

describe('które przypomnienia wysłać', () => {
  it('wysyła o czasie i do półtorej godziny później, nie wcześniej i nie po oknie', () => {
    const r = rec([item()]);
    expect(dueItems(r, new Date('2026-10-07T05:29:00Z'))).toEqual([]);
    expect(dueItems(r, new Date('2026-10-07T05:30:00Z'))).toEqual([item()]);
    expect(dueItems(r, new Date(Date.parse('2026-10-07T05:30:00Z') + (WINDOW_MIN - 1) * 60_000))).toEqual([item()]);
    // Poranne przypomnienie w południe byłoby o niczym — telefon był wyłączony, trudno.
    expect(dueItems(r, new Date(Date.parse('2026-10-07T05:30:00Z') + WINDOW_MIN * 60_000))).toEqual([]);
  });

  it('tylko w swoim dniu', () => {
    expect(dueItems(rec([item({ date: '2026-10-08' })]), new Date('2026-10-07T05:35:00Z'))).toEqual([]);
  });

  it('raz: wysłane przypomnienie nie wraca przy następnym przebiegu', () => {
    const r = rec([item(), item({ tag: 'ruch', time: '19:30', url: '#/cardio' })], {
      sent: ['2026-10-07|trening'],
    });
    expect(dueItems(r, new Date('2026-10-07T05:35:00Z'))).toEqual([]);
    expect(dueItems(r, new Date('2026-10-07T17:35:00Z')).map((i) => i.tag)).toEqual(['ruch']);
  });

  it('lista wysłanych trzyma tylko ostatnie dni', () => {
    expect(pruneSent(['2026-10-01|ruch', '2026-10-05|ruch', '2026-10-07|trening'], '2026-10-07')).toEqual([
      '2026-10-05|ruch',
      '2026-10-07|trening',
    ]);
  });

  it('subskrypcja bez odświeżenia przez długi czas jest porzucona', () => {
    const r = rec([]);
    expect(isStale(r, r.updated + (STALE_DAYS - 1) * 86_400_000)).toBe(false);
    expect(isStale(r, r.updated + (STALE_DAYS + 1) * 86_400_000)).toBe(true);
  });
});
