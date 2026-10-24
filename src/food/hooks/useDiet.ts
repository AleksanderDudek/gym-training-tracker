import { useLiveQuery } from 'dexie-react-hooks';
import { useContext, useEffect, useMemo, useState } from 'react';
import { BridgeContext, useBridge } from '../bridge';
import { mergeBody } from '../diet/body';
import { db, type DayRow, type Entry, type Favorite, type ProfileRow } from '../diet/db';
import { byUse } from '../diet/favorites';
import type { CustomFood, FoodSet } from '../diet/foods';
import type { Plan } from '../diet/plan';
import { ACTIVE_PLAN, latestKg, now, persistUpgrade } from '../diet/store';
import { cleanProfile } from '../diet/validate';
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

/**
 * The diet profile: `undefined` while loading, `null` when there is none. Every read goes through
 * the normaliser (`cleanProfile`), so `dailyKcal` is today's target and nothing unreadable reaches a
 * screen. A row stored by the old model comes back upgraded at once (§3.4), and the upgrade is
 * written once (`persistUpgrade`) with the same day and weight — the latest gym weigh-in when
 * there is a bridge, else the start weight — so the upgrade date, the notice and the first check
 * stay put.
 */
export function useProfile(): ProfileRow | null | undefined {
  const bridge = useContext(BridgeContext);
  const weightKg = latestKg(bridge?.weights);
  const today = useClock().date;
  const read = useLiveQuery(async () => {
    const row = await db.profile.get('me');
    if (!row) return { profile: null, upgrade: null };
    const profile: ProfileRow = { ...cleanProfile(row, { today, weightKg }), id: 'me' };
    return { profile, upgrade: row.version === 2 ? null : { weightKg: weightKg ?? profile.startWeightKg, today } };
  }, [today, weightKg]);
  const upgrade = read?.upgrade ?? null;
  useEffect(() => {
    if (upgrade) persistUpgrade(upgrade).catch((error: unknown) => console.error(error));
  }, [upgrade]);
  return read && read.profile;
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

/** Starred foods, most eaten first. */
export function useFavorites(): Favorite[] | undefined {
  return useLiveQuery(async () => (await db.favorites.toArray()).sort(byUse), []);
}

export interface History {
  /** Eaten kcal per date (only dates with entries). */
  eaten: Map<string, number>;
  days: Map<string, DayRow>;
  entries: Entry[];
}

/** Everything logged from `from` on: the meal plan page and the progress page read this. */
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
    // profilu (`from` = null) nie jest historią — strona pokazałaby przez chwilę tygodnie bez
    // zapisów. Inny zakres (następny tydzień) może za to chwilę postać.
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
