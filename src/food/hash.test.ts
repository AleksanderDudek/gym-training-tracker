import { describe, expect, it } from 'vitest';
import { hashPath, hashQuery, hashWith } from './hash';

describe('stan strony w części hash adresu', () => {
  it('ścieżka to hash bez zapytania', () => {
    expect(hashPath('#/produkty?q=a')).toBe('#/produkty');
    expect(hashPath('#/produkty')).toBe('#/produkty');
    expect(hashPath('#/produkty?')).toBe('#/produkty');
    expect(hashPath('')).toBe('');
  });

  it('zapytanie to wszystko po pierwszym „?”', () => {
    const params = hashQuery('#/produkty?q=a&ns=b');
    expect(params.get('q')).toBe('a');
    expect(params.get('ns')).toBe('b');
    expect([...params.keys()]).toEqual(['q', 'ns']);
    expect(hashQuery('#/produkty?q=sk%C3%B3ra+i%3Fx').get('q')).toBe('skóra i?x');
    expect(hashQuery('#/produkty').toString()).toBe('');
    expect(hashQuery('').toString()).toBe('');
  });

  it('składa ścieżkę z zapytaniem, a bez parametrów zostawia samą ścieżkę', () => {
    expect(hashWith('#/produkty', new URLSearchParams({ q: 'a' }))).toBe('#/produkty?q=a');
    expect(hashWith('#/produkty', new URLSearchParams())).toBe('#/produkty');
  });

  it('złożony adres czyta się z powrotem na to samo', () => {
    const params = new URLSearchParams({ q: 'skyr naturalny', ns: 'a', p: '590&1' });
    const hash = hashWith('#/produkty', params);
    expect(hashPath(hash)).toBe('#/produkty');
    expect(hashQuery(hash).toString()).toBe(params.toString());
  });
});
