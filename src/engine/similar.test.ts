import { describe, expect, it } from 'vitest';
import { EX, NO_EQUIPMENT, gearOf } from '../data/exercises';
import { fitsGear, similarTo, workoutGear } from './similar';

/**
 * Własna wersja treningu: zamiennik ma robić tę samą robotę i dać się zrobić tym, co jest pod
 * ręką, a sprzęt treningu wynika z jego ćwiczeń.
 */

describe('sprzęt treningu z jego ćwiczeń', () => {
  it('bez sprzętu, kettlebell albo siłownia', () => {
    expect(workoutGear(['pushup', 'squat_air', 'crunch'])).toBe('none');
    expect(workoutGear(['swing2', 'pushup', 'chinup'])).toBe('kb');
    expect(workoutGear(['bench', 'pushup'])).toBe('gym');
    // Nieznane ćwiczenie (np. z ręcznie poprawionego pliku) nie zmienia wyniku.
    expect(workoutGear(['pushup', 'nie-ma-takiego'])).toBe('none');
  });

  it('pasowanie do sprzętu: drążek to nie „bez sprzętu”, sztanga to nie kettlebell', () => {
    expect(fitsGear('chinup', 'kb')).toBe(true);
    expect(fitsGear('chinup', 'none')).toBe(false);
    expect(fitsGear('bench', 'kb')).toBe(false);
    expect(fitsGear('bench', 'gym')).toBe(true);
    expect(fitsGear('bench', undefined)).toBe(true);
    expect(fitsGear('nie-ma-takiego', 'gym')).toBe(false);
  });
});

describe('zamienniki ćwiczenia', () => {
  it('przysiad ze sztangą: najpierw inne przysiady, bez niego samego', () => {
    const out = similarTo('squat_back', { gear: 'gym' });
    expect(out).not.toContain('squat_back');
    expect(out.length).toBeGreaterThan(2);
    expect(EX[out[0]!]!.group).toBe(EX.squat_back!.group);
  });

  it('w treningu z kettlebell nie podsuwa sztangi ani maszyn, w treningu bez sprzętu — niczego ze sprzętem', () => {
    similarTo('squat_back', { gear: 'kb' }).forEach((x) => expect(['kettlebell', 'bodyweight']).toContain(gearOf(x)));
    const none = similarTo('goblet', { gear: 'none' });
    expect(none.length).toBeGreaterThan(0);
    none.forEach((x) => expect(NO_EQUIPMENT.has(x)).toBe(true));
  });

  it('pomija ćwiczenia, które już są w treningu, i trzyma się limitu', () => {
    const all = similarTo('goblet', { gear: 'gym', limit: 20 });
    const out = similarTo('goblet', { gear: 'gym', exclude: [all[0]!] });
    expect(out).not.toContain(all[0]);
    expect(out.length).toBeLessThanOrEqual(6);
  });

  it('maszyna zajęta: zamiennik stanowiska idzie pierwszy', () => {
    expect(similarTo('legpress', { gear: 'gym' }).slice(0, 2).sort()).toEqual(['bulgarian', 'hacksquat']);
  });

  it('każdy zamiennik ma wspólny wzorzec ruchu albo mięsień główny', () => {
    ['pushup', 'swing2', 'chinup', 'lateral', 'crunch'].forEach((id) =>
      expect(similarTo(id, { gear: 'gym' }).length, id).toBeGreaterThan(0),
    );
  });
});
