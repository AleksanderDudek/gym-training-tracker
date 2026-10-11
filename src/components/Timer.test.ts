import { describe, expect, it } from 'vitest';
import { formatClock } from './Timer';

describe('zegar stopera', () => {
  it('krótkie czasy zostają w sekundach', () => {
    expect(formatClock(0)).toBe('0 s');
    expect(formatClock(9)).toBe('9 s');
    expect(formatClock(59)).toBe('59 s');
  });

  it('od minuty przechodzi na zapis zegarowy', () => {
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(3599)).toBe('59:59');
  });

  it('od godziny dopisuje godziny przed minutami', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(4 * 3600 + 59)).toBe('4:00:59');
  });

  it('zaokrągla ułamki i nie schodzi poniżej zera', () => {
    expect(formatClock(29.6)).toBe('30 s');
    expect(formatClock(-5)).toBe('0 s');
  });
});
