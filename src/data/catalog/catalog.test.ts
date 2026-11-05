import { afterEach, describe, expect, it } from 'vitest';
import index from './index.json';
import stepsPl from './steps.pl.json';
import stepsEn from './steps.en.json';
import { EQ_LABEL, GEAR_OF, SECONDARY_OF, TARGET_OF, catalogId, defOf, deltOf, musclesOf } from './derive';
import type { CatalogRow } from './derive';
import { adopt, isAdopted, registerCatalog, resetCatalogForTests, restoreCatalog, syncCatalog } from './adopt';
import { ALL, EX, ex } from '../exercises';
import { EX_MUSCLES } from '../muscles';
import { P, freshState } from '../../engine/plan';

const rows = index as CatalogRow[];
const row = (en: string): CatalogRow => {
  const r = rows.find((x) => x.n[1] === en);
  if (!r) throw new Error(en);
  return r;
};

afterEach(() => resetCatalogForTests());

describe('dane katalogu', () => {
  it('ma 1324 ćwiczenia z unikalnym id i polską nazwą', () => {
    expect(rows).toHaveLength(1324);
    expect(new Set(rows.map((r) => r.i)).size).toBe(1324);
    const pl = rows.map((r) => r.n[0].toLowerCase());
    expect(pl.every((n) => n.trim().length > 0)).toBe(true);
    expect(new Set(pl).size).toBe(pl.length);
  });

  it('każde ćwiczenie ma kroki po polsku i po angielsku', () => {
    const pl = stepsPl as Record<string, string[]>;
    const en = stepsEn as Record<string, string[]>;
    for (const r of rows) {
      expect(pl[r.i]?.length, r.i).toBeGreaterThan(0);
      expect(en[r.i]?.length, r.i).toBeGreaterThan(0);
    }
  });

  it('każdy sprzęt, cel i mięsień pomocniczy ze źródła ma regułę', () => {
    for (const r of rows) {
      expect(GEAR_OF[r.e], r.e).toBeDefined();
      expect(EQ_LABEL[r.e], r.e).toBeDefined();
      expect(TARGET_OF[r.t], r.t).toBeDefined();
      for (const s of r.s) if (s !== 'shoulders' && s !== 'deltoids') expect(SECONDARY_OF[s], s).toBeDefined();
    }
  });

  it('każde ćwiczenie poza cardio ma główny mięsień', () => {
    for (const r of rows) {
      if (r.t === 'cardiovascular system') continue;
      expect(musclesOf(r).p.length, r.n[1]).toBeGreaterThan(0);
    }
  });
});

describe('reguły', () => {
  it('rozbija barki po nazwie', () => {
    expect(deltOf('dumbbell lateral raise')).toBe('bark-bok');
    expect(deltOf('dumbbell rear delt fly')).toBe('bark-tyl');
    expect(deltOf('barbell seated overhead press')).toBe('bark-przod');
  });

  it('wyciskanie na ławce: sztanga, ciężar, pchanie, klatka', () => {
    const d = defOf(row('barbell bench press'));
    expect(d).toMatchObject({ gear: 'barbell', mode: 'grind', unit: 'reps', group: 'Pchanie' });
    expect(d.def.w).toBe(20);
    expect(d.muscles.p).toEqual(['klatka']);
    expect(d.muscles.s).toContain('triceps');
  });

  it('podciąganie: masa ciała, powtórzenia, ciągnięcie', () => {
    const d = defOf(row('pull-up'));
    expect(d).toMatchObject({ gear: 'bodyweight', mode: 'body', unit: 'reps' });
    expect(d.def.w).toBeUndefined();
    expect(d.muscles.p).toEqual(['najszersze']);
  });

  it('rozciąganie idzie w sekundach', () => {
    const r = rows.find((x) => /stretch/.test(x.n[1]))!;
    expect(defOf(r)).toMatchObject({ unit: 'secs', mode: 'carry' });
  });

  it('jednorącz liczy się na stronę', () => {
    const r = rows.find((x) => /one arm|single arm/.test(x.n[1]))!;
    expect(defOf(r).side).toBe(true);
  });
});

describe('adopcja', () => {
  it('rejestruje ćwiczenie w silniku', () => {
    const id = adopt(row('barbell bench press'));
    expect(id).toBe(catalogId('0025'));
    expect(isAdopted(id)).toBe(true);
    expect(ex(id).name).toBe('Wyciskanie sztangi na ławce');
    expect(ALL).toContain(id);
    expect(EX_MUSCLES[id]?.p).toEqual(['klatka']);
  });

  it('daje świeżą progresję na żądanie', () => {
    const id = adopt(row('pull-up'));
    const s = freshState();
    delete s.prog[id];
    expect(P(s, id).phase).toBe('calib');
    expect(s.prog[id]).toBeDefined();
  });

  it('zapisuje tylko ćwiczenia, do których coś się odwołuje', () => {
    const used = adopt(row('barbell bench press'));
    adopt(row('pull-up'));
    const s = freshState();
    s.workouts = [{ id: 'w1', name: 'A', items: [{ ex: used }] } as never];
    syncCatalog(s);
    expect(Object.keys(s.catalog ?? {})).toEqual([used]);
    expect(s.prog[used]).toBeDefined();
  });

  it('odtwarza definicje z zapisu i odrzuca zepsute', () => {
    const d = defOf(row('barbell bench press'));
    const restored = restoreCatalog({
      'kat-0025': d,
      'kat-9999': { ...d, gear: 'rakieta' },
      swing2: d,
    });
    expect(Object.keys(restored ?? {})).toEqual(['kat-0025']);
    registerCatalog(restored);
    const s = freshState();
    // Pusty gryf: połowa z 20 kg schodzi na najbliższy stopień drabiny sztangi.
    expect(s.prog['kat-0025']?.weight).toBe(20);
    expect(EX['kat-0025']).toBeDefined();
  });

  it('nie nadpisuje ćwiczeń z biblioteki', () => {
    const before = EX.swing2;
    registerCatalog({ swing2: defOf(row('pull-up')) });
    expect(EX.swing2).toBe(before);
  });
});

describe('bliźniaki', () => {
  it('łączą istniejące ćwiczenia z obu stron', async () => {
    const { TWINS, twinOf } = await import('./twins');
    const ids = new Set(rows.map((r) => r.i));
    for (const [src, id] of Object.entries(TWINS)) {
      expect(ids.has(src), src).toBe(true);
      expect(Object.hasOwn(EX, id), id).toBe(true);
    }
    expect(twinOf('bench')).toBe('0025');
  });
});
