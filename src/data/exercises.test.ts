import { describe, expect, it } from 'vitest';
import {
  ALL,
  BUILTIN,
  EX,
  GEAR_LABEL,
  LADDERS,
  STAGES,
  WEIGHTED,
  ex,
  gearOf,
  ladderFor,
} from './exercises';
import { freshState } from '../engine/plan';
import type { Gear } from '../types';

describe('biblioteka ćwiczeń', () => {
  it('ma komplet pól w każdym wpisie', () => {
    ALL.forEach((id) => {
      const m = ex(id);
      expect(m.name.length).toBeGreaterThan(2);
      expect(m.group.length).toBeGreaterThan(2);
      expect(m.hint.length).toBeGreaterThan(10);
      expect(['reps', 'secs']).toContain(m.unit);
    });
  });

  it('nie powtarza nazw ani identyfikatorów', () => {
    expect(new Set(ALL).size).toBe(ALL.length);
    const names = ALL.map((id) => ex(id).name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('trzyma sensowne zakresy powtórzeń', () => {
    ALL.forEach((id) => {
      const d = ex(id).def;
      expect(d.min).toBeGreaterThan(0);
      expect(d.max).toBeGreaterThanOrEqual(d.min);
      expect(d.target).toBeGreaterThanOrEqual(d.min);
      expect(d.target).toBeLessThanOrEqual(d.max);
      expect(d.sets).toBeGreaterThan(0);
      if (d.minSets !== undefined) expect(d.minSets).toBeLessThanOrEqual(d.sets);
      if (d.maxSets !== undefined) expect(d.maxSets).toBeGreaterThanOrEqual(d.sets);
    });
  });

  it('każdy tryb etapowy wskazuje istniejącą drabinę etapów', () => {
    ALL.forEach((id) => {
      const m = ex(id);
      if (m.mode !== 'stage') return;
      expect(m.stages).toBeDefined();
      expect(STAGES[m.stages!].length).toBeGreaterThan(1);
    });
  });

  it('gotowe treningi używają wyłącznie istniejących ćwiczeń', () => {
    BUILTIN.forEach((w) => w.items.forEach((i) => expect(EX[i.ex]).toBeDefined()));
  });

  it('atlas urósł daleko poza pierwsze dziewiętnaście ćwiczeń', () => {
    expect(ALL.length).toBeGreaterThan(90);
  });

  it('pierwsza biblioteka została nietknięta — plany i treningi na niej stoją', () => {
    // Identyfikatory z wersji kettlebellowej. Zmiana któregoś zerwałaby zapisane postępy.
    [
      'swing2', 'swing1', 'rdl', 'goblet', 'lunge', 'row', 'pullup', 'curl', 'press',
      'floor', 'pushup', 'dip', 'tgu', 'complex', 'carry', 'farmer', 'core', 'calf', 'calf1',
    ].forEach((id) => expect(EX[id]).toBeDefined());
  });
});

describe('drabiny ciężaru', () => {
  it('każdy sprzęt ma etykietę i rosnącą drabinę', () => {
    (Object.keys(LADDERS) as Gear[]).forEach((g) => {
      expect(GEAR_LABEL[g].length).toBeGreaterThan(2);
      LADDERS[g].forEach((w, i) => {
        if (i > 0) expect(w).toBeGreaterThan(LADDERS[g][i - 1]!);
      });
    });
  });

  it('sztanga zaczyna od gryfu, a masa ciała nie ma drabiny', () => {
    expect(LADDERS.barbell[0]).toBe(20);
    expect(LADDERS.bodyweight).toEqual([]);
  });

  it('ćwiczenie dostaje drabinę swojego sprzętu', () => {
    const s = freshState();
    expect(ladderFor(s, 'swing2')).toBe(s.cfg.weights);
    expect(ladderFor(s, 'bench')).toEqual(LADDERS.barbell);
    expect(ladderFor(s, 'legpress')).toEqual(LADDERS.machine);
  });

  it('brak pola sprzętu znaczy kettlebell — tak wyglądała pierwsza biblioteka', () => {
    expect(gearOf('swing2')).toBe('kettlebell');
    expect(gearOf('bench')).toBe('barbell');
  });

  it('własna drabina z zapisu bije wartości domyślne', () => {
    const s = freshState();
    s.cfg.ladders = { barbell: [20, 40, 60] };
    expect(ladderFor(s, 'bench')).toEqual([20, 40, 60]);
  });

  it('każdy ciężar startowy da się nałożyć na swoim sprzęcie', () => {
    const s = freshState();
    WEIGHTED.forEach((id) => {
      const list = ladderFor(s, id);
      const w = s.prog[id]!.weight;
      expect(list.length).toBeGreaterThan(0);
      expect(list).toContain(w);
    });
  });

  it('ćwiczenia bez ciężaru zostają bez ciężaru', () => {
    const s = freshState();
    ALL.filter((id) => !WEIGHTED.includes(id)).forEach((id) => {
      expect(s.prog[id]!.weight).toBeNull();
    });
  });
});
