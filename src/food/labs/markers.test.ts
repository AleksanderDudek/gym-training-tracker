import { describe, expect, it } from 'vitest';
import { FOCUS } from './focus';
import { SCENARIOS } from './guide';
import { ALIASES, MARKER_LIST, MARKERS, toCanonical } from './markers';
import { foldUnit } from './units';

describe('marker catalog', () => {
  it('every marker converts its own canonical unit 1:1, so the review screen can edit in it', () => {
    for (const m of MARKER_LIST) expect(toCanonical(m, 1.5, m.unit), m.id).toBe(1.5);
    for (const m of MARKER_LIST) expect(Object.hasOwn(m.units, foldUnit(m.unit)), m.id).toBe(true);
  });

  it('no alias names two markers of the same specimen', () => {
    const seen = new Map<string, string>();
    for (const { alias, marker } of ALIASES) {
      const key = `${marker.specimen}:${alias}`;
      expect(seen.get(key) ?? marker.id, key).toBe(marker.id);
      seen.set(key, marker.id);
    }
  });

  it('ranges are ordered, targets cite a source', () => {
    for (const m of MARKER_LIST) {
      for (const r of Object.values(m.ref ?? {})) if (r[0] !== null && r[1] !== null) expect(r[0], m.id).toBeLessThan(r[1]);
      if (m.target) expect(m.target.source.length, m.id).toBeGreaterThan(3);
    }
  });

  it('focuses and scenarios name only known markers', () => {
    for (const f of Object.values(FOCUS)) for (const id of f.retest) expect(MARKERS[id], `${f.id}:${id}`).toBeDefined();
    for (const s of SCENARIOS) for (const id of [...s.markers, ...(s.maybe ?? [])]) expect(MARKERS[id], `${s.id}:${id}`).toBeDefined();
  });

  it('converts the units Polish labs print', () => {
    expect(toCanonical(MARKERS.vitD!, 75, 'nmol/l')).toBeCloseTo(30, 0);
    expect(toCanonical(MARKERS.hba1c!, 48, 'mmol/mol')).toBeCloseTo(6.54, 1);
    expect(toCanonical(MARKERS.ft4!, 1.2, 'ng/dl')).toBeCloseTo(15.4, 1);
    expect(toCanonical(MARKERS.wbc!, 6.2, 'G/l')).toBe(6.2);
    expect(toCanonical(MARKERS.uSg!, 1020, '')).toBe(1.02);
  });
});
