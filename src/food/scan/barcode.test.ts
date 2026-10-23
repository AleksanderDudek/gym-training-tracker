import { describe, expect, test } from 'vitest';
import { checkDigit, codeVariants, digitsOf, expandUpcE, findByCode, isInStoreCode, isShopCode, isValidGtin } from './barcode';

describe('kody kreskowe', () => {
  test('cyfra kontrolna GS1 i poprawne kody 8, 12, 13 i 14 cyfr', () => {
    expect(checkDigit('590051232035')).toBe(9);
    expect(isValidGtin('5900512320359')).toBe(true); // Mleko Wypasione
    expect(isValidGtin('5900512320358')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true); // EAN-8 z przykładu GS1
    expect(isValidGtin('036000291452')).toBe(true); // UPC-A
    expect(isValidGtin('10012345678902')).toBe(true); // GTIN-14
    expect(isValidGtin('12345')).toBe(false);
    expect(isValidGtin('59005123203a9')).toBe(false);
  });

  test('UPC-E rozpisany do UPC-A; kod, który się nie zgadza, był EAN-8', () => {
    expect(expandUpcE('04252614')).toBe('042100005264');
    expect(expandUpcE('01234565')).toBe('012345000065');
    expect(expandUpcE('01234505')).toBe('012000003455');
    expect(expandUpcE('96385074')).toBeNull();
    expect(expandUpcE('04252615')).toBeNull();
    // UPC-E ma cyfrę kontrolną długiej postaci: zwykłe sprawdzenie by go odrzuciło.
    expect(isValidGtin('04252614')).toBe(false);
    expect(isShopCode('04252614')).toBe(true);
    expect(isShopCode('96385074')).toBe(true);
    expect(isShopCode('04252615')).toBe(false);
  });

  test('warianty: jak podany, UPC-A z zerem z przodu, GTIN-14 bez zera, krótkie dopełnione do 13', () => {
    expect(codeVariants('5900512320359')).toEqual(['5900512320359']);
    expect(codeVariants('036000291452')).toEqual(['036000291452', '0036000291452']);
    expect(codeVariants('05900512320359')).toEqual(['05900512320359', '5900512320359']);
    expect(codeVariants('04252614')).toEqual(['04252614', '0042100005264', '0000004252614']);
    expect(codeVariants('590 0512-320359')).toEqual(['5900512320359']);
    expect(codeVariants('abc')).toEqual([]);
    expect(digitsOf(' 59-00 ')).toBe('5900');
  });

  test('produkt znajduje się w kształcie, w jakim trzyma go baza', () => {
    const byCode = new Map([
      ['0036000291452', 'UPC-A z bazy'],
      ['5900512320359', 'mleko'],
    ]);
    expect(findByCode(byCode, '036000291452')).toBe('UPC-A z bazy');
    expect(findByCode(byCode, '5900512320359')).toBe('mleko');
    expect(findByCode(byCode, '4006381333931')).toBeNull();
  });

  test('kody sklepowe (towar na wagę) zaczynają się od 2', () => {
    expect(isInStoreCode('2000123012345')).toBe(true);
    expect(isInStoreCode('5900512320359')).toBe(false);
  });
});
