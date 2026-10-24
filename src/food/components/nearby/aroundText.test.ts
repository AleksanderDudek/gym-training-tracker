import { describe, expect, test } from 'vitest';
import { ageText, aroundNotes } from './aroundText';

const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const base = { status: 'loading' as const, items: [{}], savedAt: null, since: NOW, retryAt: null, source: 'live' as const, shown: 'live' as const };

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

describe('przy granicy', () => {
  const border = { ...base, source: 'mixed' as const, coverage: 'partial' as const };

  test('na ekranie zapisana odpowiedź Overpass: jej wiek, a nie słowa o polskiej stronie, której nie widać', () => {
    const saved = { ...border, shown: 'live' as const, savedAt: NOW - 3 * DAY };
    expect(aroundNotes({ ...saved, status: 'error', since: null }, 'lokale', NOW).status).toBe('Pokazuję lokale zapisane 3 dni temu.');
    expect(aroundNotes(saved, 'lokale', NOW).status).toBe('Na razie pokazuję lokale zapisane 3 dni temu.');
  });

  test('na ekranie polska strona z danych aplikacji: o reszcie przy szukaniu i po błędzie, gotowa odpowiedź bez uwagi', () => {
    const polish = { ...border, shown: 'static' as const };
    expect(aroundNotes(polish, 'lokale', NOW).status).toBe('Przy granicy: lokale po polskiej stronie mam w aplikacji, o resztę pytam serwer map…');
    expect(aroundNotes({ ...polish, status: 'error', since: null }, 'sklepy', NOW).status).toBe(
      'Po drugiej stronie granicy nie udało się pobrać danych — pokazuję sklepy po polskiej stronie.',
    );
    expect(aroundNotes({ ...polish, status: 'ready', since: null }, 'lokale', NOW)).toEqual({ status: '', clock: null });
  });

  test('polska strona to dane aplikacji: ich stara data i część z poprzedniej aktualizacji jak z dala od granicy — póki to je widać', () => {
    // W południe UTC: ta sama data w każdej strefie czasowej.
    const old = { status: 'ready' as const, since: null, dataAsOf: '2026-07-01T12:00:00Z', olderLeaves: true };
    const notes = 'Część danych okolicy jest z poprzedniej aktualizacji. Dane okolicy są z 1 lipca 2026 — część miejsc mogła się zmienić.';
    expect(aroundNotes({ ...base, ...old, source: 'static', shown: 'static' }, 'lokale', NOW).status).toBe(notes);
    const polish = { ...border, ...old, shown: 'static' as const };
    expect(aroundNotes(polish, 'lokale', NOW).status).toBe(notes);
    expect(aroundNotes({ ...polish, dataAsOf: '2026-10-22T12:00:00Z' }, 'lokale', NOW).status).toBe('Część danych okolicy jest z poprzedniej aktualizacji.');
    expect(aroundNotes({ ...polish, olderLeaves: false }, 'lokale', NOW).status).toBe('Dane okolicy są z 1 lipca 2026 — część miejsc mogła się zmienić.');
    expect(aroundNotes({ ...polish, status: 'loading', since: NOW }, 'lokale', NOW).status).toBe(
      `Przy granicy: lokale po polskiej stronie mam w aplikacji, o resztę pytam serwer map… ${notes}`,
    );
    expect(aroundNotes({ ...polish, status: 'error' }, 'sklepy', NOW).status).toBe(
      `Po drugiej stronie granicy nie udało się pobrać danych — pokazuję sklepy po polskiej stronie. ${notes}`,
    );
    // Na ekranie cała odpowiedź Overpass: o danych aplikacji nic, ich na ekranie nie ma.
    expect(aroundNotes({ ...polish, shown: 'live' }, 'lokale', NOW).status).toBe('');
  });
});
