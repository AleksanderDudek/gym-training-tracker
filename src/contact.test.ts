import { describe, expect, it } from 'vitest';
import {
  DISCORD_URL,
  SUPPORT_URL_WORLD,
  contactLinks,
  isPoland,
  shortUrl,
  supportUrl,
  whereabouts,
} from './contact';
import { SUPPORT_URL } from './engine/share';

describe('kontakt z autorem', () => {
  it('Polska to polski wśród języków albo polska strefa czasowa', () => {
    expect(isPoland({ languages: ['pl-PL'], timeZone: 'Europe/Berlin' })).toBe(true);
    expect(isPoland({ languages: ['en-GB', 'pl'], timeZone: 'Europe/London' })).toBe(true);
    // Telefon po angielsku w Polsce.
    expect(isPoland({ languages: ['en-US'], timeZone: 'Europe/Warsaw' })).toBe(true);
    expect(isPoland({ languages: ['en-US', 'de-DE'], timeZone: 'America/New_York' })).toBe(false);
    // „plx” to nie polski, a brak danych to nie Polska.
    expect(isPoland({ languages: ['plx'], timeZone: undefined })).toBe(false);
    expect(isPoland({ languages: [], timeZone: undefined })).toBe(false);
  });

  it('miejsce czyta z przeglądarki bez wyjątków', () => {
    const w = whereabouts();
    expect(Array.isArray(w.languages)).toBe(true);
  });

  it('kawa: buycoffee.to w Polsce, buymeacoffee.com gdzie indziej', () => {
    expect(supportUrl(true)).toBe(SUPPORT_URL);
    expect(supportUrl(true)).toBe('https://buycoffee.to/uriel');
    expect(supportUrl(false)).toBe(SUPPORT_URL_WORLD);
    expect(supportUrl(false)).toBe('https://buymeacoffee.com/atd_uriel');
  });

  it('adres pod nazwą bez protokołu, www i końcowego ukośnika', () => {
    expect(shortUrl('https://www.instagram.com/autor/')).toBe('instagram.com/autor');
    expect(shortUrl(DISCORD_URL)).toBe('discord.gg/U6jCW6tvg');
  });

  it('w Polsce: Discord i polska kawa; gdzie indziej: bez Discorda, kawa międzynarodowa', () => {
    expect(contactLinks(true, null).map((l) => [l.id, l.href])).toEqual([
      ['discord', 'https://discord.gg/U6jCW6tvg'],
      ['support', 'https://buycoffee.to/uriel'],
    ]);
    expect(contactLinks(false, null).map((l) => [l.id, l.href])).toEqual([
      ['support', 'https://buymeacoffee.com/atd_uriel'],
    ]);
  });

  it('Instagram stoi pierwszy, gdy adres jest, i znika, gdy go nie ma', () => {
    const ig = 'https://www.instagram.com/autor/';
    expect(contactLinks(true, ig).map((l) => l.id)).toEqual(['instagram', 'discord', 'support']);
    expect(contactLinks(false, ig).map((l) => l.id)).toEqual(['instagram', 'support']);
    expect(contactLinks(false, null).some((l) => l.id === 'instagram')).toBe(false);
  });
});
