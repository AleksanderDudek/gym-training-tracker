import type { ActivePlan } from '../types';

/**
 * Zmiany aktywnego planu bez przepisywania historii.
 *
 * Plan żyje tygodniami, a życie zmienia się szybciej: nowa praca, inne dni na basenie,
 * dziecko w przedszkolu od wtorku. Zmiana dni działa od wskazanego dnia — terminy sprzed
 * niej zostają takie, jakie były, więc realizacja, punkty i odznaki się nie przeliczają.
 * Plan, który się kończy, da się przedłużyć o kilka tygodni bez zakładania nowego.
 */

const sortDays = (ds: number[]): number[] => [...new Set(ds)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);

/** Nowe dni od `from`. Druga zmiana tego samego dnia zastępuje pierwszą. */
export function withWeekdays(p: ActivePlan, from: string, weekdays: number[]): ActivePlan {
  const changes = (p.changes ?? []).filter((c) => c.from !== from && c.from < from);
  return { ...p, changes: [...changes, { from, weekdays: sortDays(weekdays) }] };
}

/** Plan dłuższy o `weeks` tygodni. */
export const withExtension = (p: ActivePlan, weeks: number): ActivePlan => ({
  ...p,
  extraWeeks: Math.max(0, (p.extraWeeks ?? 0) + weeks),
});

/** Przerwy w tygodniu po kolei, z przejściem z ostatniego dnia na pierwszy następnego tygodnia. */
const gaps = (ds: number[]): number[] => ds.map((d, i) => (i ? d - ds[i - 1]! : d + 7 - ds[ds.length - 1]!));

const spread = (ds: number[]): [number, number] => {
  const g = gaps(ds);
  const mean = 7 / ds.length;
  return [Math.min(...g), -g.reduce((s, x) => s + (x - mean) ** 2, 0)];
};

/**
 * Dni tygodnia z jednym dniem mniej albo więcej, tak żeby przerwy były jak najrówniejsze:
 * najpierw największa najkrótsza przerwa (dwa dni z rzędu to najgorsze, co może się stać),
 * potem najmniejszy rozrzut. Przy remisie zostaje wcześniejszy dzień.
 */
export function spreadDays(days: number[], delta: 1 | -1): number[] {
  const ds = sortDays(days);
  const options =
    delta < 0
      ? ds.length <= 1
        ? [ds]
        : ds.map((d) => ds.filter((x) => x !== d))
      : [1, 2, 3, 4, 5, 6, 7].filter((d) => !ds.includes(d)).map((d) => sortDays([...ds, d]));
  if (!options.length) return ds;
  return options.reduce((best, o) => {
    const [a1, a2] = spread(o);
    const [b1, b2] = spread(best);
    return a1 > b1 || (a1 === b1 && a2 > b2) ? o : best;
  });
}
