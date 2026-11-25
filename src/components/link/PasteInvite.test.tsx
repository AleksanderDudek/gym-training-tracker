import { describe, expect, it } from 'vitest';
import { invitePathFrom } from './PasteInvite';

describe('wklejony link zaproszenia', () => {
  const i = '0b6f7c1e-3a2d-4f5e-9a8b-1c2d3e4f5a6b';
  const f = 'AbCdEfGhIjKlMnOpQrStUv';
  it('pełny link, sam hash albo samo zapytanie — ta sama trasa w aplikacji', () => {
    const want = `#/wspolpraca/zaproszenie?i=${i}&f=${f}`;
    expect(invitePathFrom(`https://aleksanderdudek.github.io/gym-training-tracker/#/wspolpraca/zaproszenie?i=${i}&f=${f}`)).toBe(want);
    expect(invitePathFrom(`  #/wspolpraca/zaproszenie?i=${i.toUpperCase()}&f=${f}\n`)).toBe(want);
    expect(invitePathFrom(`i=${i}&f=${f}`)).toBe(want);
  });
  it('ucięty albo cudzy link — nic', () => {
    expect(invitePathFrom(`https://example.com/?i=${i}`)).toBeNull();
    expect(invitePathFrom('cześć')).toBeNull();
  });
});
