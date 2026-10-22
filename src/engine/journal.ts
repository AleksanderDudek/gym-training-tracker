import type { PlanEvent } from '../types';
import type { Schedule } from './schedule';
import { POINTS } from './score';
import { countCleanWeeks } from './score';
import { text } from '../i18n';

const T = text({
  pl: {
    late: (n: number) => (n === 1 ? 'nadrobiony dzień po terminie' : `nadrobiony ${n} dni po terminie`),
    manual: ' · odhaczony ręcznie',
    onTime: 'w terminie',
    done: (name: string, how: string) => `${name} — ${how}`,
    slot: (week: number, manual: string) => `Termin: tydzień ${week}${manual}`,
    missedTitle: (name: string) => `${name} — termin opuszczony`,
    missedText: 'Trening nie przepadł: wchodzi na kolejny termin.',
    extraTitle: 'Trening poza planem',
    extraText: 'Nie domknął żadnego terminu, ale się liczy.',
    weekTitle: (week: number) => `Tydzień ${week} zamknięty w komplecie`,
    weekText: 'Żaden termin nie przepadł.',
  },
  en: {
    late: (n: number) => (n === 1 ? 'made up a day late' : `made up ${n} days late`),
    manual: ' · ticked off by hand',
    onTime: 'on time',
    done: (name: string, how: string) => `${name} — ${how}`,
    slot: (week: number, manual: string) => `Deadline: week ${week}${manual}`,
    missedTitle: (name: string) => `${name} — deadline missed`,
    missedText: 'The workout isn’t lost: it moves to the next deadline.',
    extraTitle: 'Off-plan workout',
    extraText: 'It didn’t close any deadline, but it still counts.',
    weekTitle: (week: number) => `Week ${week} completed in full`,
    weekText: 'Not a single deadline missed.',
  },
});

/**
 * Dziennik zdarzeń. Wpisy o terminach wyprowadzane są z kalendarza przy każdym otwarciu,
 * a nie dopisywane w chwili, gdy coś się dzieje — dzięki temu dzień, którego nikt nie
 * odnotował, bo aplikacja była zamknięta, i tak trafia do dziennika jako opuszczony.
 *
 * Trwale zapisane są wyłącznie zdarzenia nie do odtworzenia z kalendarza: start i koniec
 * planu, zmiana wariantu, zdobyte odznaki.
 */
export function journal(
  schedule: Schedule,
  stored: PlanEvent[],
  name: (id: string) => string,
): PlanEvent[] {
  const out: PlanEvent[] = [...stored];

  schedule.days.forEach((d) => {
    if (d.status === 'done') {
      const manual = d.source === 'tick' ? T.manual : '';
      out.push({
        id: `slot:${d.index}`,
        date: d.filled ?? d.date,
        kind: d.late === 0 ? 'done' : 'late',
        title: T.done(name(d.workout), d.late === 0 ? T.onTime : T.late(d.late)),
        text: T.slot(d.week, manual),
        points: d.late === 0 ? POINTS.onTime : (POINTS.late[Math.min(d.late, 3) - 1] ?? 25),
      });
      return;
    }
    if (d.status === 'missed') {
      out.push({
        id: `slot:${d.index}`,
        date: d.date,
        kind: 'missed',
        title: T.missedTitle(name(d.workout)),
        text: T.missedText,
        points: 0,
      });
    }
  });

  schedule.extras.forEach((day) => {
    out.push({
      id: `extra:${day}`,
      date: day,
      kind: 'extra',
      title: T.extraTitle,
      text: T.extraText,
      points: POINTS.extra,
    });
  });

  const clean = countCleanWeeks(schedule.days);
  if (clean > 0) {
    const weeks = [...new Set(schedule.days.map((d) => d.week))].filter((w) =>
      schedule.days.filter((d) => d.week === w).every((d) => d.status === 'done'),
    );
    weeks.forEach((w) => {
      const last = schedule.days.filter((d) => d.week === w).pop()!;
      out.push({
        id: `week:${w}`,
        date: last.filled ?? last.date,
        kind: 'week',
        title: T.weekTitle(w),
        text: T.weekText,
        points: POINTS.cleanWeek,
      });
    });
  }

  // Ten sam klucz nie wchodzi dwa razy, choćby trafił i z kalendarza, i z zapisu.
  const seen = new Set<string>();
  return out
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));
}
