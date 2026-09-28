import { EX, GEAR_LABEL, gearOf } from '../data/exercises';
import type { ExerciseId } from '../types';

/**
 * Wyszukiwanie ćwiczenia po nazwie — pod pole z podpowiedziami.
 *
 * Dwie rzeczy, bez których po polsku nie da się szukać:
 *
 * - **Kolejność według polskiego alfabetu.** Zwykłe sortowanie po kodach znaków wrzuca
 *   „Łydki” za „Zakroki”, a „Świecę” za wszystko inne. `Intl.Collator('pl')` stawia Ł po L
 *   i Ś po S, tak jak w słowniku.
 * - **Litery bez ogonków znaczą to samo co z ogonkami.** Na telefonie łatwiej wpisać
 *   „wioslowanie” niż „wiosłowanie”, więc porównanie idzie po literach sprowadzonych do
 *   podstawowych. Każda litera zamienia się na dokładnie jedną, dlatego pozycje dopasowania
 *   w uproszczonym tekście są tymi samymi pozycjami w oryginale — na nich stoi podświetlenie.
 */

const collator = new Intl.Collator('pl', { sensitivity: 'base' });

/** Jedna litera bez ogonka i małą. „Ł” nie rozkłada się w Unicode, więc idzie ręcznie. */
const plain = (ch: string): string => {
  const low = ch.toLowerCase();
  if (low === 'ł') return 'l';
  const base = low.normalize('NFD').replace(/\p{M}/gu, '');
  return base.length === 1 ? base : low;
};

/** Tekst do porównań: małe litery bez ogonków, ta sama długość co oryginał. */
export const fold = (s: string): string => [...s].map(plain).join('');

/** Wszystkie ćwiczenia w kolejności polskiego alfabetu. */
export const ALPHABETICAL: ExerciseId[] = Object.keys(EX).sort((a, b) =>
  collator.compare(EX[a]!.name, EX[b]!.name),
);

/** Fragment nazwy do podświetlenia: od której litery i ile. */
export interface Hit {
  start: number;
  length: number;
}

export interface Found {
  id: ExerciseId;
  /** Dopasowania w nazwie — puste, gdy ćwiczenie pasuje tylko sprzętem albo partią. */
  hits: Hit[];
}

/** Początki słów w tekście: po spacji, myślniku, ukośniku, nawiasie i dwukropku. */
const wordStarts = (text: string): number[] => {
  const out: number[] = [];
  [...text].forEach((ch, i) => {
    if (i === 0 || /[\s\-/(:+,.]/.test(text[i - 1]!)) {
      if (!/[\s\-/(:+,.]/.test(ch)) out.push(i);
    }
  });
  return out;
};

/**
 * Szuka po początkach słów: „pomp” znajduje wszystkie pompki, „hant” — ćwiczenia z hantlami,
 * „zawias” — całą partię. Każde wpisane słowo musi pasować do początku któregoś słowa
 * w nazwie, sprzęcie albo partii. Gdy tak nic nie wyjdzie, dopuszczamy dopasowanie
 * w środku słowa — lepsza szersza lista niż pusta.
 *
 * Wynik zostaje w kolejności alfabetycznej. Lista po wpisaniu dwóch liter ma zwykle kilka
 * pozycji, a stała kolejność pozwala znaleźć ćwiczenie wzrokiem bez czytania całości.
 */
export function findExercises(query: string): Found[] {
  const words = fold(query).split(/[\s,]+/).filter(Boolean);
  if (!words.length) return ALPHABETICAL.map((id) => ({ id, hits: [] }));

  const run = (anywhere: boolean): Found[] =>
    ALPHABETICAL.flatMap((id) => {
      const name = fold(EX[id]!.name);
      const extra = fold(`${EX[id]!.group} ${GEAR_LABEL[gearOf(id)]}`);
      const hits: Hit[] = [];
      const ok = words.every((w) => {
        const inName = anywhere
          ? [name.indexOf(w)].filter((i) => i >= 0)
          : wordStarts(name).filter((i) => name.startsWith(w, i));
        if (inName.length) {
          hits.push({ start: inName[0]!, length: w.length });
          return true;
        }
        return anywhere
          ? extra.includes(w)
          : wordStarts(extra).some((i) => extra.startsWith(w, i));
      });
      return ok ? [{ id, hits }] : [];
    });

  const strict = run(false);
  return strict.length ? strict : run(true);
}

/** Nazwa pocięta na kawałki zwykłe i podświetlone — pod `<mark>` w liście. */
export function splitHits(name: string, hits: Hit[]): { text: string; on: boolean }[] {
  const on = new Array<boolean>(name.length).fill(false);
  hits.forEach((h) => {
    for (let i = h.start; i < Math.min(name.length, h.start + h.length); i++) on[i] = true;
  });
  const out: { text: string; on: boolean }[] = [];
  [...name].forEach((ch, i) => {
    const last = out[out.length - 1];
    if (last && last.on === on[i]) last.text += ch;
    else out.push({ text: ch, on: on[i]! });
  });
  return out;
}
