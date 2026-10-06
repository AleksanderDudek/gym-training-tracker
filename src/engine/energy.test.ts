import { describe, expect, it } from 'vitest';
import { ALL, BUILTIN, EX } from '../data/exercises';
import {
  BIKE_POINTS,
  DANCE_MET,
  DANCE_SHARE,
  LISTEN_MET,
  activeKcal,
  bikeMet,
  cardioEnergy,
  danceMet,
  ergoMet,
  profileOf,
  roundKcal,
  runVO2,
  setsEnergy,
  strideM,
  totalKcal,
  treadmillMet,
  walkVO2,
} from './energy';

describe('równania ACSM', () => {
  it('marsz po płaskim: 0,1 ml/kg/min na każdy metr na minutę ponad spoczynek', () => {
    // 5 km/h to 83,3 m/min: 8,33 + 3,5 = 11,83 ml/kg/min, czyli 3,38 MET.
    expect(walkVO2(5)).toBeCloseTo(11.83, 2);
    expect(treadmillMet(5)).toBeCloseTo(3.38, 2);
  });

  it('nachylenie liczy się w marszu dwa razy mocniej niż w biegu', () => {
    // 5 km/h pod 10%: 11,83 + 1,8 · 83,3 · 0,1 = 26,83.
    expect(walkVO2(5, 0.1)).toBeCloseTo(26.83, 2);
    expect(treadmillMet(5, 10)).toBeCloseTo(26.83 / 3.5, 2);
    // Bieg 10 km/h: 0,2 · 166,7 + 3,5 = 36,83; pod górę współczynnik 0,9 zamiast 1,8.
    expect(runVO2(10)).toBeCloseTo(36.83, 2);
    expect(runVO2(10, 0.05) - runVO2(10)).toBeCloseTo(0.9 * 166.67 * 0.05, 1);
  });

  it('między marszem a biegiem wynik przechodzi płynnie, bez skoku', () => {
    let prev = treadmillMet(2);
    for (let v = 2.1; v <= 20; v += 0.1) {
      const met = treadmillMet(v);
      expect(met).toBeGreaterThan(prev);
      expect(met - prev, `${v.toFixed(1)} km/h`).toBeLessThan(0.35);
      prev = met;
    }
    // Środek przedziału: połowa drogi między wzorem na marsz a wzorem na bieg.
    expect(treadmillMet(7)).toBeCloseTo(6.0, 1);
    expect(treadmillMet(6)).toBeCloseTo(walkVO2(6) / 3.5, 5);
    expect(treadmillMet(8)).toBeCloseTo(runVO2(8) / 3.5, 5);
  });

  it('zbieganie liczy się jak płasko — wzór ACSM nie obejmuje spadku', () => {
    expect(treadmillMet(5, -5)).toBe(treadmillMet(5, 0));
  });

  it('rower stacjonarny z mocą: 100 W przy 80 kg to okolice 6 MET, jak w tabeli Compendium', () => {
    expect(ergoMet(100, 80)).toBeCloseTo(5.93, 2);
  });

  it('te same waty to podobny wydatek bez względu na wagę — liczy się praca, nie masa', () => {
    const perHour = (kg: number) => activeKcal(ergoMet(150, kg), kg, 3600);
    expect(perHour(100) / perHour(60)).toBeLessThan(1.15);
    expect(perHour(100)).toBeGreaterThan(perHour(60));
  });
});

describe('rower według prędkości (Compendium 2024)', () => {
  it('w punktach tabeli daje wartości z tabeli', () => {
    BIKE_POINTS.forEach(([kmh, met]) => expect(bikeMet(kmh)).toBeCloseTo(met, 5));
  });

  it('rośnie razem z prędkością i nie wychodzi poza tabelę', () => {
    let prev = 0;
    for (let v = 3; v <= 60; v += 0.5) {
      const met = bikeMet(v);
      expect(met).toBeGreaterThanOrEqual(prev);
      prev = met;
    }
    expect(bikeMet(3)).toBe(3.5);
    expect(bikeMet(60)).toBe(16.8);
  });
});

describe('kalorie', () => {
  it('aktywne to nadwyżka ponad spoczynek, całkowite to razem ze spoczynkiem', () => {
    expect(activeKcal(1, 70, 3600)).toBe(0);
    expect(totalKcal(1, 70, 3600)).toBe(70);
    expect(activeKcal(4, 80, 1800)).toBe(120);
  });

  it('zaokrąglenie: małe liczby co 1, większe co 5 — szacunek nie udaje precyzji', () => {
    expect(roundKcal(12.4)).toBe(12);
    expect(roundKcal(247)).toBe(245);
    expect(roundKcal(248)).toBe(250);
    expect(roundKcal(0.3)).toBe(0);
  });
});

describe('kroki', () => {
  it('długość kroku to ok. 41% wzrostu, bez wzrostu — dla 170 cm', () => {
    expect(strideM()).toBeCloseTo(0.704, 3);
    expect(strideM(190)).toBeCloseTo(0.787, 3);
  });

  it('10 tysięcy kroków przy 80 kg to ok. 7 km i 250–300 kcal ponad spoczynek', () => {
    const b = cardioEnergy({ kind: 'steps', steps: 10_000 }, 80);
    expect(b.km).toBeCloseTo(7.04, 2);
    expect(b.active).toBeGreaterThan(250);
    expect(b.active).toBeLessThan(300);
    expect(b.total).toBeGreaterThan(b.active);
  });

  it('kalorie rosną liniowo z krokami, wagą i długością kroku', () => {
    const a = cardioEnergy({ kind: 'steps', steps: 5000 }, 70).active;
    expect(cardioEnergy({ kind: 'steps', steps: 10_000 }, 70).active).toBeCloseTo(2 * a, 6);
    expect(cardioEnergy({ kind: 'steps', steps: 5000 }, 140).active).toBeCloseTo(2 * a, 6);
    expect(cardioEnergy({ kind: 'steps', steps: 5000 }, 70, 190).active).toBeGreaterThan(a);
  });
});

describe('bieżnia i rower jako wpis', () => {
  it('bieżnia: droga z prędkości i czasu, kalorie z równania ACSM', () => {
    const b = cardioEnergy({ kind: 'treadmill', kmh: 6, min: 30, grade: 0 }, 80);
    expect(b.km).toBeCloseTo(3, 5);
    expect(b.secs).toBe(1800);
    expect(b.active).toBeCloseTo((treadmillMet(6) - 1) * 80 * 0.5, 5);
  });

  it('pod górę spala więcej niż po płaskim przy tej samej prędkości', () => {
    const flat = cardioEnergy({ kind: 'treadmill', kmh: 5, min: 30, grade: 0 }, 80).active;
    const hill = cardioEnergy({ kind: 'treadmill', kmh: 5, min: 30, grade: 8 }, 80).active;
    expect(hill).toBeGreaterThan(flat * 2);
  });

  it('rower stacjonarny z mocą nie ma drogi', () => {
    expect(cardioEnergy({ kind: 'ergo', watts: 120, min: 40 }, 75).km).toBeNull();
    expect(cardioEnergy({ kind: 'bike', kmh: 20, min: 60 }, 75).km).toBe(20);
  });
});

describe('zajęcia tańca', () => {
  it('MET zajęć to średnia z tańca i słuchania, ważona tym, ile czasu idzie na taniec', () => {
    expect(DANCE_MET).toEqual({ pair: 4.8, solo: 5.0 });
    expect(LISTEN_MET).toBe(1.5);
    expect(DANCE_SHARE).toEqual({ full: 0.85, half: 0.5, talk: 0.25 });
    expect(danceMet('pair', 'full')).toBeCloseTo(0.85 * 4.8 + 0.15 * 1.5, 5);
    expect(danceMet('pair', 'half')).toBeCloseTo(3.15, 5);
    expect(danceMet('solo', 'talk')).toBeCloseTo(0.25 * 5 + 0.75 * 1.5, 5);
  });

  it('więcej tłumaczenia to mniej kalorii, a solo spala odrobinę więcej niż para', () => {
    (['pair', 'solo'] as const).forEach((style) => {
      expect(danceMet(style, 'full')).toBeGreaterThan(danceMet(style, 'half'));
      expect(danceMet(style, 'half')).toBeGreaterThan(danceMet(style, 'talk'));
      // Nawet zajęcia, na których głównie się słucha, spalają więcej niż stanie w miejscu.
      expect(danceMet(style, 'talk')).toBeGreaterThan(LISTEN_MET);
    });
    expect(danceMet('solo', 'full')).toBeGreaterThan(danceMet('pair', 'full'));
  });

  it('godzina tańca w parze przy 80 kg: od ok. 105 do ok. 265 kcal ponad spoczynek, bez drogi', () => {
    const at = (mix: 'full' | 'half' | 'talk') => cardioEnergy({ kind: 'dance', style: 'pair', mix, min: 60 }, 80);
    expect(roundKcal(at('full').active)).toBe(265);
    expect(roundKcal(at('half').active)).toBe(170);
    expect(roundKcal(at('talk').active)).toBe(105);
    expect(at('full').secs).toBe(3600);
    expect(at('full').km).toBeNull();
    expect(at('full').total - at('full').active).toBeCloseTo(80, 5);
  });
});

describe('profil energii ćwiczeń', () => {
  it('każde ćwiczenie z katalogu ma MET z Compendium, tempo i przerwę', () => {
    ALL.forEach((id) => {
      const p = profileOf(id);
      expect(p.met, id).toBeGreaterThanOrEqual(2.5);
      expect(p.met, id).toBeLessThanOrEqual(12);
      expect(p.tempo, id).toBeGreaterThan(0);
      expect(p.rest, id).toBeGreaterThan(0);
      expect(p.code, id).toMatch(/^\d{5}$/);
      expect(p.label.length, id).toBeGreaterThan(3);
    });
  });

  it('rodzaje pracy trafiają do właściwych kodów', () => {
    expect(profileOf('swing2').met).toBe(9.8);
    expect(profileOf('squat_back').met).toBe(5.0);
    expect(profileOf('deadlift').code).toBe('02052');
    expect(profileOf('curl_db').met).toBe(3.5);
    expect(profileOf('legext').met).toBe(3.5);
    expect(profileOf('pushup').met).toBe(3.8);
    expect(profileOf('plank').met).toBe(2.8);
    expect(profileOf('farmer').met).toBe(6.0);
    expect(profileOf('burpee').met).toBe(7.5);
    expect(profileOf('jumprope').restMet).toBeDefined();
    expect(profileOf('squat_back').restMet).toBeUndefined();
  });

  it('turecki wstaw i kompleks mają własne tempo — to nie są zwykłe powtórzenia', () => {
    expect(profileOf('tgu').tempo).toBeGreaterThanOrEqual(20);
    expect(profileOf('complex').tempo).toBeGreaterThan(profileOf('goblet').tempo);
  });
});

describe('kalorie z serii', () => {
  it('ruch na stronę liczy pracę dwa razy, ćwiczenie na czas bierze sekundy wprost', () => {
    const one = setsEnergy('row_db', [{ reps: 10 }], 80, false);
    const both = setsEnergy('row_bb', [{ reps: 10 }], 80, false);
    expect(EX.row_db!.side).toBe(true);
    expect(one.work).toBe(2 * both.work);
    expect(setsEnergy('plank', [{ reps: 45 }], 80, false).work).toBe(45);
  });

  it('seria z zerem się nie liczy, a przekąska nie ma przerwy', () => {
    const withRest = setsEnergy('squat_air', [{ reps: 20 }, { reps: 0 }], 80);
    const noRest = setsEnergy('squat_air', [{ reps: 20 }], 80, false);
    expect(withRest.secs - withRest.work).toBe(profileOf('squat_air').rest);
    expect(noRest.secs).toBe(noRest.work);
    expect(setsEnergy('nie-ma-takiego', [{ reps: 10 }], 80).active).toBe(0);
  });

  it('w ruchu ciągłym przerwa spala mniej niż praca', () => {
    const b = setsEnergy('jumprope', [{ reps: 60 }, { reps: 60 }, { reps: 60 }], 80);
    const allAtWork = activeKcal(profileOf('jumprope').met, 80, b.secs);
    expect(b.active).toBeLessThan(allAtWork);
  });

  it('typowy trening A przy 80 kg to 30–75 minut i 150–450 kcal ponad spoczynek', () => {
    const w = BUILTIN.find((x) => x.id === 'A')!;
    let secs = 0;
    let kcal = 0;
    w.items.forEach(({ ex }) => {
      const d = EX[ex]!.def;
      const b = setsEnergy(ex, Array.from({ length: d.sets }, () => ({ reps: d.target })), 80);
      secs += b.secs;
      kcal += b.active;
    });
    expect(secs / 60).toBeGreaterThan(30);
    expect(secs / 60).toBeLessThan(75);
    expect(kcal).toBeGreaterThan(150);
    expect(kcal).toBeLessThan(450);
  });
});
