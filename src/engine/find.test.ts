import { describe, expect, it } from 'vitest';
import { ALL, EX, GEAR_LABEL, gearOf } from '../data/exercises';
import { ALPHABETICAL, findExercises, fold, splitHits } from './find';

const names = (q: string): string[] => findExercises(q).map((f) => EX[f.id]!.name);

describe('kolejność', () => {
  it('lista ma każde ćwiczenie dokładnie raz', () => {
    expect([...ALPHABETICAL].sort()).toEqual([...ALL].sort());
  });

  it('idzie według polskiego alfabetu, nie kodów znaków', () => {
    const list = ALPHABETICAL.map((id) => EX[id]!.name);
    const collator = new Intl.Collator('pl', { sensitivity: 'base' });
    list.forEach((n, i) => {
      if (i > 0) expect(collator.compare(list[i - 1]!, n), `${list[i - 1]} → ${n}`).toBeLessThanOrEqual(0);
    });
    // „Kompleks” przed „Kółko”: o przed ó. Kody znaków dałyby to samo tylko przypadkiem.
    expect(list.indexOf('Kompleks: clean + press + squat')).toBeLessThan(list.indexOf('Kółko do brzucha'));
  });

  it('puste pole pokazuje całą listę alfabetycznie', () => {
    expect(findExercises('').map((f) => f.id)).toEqual(ALPHABETICAL);
    expect(findExercises('   ').map((f) => f.id)).toEqual(ALPHABETICAL);
  });
});

describe('podpowiedzi', () => {
  it('szuka po początku słowa i zostawia wynik alfabetycznie', () => {
    const p = names('pomp');
    expect(p.length).toBeGreaterThan(3);
    p.forEach((n) => expect(fold(n)).toMatch(/(^|\s)pomp/));
    expect(p).toEqual([...p].sort(new Intl.Collator('pl').compare));
  });

  it('ogonki są opcjonalne w obie strony', () => {
    expect(names('wioslowanie')).toEqual(names('wiosłowanie'));
    expect(names('wioslowanie').length).toBeGreaterThan(0);
    expect(names('nad glowe')).toEqual(['Wyciskanie hantli nad głowę', 'Wyciskanie nad głowę']);
    expect(names('MLOT')).toEqual(names('młot'));
    expect(names('MLOT')).toContain('Uginanie młotkowe');
    expect(fold('Źdźbło Łódź')).toBe('zdzblo lodz');
    expect(fold('Źdźbło Łódź').length).toBe('Źdźbło Łódź'.length);
  });

  it('każde słowo zapytania musi pasować', () => {
    const both = names('martwy sumo');
    expect(both).toEqual(['Martwy ciąg sumo']);
  });

  it('sprzęt i partia też prowadzą do ćwiczenia', () => {
    const dumbbell = findExercises('hantle');
    expect(dumbbell.length).toBeGreaterThan(0);
    dumbbell.forEach((f) => {
      const inName = fold(EX[f.id]!.name).includes('hantl');
      expect(inName || GEAR_LABEL[gearOf(f.id)] === 'hantle').toBe(true);
    });
  });

  it('bez dopasowania na początku słowa szuka w środku, zanim się podda', () => {
    // „siad” nie zaczyna żadnego słowa, ale siedzi w „Przysiad”.
    expect(names('siad').some((n) => n.startsWith('Przysiad'))).toBe(true);
    expect(findExercises('qqqxyz')).toEqual([]);
  });

  it('dopasowanie wskazuje fragment nazwy do podświetlenia', () => {
    const f = findExercises('dead').find((x) => EX[x.id]!.name === 'Dead bug')!;
    expect(splitHits('Dead bug', f.hits)).toEqual([
      { text: 'Dead', on: true },
      { text: ' bug', on: false },
    ]);
    const lodz = findExercises('lawce').find((x) => EX[x.id]!.name === 'Pompki na ławce')!;
    expect(splitHits('Pompki na ławce', lodz.hits).find((p) => p.on)?.text).toBe('ławce');
  });
});
