import { describe, expect, test } from 'vitest';
import { brandPrefix, fold, inflected, isNoise, tokenize, typos } from './words';

const words = (s: string) => tokenize(s).words;

describe('fold', () => {
  test('folds case and diacritics, ł included, and drops ®™©', () => {
    expect(fold('Fēnix® 7X')).toBe('fenix 7x');
    expect(fold('vívoactive™ ©')).toBe('vivoactive ');
    expect(fold('Łódź ŻÓŁW')).toBe('lodz zolw');
  });
});

describe('tokenize', () => {
  test.each([
    ['Fēnix® 7X Pro (Gen 2) 47 mm', ['fenix', '7', 'x', 'pro', 'gen2', '47mm']],
    ['FR265', ['forerunner', '265']],
    ['forerunner265', ['forerunner', '265']],
    ['venu sq2', ['venu', 'sq', '2']],
    ['Venu Square 2', ['venu', 'sq', '2']],
    ['fr 245m', ['forerunner', '245', 'music']],
    ['forerunner255sm', ['forerunner', '255', 's', 'music']],
    ['forerunner 255 muzyka', ['forerunner', '255', 'music']],
    ['fēnix 7 szafir', ['fenix', '7', 'sapphire']],
    ['fēnix 7 szafirem', ['fenix', '7', 'sapphire']],
    ['mam feniksa 7', ['mam', 'fenix', '7']],
    ['z instynktem 2', ['z', 'instinct', '2']],
    ['ForeAthlete 245', ['forerunner', '245']],
    ['phoenix 6', ['fenix', '6']],
    ['va3 music', ['vivoactive', '3', 'music']],
    ['vivo active 4', ['vivoactive', '4']],
    ['fenix 7 pro bez wi-fi', ['fenix', '7', 'pro', 'bez', 'wifi']],
    ['epix gen 2', ['epix', 'gen2']],
    ['epix 2nd gen', ['epix', 'gen2']],
    ['epix druga generacja', ['epix', 'gen2']],
    ['instinct pierwszy', ['instinct', 'gen1']],
    ['Instinct® (1. generacja)', ['instinct', 'gen1']],
    ['Instinct® (1st gen)', ['instinct', 'gen1']],
    ['Edge® 1030 Plus', ['edge', '1030', 'plus']],
    ['Venu® 2+', ['venu', '2', 'plus']],
  ])('%s', (typed, expected) => {
    expect(words(typed)).toEqual(expected);
  });

  test('a region word sets the APAC flag instead of becoming a word', () => {
    expect(tokenize('instinct 2 apac')).toEqual({ words: ['instinct', '2'], apac: true });
    expect(tokenize('descent mk3 azjatycka')).toEqual({ words: ['descent', 'mk', '3'], apac: true });
    expect(tokenize('instinct 2').apac).toBe(false);
  });

  test('„nie wiem” and its kin set the help flag and leave the rest', () => {
    for (const q of ['nie wiem', 'Nie pamiętam', 'nie znam modelu', 'nie mam pojęcia', 'zapomniałem', "I don't know", 'no idea'])
      expect(tokenize(q).help, q).toBe(true);
    expect(tokenize('nie wiem, chyba fenix 7')).toEqual({ words: ['chyba', 'fenix', '7'], apac: false, help: true });
    expect(tokenize('fenix 7').help).toBeUndefined();
    // „nie” alone is not a phrase.
    expect(tokenize('nie fenix').help).toBeUndefined();
  });

  test('„m” and „sm” mean music only right after a number', () => {
    expect(words('fr 245 m')).toEqual(['forerunner', '245', 'music']);
    expect(words('venu m')).toEqual(['venu', 'm']);
    expect(words('sm 255')).toEqual(['sm', '255']);
  });
});

describe('noise and endings', () => {
  test('old/new, filler and prepositions are noise, with Polish endings too', () => {
    for (const w of ['garmin', 'garmina', 'zegarek', 'stary', 'stara', 'starego', 'nowy', 'jakis', 'chyba', 'to', 'jest', 'moj', 'model', 'modelu'])
      expect(isNoise(w), w).toBe(true);
    for (const w of ['star', 'fenix', 'mi', 'band', 's', 'pro']) expect(isNoise(w), w).toBe(false);
  });

  test('an ending counts only on a base of 4+ letters', () => {
    expect(inflected('forerunnera', 'forerunner')).toBe(true);
    expect(inflected('instinctem', 'instinct')).toBe(true);
    expect(inflected('vena', 'ven')).toBe(false);
    expect(inflected('fenixxx', 'fenix')).toBe(false);
  });

  test('a brand prefix is 2+ letters of „garmin”, not the whole word', () => {
    expect(['ga', 'gar', 'garmi'].every(brandPrefix)).toBe(true);
    expect(['g', 'garmin', 'gal', 'fo'].some(brandPrefix)).toBe(false);
  });
});

describe('typos (optimal string alignment)', () => {
  test.each([
    ['forerunner', 'forerunner', 0],
    ['forrunner', 'forerunner', 1],
    ['fenx', 'fenix', 1],
    ['fneix', 'fenix', 1],
    ['instnict', 'instinct', 1],
    ['vivoactvie', 'vivoactive', 1],
    ['phenix', 'fenix', 2],
    ['venu', 'vivo', 3],
  ])('%s → %s: %i', (a, b, d) => {
    expect(typos(a, b, 3)).toBe(d);
  });

  test('stops above the limit', () => {
    expect(typos('forerunner', 'fenix', 2)).toBe(3);
    expect(typos('abc', 'abcdefgh', 1)).toBe(2);
  });
});
