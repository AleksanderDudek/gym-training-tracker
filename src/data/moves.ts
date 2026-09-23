import type { Keyframe } from '../engine/pose';

/**
 * Wzorce ruchu dla manekina. Jeden wzorzec obsługuje całą rodzinę ćwiczeń — przysiad ze
 * sztangą, goblet i hack squat różnią się trzymanym sprzętem, nie torem ruchu — dzięki czemu
 * sto pięć ćwiczeń opisuje kilkanaście cykli, a nie sto pięć osobnych animacji.
 *
 * Wszystko jest rysowane od zera w tej aplikacji: nic nie pochodzi z cudzych nagrań,
 * bibliotek ruchu ani sklepów z modelami, więc nie ma tu czyjegoś prawa autorskiego,
 * licencji do pilnowania ani reklam przed odtworzeniem.
 */

export type MoveName =
  | 'hinge'
  | 'swing'
  | 'squat'
  | 'lunge'
  | 'pressOverhead'
  | 'benchPress'
  | 'row'
  | 'pullup'
  | 'pushup'
  | 'dip'
  | 'curl'
  | 'lateral'
  | 'carry'
  | 'plank'
  | 'crunch'
  | 'calf'
  | 'legCurl'
  | 'legExtension';

/** Gdzie ląduje sprzęt: w dłoniach, na barkach czy pod stopami. */
export type PropSpot = 'hands' | 'rack' | 'shoulders' | 'none';

export interface Move {
  frames: Keyframe[];
  /** Sprzęt otoczenia: ławka pod plecami albo drążek nad głową. */
  scene?: 'bench' | 'bar';
  /**
   * Klatka, na której zatrzymuje się animacja. Domyślnie dół ruchu, bo tam widać najwięcej;
   * przy wyciskaniu nad głowę wyprost jest jednak współliniowy z tułowiem i z boku wygląda
   * jak kreska, więc nieruchoma klatka łapie ruch w połowie drogi.
   */
  key?: number;
  /** Ile trwa jedno powtórzenie w sekundach. */
  secs: number;
  prop: PropSpot;
  /** Krótki opis toru ruchu — czytany przez czytniki ekranu zamiast animacji. */
  alt: string;
}

export const MOVES: Record<MoveName, Move> = {
  hinge: {
    secs: 3,
    prop: 'hands',
    alt: 'Biodra jadą do tyłu, plecy zostają proste, ciężar sunie blisko nóg.',
    frames: [
      { at: 0, pose: { torso: 4, armA: 178, armB: 178, legA: 180, legB: 180 } },
      {
        at: 0.45,
        pose: { torso: 72, head: 58, armA: 168, armB: 168, legA: 188, legB: 172, rootX: 84 },
      },
      { at: 0.9, pose: { torso: 4, armA: 178, armB: 178, legA: 180, legB: 180 } },
    ],
  },

  swing: {
    secs: 1.6,
    prop: 'hands',
    alt: 'Zamach z bioder: ciężar leci między nogami, potem wyrzut do poziomu.',
    frames: [
      { at: 0, pose: { torso: 66, head: 50, armA: 150, armB: 150, legA: 186, legB: 174, rootX: 84 } },
      { at: 0.4, pose: { torso: -4, armA: 96, armB: 96, legA: 180, legB: 180 } },
      { at: 0.75, pose: { torso: 66, head: 50, armA: 150, armB: 150, legA: 186, legB: 174, rootX: 84 } },
    ],
  },

  squat: {
    secs: 3,
    prop: 'rack',
    alt: 'Biodra i kolana zginają się razem, tułów zostaje wysoko, pięty na ziemi.',
    frames: [
      { at: 0, pose: { torso: 3, legA: 180, legB: 180, armA: 205, armB: 335, farArmA: 212, farArmB: 342 } },
      {
        at: 0.45,
        pose: { torso: 34, head: 22, legA: 128, legB: 212, foot: 92, rootX: 72, armA: 205, armB: 335, farArmA: 212, farArmB: 342 },
      },
      { at: 0.9, pose: { torso: 3, legA: 180, legB: 180, armA: 205, armB: 335, farArmA: 212, farArmB: 342 } },
    ],
  },

  lunge: {
    secs: 3,
    prop: 'rack',
    alt: 'Krok w przód, kolano tylnej nogi schodzi nisko, tułów pionowo.',
    frames: [
      { at: 0, pose: { torso: 2, legA: 180, legB: 180, farLegA: 180, farLegB: 180, armA: 205, armB: 335, farArmA: 212, farArmB: 342 } },
      {
        at: 0.45,
        pose: {
          torso: 8,
          armA: 205,
          armB: 335,
          farArmA: 212,
          farArmB: 342,
          legA: 148,
          legB: 196,
          foot: 92,
          farLegA: 206,
          farLegB: 128,
          farFoot: 64,
          rootX: 74,
        },
      },
      { at: 0.9, pose: { torso: 2, legA: 180, legB: 180, farLegA: 180, farLegB: 180, armA: 205, armB: 335, farArmA: 212, farArmB: 342 } },
    ],
  },

  pressOverhead: {
    secs: 3,
    prop: 'hands',
    key: 0.2,
    alt: 'Z pozycji przy barkach ciężar idzie pionowo nad głowę, żebra w dole.',
    frames: [
      { at: 0, pose: { torso: 0, armA: 146, armB: 28, farArmA: 214, farArmB: 332 } },
      { at: 0.45, pose: { torso: -3, armA: 18, armB: 6, farArmA: 342, farArmB: 354 } },
      { at: 0.9, pose: { torso: 0, armA: 146, armB: 28, farArmA: 214, farArmB: 332 } },
    ],
  },

  benchPress: {
    secs: 3,
    prop: 'hands',
    scene: 'bench',
    alt: 'Leżąc na ławce: ciężar schodzi do klatki i wraca na wyprost ramion.',
    frames: [
      {
        at: 0,
        pose: { anchor: 'free' as const, rootX: 84, rootY: 96, torso: 272, head: 272, legA: 120, legB: 190, foot: 92, farLegA: 126, farLegB: 196, armA: 4, armB: 356, farArmA: 356, farArmB: 4 },
      },
      {
        at: 0.45,
        pose: { anchor: 'free' as const, rootX: 84, rootY: 96, torso: 272, head: 272, legA: 120, legB: 190, foot: 92, farLegA: 126, farLegB: 196, armA: 312, armB: 52, farArmA: 306, farArmB: 46 },
      },
      {
        at: 0.9,
        pose: { anchor: 'free' as const, rootX: 84, rootY: 96, torso: 272, head: 272, legA: 120, legB: 190, foot: 92, farLegA: 126, farLegB: 196, armA: 4, armB: 356, farArmA: 356, farArmB: 4 },
      },
    ],
  },

  row: {
    secs: 2.6,
    prop: 'hands',
    alt: 'Tułów blisko poziomu i nieruchomy, łokieć jedzie wzdłuż tułowia do biodra.',
    frames: [
      { at: 0, pose: { torso: 74, head: 58, armA: 176, armB: 176, legA: 186, legB: 172, rootX: 82 } },
      { at: 0.45, pose: { torso: 74, head: 58, armA: 214, armB: 150, legA: 186, legB: 172, rootX: 82 } },
      { at: 0.9, pose: { torso: 74, head: 58, armA: 176, armB: 176, legA: 186, legB: 172, rootX: 82 } },
    ],
  },

  pullup: {
    secs: 3,
    prop: 'none',
    scene: 'bar',
    alt: 'Pełny zwis na dole, ruch zaczyna się z łopatek, klatka jedzie do drążka.',
    frames: [
      // Dłonie zostają na drążku, więc w górnej pozycji łokcie muszą wyjść w bok —
      // inaczej łańcuch ramienia wypchnąłby nadgarstki poza kadr.
      {
        at: 0,
        pose: { anchor: 'free', rootX: 78, rootY: 74, torso: 2, armA: 15, armB: 3, farArmA: 345, farArmB: 357, legA: 184, legB: 176 },
      },
      {
        at: 0.45,
        pose: { anchor: 'free', rootX: 78, rootY: 52, torso: 5, armA: 52, armB: 288, farArmA: 308, farArmB: 72, legA: 190, legB: 162 },
      },
      {
        at: 0.9,
        pose: { anchor: 'free', rootX: 78, rootY: 74, torso: 2, armA: 15, armB: 3, farArmA: 345, farArmB: 357, legA: 184, legB: 176 },
      },
    ],
  },

  pushup: {
    secs: 2.6,
    prop: 'none',
    alt: 'Ciało w jednej linii od pięt po kark, łokcie pod kątem do tułowia.',
    frames: [
      {
        at: 0,
        pose: { anchor: 'ground', rootX: 76, rootY: 100, torso: 290, head: 296, armA: 196, armB: 196, farArmA: 202, farArmB: 202, legA: 108, legB: 108, foot: 40 },
      },
      {
        at: 0.45,
        pose: { anchor: 'ground', rootX: 76, rootY: 112, torso: 290, head: 300, armA: 236, armB: 158, farArmA: 242, farArmB: 164, legA: 108, legB: 108, foot: 40 },
      },
      {
        at: 0.9,
        pose: { anchor: 'ground', rootX: 76, rootY: 100, torso: 290, head: 296, armA: 196, armB: 196, farArmA: 202, farArmB: 202, legA: 108, legB: 108, foot: 40 },
      },
    ],
  },

  dip: {
    secs: 2.8,
    prop: 'none',
    alt: 'Ciało pionowo między poręczami, łokcie zginają się do kąta prostego.',
    frames: [
      {
        at: 0,
        pose: { anchor: 'free', rootX: 78, rootY: 76, torso: 8, armA: 184, armB: 184, farArmA: 190, farArmB: 190, legA: 200, legB: 140, foot: 70 },
      },
      {
        at: 0.45,
        pose: { anchor: 'free', rootX: 78, rootY: 94, torso: 12, armA: 150, armB: 208, farArmA: 156, farArmB: 214, legA: 200, legB: 140, foot: 70 },
      },
      {
        at: 0.9,
        pose: { anchor: 'free', rootX: 78, rootY: 76, torso: 8, armA: 184, armB: 184, farArmA: 190, farArmB: 190, legA: 200, legB: 140, foot: 70 },
      },
    ],
  },

  curl: {
    secs: 2.6,
    prop: 'hands',
    alt: 'Łokcie przy tułowiu, ruch wychodzi tylko z przedramion.',
    frames: [
      { at: 0, pose: { armA: 178, armB: 178, farArmA: 184, farArmB: 184 } },
      { at: 0.45, pose: { armA: 174, armB: 46, farArmA: 180, farArmB: 52 } },
      { at: 0.9, pose: { armA: 178, armB: 178, farArmA: 184, farArmB: 184 } },
    ],
  },

  lateral: {
    secs: 2.6,
    prop: 'hands',
    alt: 'Ramiona idą bokiem do linii barków, bez bujania tułowiem.',
    frames: [
      { at: 0, pose: { armA: 172, armB: 172, farArmA: 188, farArmB: 188 } },
      { at: 0.45, pose: { armA: 96, armB: 92, farArmA: 264, farArmB: 268 } },
      { at: 0.9, pose: { armA: 172, armB: 172, farArmA: 188, farArmB: 188 } },
    ],
  },

  carry: {
    secs: 1.5,
    prop: 'hands',
    alt: 'Tułów pionowo, żebra w dole, krótkie kroki z napiętym brzuchem.',
    frames: [
      { at: 0, pose: { torso: 1, armA: 178, armB: 178, legA: 164, legB: 190, farLegA: 196, farLegB: 172, farFoot: 78 } },
      { at: 0.5, pose: { torso: 1, armA: 178, armB: 178, legA: 196, legB: 172, foot: 78, farLegA: 164, farLegB: 190, farFoot: 92 } },
      { at: 1, pose: { torso: 1, armA: 178, armB: 178, legA: 164, legB: 190, farLegA: 196, farLegB: 172, farFoot: 78 } },
    ],
  },

  plank: {
    secs: 4,
    prop: 'none',
    alt: 'Przedramiona na podłodze, pośladki napięte, ciało w jednej linii.',
    frames: [
      {
        at: 0,
        pose: { anchor: 'ground', rootX: 78, rootY: 104, torso: 288, head: 296, armA: 194, armB: 262, farArmA: 200, farArmB: 268, legA: 106, legB: 106, foot: 40 },
      },
      {
        at: 0.5,
        pose: { anchor: 'ground', rootX: 78, rootY: 102, torso: 286, head: 294, armA: 194, armB: 262, farArmA: 200, farArmB: 268, legA: 106, legB: 106, foot: 40 },
      },
      {
        at: 1,
        pose: { anchor: 'ground', rootX: 78, rootY: 104, torso: 288, head: 296, armA: 194, armB: 262, farArmA: 200, farArmB: 268, legA: 106, legB: 106, foot: 40 },
      },
    ],
  },

  crunch: {
    secs: 2.6,
    prop: 'none',
    alt: 'Lędźwie dociśnięte do podłogi, zwija się kręgosłup, nie biodra.',
    frames: [
      {
        at: 0,
        pose: { anchor: 'ground', rootX: 74, rootY: 112, torso: 268, head: 268, armA: 318, armB: 250, farArmA: 324, farArmB: 256, legA: 190, legB: 116, foot: 92 },
      },
      {
        at: 0.45,
        pose: { anchor: 'ground', rootX: 74, rootY: 112, torso: 300, head: 316, armA: 342, armB: 268, farArmA: 348, farArmB: 274, legA: 190, legB: 116, foot: 92 },
      },
      {
        at: 0.9,
        pose: { anchor: 'ground', rootX: 74, rootY: 112, torso: 268, head: 268, armA: 318, armB: 250, farArmA: 324, farArmB: 256, legA: 190, legB: 116, foot: 92 },
      },
    ],
  },

  calf: {
    secs: 2,
    prop: 'rack',
    alt: 'Pełne opuszczenie pięty, pauza w górze na palcach.',
    frames: [
      { at: 0, pose: { legA: 180, legB: 180, foot: 92, armA: 205, armB: 335, farArmA: 212, farArmB: 342 } },
      { at: 0.45, pose: { legA: 180, legB: 180, foot: 128, armA: 205, armB: 335, farArmA: 212, farArmB: 342 } },
      { at: 0.9, pose: { legA: 180, legB: 180, foot: 92, armA: 205, armB: 335, farArmA: 212, farArmB: 342 } },
    ],
  },

  legCurl: {
    secs: 2.6,
    prop: 'none',
    alt: 'Biodra dociśnięte do oparcia, pięta jedzie do pośladka.',
    frames: [
      {
        at: 0,
        pose: { anchor: 'ground', rootX: 74, rootY: 110, torso: 276, head: 284, armA: 206, armB: 206, farArmA: 212, farArmB: 212, legA: 96, legB: 96, foot: 40 },
      },
      {
        at: 0.45,
        pose: { anchor: 'ground', rootX: 74, rootY: 110, torso: 276, head: 284, armA: 206, armB: 206, farArmA: 212, farArmB: 212, legA: 96, legB: 20, foot: 330 },
      },
      {
        at: 0.9,
        pose: { anchor: 'ground', rootX: 74, rootY: 110, torso: 276, head: 284, armA: 206, armB: 206, farArmA: 212, farArmB: 212, legA: 96, legB: 96, foot: 40 },
      },
    ],
  },

  legExtension: {
    secs: 2.6,
    prop: 'none',
    alt: 'Siedząc: kolano prostuje się do końca, pauza na szczycie.',
    frames: [
      {
        at: 0,
        pose: { anchor: 'free', rootX: 72, rootY: 86, torso: 4, armA: 150, armB: 120, farArmA: 156, farArmB: 126, legA: 96, legB: 180, foot: 92 },
      },
      {
        at: 0.45,
        pose: { anchor: 'free', rootX: 72, rootY: 86, torso: 4, armA: 150, armB: 120, farArmA: 156, farArmB: 126, legA: 96, legB: 96, foot: 40 },
      },
      {
        at: 0.9,
        pose: { anchor: 'free', rootX: 72, rootY: 86, torso: 4, armA: 150, armB: 120, farArmA: 156, farArmB: 126, legA: 96, legB: 180, foot: 92 },
      },
    ],
  },
};
