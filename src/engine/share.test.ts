import { describe, expect, it } from 'vitest';
import { APP_URL, SUPPORT_URL, shareLinks, shareText } from './share';
import { STEPS } from '../components/Intro';

const badge = { title: 'Gęsty tydzień', band: 'platyna', lines: ['próg 4 z 6', '5 treningów'] };
const session = { title: 'Trening A zaliczony', lines: ['8 ćwiczeń w tej sesji'] };

describe('treść wpisu', () => {
  it('kończy się adresem aplikacji w osobnej linii', () => {
    const lines = shareText(badge).split('\n');
    expect(lines[lines.length - 1]).toBe(APP_URL);
    // Serwisy robią podgląd z ostatniego adresu we wpisie, a wtrącony w zdanie bywa ucinany.
    expect(lines[lines.length - 1]).not.toMatch(/\s/);
  });

  it('łączy tytuł z tworzywem odznaki', () => {
    expect(shareText(badge).split('\n')[0]).toBe('Gęsty tydzień — platyna');
  });

  it('bez tworzywa zostaje sam tytuł', () => {
    expect(shareText(session).split('\n')[0]).toBe('Trening A zaliczony');
  });

  it('niesie wszystkie podane liczby', () => {
    const t = shareText(badge);
    badge.lines.forEach((l) => expect(t).toContain(l));
  });

  it('nie zostawia podwójnych pustych linii', () => {
    expect(shareText({ title: 'X', lines: [] })).not.toContain('\n\n\n');
  });

  it('wspomina nazwę aplikacji, żeby wpis miał sens bez podglądu', () => {
    expect(shareText(session)).toContain('GYM TRACKER');
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
