import { describe, expect, it } from 'vitest';
import {
  GRACE_MIN,
  PHONE_EVERY_MIN,
  STALE_AFTER_MIN,
  WATCH_EVERY_MIN,
  aboutText,
  agoText,
  checkSaid,
  deviceStatus,
  lastPackText,
  nextText,
  shortAtText,
  sinceText,
} from './deviceStatus';
import type { DeviceInput } from './deviceStatus';

/**
 * Stan połączenia z urządzeniem: progi „działa / spóźnia się / od dawna nic”, następna paczka,
 * zły klucz i brak sieci — i słowa, którymi o tym mówimy. Czas lokalny, jak na ekranie.
 */

const NOW = new Date(2026, 9, 22, 14, 44).getTime();
const MIN = 60_000;
/** Paczka sprzed tylu minut — w sekundach, jak `t` z urządzenia. */
const ago = (min: number): number => Math.floor((NOW - min * MIN) / 1000);

const input = (over: Partial<DeviceInput> = {}): DeviceInput => ({
  lastT: ago(12),
  got: new Date(NOW - 11 * MIN).toISOString(),
  kind: 'ok',
  hasKey: true,
  nowMs: NOW,
  cadenceMin: WATCH_EVERY_MIN,
  ...over,
});

describe('poziom połączenia', () => {
  it('świeża paczka: działa, z ostatnią i następną paczką', () => {
    const s = deviceStatus(input());
    expect(s.level).toBe('ok');
    expect(s.lastAt).toBe(ago(12) * 1000);
    expect(s.nextAt).toBe(ago(12) * 1000 + 30 * MIN);
    expect(s.minutesSince).toBe(12);
    expect(s.overdueMin).toBe(0);
  });

  it('progi: kadencja + kwadrans to jeszcze „działa”, minuta dalej — „spóźnia się”', () => {
    expect(deviceStatus(input({ lastT: ago(WATCH_EVERY_MIN + GRACE_MIN) })).level).toBe('ok');
    expect(deviceStatus(input({ lastT: ago(WATCH_EVERY_MIN + GRACE_MIN + 1) })).level).toBe('late');
  });

  it('progi: spóźnienie do sześciu godzin to „spóźnia się”, dłuższe — „od dawna nic”', () => {
    const edge = WATCH_EVERY_MIN + STALE_AFTER_MIN;
    expect(deviceStatus(input({ lastT: ago(edge) })).level).toBe('late');
    const s = deviceStatus(input({ lastT: ago(edge + 1) }));
    expect(s.level).toBe('stale');
    expect(s.overdueMin).toBe(STALE_AFTER_MIN + 1);
  });

  it('telefon wysyła co godzinę, więc spóźnia się później niż zegarek', () => {
    expect(deviceStatus(input({ lastT: ago(70) })).level).toBe('late');
    expect(deviceStatus(input({ lastT: ago(70), cadenceMin: PHONE_EVERY_MIN })).level).toBe('ok');
    expect(deviceStatus(input({ lastT: ago(76), cadenceMin: PHONE_EVERY_MIN })).level).toBe('late');
  });

  it('klucz zapisany, a nic jeszcze nie przyszło — pierwsze kroki; bez klucza też', () => {
    expect(deviceStatus(input({ lastT: null, got: null, kind: 'empty' })).level).toBe('setup');
    expect(deviceStatus(input({ lastT: null, got: null, kind: null })).level).toBe('setup');
    expect(deviceStatus(input({ hasKey: false })).level).toBe('setup');
  });

  it('zły klucz wygrywa z zegarem, nawet przy świeżej paczce', () => {
    const s = deviceStatus(input({ kind: 'bad' }));
    expect(s.level).toBe('bad');
    expect(s.lastAt).toBe(ago(12) * 1000);
  });

  it('bez sieci: „offline”, ale ostatnia i następna paczka zostają do pokazania', () => {
    const s = deviceStatus(input({ kind: 'offline', lastT: ago(200) }));
    expect(s.level).toBe('offline');
    expect(s.lastAt).toBe(ago(200) * 1000);
    expect(s.nextAt).toBe(ago(200) * 1000 + 30 * MIN);
    expect(s.minutesSince).toBe(200);
    expect(deviceStatus(input({ kind: 'offline', lastT: null, got: null })).lastAt).toBeNull();
  });

  it('pusta skrzynka przy starych danych to sprawa zegara, nie błąd', () => {
    expect(deviceStatus(input({ kind: 'empty', lastT: ago(9 * 60) })).level).toBe('stale');
  });

  it('paczka „z przyszłości” (spieszący się zegar urządzenia) jest świeża, nie ujemna', () => {
    const s = deviceStatus(input({ lastT: ago(-20) }));
    expect(s.level).toBe('ok');
    expect(s.minutesSince).toBe(0);
  });

  it('bez czasu paczki liczy się chwila odbioru', () => {
    const s = deviceStatus(input({ lastT: null }));
    expect(s.lastAt).toBe(NOW - 11 * MIN);
    expect(s.level).toBe('ok');
  });
});

describe('słowa o czasie', () => {
  it('czas względny: przed chwilą, minuty, godziny, a od wczoraj data', () => {
    expect(agoText(NOW - 20_000, NOW)).toBe('przed chwilą');
    expect(agoText(NOW - 12 * MIN, NOW)).toBe('12 min temu');
    expect(agoText(NOW - 125 * MIN, NOW)).toBe('2 godz. temu');
    expect(agoText(new Date(2026, 9, 21, 21, 40).getTime(), NOW)).toBe('wczoraj 21:40');
    expect(agoText(new Date(2026, 9, 1, 21, 40).getTime(), NOW)).toBe('1.10 21:40');
  });

  it('ostatnia paczka: godzina i czas względny, bez powtórzeń od wczoraj', () => {
    expect(lastPackText(NOW - 12 * MIN, NOW)).toBe('dziś 14:32 (12 min temu)');
    expect(lastPackText(new Date(2026, 9, 21, 21, 40).getTime(), NOW)).toBe('wczoraj 21:40');
  });

  it('następna paczka: godzina, a po jej porze — lada chwila', () => {
    const s = deviceStatus(input({ lastT: Math.floor(new Date(2026, 9, 22, 14, 32).getTime() / 1000) }));
    expect(nextText(s, NOW)).toBe('następna ok. 15:02');
    const due = deviceStatus(input({ lastT: ago(40) }));
    expect(due.level).toBe('ok');
    expect(nextText(due, NOW)).toBe('następna lada chwila');
  });

  it('pora z innego dnia mówi, którego', () => {
    const late = new Date(2026, 9, 22, 23, 50).getTime();
    expect(aboutText(late + 30 * MIN, late)).toBe('jutro ok. 0:20');
    expect(aboutText(new Date(2026, 9, 21, 23, 40).getTime(), NOW)).toBe('wczoraj ok. 23:40');
    expect(shortAtText(NOW - 12 * MIN, NOW)).toBe('14:32');
    expect(shortAtText(new Date(2026, 9, 21, 7, 5).getTime(), NOW)).toBe('wczoraj 7:05');
  });

  it('jak długo nic nie przyszło', () => {
    expect(sinceText(50)).toBe('1 godz.');
    expect(sinceText(7 * 60 - 10)).toBe('7 godz.');
    expect(sinceText(26 * 60)).toBe('doby');
    expect(sinceText(3 * 24 * 60 + 5)).toBe('3 dni');
  });
});

describe('po „Sprawdź teraz”', () => {
  const t = ago(12);

  it('nowa paczka — z jej godziną', () => {
    expect(checkSaid('watch', t, { kind: 'ok', payload: { t: ago(1) } }, NOW)).toBe('Przyszła nowa paczka (14:43).');
    expect(checkSaid('watch', null, { kind: 'ok', payload: { t } }, NOW)).toBe('Przyszła nowa paczka (14:32).');
  });

  it('ta sama paczka — bez nowej, co ile wysyła i jak wysłać od razu', () => {
    expect(checkSaid('watch', t, { kind: 'ok', payload: { t } }, NOW)).toBe(
      'Bez nowej paczki — ostatnia z 14:32, zegarek wysyła co ok. 30 min. Chcesz teraz? Otwórz GYM TRACKER na zegarku i naciśnij START.',
    );
    expect(checkSaid('phone', t, { kind: 'ok', payload: { t } }, NOW)).toContain('naciśnij „Wyślij teraz”');
  });

  it('pusta skrzynka: przed pierwszą paczką instrukcja, po niej — tydzień ciszy', () => {
    expect(checkSaid('watch', null, { kind: 'empty' }, NOW)).toMatch(/^Zegarek jeszcze nic nie przysłał/);
    expect(checkSaid('phone', t, { kind: 'empty' }, NOW)).toMatch(/telefon nic nie wysłał od ponad tygodnia/);
  });

  it('zły klucz i brak sieci', () => {
    expect(checkSaid('watch', t, { kind: 'bad' }, NOW)).toMatch(/nie otwiera się tym kluczem/);
    expect(checkSaid('phone', t, { kind: 'offline' }, NOW)).toMatch(/nie ma sieci/);
  });
});
