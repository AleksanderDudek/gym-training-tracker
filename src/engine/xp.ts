import type { AppState } from '../types';
import { achievementById, bandFor } from './badges';
import { addDays, dayKey } from './schedule';
import { snacksOf } from './snacks';
import { minutesByDay } from './cardio';

/**
 * Punkty doświadczenia i poziom postaci.
 *
 * Punkty planu (`score.ts`) pilnują terminów i istnieją tylko przy uruchomionym planie.
 * Doświadczenie liczy każdy ruch — trening, przekąskę, zdobyty próg — także bez planu,
 * i z niego rośnie postać: goryl, który z czasem dochodzi do srebrnego grzbietu.
 *
 * Trzy zasady, z tych samych powodów co przy punktach planu:
 *
 * - **Obecność, nie objętość.** Trening daje stałą pulę, niezależnie od tonażu. Drugi
 *   trening tego samego dnia daje mało, bo te same wzorce dwa razy dziennie nie budują
 *   lepszej progresji — a doświadczenie za objętość rosłoby najszybciej tuż przed kontuzją.
 * - **Przekąski mają dzienny sufit.** Sześć dziennie daje doświadczenie, kolejne liczą się
 *   już tylko do odznak. Sens przekąsek to ruch rozłożony w ciągu dnia, a nie klikanie.
 * - **Kroki i cardio płacą za minuty ruchu, nie za liczby.** Minuta umiarkowana to punkt,
 *   intensywna — dwa, jak w zaleceniach WHO; dzienny sufit trzyma to poniżej treningu.
 *   Wpis jest ręczny i nikt go nie sprawdza, więc sufit jest też zabezpieczeniem przed zerem
 *   dopisanym przez pomyłkę.
 * - **Nic nie jest zapamiętane.** Suma liczy się od zera z dziennika, przekąsek i dat
 *   zdobycia odznak — nie ma licznika, który mógłby się rozjechać z historią po imporcie.
 */
export const XP = {
  /** Pierwszy zamknięty trening danego dnia. */
  workout: 100,
  /** Każdy kolejny trening tego samego dnia. */
  workoutAgain: 20,
  /** Przekąska ruchowa… */
  snack: 15,
  /** …ale tylko tyle przekąsek dziennie daje doświadczenie. */
  snackCap: 6,
  /** Minuta ruchu umiarkowanego z kroków i cardio (intensywna liczy się podwójnie)… */
  cardioPerMin: 1,
  /**
   * …do tylu punktów dziennie. Połowa treningu: 50 minut to z nawiązką dzienna porcja z WHO
   * (150–300 minut tygodniowo), a spacer nie może być wart więcej niż sesja, wokół której
   * zbudowana jest cała aplikacja.
   */
  cardioCap: 50,
  /** Próg odznaki według tworzywa: brąz, srebro, złoto, platyna, szmaragd. */
  band: [0, 20, 40, 80, 150, 300],
  /**
   * Odznaki ćwiczeń płacą połowę. Jest ich po cztery na każdy ruch, więc przy pełnej stawce
   * doświadczenie rosłoby głównie z tego, że ktoś robi dużo różnych ćwiczeń naraz.
   */
  exerciseShare: 0.5,
} as const;

export type XpSource = 'trening' | 'przekaska' | 'cardio' | 'odznaka';

/** Doświadczenie z kroków i cardio za jeden dzień z danej liczby minut ruchu. */
export const cardioXp = (minutes: number): number =>
  Math.min(XP.cardioCap, Math.floor(minutes * XP.cardioPerMin));

export interface XpItem {
  /** Dzień `yyyy-mm-dd`, w którym doświadczenie wpadło. */
  day: string;
  source: XpSource;
  xp: number;
}

/** Wszystkie źródła doświadczenia, każde z datą. */
export function xpItems(state: AppState): XpItem[] {
  const out: XpItem[] = [];

  const workouts = new Map<string, number>();
  [...state.log]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((e) => {
      const day = dayKey(e.date);
      const n = workouts.get(day) ?? 0;
      workouts.set(day, n + 1);
      out.push({ day, source: 'trening', xp: n === 0 ? XP.workout : XP.workoutAgain });
    });

  const snacks = new Map<string, number>();
  [...snacksOf(state)]
    .sort((a, b) => a.at.localeCompare(b.at))
    .forEach((s) => {
      const day = dayKey(s.at);
      const n = snacks.get(day) ?? 0;
      snacks.set(day, n + 1);
      out.push({ day, source: 'przekaska', xp: n < XP.snackCap ? XP.snack : 0 });
    });

  Object.entries(minutesByDay(state)).forEach(([day, min]) => {
    const xp = cardioXp(min);
    if (xp > 0) out.push({ day, source: 'cardio', xp });
  });

  // Klucz progu to `rodzina:numer`, a w rodzinie ćwiczenia samo id ma dwukropki
  // (`ex:pompki:dzien:2`) — dlatego numer odcinany jest od końca.
  Object.entries(state.award.badges).forEach(([key, day]) => {
    const cut = key.lastIndexOf(':');
    const a = achievementById(key.slice(0, cut));
    const tier = Number(key.slice(cut + 1));
    if (!a || !Number.isInteger(tier) || tier < 1 || tier > a.tiers.length) return;
    const base = XP.band[bandFor(tier, a.tiers.length)] ?? 0;
    out.push({
      day,
      source: 'odznaka',
      xp: a.group === 'cwiczenia' ? Math.round(base * XP.exerciseShare) : base,
    });
  });

  return out;
}

export interface XpSummary {
  total: number;
  today: number;
  /**
   * Dzisiejsze doświadczenie z samego ruchu — treningów, przekąsek, kroków i cardio. Próg odznaki bywa
   * dopisany dziś, choć ruch był wcześniej (upływ czasu, dopięcie po aktualizacji), więc
   * o tym, czy ktoś się dziś ruszał, mówi tylko ta liczba.
   */
  move: number;
  /** Ostatnie siedem dni razem z dzisiejszym. */
  week: number;
  parts: Record<XpSource, number>;
}

export function xpSummary(state: AppState, today: string = dayKey(Date.now())): XpSummary {
  const from = addDays(today, -6);
  const parts: Record<XpSource, number> = { trening: 0, przekaska: 0, cardio: 0, odznaka: 0 };
  let total = 0;
  let now = 0;
  let move = 0;
  let week = 0;
  xpItems(state).forEach((i) => {
    total += i.xp;
    parts[i.source] += i.xp;
    if (i.day === today) now += i.xp;
    if (i.day === today && i.source !== 'odznaka') move += i.xp;
    if (i.day >= from && i.day <= today) week += i.xp;
  });
  return { total, today: now, move, week, parts };
}

/** Ile przekąsek dziś jeszcze da doświadczenie. */
export const snackXpLeft = (state: AppState, today: string = dayKey(Date.now())): number =>
  Math.max(0, XP.snackCap - snacksOf(state).filter((s) => dayKey(s.at) === today).length);

/**
 * Ile doświadczenia trzeba mieć, żeby stać na danym poziomie. Przejście z poziomu n na n+1
 * kosztuje 100·n: pierwszy awans wypada po pierwszym treningu, dziesiąty po półtora
 * miesiąca regularnego ruchu, trzydziesty po mniej więcej roku.
 */
export const xpForLevel = (level: number): number => 50 * level * (level - 1);

/**
 * Tytuły postaci. Goryl dostaje srebrny grzbiet dopiero z wiekiem i doświadczeniem — ta sama
 * metafora, na której stoi cała obsada. Nazwy opisują goryla, nie człowieka: żart jest
 * o postaci, a nie o kimś, kto dopiero zaczyna.
 */
export const LEVEL_TITLES: readonly { at: number; name: string }[] = [
  { at: 1, name: 'Świeżo z dżungli' },
  { at: 3, name: 'Młode na lianie' },
  { at: 5, name: 'Podrostek z ambicjami' },
  { at: 8, name: 'Czarny grzbiet' },
  { at: 12, name: 'Pierwszy siwy włos' },
  { at: 16, name: 'Srebrny grzbiet' },
  { at: 20, name: 'Przywódca stada' },
  { at: 25, name: 'Postrach bananowca' },
  { at: 30, name: 'Legenda buszu' },
  { at: 40, name: 'Pomnik z bambusa' },
  { at: 50, name: 'Góra, która chodzi' },
];

export const titleFor = (level: number): string =>
  [...LEVEL_TITLES].reverse().find((t) => level >= t.at)?.name ?? LEVEL_TITLES[0]!.name;

export interface LevelState {
  level: number;
  title: string;
  xp: number;
  /** Doświadczenie, od którego zaczyna się bieżący poziom, i od którego zaczyna się następny. */
  floor: number;
  ceil: number;
  /** Postęp do kolejnego poziomu, 0–1. */
  progress: number;
  toNext: number;
  /** Najbliższy nowy tytuł i poziom, na którym wpada. */
  nextTitle: { level: number; name: string } | null;
}

export function levelFor(xp: number): LevelState {
  const x = Math.max(0, xp);
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * x)) / 2));
  // Pierwiastek bywa o włos za duży albo za mały — dwie poprawki zamiast zaufania do floatów.
  while (xpForLevel(level + 1) <= x) level++;
  while (level > 1 && xpForLevel(level) > x) level--;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const next = LEVEL_TITLES.find((t) => t.at > level);
  return {
    level,
    title: titleFor(level),
    xp: x,
    floor,
    ceil,
    progress: (x - floor) / (ceil - floor),
    toNext: ceil - x,
    nextTitle: next ? { level: next.at, name: next.name } : null,
  };
}
