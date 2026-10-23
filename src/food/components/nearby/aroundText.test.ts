import { describe, expect, test } from 'vitest';
import { ageText, aroundNotes } from './aroundText';

const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);
const HOUR = 3600 * 1000;
const base = { status: 'loading' as const, items: [{}], savedAt: null, since: NOW, retryAt: null };

describe('słowa o serwerze map', () => {
  test('wiek zapisanej odpowiedzi czyta się jak w rozmowie', () => {
    expect(ageText(30_000)).toBe('1 minutę temu');
    expect(ageText(5 * 60_000)).toBe('5 minut temu');
    expect(ageText(2 * HOUR)).toBe('2 godziny temu');
    expect(ageText(26 * HOUR)).toBe('wczoraj');
    expect(ageText(5 * 24 * HOUR)).toBe('5 dni temu');
  });

  test('długie szukanie dostaje stoper, przerwa serwera odliczanie — oba poza regionem status', () => {
    expect(aroundNotes(base, 'lokale', NOW + 5000)).toEqual({ status: '', clock: null });
    expect(aroundNotes(base, 'lokale', NOW + 15_000).clock).toBe('Serwer map odpowiada wolno — czekam (15 s)…');
    expect(aroundNotes({ ...base, retryAt: NOW + 6000 }, 'lokale', NOW).clock).toBe('Serwer map jest zajęty — ponawiam za 6 s…');
  });

  test('podczas szukania stara odpowiedź jest nazwana dopiero, gdy ma ponad dobę', () => {
    expect(aroundNotes({ ...base, savedAt: NOW - 2 * HOUR }, 'lokale', NOW).status).toBe('');
    expect(aroundNotes({ ...base, savedAt: NOW - 30 * HOUR }, 'lokale', NOW).status).toBe('Na razie pokazuję lokale zapisane wczoraj.');
  });

  test('po błędzie: co widać i kiedy następna próba; bez zapisanych nic nie udaje, że jest', () => {
    const failed = { ...base, status: 'error' as const, since: null, savedAt: NOW - 10 * 60_000, retryAt: NOW + 30_000 };
    expect(aroundNotes(failed, 'sklepy', NOW)).toEqual({
      status: 'Pokazuję sklepy zapisane 10 minut temu.',
      clock: 'Ponowię sam za 30 s.',
    });
    expect(aroundNotes({ ...failed, items: [], savedAt: null, retryAt: null }, 'sklepy', NOW)).toEqual({ status: '', clock: null });
  });
});
