import type { AppState, Badge, BadgeId, PlanEvent } from '../types';
import type { PlanStats, Schedule } from './schedule';
import { countCleanWeeks } from './score';

/**
 * Odznaki opisują zachowanie, nie wynik siłowy. Wszystkie da się zdobyć przy dowolnym
 * ciężarze — bo jedyne, na co człowiek ma realny wpływ każdego dnia, to czy się pojawi.
 */
export const BADGES: Badge[] = [
  { id: 'pierwszy-krok', mark: '1', name: 'Pierwszy krok', desc: 'Pierwszy zapisany trening.' },
  { id: 'czysty-tydzien', mark: '7', name: 'Czysty tydzień', desc: 'Cały tydzień planu bez opuszczonego terminu.' },
  { id: 'seria-3', mark: '3', name: 'Seria 3', desc: 'Trzy terminy z rzędu zrobione co do dnia.' },
  { id: 'seria-10', mark: '10', name: 'Seria 10', desc: 'Dziesięć terminów z rzędu co do dnia.' },
  { id: 'seria-25', mark: '25', name: 'Seria 25', desc: 'Dwadzieścia pięć terminów z rzędu co do dnia.' },
  { id: 'nadrabiacz', mark: '↺', name: 'Nadrabiacz', desc: 'Zaległy termin domknięty w ciągu dwóch dni.' },
  { id: 'punktualny', mark: '✓', name: 'Punktualny', desc: '90% realizacji przy co najmniej dwunastu terminach.' },
  { id: 'powrot', mark: '⟲', name: 'Powrót', desc: 'Trening po co najmniej czternastu dniach przerwy.' },
  { id: 'polowa', mark: '½', name: 'Półmetek', desc: 'Połowa terminów planu zrobiona.' },
  { id: 'plan-zamkniety', mark: '★', name: 'Plan zamknięty', desc: 'Wszystkie terminy planu zrobione.' },
  { id: 'setka', mark: '100', name: 'Setka', desc: 'Sto zapisanych treningów.' },
  { id: 'ranny-ptaszek', mark: '☀', name: 'Ranny ptaszek', desc: 'Trening zamknięty przed ósmą rano.' },
  { id: 'zelazo', mark: '▲', name: 'Żelazo', desc: 'Ćwiczenie przeszło na cięższy kettlebell.' },
];

export const badgeById = (id: BadgeId): Badge => BADGES.find((b) => b.id === id)!;

export interface BadgeCtx {
  state: AppState;
  schedule: Schedule | null;
  stats: PlanStats | null;
  today: string;
}

const MS_DAY = 86_400_000;

/** Czy w historii jest trening po długiej przerwie. */
const hadComeback = (state: AppState, days: number): boolean =>
  state.log.some((e, i) => {
    const prev = state.log[i - 1];
    if (!prev) return false;
    return new Date(e.date).getTime() - new Date(prev.date).getTime() >= days * MS_DAY;
  });

/** Czy jakiekolwiek ćwiczenie stoi dziś na cięższym kettlebellu niż na starcie historii. */
const wentHeavier = (state: AppState): boolean =>
  Object.values(state.prog).some((p) => {
    const withWeight = p.hist.filter((h) => h.w !== null);
    const first = withWeight[0]?.w;
    const last = withWeight[withWeight.length - 1]?.w;
    return first != null && last != null && last > first;
  });

const TESTS: Record<BadgeId, (c: BadgeCtx) => boolean> = {
  'pierwszy-krok': (c) => c.state.log.length >= 1,
  'czysty-tydzien': (c) => !!c.schedule && countCleanWeeks(c.schedule.days) >= 1,
  'seria-3': (c) => (c.stats?.bestStreak ?? 0) >= 3,
  'seria-10': (c) => (c.stats?.bestStreak ?? 0) >= 10,
  'seria-25': (c) => (c.stats?.bestStreak ?? 0) >= 25,
  'nadrabiacz': (c) =>
    !!c.schedule && c.schedule.days.some((d) => d.status === 'done' && d.late >= 1 && d.late <= 2),
  'punktualny': (c) => !!c.stats && c.stats.elapsed >= 12 && (c.stats.adherence ?? 0) >= 90,
  'powrot': (c) => hadComeback(c.state, 14),
  'polowa': (c) => !!c.stats && c.stats.total > 0 && c.stats.done >= c.stats.total / 2,
  'plan-zamkniety': (c) => !!c.stats && c.stats.total > 0 && c.stats.done === c.stats.total,
  'setka': (c) => c.state.log.length >= 100,
  // Godzina lokalna, bo o poranku decyduje zegar w kuchni, nie strefa UTC.
  'ranny-ptaszek': (c) => c.state.log.some((e) => new Date(e.date).getHours() < 8),
  'zelazo': (c) => wentHeavier(c.state),
};

/**
 * Dopisuje nowo zdobyte odznaki do trwałego dorobku i do dziennika. Raz zdobyta odznaka
 * zostaje na zawsze — także po zmianie planu, bo dotyczy tego, co ktoś zrobił, a nie tego,
 * jaki kalendarz ma akurat włączony.
 */
export function syncBadges(state: AppState, ctx: BadgeCtx): BadgeId[] {
  const fresh: BadgeId[] = [];

  BADGES.forEach((b) => {
    if (state.award.badges[b.id]) return;
    if (!TESTS[b.id](ctx)) return;
    state.award.badges[b.id] = ctx.today;
    fresh.push(b.id);
    state.events.push(badgeEvent(b, ctx.today));
  });

  return fresh;
}

const badgeEvent = (b: Badge, date: string): PlanEvent => ({
  id: `badge:${b.id}`,
  date,
  kind: 'badge',
  title: `Odznaka: ${b.name}`,
  text: b.desc,
});
