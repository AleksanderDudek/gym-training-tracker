import { describe, expect, it } from 'vitest';
import { APP_URL, SUPPORT_URL, shareLinks, shareText } from './share';
import { STEPS } from '../components/Intro';

const badge = { title: 'Gęsty tydzień', band: 'platyna', lines: ['próg 4 z 6', '5 treningów'] };

const KINDS = ['badge', 'session', 'progress'] as const;

const sample = (kind: (typeof KINDS)[number], seed: number) => ({
  kind,
  seed,
  title: kind === 'progress' ? 'Stały klient' : kind === 'session' ? 'Trening A zaliczony' : 'Gęsty tydzień',
  ...(kind === 'badge' ? { band: 'platyna' } : {}),
  lines:
    kind === 'progress'
      ? ['48 treningów · 6288 powtórzeń', '480 serii · 99,1 t']
      : kind === 'session'
        ? ['8 ćwiczeń w tej sesji']
        : ['próg 4 z 6', 'Najwięcej treningów w dowolnych siedmiu dniach.'],
  punch: 'W sumie 2 czołgi.',
});

describe('treść wpisu', () => {
  it('kończy się adresem aplikacji w osobnej linii', () => {
    const lines = shareText(badge).split('\n');
    expect(lines[lines.length - 1]).toBe(APP_URL);
    // Serwisy robią podgląd z ostatniego adresu we wpisie, a wtrącony w zdanie bywa ucinany.
    expect(lines[lines.length - 1]).not.toMatch(/\s/);
  });

  it('brzmi jak zdanie, a nie jak wydruk z maszyny', () => {
    KINDS.forEach((kind) => {
      for (let seed = 0; seed < 8; seed++) {
        const body = shareText(sample(kind, seed)).split('\n')[0]!;
        // Zdanie: wielka litera albo liczba na starcie („48 treningów…” jest poprawne),
        // kropka gdzieś w środku i żadnych sierocych spacji.
        expect({ kind, seed, ok: /^[\p{Lu}0-9]/u.test(body) }).toEqual({ kind, seed, ok: true });
        expect({ kind, seed, dot: body.includes('.') }).toEqual({ kind, seed, dot: true });
        expect(body).not.toMatch(/ {2}|\s[.,]|\.\./);
      }
    });
  });

  it('niesie nazwę odznaki, stopnia albo treningu', () => {
    expect(shareText(sample('badge', 1))).toContain('Gęsty tydzień');
    expect(shareText(sample('progress', 1))).toMatch(/Stały klient|stały klient/);
    expect(shareText(sample('session', 1))).toContain('Trening A');
  });

  it('każdy wariant niesie porównanie i zaproszenie', () => {
    KINDS.forEach((kind) => {
      for (let seed = 0; seed < 8; seed++) {
        const t = shareText(sample(kind, seed));
        expect({ kind, seed, punch: t.includes('czołgi') }).toEqual({ kind, seed, punch: true });
        expect({ kind, seed, cta: t.includes(APP_URL) }).toEqual({ kind, seed, cta: true });
      }
    });
  });

  it('mieści się w jednym wpisie razem z adresem', () => {
    KINDS.forEach((kind) => {
      for (let seed = 0; seed < 8; seed++) {
        const t = shareText(sample(kind, seed));
        expect({ kind, seed, len: t.length < 420 }).toEqual({ kind, seed, len: true });
      }
    });
  });

  it('to samo ziarno daje ten sam wpis', () => {
    expect(shareText(sample('badge', 3))).toBe(shareText(sample('badge', 3)));
    expect(shareText(sample('badge', 3))).not.toBe(shareText(sample('badge', 4)));
  });

  it('nie zostawia podwójnych pustych linii', () => {
    expect(shareText({ title: 'X', lines: [] })).not.toContain('\n\n\n');
  });
});

describe('adresy zapasowe', () => {
  it('każdy serwis dostaje poprawnie zakodowany adres', () => {
    shareLinks(badge).forEach((l) => {
      expect(l.name.length).toBeGreaterThan(0);
      expect(() => new URL(l.url)).not.toThrow();
      expect(l.url.startsWith('https://')).toBe(true);
    });
  });

  it('przenosi treść wpisu tam, gdzie serwis ją przyjmuje', () => {
    const x = shareLinks(badge).find((l) => l.name === 'X')!;
    expect(decodeURIComponent(x.url)).toContain('Gęsty tydzień');
    expect(decodeURIComponent(x.url)).toContain(APP_URL);
  });
});

describe('wsparcie i wprowadzenie', () => {
  it('adres wsparcia jest tym, który podał autor', () => {
    expect(SUPPORT_URL).toBe('https://buycoffee.to/uriel');
  });

  it('wprowadzenie jest krótkie i każdy ekran ma treść', () => {
    expect(STEPS.length).toBeLessThanOrEqual(4);
    STEPS.forEach((s) => {
      expect(s.title.length).toBeGreaterThan(8);
      expect(s.body.length).toBeGreaterThan(40);
      expect(s.body.length).toBeLessThan(320);
    });
  });

  it('ostatni ekran mówi o bezpłatności i o wsparciu', () => {
    const last = STEPS[STEPS.length - 1]!;
    expect(last.title.toLowerCase()).toContain('bezpłatn');
    expect(last.body.toLowerCase()).toContain('kaw');
  });
});
