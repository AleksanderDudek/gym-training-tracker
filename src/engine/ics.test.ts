import { describe, expect, it } from 'vitest';
import { byDay, foldLine, googleTemplateUrl, icsCalendar, icsEscape, icsUtc, localStamp, PRODID } from './ics';

/**
 * Plik .ics musi przejść przez Apple Calendar, Outlook i import w Google — każdy z nich jest
 * wybredny w innym miejscu. Testy pilnują reguł RFC 5545, które łatwo zepsuć niechcący.
 */

const utf8 = new TextEncoder();
const octets = (s: string): number => utf8.encode(s).length;

/** Rozłożenie pliku na wiersze logiczne (RFC 5545, 3.1: ciąg dalszy zaczyna się spacją). */
const unfold = (ics: string): string[] => ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean);

describe('ucieczki tekstu', () => {
  it('przecinek, średnik, ukośnik wsteczny i nowa linia', () => {
    expect(icsEscape('a,b;c\\d\ne\r\nf')).toBe('a\\,b\\;c\\\\d\\ne\\nf');
  });

  it('ukośnik idzie pierwszy — inaczej ucieczki by się podwoiły', () => {
    expect(icsEscape('\\,')).toBe('\\\\\\,');
  });
});

describe('łamanie wierszy po 75 oktetach', () => {
  it('krótki wiersz zostaje jak był', () => {
    expect(foldLine('SUMMARY:Trening')).toBe('SUMMARY:Trening');
  });

  it('długi wiersz: każdy kawałek ≤ 75 oktetów, ciąg dalszy od spacji', () => {
    const line = `DESCRIPTION:${'x'.repeat(200)}`;
    const parts = foldLine(line).split('\r\n');
    expect(parts.length).toBeGreaterThan(2);
    parts.forEach((p, i) => {
      expect(octets(p)).toBeLessThanOrEqual(75);
      if (i) expect(p.startsWith(' ')).toBe(true);
    });
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });

  it('liczy bajty UTF-8 i nie rozcina polskiej litery ani emoji', () => {
    const line = `SUMMARY:${'ż'.repeat(60)}💪${'ą'.repeat(30)}`;
    const parts = foldLine(line).split('\r\n');
    parts.forEach((p) => {
      expect(octets(p)).toBeLessThanOrEqual(75);
      // Rozcięty znak dałby U+FFFD po zdekodowaniu bajtów kawałka.
      expect(new TextDecoder().decode(utf8.encode(p))).not.toContain('�');
    });
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });
});

describe('plik kalendarza', () => {
  const stamp = new Date('2026-11-03T10:15:00Z');
  const ics = icsCalendar(
    [
      {
        uid: 'trening-2026-11-05@gym-tracker',
        start: new Date('2026-11-05T17:00:00Z'),
        end: new Date('2026-11-05T18:00:00Z'),
        summary: 'Trening: Siła, góra; dół',
        description: 'Plan „Start”.\nDruga linia',
        alarmMin: 60,
      },
      {
        uid: 'badanie-2026-12-01@gym-tracker',
        start: new Date('2026-12-01T07:00:00Z'),
        end: new Date('2026-12-01T07:30:00Z'),
        summary: 'Badanie kontrolne',
        alarmMin: 13 * 60,
      },
    ],
    { stamp, name: 'GYM TRACKER' },
  );
  const lines = unfold(ics);

  it('CRLF na końcu każdego wiersza, także ostatniego, i żadnych gołych LF', () => {
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('nagłówek: wersja, PRODID, kalendarz gregoriański', () => {
    expect(lines.slice(0, 5)).toEqual(['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${PRODID}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']);
    expect(lines).toContain('X-WR-CALNAME:GYM TRACKER');
  });

  it('wydarzenie: stały UID, DTSTAMP i czasy w UTC, tekst z ucieczkami', () => {
    expect(lines).toContain('UID:trening-2026-11-05@gym-tracker');
    expect(lines).toContain('DTSTAMP:20261103T101500Z');
    expect(lines).toContain('DTSTART:20261105T170000Z');
    expect(lines).toContain('DTEND:20261105T180000Z');
    expect(lines).toContain('SUMMARY:Trening: Siła\\, góra\\; dół');
    expect(lines).toContain('DESCRIPTION:Plan „Start”.\\nDruga linia');
  });

  it('przypomnienie: VALARM z wyprzedzeniem w minutach albo pełnych godzinach', () => {
    const triggers = lines.filter((l) => l.startsWith('TRIGGER:'));
    expect(triggers).toEqual(['TRIGGER:-PT1H', 'TRIGGER:-PT13H']);
    expect(lines.filter((l) => l === 'BEGIN:VALARM')).toHaveLength(2);
    expect(lines.filter((l) => l === 'ACTION:DISPLAY')).toHaveLength(2);
  });

  it('bloki są domknięte w dobrej kolejności', () => {
    const stack: string[] = [];
    for (const l of lines) {
      if (l.startsWith('BEGIN:')) stack.push(l.slice(6));
      if (l.startsWith('END:')) expect(stack.pop()).toBe(l.slice(4));
    }
    expect(stack).toEqual([]);
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
  });

  it('każdy wiersz fizyczny ≤ 75 oktetów', () => {
    ics.split('\r\n').forEach((l) => expect(octets(l)).toBeLessThanOrEqual(75));
  });

  it('późniejszy zapis ma wyższy SEQUENCE — ponowny import to nowsza wersja, nie duplikat', () => {
    const later = icsCalendar([], { stamp: new Date('2026-11-10T10:15:00Z'), name: 'x' });
    const seq = (s: string) => Number(s.match(/SEQUENCE:(\d+)/)?.[1] ?? NaN);
    const one = icsCalendar(
      [{ uid: 'a', start: stamp, end: stamp, summary: 's' }],
      { stamp: new Date('2026-11-10T10:15:00Z'), name: 'x' },
    );
    expect(seq(one)).toBeGreaterThan(seq(ics));
    expect(later).not.toContain('VEVENT');
  });

  it('czas UTC zawsze z zerami wiodącymi', () => {
    expect(icsUtc(new Date('2027-01-02T03:04:05Z'))).toBe('20270102T030405Z');
  });
});

describe('formularz Kalendarza Google', () => {
  it('czas lokalny bez strefy, koniec przez północ', () => {
    expect(localStamp({ date: '2026-11-05', at: '18:00' })).toBe('20261105T180000');
    expect(localStamp({ date: '2026-12-31', at: '23:30' }, 60)).toBe('20270101T003000');
  });

  it('adres: akcja, tekst, daty, strefa, powtarzanie i opis', () => {
    const url = googleTemplateUrl({
      text: 'Trening — Start & siła',
      start: { date: '2026-11-05', at: '18:00' },
      minutes: 60,
      ctz: 'Europe/Warsaw',
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261203T225900Z',
      details: 'Linia 1\nLinia 2',
    });
    expect(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE&')).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get('action')).toBe('TEMPLATE');
    expect(q.get('text')).toBe('Trening — Start & siła');
    expect(q.get('dates')).toBe('20261105T180000/20261105T190000');
    expect(q.get('ctz')).toBe('Europe/Warsaw');
    expect(q.get('recur')).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261203T225900Z');
    expect(q.get('details')).toBe('Linia 1\nLinia 2');
    // Daty bez kodowania — tak jak w przykładach Google.
    expect(url).toContain('&dates=20261105T180000/20261105T190000&');
  });

  it('jednorazowe wydarzenie nie ma `recur`', () => {
    const url = googleTemplateUrl({ text: 'Badanie', start: { date: '2026-12-01', at: '08:00' }, minutes: 30, ctz: 'Europe/Warsaw' });
    expect(new URL(url).searchParams.has('recur')).toBe(false);
    expect(new URL(url).searchParams.get('dates')).toBe('20261201T080000/20261201T083000');
  });

  it('dni tygodnia RFC 5545 od poniedziałku, rosnąco i bez powtórzeń', () => {
    expect(byDay([5, 1, 3, 3])).toBe('MO,WE,FR');
    expect(byDay([7, 6])).toBe('SA,SU');
  });
});
