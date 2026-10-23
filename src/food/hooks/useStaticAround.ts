import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OsmIndex } from '../nearby/osmFormat';
import { completeWithin as completeOf, coverageOf, haversine, roundedCentre, roundingMargin, wantedLeaves } from '../nearby/osmGrid';
import type { Element } from '../nearby/overpass';
import {
  failureOf,
  hasStaticData,
  leafNow,
  leafRefs,
  leafStartedAt,
  loadIndex,
  loadLeaf,
  pinLeaves,
  type LeafRef,
  type StaticFailure,
} from '../nearby/staticData';
import type { LatLon } from '../nearby/types';
import { useAutoRetry } from './useNearbyShops';

/**
 * Where the app's own data covers the circle around the user:
 * - `off`: this build has no data (tests, a build without the file) — ask Overpass as before;
 * - `unknown`: the index is still on its way (a fraction of a second, a few ms when cached);
 * - `full`: the whole circle is inside Poland's data;
 * - `partial`: the user is in Poland but the circle crosses the border (or the coast) — the Polish
 *   part is here, the rest has to come from Overpass;
 * - `none`: abroad — Overpass only.
 */
export type Coverage = 'off' | 'unknown' | 'full' | 'partial' | 'none';

export interface StaticState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** The elements of the loaded leaves within reach of the rounded position. */
  items: Element[];
  /** How far from the exact position `items` is complete (the nearest missing leaf, the border). */
  completeWithin: number;
  coverage: Coverage;
  /** How far from the position the data's coverage reaches (border minus its margin). */
  safeWithin: number;
  /** The circle the leaves were chosen for: the rounded position and the reach (for the diary's digest). */
  circle: (LatLon & { radius: number }) | null;
  /** The OpenStreetMap data's date (ISO). */
  dataAsOf: string | null;
  /** Some leaf is an older data version kept on the device (the current one could not be fetched). */
  olderLeaves: boolean;
  failure: StaticFailure | null;
  /** When the leaves still missing started loading: a long wait is called slow. */
  since: number | null;
  /** When the next automatic try is due after a network failure. */
  retryAt: number | null;
}

const BASE: StaticState = {
  status: 'idle',
  items: [],
  completeWithin: 0,
  coverage: 'off',
  safeWithin: 0,
  circle: null,
  dataAsOf: null,
  olderLeaves: false,
  failure: null,
  since: null,
  retryAt: null,
};

/** Leaves arriving within this long render together: a warm page in one go, a cold one in a few steps. */
const FLUSH_MS = 30;

const keyOf = (leaf: LeafRef) => `${leaf.d}-${leaf.i}-${leaf.j}.${leaf.sha10}`;

/** One empty record, so "no failures" does not change identity every render. */
const NO_FAILURES: Record<string, StaticFailure> = {};

interface Failed {
  /** The selection and attempt these failures belong to: a new one starts clean. */
  run: string;
  byLeaf: Record<string, StaticFailure>;
  at: number | null;
}

/**
 * „W pobliżu” from the app's own copy of the OpenStreetMap data: the index once, then the leaves
 * around the position — nearest first, all at once, never aborted (a leaf that arrives late still
 * fills the memory for the next look), held in memory while on screen.
 *
 * Everything that decides what goes over the network — which leaves, whether the circle is inside
 * Poland, whether Overpass is needed — comes from the position ROUNDED to ~100 m (and the radius
 * plus the rounding's reach), so the files and questions sent tell no more than today's rounded
 * circle told Overpass. Only what is complete on screen is measured from the exact position, on the
 * device.
 */
export function useStaticAround(position: LatLon | null, radius: number): [StaticState, () => void] {
  const enabled = hasStaticData();
  const [index, setIndex] = useState<OsmIndex | null>(null);
  const [indexFailed, setIndexFailed] = useState<{ kind: StaticFailure; at: number } | null>(null);
  const indexFailure = indexFailed?.kind ?? null;
  const [tick, setTick] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<Failed>({ run: '', byLeaf: {}, at: null });
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadIndex().then(
      (fresh) => {
        if (!live) return;
        setIndex(fresh);
        setIndexFailed(null);
      },
      (error: unknown) => {
        if (live) setIndexFailed({ kind: failureOf(error), at: Date.now() });
      },
    );
    return () => {
      live = false;
    };
  }, [enabled, attempt]);

  const refs = useMemo(() => (index ? leafRefs(index) : []), [index]);
  const lat = position?.lat;
  const lon = position?.lon;
  const centre = lat !== undefined && lon !== undefined ? roundedCentre({ lat, lon }) : null;
  const cLat = centre?.lat;
  const cLon = centre?.lon;
  // What goes over the network: from the rounded circle grown by the rounding's reach. If THAT is
  // inside the data, so is the exact circle; near the border it errs towards asking Overpass.
  const netCoverage = useMemo(
    () =>
      index && cLat !== undefined && cLon !== undefined
        ? coverageOf({ lat: cLat, lon: cLon }, radius + roundingMargin(cLat), index.coverage)
        : null,
    [index, cLat, cLon, radius],
  );
  // What is complete on screen: the exact position (local only).
  const exactCoverage = useMemo(
    () => (index && lat !== undefined && lon !== undefined ? coverageOf({ lat, lon }, radius, index.coverage) : null),
    [index, lat, lon, radius],
  );
  const inData = netCoverage !== null && netCoverage.kind !== 'none';
  /** The place: what the automatic retries count against (a new place starts afresh). */
  const place = `${index?.dataAsOf ?? ''}|${cLat},${cLon},${radius}`;
  /** The place and the try: a new try starts with a clean failure record. */
  const run = `${place}|${attempt}`;

  useEffect(() => {
    if (!index || !inData || cLat === undefined || cLon === undefined) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      if (live) setTick((n) => n + 1);
    };
    const soon = () => {
      timer ??= setTimeout(flush, FLUSH_MS);
    };
    const record = (leaf: LeafRef, kind: StaticFailure) =>
      setFailed((f) => ({ run, byLeaf: { ...(f.run === run ? f.byLeaf : {}), [keyOf(leaf)]: kind }, at: Date.now() }));
    const { leaves } = wantedLeaves(refs, { lat: cLat, lon: cLon }, radius);
    // The view's leaves stay in memory while it is on screen.
    const release = pinLeaves(leaves);
    let started = 0;
    for (const leaf of leaves) {
      const known = leafNow(leaf);
      if (known && !known.older) continue;
      started++;
      loadLeaf(leaf).then(soon, (error: unknown) => {
        if (!live) return;
        const kind = failureOf(error);
        if (kind === 'moved') {
          // A new data version was deployed: take its index (just re-read) and choose again. The
          // same index again means the file is really missing — then Overpass answers instead.
          loadIndex().then(
            (fresh) => {
              if (!live) return;
              if (fresh !== index) setIndex(fresh);
              else record(leaf, 'unavailable');
            },
            () => live && record(leaf, 'network'),
          );
          return;
        }
        record(leaf, kind);
        soon();
      });
    }
    // Loads just started: one more look shortly, so "since when" (a slow connection) is known.
    if (started > 0) soon();
    return () => {
      live = false;
      clearTimeout(timer);
      release();
    };
  }, [index, refs, inData, cLat, cLon, radius, run]);

  const failures = failed.run === run ? failed.byLeaf : NO_FAILURES;
  const networkFailedAt = Object.values(failures).includes('network') ? failed.at : null;
  const indexNetworkFailed = indexFailure === 'network';
  const retryAt = useAutoRetry(networkFailedAt ?? (indexNetworkFailed ? indexFailed!.at : null), place, retry);

  const state = useMemo<StaticState>(() => {
    void tick; // leaves arrived: read the memory again
    if (!enabled) return BASE;
    const dataAsOf = index?.dataAsOf ?? null;
    if (!index) {
      if (indexFailure === 'unavailable') return { ...BASE, failure: 'unavailable' };
      return { ...BASE, coverage: 'unknown', status: indexFailure ? 'error' : lat === undefined ? 'idle' : 'loading', failure: indexFailure };
    }
    if (!netCoverage || !exactCoverage || lat === undefined || lon === undefined) return { ...BASE, coverage: 'unknown', dataAsOf };
    if (netCoverage.kind === 'none') return { ...BASE, coverage: 'none', dataAsOf };
    const p = { lat, lon };
    const wanted = wantedLeaves(refs, p, radius);
    const loaded = new Map<string, NonNullable<ReturnType<typeof leafNow>>>();
    let older = false;
    let since: number | null = null;
    const kinds = new Set<StaticFailure>();
    for (const leaf of wanted.leaves) {
      const got = leafNow(leaf);
      const failure = failures[keyOf(leaf)];
      if (got) {
        loaded.set(keyOf(leaf), got);
        older ||= got.older;
      } else if (failure) kinds.add(failure);
      const startedAt = got ? undefined : leafStartedAt(leaf);
      if (startedAt !== undefined) since = since === null ? startedAt : Math.min(since, startedAt);
    }
    let complete = completeOf(p, radius, wanted.leaves, (leaf) => loaded.has(keyOf(leaf)));
    // Near the border only the Polish side is here: complete up to the coverage's edge.
    const safe = exactCoverage.kind === 'none' ? 0 : exactCoverage.safeWithin;
    if (netCoverage.kind === 'partial') complete = Math.min(complete, safe);
    const items: Element[] = [];
    for (const got of loaded.values()) for (const e of got.elements) if (haversine(wanted.centre, e) <= wanted.reach) items.push(e);
    const pendingLeaves = wanted.leaves.length - loaded.size - Object.keys(failures).filter((k) => !loaded.has(k)).length;
    const failure = kinds.has('unavailable') ? 'unavailable' : kinds.has('network') ? 'network' : null;
    return {
      status: pendingLeaves > 0 ? 'loading' : failure ? 'error' : 'ready',
      items,
      completeWithin: complete,
      coverage: netCoverage.kind,
      safeWithin: safe,
      circle: { ...wanted.centre, radius: wanted.reach },
      dataAsOf,
      olderLeaves: older,
      failure,
      since,
      retryAt: null,
    };
  }, [enabled, index, indexFailure, netCoverage, exactCoverage, refs, lat, lon, radius, failures, tick]);

  const withRetry = useMemo(
    () => ({ ...state, retryAt: state.failure === 'network' || indexNetworkFailed ? retryAt : null }),
    [state, retryAt, indexNetworkFailed],
  );
  return [withRetry, retry];
}
