import { describe, expect, it } from 'vitest';
import { freshState } from '../engine/plan';
import { SUPPORT_SHORT } from '../engine/quips';
import { SNOOZE_DAYS, snoozeUntil, supportSnoozed } from './Support';

describe('pasek wsparcia', () => {
  it('× chowa pasek na tydzień, a potem wraca sam', () => {
    const s = freshState();
    expect(supportSnoozed(s, '2026-09-29')).toBe(false);
    s.supportSnooze = snoozeUntil('2026-09-29');
    expect(s.supportSnooze).toBe('2026-10-06');
    expect(SNOOZE_DAYS).toBe(7);
    expect(supportSnoozed(s, '2026-09-29')).toBe(true);
    expect(supportSnoozed(s, '2026-10-05')).toBe(true);
    expect(supportSnoozed(s, '2026-10-06')).toBe(false);
  });

  it('teksty paska mieszczą się w dwóch krótkich wierszach na telefonie', () => {
    // Obok twarzy i przycisku zostaje na telefonie ok. 25 znaków na wiersz, a pasek ma najwyżej dwa.
    expect(SUPPORT_SHORT.length).toBeGreaterThanOrEqual(5);
    expect(new Set(SUPPORT_SHORT).size).toBe(SUPPORT_SHORT.length);
    SUPPORT_SHORT.forEach((t) => expect(t.length, t).toBeLessThanOrEqual(46));
  });

  it('pasek mówi głosem Siwego i o kawie — jak duży baner', () => {
    SUPPORT_SHORT.forEach((t) => expect(t, t).toMatch(/siwy|goryl|srebrn|stad/i));
    SUPPORT_SHORT.forEach((t) => expect(t, t).toMatch(/kaw|espresso|czarn|filiżan/i));
  });

  it('pasek nie naciska i nie robi wyrzutów', () => {
    SUPPORT_SHORT.forEach((t) =>
      expect(t).not.toMatch(/musisz|koniecznie|natychmiast|ostatnia szansa|błagam|wstyd|pomóż nam przetrwać/i),
    );
  });
});
