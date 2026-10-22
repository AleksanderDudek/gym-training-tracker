import { describe, expect, test } from 'vitest';
import { openState } from './hours';

// October 2026, local time. The 22nd is a Thursday.
const MON = 19;
const TUE = 20;
const WED = 21;
const THU = 22;
const FRI = 23;
const SAT = 24;
const SUN = 25;
const NEXT_MON = 26;
const at = (date: number, h: number, m = 0) => new Date(2026, 9, date, h, m);

const openUntil = (closesAt: string | null) => ({ open: true, closesAt, opensAt: null });
const closedUntil = (day: number, time: string) => ({ open: false, closesAt: null, opensAt: { day, time } });
const closedForGood = { open: false, closesAt: null, opensAt: null };

describe('24/7', () => {
  test('always open, never closes within a day', () => {
    expect(openState('24/7', at(THU, 14, 30))).toEqual(openUntil(null));
    expect(openState('24/7', at(SUN, 4))).toEqual(openUntil(null));
  });

  test('a later rule still overrides it', () => {
    expect(openState('24/7; Su off', at(SUN, 12))).toEqual(closedUntil(1, '00:00'));
    expect(openState('24/7; Su off', at(SAT, 12))).toEqual(openUntil('24:00'));
  });
});

describe('one rule', () => {
  const spec = 'Mo-Fr 08:00-20:00';

  test('open inside the range, with its closing time', () => {
    expect(openState(spec, at(THU, 14, 30))).toEqual(openUntil('20:00'));
    expect(openState(spec, at(THU, 8))).toEqual(openUntil('20:00'));
  });

  test('the end is exclusive', () => {
    expect(openState(spec, at(THU, 19, 59))).toEqual(openUntil('20:00'));
    expect(openState(spec, at(THU, 20))).toEqual(closedUntil(5, '08:00'));
  });

  test('closed before opening: opens the same day', () => {
    expect(openState(spec, at(THU, 7, 59))).toEqual(closedUntil(4, '08:00'));
  });

  test('closed over the weekend: opens on Monday', () => {
    expect(openState(spec, at(FRI, 21))).toEqual(closedUntil(1, '08:00'));
    expect(openState(spec, at(SAT, 10))).toEqual(closedUntil(1, '08:00'));
    expect(openState(spec, at(SUN, 23, 59))).toEqual(closedUntil(1, '08:00'));
  });

  test('no weekday selector means every day', () => {
    expect(openState('10:00-22:00', at(SUN, 12))).toEqual(openUntil('22:00'));
    expect(openState('10:00-22:00', at(SAT, 23))).toEqual(closedUntil(0, '10:00'));
  });

  test('single-digit hours', () => {
    expect(openState('Mo-Su 8:00-20:00', at(THU, 8, 15))).toEqual(openUntil('20:00'));
    expect(openState('Mo-Su 8:00-9:30', at(THU, 9, 40))).toEqual(closedUntil(5, '08:00'));
  });

  test('spaces around dashes, commas and semicolons do not matter', () => {
    expect(openState('Mo - Fr 08:00 - 20:00 ;  Sa 09:00-14:00', at(SAT, 10))).toEqual(openUntil('14:00'));
    expect(openState('  Mo-Fr 08:00-20:00  ', at(THU, 14, 30))).toEqual(openUntil('20:00'));
  });

  test('a trailing semicolon is ignored', () => {
    expect(openState('Mo-Fr 08:00-20:00;', at(THU, 14, 30))).toEqual(openUntil('20:00'));
  });
});

describe('weekday selectors', () => {
  test('a single day', () => {
    expect(openState('Th 10:00-18:00', at(THU, 14, 30))).toEqual(openUntil('18:00'));
    expect(openState('Th 10:00-18:00', at(FRI, 14, 30))).toEqual(closedUntil(4, '10:00'));
  });

  test('a list of days', () => {
    const spec = 'Mo,We,Fr 09:00-17:00';
    expect(openState(spec, at(WED, 10))).toEqual(openUntil('17:00'));
    expect(openState(spec, at(THU, 10))).toEqual(closedUntil(5, '09:00'));
    expect(openState(spec, at(MON, 10))).toEqual(openUntil('17:00'));
    expect(openState(spec, at(TUE, 10))).toEqual(closedUntil(3, '09:00'));
  });

  test('ranges and days mixed', () => {
    const spec = 'Mo-We,Fr 09:00-17:00';
    expect(openState(spec, at(THU, 10))).toEqual(closedUntil(5, '09:00'));
    expect(openState(spec, at(FRI, 10))).toEqual(openUntil('17:00'));
    expect(openState(spec, at(TUE, 10))).toEqual(openUntil('17:00'));
  });

  test('a range wrapping through the weekend', () => {
    const spec = 'Fr-Mo 12:00-22:00';
    expect(openState(spec, at(FRI, 13))).toEqual(openUntil('22:00'));
    expect(openState(spec, at(SUN, 13))).toEqual(openUntil('22:00'));
    expect(openState(spec, at(NEXT_MON, 13))).toEqual(openUntil('22:00'));
    expect(openState(spec, at(TUE, 13))).toEqual(closedUntil(5, '12:00'));
    expect(openState(spec, at(THU, 14, 30))).toEqual(closedUntil(5, '12:00'));
  });

  test('a range from Sunday to Monday', () => {
    const spec = 'Su-Mo 10:00-14:00';
    expect(openState(spec, at(SUN, 11))).toEqual(openUntil('14:00'));
    expect(openState(spec, at(SUN, 15))).toEqual(closedUntil(1, '10:00'));
    expect(openState(spec, at(NEXT_MON, 15))).toEqual(closedUntil(0, '10:00'));
  });
});

describe('time ranges', () => {
  test('several ranges a day: the lunch break', () => {
    const spec = 'Mo-Fr 08:00-12:00,13:00-18:00';
    expect(openState(spec, at(THU, 10))).toEqual(openUntil('12:00'));
    expect(openState(spec, at(THU, 12, 30))).toEqual(closedUntil(4, '13:00'));
    expect(openState(spec, at(THU, 14, 30))).toEqual(openUntil('18:00'));
  });

  test('a range past midnight covers the early hours of the next day', () => {
    const spec = 'Fr 18:00-02:00';
    expect(openState(spec, at(FRI, 17))).toEqual(closedUntil(5, '18:00'));
    expect(openState(spec, at(FRI, 23))).toEqual(openUntil('02:00'));
    expect(openState(spec, at(SAT, 1))).toEqual(openUntil('02:00'));
    expect(openState(spec, at(SAT, 2))).toEqual(closedUntil(5, '18:00'));
    expect(openState(spec, at(THU, 1))).toEqual(closedUntil(5, '18:00'));
  });

  test('every night past midnight', () => {
    const spec = 'Mo-Su 18:00-06:00';
    expect(openState(spec, at(THU, 20))).toEqual(openUntil('06:00'));
    expect(openState(spec, at(THU, 3))).toEqual(openUntil('06:00'));
    expect(openState(spec, at(THU, 12))).toEqual(closedUntil(4, '18:00'));
  });

  test('a range ending at 24:00 closes at midnight', () => {
    expect(openState('Mo-Su 22:00-24:00', at(THU, 23))).toEqual(openUntil('24:00'));
    expect(openState('Mo-Su 22:00-24:00', at(THU, 0, 30))).toEqual(closedUntil(4, '22:00'));
  });

  test('back-to-back ranges across midnight merge', () => {
    const spec = 'Fr 22:00-24:00; Sa 00:00-03:00';
    expect(openState(spec, at(FRI, 23))).toEqual(openUntil('03:00'));
    expect(openState(spec, at(SAT, 2))).toEqual(openUntil('03:00'));
  });

  test('extended hours mean the same as past midnight', () => {
    expect(openState('Fr 22:00-26:00', at(SAT, 1))).toEqual(openUntil('02:00'));
    expect(openState('Fr 22:00-26:00', at(FRI, 23))).toEqual(openUntil('02:00'));
  });

  test('an open end is taken as open until midnight', () => {
    expect(openState('Fr 18:00+', at(FRI, 20))).toEqual(openUntil('24:00'));
    expect(openState('Fr 18:00+', at(SAT, 0, 30))).toEqual(closedUntil(5, '18:00'));
    expect(openState('Mo-Fr 08:00-12:00,18:00+', at(THU, 19))).toEqual(openUntil('24:00'));
  });

  test('an equal start and end is a full day', () => {
    expect(openState('Mo-Su 00:00-00:00', at(THU, 14, 30))).toEqual(openUntil(null));
  });
});

describe('off and closed', () => {
  test('a later off closes the day', () => {
    const spec = 'Mo-Fr 08:00-20:00; We off';
    expect(openState(spec, at(WED, 10))).toEqual(closedUntil(4, '08:00'));
    expect(openState(spec, at(THU, 10))).toEqual(openUntil('20:00'));
  });

  test('closed means the same', () => {
    const spec = 'Mo-Su 10:00-22:00; Su closed';
    expect(openState(spec, at(SUN, 12))).toEqual(closedUntil(1, '10:00'));
    expect(openState(spec, at(SAT, 12))).toEqual(openUntil('22:00'));
  });

  test('in any letter case', () => {
    expect(openState('Mo-Su 10:00-22:00; Su Closed', at(SUN, 12))).toEqual(closedUntil(1, '10:00'));
    expect(openState('Mo-Su 10:00-22:00; Su OFF', at(SUN, 12))).toEqual(closedUntil(1, '10:00'));
  });

  test('off alone: closed for good', () => {
    expect(openState('off', at(THU, 14, 30))).toEqual(closedForGood);
    expect(openState('closed', at(THU, 14, 30))).toEqual(closedForGood);
  });

  test('days no rule names are closed', () => {
    expect(openState('Tu-Su 12:00-21:00', at(NEXT_MON, 13))).toEqual(closedUntil(2, '12:00'));
  });
});

describe('rule order', () => {
  test('a later rule replaces the hours of the days it names', () => {
    const spec = 'Mo-Su 10:00-22:00; Fr 10:00-24:00';
    expect(openState(spec, at(FRI, 23))).toEqual(openUntil('24:00'));
    expect(openState(spec, at(THU, 23))).toEqual(closedUntil(5, '10:00'));
  });

  test('the other way round, the general rule wins', () => {
    expect(openState('Fr 10:00-24:00; Mo-Su 10:00-22:00', at(FRI, 23))).toEqual(closedUntil(6, '10:00'));
  });

  test('replacing shortens the day', () => {
    const spec = 'Mo-Fr 08:00-20:00; We 10:00-14:00';
    expect(openState(spec, at(WED, 9))).toEqual(closedUntil(3, '10:00'));
    expect(openState(spec, at(WED, 15))).toEqual(closedUntil(4, '08:00'));
  });

  test('a typical restaurant week', () => {
    const spec = 'Mo-Th 11:00-22:00; Fr-Sa 11:00-02:00; Su 12:00-22:00';
    expect(openState(spec, at(THU, 14, 30))).toEqual(openUntil('22:00'));
    expect(openState(spec, at(THU, 23))).toEqual(closedUntil(5, '11:00'));
    expect(openState(spec, at(FRI, 23))).toEqual(openUntil('02:00'));
    expect(openState(spec, at(NEXT_MON, 1))).toEqual(closedUntil(1, '11:00'));
  });

  test('a night past midnight stays with the day it started on, whatever the next day says', () => {
    const spec = 'Mo-Th 11:00-22:00; Fr-Sa 11:00-02:00; Su 12:00-22:00';
    expect(openState(spec, at(SUN, 1))).toEqual(openUntil('02:00'));
    expect(openState(spec, at(SUN, 2))).toEqual(closedUntil(0, '12:00'));
    expect(openState('Fr 18:00-02:00; Sa off', at(SAT, 1))).toEqual(openUntil('02:00'));
    expect(openState('Fr 18:00-02:00; Sa off', at(SAT, 12))).toEqual(closedUntil(5, '18:00'));
  });
});

describe('comma between rules', () => {
  test('rules for different days', () => {
    const spec = 'Mo-Fr 08:00-20:00, Sa 09:00-14:00';
    expect(openState(spec, at(THU, 14, 30))).toEqual(openUntil('20:00'));
    expect(openState(spec, at(SAT, 10))).toEqual(openUntil('14:00'));
    expect(openState(spec, at(SUN, 10))).toEqual(closedUntil(1, '08:00'));
  });

  test('without a space', () => {
    expect(openState('Mo-Fr 08:00-20:00,Sa 09:00-14:00', at(SAT, 10))).toEqual(openUntil('14:00'));
  });

  test('a day list after the comma', () => {
    const spec = 'Mo-Fr 08:00-20:00, Sa,Su 10:00-14:00';
    expect(openState(spec, at(SUN, 11))).toEqual(openUntil('14:00'));
    expect(openState(spec, at(THU, 14, 30))).toEqual(openUntil('20:00'));
  });

  test('after off', () => {
    expect(openState('Mo-Fr off, Sa 10:00-14:00', at(SAT, 11))).toEqual(openUntil('14:00'));
    expect(openState('Mo-Fr off, Sa 10:00-14:00', at(THU, 11))).toEqual(closedUntil(6, '10:00'));
  });

  test('adds hours to a day an earlier rule named (the spec’s “additional rule”)', () => {
    const spec = 'Mo-Sa 09:00-12:00, We 15:00-18:00';
    expect(openState(spec, at(WED, 10))).toEqual(openUntil('12:00'));
    expect(openState(spec, at(WED, 13))).toEqual(closedUntil(3, '15:00'));
    expect(openState(spec, at(WED, 16))).toEqual(openUntil('18:00'));
    expect(openState(spec, at(THU, 16))).toEqual(closedUntil(5, '09:00'));
  });

  test('off after a comma still closes the day', () => {
    expect(openState('Mo-Fr 08:00-20:00, We off', at(WED, 10))).toEqual(closedUntil(4, '08:00'));
  });
});

describe('public holidays', () => {
  test('a PH rule is ignored', () => {
    expect(openState('Mo-Fr 08:00-20:00; PH off', at(THU, 14, 30))).toEqual(openUntil('20:00'));
    expect(openState('Mo-Fr 08:00-20:00; PH 10:00-14:00', at(THU, 15))).toEqual(openUntil('20:00'));
    expect(openState('Mo-Fr 08:00-20:00; PH 10:00-14:00', at(SAT, 11))).toEqual(closedUntil(1, '08:00'));
    expect(openState('Mo-Fr 08:00-20:00, PH off', at(THU, 14, 30))).toEqual(openUntil('20:00'));
    expect(openState('PH off; Mo-Fr 08:00-20:00', at(THU, 14, 30))).toEqual(openUntil('20:00'));
  });

  test('PH next to weekdays: the weekdays still count', () => {
    expect(openState('Mo-Su 10:00-20:00; Su,PH off', at(SUN, 12))).toEqual(closedUntil(1, '10:00'));
    expect(openState('Mo-Su 10:00-20:00; Su,PH off', at(THU, 12))).toEqual(openUntil('20:00'));
    expect(openState('Mo-Fr,PH 08:00-20:00', at(THU, 9))).toEqual(openUntil('20:00'));
    expect(openState('Mo-Fr,PH 08:00-20:00', at(SAT, 9))).toEqual(closedUntil(1, '08:00'));
    expect(openState('PH,Sa 09:00-13:00', at(SAT, 9))).toEqual(openUntil('13:00'));
  });

  test('only PH rules say nothing about an ordinary day', () => {
    expect(openState('PH off', at(THU, 14, 30))).toBeNull();
    expect(openState('PH 10:00-14:00', at(THU, 11))).toBeNull();
  });
});

describe('closesAt', () => {
  test('null when the place stays open 24 h or more', () => {
    expect(openState('Mo-Su 00:00-24:00', at(THU, 14, 30))).toEqual(openUntil(null));
    expect(openState('Mo-Sa 00:00-24:00', at(THU, 14, 30))).toEqual(openUntil(null));
  });

  test('a time when the merged span ends within a day', () => {
    expect(openState('Mo-Sa 00:00-24:00', at(SAT, 14, 30))).toEqual(openUntil('24:00'));
    expect(openState('Mo-Sa 00:00-24:00', at(SUN, 14, 30))).toEqual(closedUntil(1, '00:00'));
  });

  test('exactly 24 h ahead is not "within a day"', () => {
    const spec = 'Th 14:30-24:00; Fr 00:00-14:30';
    expect(openState(spec, at(THU, 14, 30))).toEqual(openUntil(null));
    expect(openState(spec, at(THU, 14, 31))).toEqual(openUntil('14:30'));
  });

  test('midnight closing on a Sunday night', () => {
    expect(openState('Su 20:00-24:00', at(SUN, 21))).toEqual(openUntil('24:00'));
  });
});

describe('opensAt', () => {
  test('a week ahead is still found', () => {
    const spec = 'Th 14:30-15:00';
    expect(openState(spec, at(THU, 14, 30))).toEqual(openUntil('15:00'));
    expect(openState(spec, at(THU, 15))).toEqual(closedUntil(4, '14:30'));
    expect(openState('Mo 08:00-10:00', at(MON, 10))).toEqual(closedUntil(1, '08:00'));
  });

  test('null when nothing is ever open', () => {
    expect(openState('Mo-Su off', at(THU, 14, 30))).toEqual(closedForGood);
    expect(openState('Mo-Fr 08:00-20:00; Mo-Su off', at(THU, 14, 30))).toEqual(closedForGood);
  });

  test('Sunday night into Monday', () => {
    const spec = 'Su 20:00-01:00';
    expect(openState(spec, at(SUN, 21))).toEqual(openUntil('01:00'));
    expect(openState(spec, at(NEXT_MON, 0, 30))).toEqual(openUntil('01:00'));
    expect(openState(spec, at(NEXT_MON, 1))).toEqual(closedUntil(0, '20:00'));
  });

  test('Saturday night into Sunday, after a Sunday rule', () => {
    expect(openState('Sa 20:00-24:00; Su 00:00-02:00', at(SAT, 23))).toEqual(openUntil('02:00'));
    expect(openState('Mo-Su 09:00-17:00', at(SUN, 18))).toEqual(closedUntil(1, '09:00'));
  });
});

describe('not understood: null', () => {
  test.each([
    'Mo-Fr 08:00-20:00; Dec 24 off',
    'Jan-Mar Mo-Fr 08:00-16:00',
    'week 1-26 Mo-Fr 08:00-12:00',
    '2026 Mo-Fr 08:00-20:00',
    'Mo-Fr sunrise-sunset',
    'Mo-Fr 08:00-sunset',
    'Mo-Fr 08:00-20:00 "call ahead"',
    '"by appointment"',
    'Mo-Fr 08:00-20:00; SH off',
    'Su[1] 10:00-12:00',
    'Mo-Fr 08:00-20:00 || "on appointment"',
    'easter off',
    'Mo-Fr 25:00-26:00',
    'Mo-Fr 24:00-26:00',
    'Mo-Fr 08:60-20:00',
    'Mo-Fr 08:00-49:00',
    'Mo-Fr 0800-2000',
    'Mo-Fr 8-20',
    'Mo-Fr 08.00-20.00',
    'Pn-Pt 08:00-20:00',
    'mo-fr 08:00-20:00',
    'Mo-Fr: 08:00-20:00',
    'Mo-Fr',
    'Mo-Fr 08:00-12:00 off',
    'Mo-Fr 08:00-20:00 open',
    'Mo-Fr 18:00-02:00+',
    'Mo-Fr 24/7',
    'Mo-Fr 08:00-20:00,',
    'Mo-Fr 08:00-20:00, Dec 24 off',
  ])('%s', (spec) => {
    expect(openState(spec, at(THU, 14, 30))).toBeNull();
  });

  test('no spec', () => {
    expect(openState(null, at(THU, 14, 30))).toBeNull();
    expect(openState(undefined, at(THU, 14, 30))).toBeNull();
    expect(openState('', at(THU, 14, 30))).toBeNull();
    expect(openState('   ', at(THU, 14, 30))).toBeNull();
    expect(openState(';', at(THU, 14, 30))).toBeNull();
  });
});
