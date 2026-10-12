import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useBridge } from '../bridge';
import { mergeBody } from '../diet/body';
import { db, type DayRow, type Entry, type ProfileRow } from '../diet/db';
import type { CustomFood, FoodSet } from '../diet/foods';
import type { Plan } from '../diet/plan';
import { ACTIVE_PLAN, now } from '../diet/store';
import { readCache } from '../nearby/cache';
import { formatDistance } from '../nearby/geo';
import { DEFAULT_RADIUS } from '../nearby/radius';
import { placeShops, summarizeChains, type ChainSummary } from '../nearby/summary';

export interface Clock {
  /** Today, YYYY-MM-DD, local. */
  date: string;
  hour: number;
  ms: number;
}

function readClock(): Clock {
  const d = new Date();
  return { date: now().date, hour: d.getHours(), ms: d.getTime() };
}

/**
 * The time, read once and then once a minute: a page left open past
 * midnight moves on to the new day, and rendering stays pure.
 */
export function useClock(): Clock {
  const [clock, setClock] = useState(readClock);
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = readClock();
      setClock((c) => (c.date === next.date && c.hour === next.hour ? c : next));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return clock;
}

/** `undefined` while loading, `null` when there is none. */
export function useProfile(): ProfileRow | null | undefined {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export function usePlan(): Plan | null | undefined {
  return useLiveQuery(async () => (await db.plans.get(ACTIVE_PLAN)) ?? null, []);
}

export function useEntries(date: string): Entry[] | undefined {
  return useLiveQuery(() => db.entries.where('date').equals(date).sortBy('time'), [date]);
}

export function useDay(date: string): DayRow | undefined {
  return useLiveQuery(async () => (await db.days.get(date)) ?? { date }, [date]);
}

export function useCustomFoods(): (CustomFood & { id: number })[] | undefined {
  return useLiveQuery(() => db.foods.toArray() as Promise<(CustomFood & { id: number })[]>, []);
}

export function useSets(): (FoodSet & { id: number })[] | undefined {
  return useLiveQuery(() => db.sets.toArray() as Promise<(FoodSet & { id: number })[]>, []);
}

export interface History {
  /** Eaten kcal per date (only dates with entries). */
  eaten: Map<string, number>;
  days: Map<string, DayRow>;
  entries: Entry[];
}

/** Everything logged from `from` on: the forecast, the week and the progress view read this. */
export function useHistory(from: string | null): History | undefined {
  const raw = useLiveQuery(async () => {
    if (!from) return { from, entries: [] as Entry[], days: [] as DayRow[] };
    return {
      from,
      entries: await db.entries.where('date').aboveOrEqual(from).toArray(),
      days: await db.days.where('date').aboveOrEqual(from).toArray(),
    };
  }, [from]);
  return useMemo(() => {
    // Przy nowych zależnościach `useLiveQuery` oddaje jeszcze poprzedni wynik. Pusty wynik sprzed
    // profilu (`from` = null) nie jest historią — strona pokazałaby przez chwilę cel bez korekty
    // tygodnia i tydzień bez zapisów. Inny zakres (następny tydzień) może za to chwilę postać.
    if (!raw || (from && raw.from === null)) return undefined;
    const eaten = new Map<string, number>();
    for (const e of raw.entries) eaten.set(e.date, (eaten.get(e.date) ?? 0) + e.kcal);
    return { eaten, days: new Map(raw.days.map((d) => [d.date, d])), entries: raw.entries };
  }, [raw, from]);
}

/**
 * Dzień diety z wagą i krokami z treningów nałożonymi na jego własne pola (`mergeBody`). Ekrany
 * diety pokazują i liczą z tego wariantu — `useDay` zostaje surowym wierszem z IndexedDB, np. do
 * zapisu wyborów planu. Waga i kroki zapisują się przez most (`useBridge`), nie do `DayRow`.
 */
export function useMergedDay(date: string): DayRow | undefined {
  const day = useDay(date);
  const bridge = useBridge();
  return useMemo(() => {
    if (!day) return undefined;
    const weighed = bridge.weights.filter((w) => w.day === date);
    return mergeBody([day], weighed, bridge.stepsOn)[0] ?? day;
  }, [day, date, bridge]);
}

/**
 * Historia od `from` z wagą i krokami z treningów: ważenia z dziennika wagi (od `from`) nadpisują
 * i uzupełniają wagi diety, kroki z treningów — kroki diety. Prognoza, tydzień i postęp czytają
 * ten wariant, więc `weightOn`, `lastWeighing` i `forecastInputs` widzą jedno ciało.
 */
export function useMergedHistory(from: string | null): History | undefined {
  const history = useHistory(from);
  const bridge = useBridge();
  return useMemo(() => {
    if (!history || !from) return history;
    const weights = bridge.weights.filter((w) => w.day >= from);
    const days = mergeBody([...history.days.values()], weights, bridge.stepsOn);
    return { ...history, days: new Map(days.map((d) => [d.date, d])) };
  }, [history, from, bridge]);
}

export interface NearbyChains {
  /** Nearest first. */
  chains: ChainSummary[];
  /** Where they came from, for the line under the suggestions. */
  source: 'nearby' | 'preferred' | 'none';
}

function savedJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * The shops around the user as the "W pobliżu" page last found them - read
 * from the device, never a new request (this page works offline and must not
 * send the position anywhere by itself). Falls back to the preferred store.
 */
export function useNearbyChains(knownChains: Set<string>, preferredStore: string | null, nowMs: number): NearbyChains {
  return useMemo(() => {
    const position = savedJson<{ lat: number; lon: number }>('produkty-pl:position');
    const radius = Number(savedJson<number>('produkty-pl:radius')) || DEFAULT_RADIUS;
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    const shops = position ? readCache(storage, position, radius, nowMs) : null;
    if (position && shops) {
      const chains = summarizeChains(placeShops(shops, position, radius, knownChains).known);
      if (chains.length) return { chains, source: 'nearby' };
    }
    return { chains: [], source: preferredStore ? 'preferred' : 'none' };
  }, [knownChains, preferredStore, nowMs]);
}

export const distanceOf = (chains: ChainSummary[]) => (chain: string) => {
  const c = chains.find((x) => x.chain === chain);
  return c ? formatDistance(c.nearest.distance) : null;
};
