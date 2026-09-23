import { describe, expect, it } from 'vitest';
import {
  CHEERS,
  EMPTY_SHELF,
  LATE,
  LOADING,
  REST,
  SAVED,
  daySeed,
  massJoke,
  pick,
  plural,
  repsJoke,
  timeJoke,
} from './quips';

/**
 * Wzorce dokuczania. Sprawdzamy zwroty, nie pojedyncze słowa: „bez wstydu” jest zdaniem
 * pocieszającym, a wyłapanie go przez samo słowo „wstyd” kasowałoby dobre teksty.
 */
const SHAMING = /wstydź się|nie ma czego|jesteś (słab|leni|gruby)|za słab|nieudacznik|żałosn|leniu|nie umiesz|do niczego/i;

describe('wybór tekstu', () => {
  it('to samo ziarno daje ten sam tekst', () => {
    expect(pick(CHEERS, 7)).toBe(pick(CHEERS, 7));
  });

  it('kolejne ziarna przechodzą przez całą listę', () => {
    const seen = new Set(CHEERS.map((_, i) => pick(CHEERS, i)));
    expect(seen.size).toBe(CHEERS.length);
  });

  it('radzi sobie z ziarnem ujemnym i ułamkowym', () => {
    expect(CHEERS).toContain(pick(CHEERS, -3));
    expect(CHEERS).toContain(pick(CHEERS, 2.7));
  });

  it('pusta lista to błąd, a nie cicha pustka na ekranie', () => {
    expect(() => pick([], 1)).toThrow();
  });

  it('ziarno dobowe zmienia się raz na dobę', () => {
    const t = Date.parse('2026-09-23T10:00:00Z');
    expect(daySeed(t)).toBe(daySeed(t + 3_600_000));
    expect(daySeed(t)).not.toBe(daySeed(t + 86_400_000));
  });
});

describe('odmiana po liczebniku', () => {
  const f = ['słoń', 'słonie', 'słoni'] as const;

  it('trzyma polskie reguły, łącznie z nastkami', () => {
    expect(plural(1, f)).toBe('słoń');
    expect(plural(2, f)).toBe('słonie');
    expect(plural(4, f)).toBe('słonie');
    expect(plural(5, f)).toBe('słoni');
    expect(plural(12, f)).toBe('słoni');
    expect(plural(13, f)).toBe('słoni');
    expect(plural(22, f)).toBe('słonie');
    expect(plural(25, f)).toBe('słoni');
    expect(plural(112, f)).toBe('słoni');
    expect(plural(122, f)).toBe('słonie');
  });
});

describe('porównania masy', () => {
  it('milczy przy wartościach, z których nie ma żartu', () => {
    expect(massJoke(0)).toBeNull();
    expect(massJoke(5)).toBeNull();
    expect(massJoke(NaN)).toBeNull();
  });

  it('dobiera jednostkę tak, żeby liczba była wyobrażalna', () => {
    // Przy każdej sensownej masie wynik mieści się w granicach, które da się sobie ułożyć w głowie.
    [25, 140, 600, 5_000, 198_000, 2_000_000, 50_000_000].forEach((kg) => {
      const n = parseInt(massJoke(kg)!.replace(/\s/g, ''), 10);
      expect({ kg, ok: n >= 1 && n < 500 }).toEqual({ kg, ok: true });
    });
  });

  it('woli kilka sztuk od ułamka jednej', () => {
    // „1,2 hipopotama” jest prawdziwe i martwe; liczba ma być widoczna od razu.
    const n = (s: string): number => parseInt(s.replace(/\s/g, ''), 10);
    [600, 1_800, 12_000, 198_000, 900_000].forEach((kg) => {
      const v = n(massJoke(kg)!);
      expect({ kg, ok: v >= 1 && v <= 40 }).toEqual({ kg, ok: true });
    });
  });

  it('odmienia rzeczownik razem z liczbą', () => {
    expect(massJoke(1_800)).toBe('3 maluchy');
    expect(massJoke(3_000)).toBe('4 żubry');
    expect(massJoke(200_000)).toBe('4 czołgi');
  });
});

describe('porównania czasu i powtórzeń', () => {
  it('powtórzenia zamieniają się w czas liczony po sekundzie', () => {
    expect(repsJoke(10)).toBeNull();
    expect(repsJoke(120)).toContain('2 minuty');
    // Po „zajęłoby to” idzie biernik: godzinę, nie godzina.
    expect(repsJoke(3_600)).toBe('po jednym na sekundę zajęłoby to 1 godzinę');
    expect(repsJoke(6_300)).toBe('po jednym na sekundę zajęłoby to 1 godzinę i 45 minut');
    expect(repsJoke(7_500)).toContain('2 godziny');
    expect(repsJoke(12_483)).toMatch(/godzin/);
  });

  it('czas pod obciążeniem dostaje odpowiednik z życia', () => {
    expect(timeJoke(30)).toBeNull();
    expect(timeJoke(10_080)).toBe('4 odcinki serialu');
    expect(timeJoke(1_200)).toBe('4 jajka na miękko');
  });
});

describe('zestawy tekstów', () => {
  it('każdy zestaw ma z czego losować i nie powtarza się w środku', () => {
    [CHEERS, SAVED, REST, LATE, EMPTY_SHELF, LOADING].forEach((list) => {
      expect(list.length).toBeGreaterThanOrEqual(3);
      expect(new Set(list).size).toBe(list.length);
      list.forEach((t) => expect(t.length).toBeGreaterThan(12));
    });
  });

  it('teksty o spóźnieniu nie robią użytkownikowi wyrzutów', () => {
    const harsh = /wstyd|leń|słab|wymówk|żałos|porażk/i;
    [...LATE, ...REST, ...SAVED, ...CHEERS].forEach((t) => expect(t).not.toMatch(harsh));
  });
});

describe('dopiski ćwiczeń i treningów', () => {
  it('każde ćwiczenie ma dopisek i nie powiela wskazówki technicznej', async () => {
    const { EX_JOKES, WORKOUT_JOKES, OWN_WORKOUT_JOKES } = await import('../data/exjokes');
    const { EX, ALL, BUILTIN } = await import('../data/exercises');
    ALL.forEach((id) => {
      const j = EX_JOKES[id];
      expect({ id, ok: !!j && j.length > 20 }).toEqual({ id, ok: true });
      expect(j).not.toBe(EX[id]!.hint);
    });
    BUILTIN.forEach((w) => expect(WORKOUT_JOKES[w.id]?.length ?? 0).toBeGreaterThan(20));
    expect(OWN_WORKOUT_JOKES.length).toBeGreaterThanOrEqual(3);
  });

  it('dopiski nie dokuczają i nie powtarzają się', async () => {
    const { EX_JOKES } = await import('../data/exjokes');
    const all = Object.values(EX_JOKES) as string[];
    expect(new Set(all).size).toBe(all.length);
    all.forEach((t) => expect(t).not.toMatch(SHAMING));
  });
});

describe('wsparcie i dorobek', () => {
  it('wiersze o wsparciu mówią o bezpłatności i nie naciskają', async () => {
    const { SUPPORT, PROGRESS_TITLES } = await import('./quips');
    expect(SUPPORT.length).toBeGreaterThanOrEqual(4);
    expect(PROGRESS_TITLES.length).toBeGreaterThanOrEqual(3);
    SUPPORT.forEach((t) => expect(t).not.toMatch(/musisz|koniecznie|natychmiast|ostatnia szansa/i));
  });

  it('karta dorobku zbiera liczby i puentę', async () => {
    const { progressSubject, shareText } = await import('./share');
    const subj = progressSubject(
      { workouts: 48, reps: 6288, sets: 480, tonnage: 99_100, secs: 7680 },
      'Stały klient',
      3,
    );
    expect(subj.kind).toBe('progress');
    expect(subj.title).toBe('Stały klient');
    expect(subj.lines.join(' ')).toContain('48');
    expect(subj.punch!.length).toBeGreaterThan(5);
    expect(shareText(subj)).toContain('Stały klient');
  });

  it('dorobek bez historii nie wywraca się na zerach', async () => {
    const { progressSubject } = await import('./share');
    const subj = progressSubject({ workouts: 0, reps: 0, sets: 0, tonnage: 0, secs: 0 }, 'Gość z ulicy', 0);
    expect(subj.title).toBe('Gość z ulicy');
    expect(subj.punch).toBeTruthy();
  });
});
