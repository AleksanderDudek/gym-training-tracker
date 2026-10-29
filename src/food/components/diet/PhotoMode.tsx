import { Camera, Check, Circle, Download, ImagePlus, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Segmented } from '../../../components/ui';
import { LOCALE, num, text } from '../../../i18n';
import { logFood } from '../../diet/store';
import { formatNumber } from '../../lib/format';
import { FAT_SCALE, SAUCE_SCALE, SWEET_SCALE, type Choices, type Dish, type FatLevel, type SauceLevel, type SweetLevel } from '../../photo/dishes';
import type { Food } from '../../diet/foods';
import { PHOTO_MODEL } from '../../photo/model';
import { NOT_FOOD_COS } from '../../photo/score';
import { checkModel, useModelState, type ModelState } from '../../photo/modelState';
import { clearCamera, clearRun, clearRunOnLeave, consumeRun, markCamera, markReading, pendingPhoto, type Interrupted } from '../../photo/pending';
import {
  PORTION_STEPS,
  gramsOf,
  itemEstimate,
  itemRange,
  likelyAlts,
  newItem,
  plateFood,
  plateTotal,
  portionWord,
  rememberItems,
  searchDishes,
  similarFoods,
  type PlateItem,
} from '../../photo/plate';
import { MODEL_MB, downloadModel, failureOf, preload, prepare, recognize, release, type Failure, type Progress, type Suggestion } from '../../photo/recognize';
import { useKcalShown } from './kcalShown';
import { PhotoCamera } from './PhotoCamera';

const MODEL_FILE_MB = Math.round(PHOTO_MODEL.bytes / 1e6);

const T = text({
  pl: {
    lead: 'Zrób zdjęcie talerza — rozpoznam danie, a porcję i to, czego nie widać, ustawisz suwakiem i skalami.',
    take: 'Zrób zdjęcie',
    gallery: 'Z galerii',
    privacy: 'Zdjęcie zostaje w telefonie — nic nie jest wysyłane.',
    model: 'Model rozpoznawania',
    modelChecking: 'Sprawdzam, czy jest już w telefonie…',
    modelReady: `Jest w telefonie (${MODEL_FILE_MB} MB) — rozpoznawanie działa też bez internetu.`,
    modelDownloading: (pct: number | null, got: number | null) =>
      pct === null ? 'Pobieram…' : `Pobieram: ${pct}% (${got} z ${MODEL_FILE_MB} MB).`,
    modelDownloadingNote: 'Zdjęcie zrobisz, gdy się pobierze. W międzyczasie możesz wyszukać danie poniżej.',
    modelMissing: (mb: number) => `Jeszcze go nie ma w telefonie (ok. ${mb} MB) — bez niego zdjęcie nie rozpozna dania.`,
    modelSaver: (mb: number) => `Jeszcze go nie ma w telefonie. Masz włączone oszczędzanie danych, więc nie pobieram sam ok. ${mb} MB.`,
    waitModel: (pct: number | null) => (pct === null ? 'Zdjęcie zrobisz, gdy model się pobierze.' : `Zdjęcie zrobisz, gdy model się pobierze (${pct}%).`),
    needModel: 'Najpierw pobierz model rozpoznawania — przycisk wyżej.',
    checkingModel: 'Sprawdzam model rozpoznawania…',
    modelOffline: 'Jeszcze go nie ma w telefonie, a teraz nie ma internetu. Pobiorę go, gdy sieć wróci.',
    modelFailed: (reason: 'offline' | 'storage' | 'error'): string =>
      reason === 'offline'
        ? 'Pobieranie przerwał brak internetu.'
        : reason === 'storage'
          ? 'Nie udało się zapisać modelu w telefonie — może brakuje miejsca.'
          : 'Pobieranie się nie udało.',
    modelUnsupported: (mb: number) => `Ta przeglądarka nie zatrzyma modelu na stałe — pobiorę go (ok. ${mb} MB) przy zdjęciu.`,
    download: (mb: number) => `Pobierz teraz (ok. ${mb} MB)`,
    retryDownload: 'Spróbuj ponownie',
    stepPhoto: 'Zdjęcie odebrane',
    stepModelWait: 'Czekam na model…',
    stepModelCopy: 'Wczytuję model z telefonu',
    stepModelNet: (pct: number | null) => (pct === null ? 'Pobieram model' : `Pobieram model: ${pct}%`),
    stepModelDone: 'Model gotowy',
    stepStart: 'Uruchamiam model (kilka sekund)',
    stepRead: 'Rozpoznaję danie',
    elapsed: (s: number) => `trwa ${s} s`,
    failed: (why: Failure): string =>
      why === 'offline'
        ? 'Bez internetu nie pobiorę modelu, a jeszcze go nie ma w telefonie. Spróbuj, gdy wróci sieć, albo wyszukaj danie poniżej.'
        : why === 'memory'
          ? 'Telefonowi zabrakło pamięci na model. Zamknij inne aplikacje i spróbuj ponownie albo wyszukaj danie poniżej.'
          : 'Nie udało się rozpoznać zdjęcia. Spróbuj ponownie albo wyszukaj danie poniżej.',
    details: 'Szczegóły',
    retry: 'Spróbuj ponownie',
    lostCamera:
      'Poprzednie zdjęcie do mnie nie dotarło — telefon zamknął aplikację, kiedy był otwarty aparat telefonu albo galeria. Zrób je jeszcze raz przyciskiem „Zrób zdjęcie”: aparat w aplikacji tego problemu nie ma.',
    lostReading: 'Analiza poprzedniego zdjęcia została przerwana — telefon zamknął aplikację, pewnie z braku pamięci.',
    lostAgain: (n: number) => `Przerwało się już ${n} razy z rzędu — na tym telefonie model może się nie mieścić w pamięci. Zamknij inne aplikacje albo wyszukaj danie poniżej.`,
    lostPhoto: 'Zdjęcie jest zachowane:',
    result: 'Wynik ze zdjęcia',
    sure: (name: string, pct: number) => `${name} — pewne (${pct}%)`,
    probably: (name: string, pct: number) => `Najpewniej ${name} (${pct}%)`,
    maybeAlso: (names: string) => `, może też: ${names}`,
    kind: (family: string) => `To chyba ${family} — rodzaj niepewny`,
    tentative: 'Wstępny szacunek — zakres obejmuje inne możliwe dania. Stuknij właściwe danie poniżej albo popraw porcję, a się zawęzi.',
    confirmedNote: 'Popraw porcję i to, czego nie widać, a szacunek będzie bliżej prawdy.',
    notFood: 'Na tym zdjęciu nie widzę jedzenia. Zrób zdjęcie talerza z bliska, z góry i w dobrym świetle — albo wyszukaj danie poniżej.',
    showAnyway: 'To jednak jedzenie — pokaż propozycje',
    otherDish: 'Inne możliwe dania — stuknij właściwe:',
    otherSure: 'Jeśli to coś innego, stuknij właściwe:',
    addMore: 'Co jeszcze jest na talerzu? Stuknij wszystko, co widać.',
    totalBig: (kcal: string) => `ok. ${kcal} kcal`,
    range: (low: string, high: string) => `${low}–${high} kcal`,
    tentativeTag: 'wstępnie',
    refSummary: (n: number, low: string, high: string, own: string) => `Podobne w bazie (${n}): ${low === high ? low : `${low}–${high}`} kcal/100 g · to danie ${own}`,
    refSummaryMacros: (n: number) => `Podobne w bazie (${n})`,
    refNone: 'W bazie nie ma nic o podobnej nazwie.',
    refLoading: 'Szukam podobnych w bazie produktów…',
    refPer100: (kcal: string) => `${kcal} kcal/100 g`,
    refUse: 'Użyj',
    refUsing: (name: string) => `Liczę z wartości: ${name}`,
    refBack: 'Wróć do wartości dania',
    refUseLabel: (name: string) => `Użyj wartości: ${name}`,
    searchLabel: 'Szukaj dania',
    searchPlaceholder: 'np. pierogi, pad thai, sałatka grecka',
    nothing: 'Nie znam takiego dania — spróbuj innej nazwy albo dodaj je w „Szukaj”.',
    photo: 'Zdjęcie posiłku',
    newPhoto: 'Inne zdjęcie',
    plate: 'Na talerzu',
    remove: (name: string) => `Usuń ${name}`,
    portion: 'Porcja',
    portionText: (n: string, g: number, word: string) => `${n} × porcja · ${g} g · ${word}`,
    estimate: (kcal: string, low: string, high: string) => `ok. ${kcal} kcal (${low}–${high})`,
    chipKcal: (kcal: string) => `${kcal} kcal`,
    macros: (p: string, c: string, f: string) => `B ${p} g · W ${c} g · T ${f} g`,
    total: 'Razem',
    add: (n: number) => (n > 1 ? `Dodaj ${n} pozycje` : 'Dodaj do dziennika'),
    saveFailed: 'Nie udało się zapisać. To, co zostało na talerzu, nie jest jeszcze w dzienniku — spróbuj ponownie.',
    saved: (n: number, kcal: string | null) => `Zapisano ${n > 1 ? `${n} pozycje` : 'posiłek'} ze zdjęcia${kcal ? ` — ok. ${kcal} kcal` : ''}.`,
    why: 'Wartości z bazy dań (USDA). Najbardziej zmienia je porcja i tłuszcz — ustaw je, a szacunek będzie bliżej prawdy.',
  },
  en: {
    lead: 'Take a photo of the plate — I’ll recognise the dish, and you set the portion and what a photo can’t show with a slider and scales.',
    take: 'Take a photo',
    gallery: 'From gallery',
    privacy: 'The photo stays on your phone — nothing is sent anywhere.',
    model: 'Recognition model',
    modelChecking: 'Checking whether it is on the phone…',
    modelReady: `On the phone (${MODEL_FILE_MB} MB) — recognition also works offline.`,
    modelDownloading: (pct: number | null, got: number | null) =>
      pct === null ? 'Downloading…' : `Downloading: ${pct}% (${got} of ${MODEL_FILE_MB} MB).`,
    modelDownloadingNote: 'You can take the photo once it is downloaded. Meanwhile you can search for the dish below.',
    modelMissing: (mb: number) => `Not on the phone yet (about ${mb} MB) — without it a photo can’t recognise the dish.`,
    modelSaver: (mb: number) => `Not on the phone yet. Data saver is on, so I don’t download about ${mb} MB by myself.`,
    waitModel: (pct: number | null) => (pct === null ? 'You can take the photo once the model is downloaded.' : `You can take the photo once the model is downloaded (${pct}%).`),
    needModel: 'Download the recognition model first — the button above.',
    checkingModel: 'Checking the recognition model…',
    modelOffline: 'Not on the phone yet, and there is no internet right now. I’ll download it when the connection is back.',
    modelFailed: (reason: 'offline' | 'storage' | 'error') =>
      reason === 'offline'
        ? 'The download stopped: no internet.'
        : reason === 'storage'
          ? 'Couldn’t keep the model on the phone — maybe it is out of space.'
          : 'The download failed.',
    modelUnsupported: (mb: number) => `This browser won’t keep the model — I’ll download it (about ${mb} MB) with the photo.`,
    download: (mb: number) => `Download now (about ${mb} MB)`,
    retryDownload: 'Try again',
    stepPhoto: 'Photo received',
    stepModelWait: 'Waiting for the model…',
    stepModelCopy: 'Loading the model from the phone',
    stepModelNet: (pct: number | null) => (pct === null ? 'Downloading the model' : `Downloading the model: ${pct}%`),
    stepModelDone: 'Model ready',
    stepStart: 'Starting the model (a few seconds)',
    stepRead: 'Recognising the dish',
    elapsed: (s: number) => `${s} s so far`,
    failed: (why: Failure) =>
      why === 'offline'
        ? 'Without internet I can’t download the model, and it isn’t on the phone yet. Try again when you’re online, or search for the dish below.'
        : why === 'memory'
          ? 'The phone ran out of memory for the model. Close other apps and try again, or search for the dish below.'
          : 'Couldn’t recognise the photo. Try again, or search for the dish below.',
    details: 'Details',
    retry: 'Try again',
    lostCamera:
      'The last photo never reached me — the phone closed the app while its camera or gallery was open. Take it again with “Take a photo”: the camera inside the app doesn’t have this problem.',
    lostReading: 'The analysis of the last photo was cut short — the phone closed the app, probably for lack of memory.',
    lostAgain: (n: number) => `It has stopped ${n} times in a row — the model may not fit in this phone’s memory. Close other apps, or search for the dish below.`,
    lostPhoto: 'The photo is kept:',
    result: 'Result from the photo',
    sure: (name: string, pct: number) => `${name} — sure (${pct}%)`,
    probably: (name: string, pct: number) => `Most likely ${name} (${pct}%)`,
    maybeAlso: (names: string) => `, could also be: ${names}`,
    kind: (family: string) => `Looks like ${family} — the kind is unsure`,
    tentative: 'A first estimate — the range covers the other possible dishes. Tap the right dish below or set the portion, and it narrows.',
    confirmedNote: 'Set the portion and what a photo can’t show, and the estimate gets closer to the truth.',
    notFood: 'I don’t see food in this photo. Take a close photo of the plate from above in good light — or search for the dish below.',
    showAnyway: 'It is food — show suggestions',
    otherDish: 'Other possible dishes — tap the right one:',
    otherSure: 'If it’s something else, tap the right one:',
    addMore: 'What else is on the plate? Tap everything you see.',
    totalBig: (kcal: string) => `about ${kcal} kcal`,
    range: (low: string, high: string) => `${low}–${high} kcal`,
    tentativeTag: 'first guess',
    refSummary: (n: number, low: string, high: string, own: string) => `Similar in the database (${n}): ${low === high ? low : `${low}–${high}`} kcal/100 g · this dish ${own}`,
    refSummaryMacros: (n: number) => `Similar in the database (${n})`,
    refNone: 'Nothing with a similar name in the database.',
    refLoading: 'Looking for similar foods in the product database…',
    refPer100: (kcal: string) => `${kcal} kcal/100 g`,
    refUse: 'Use',
    refUsing: (name: string) => `Counted from: ${name}`,
    refBack: 'Back to the dish’s values',
    refUseLabel: (name: string) => `Use the values of ${name}`,
    searchLabel: 'Search dishes',
    searchPlaceholder: 'e.g. pierogi, pad thai, Greek salad',
    nothing: 'I don’t know that dish — try another name or add it in “Search”.',
    photo: 'Meal photo',
    newPhoto: 'Another photo',
    plate: 'On the plate',
    remove: (name: string) => `Remove ${name}`,
    portion: 'Portion',
    portionText: (n: string, g: number, word: string) => `${n} × portion · ${g} g · ${word}`,
    estimate: (kcal: string, low: string, high: string) => `about ${kcal} kcal (${low}–${high})`,
    chipKcal: (kcal: string) => `${kcal} kcal`,
    macros: (p: string, c: string, f: string) => `P ${p} g · C ${c} g · F ${f} g`,
    total: 'Total',
    add: (n: number) => (n > 1 ? `Add ${n} items` : 'Add to the diary'),
    saveFailed: 'Couldn’t save. What is still on the plate is not in the diary yet — try again.',
    saved: (n: number, kcal: string | null) => `Saved ${n > 1 ? `${n} items` : 'the meal'} from the photo${kcal ? ` — about ${kcal} kcal` : ''}.`,
    why: 'Values from a dish database (USDA). Portion and fat change them most — set those and the estimate gets closer to the truth.',
  },
});

/**
 * From this top probability the first dish leads and goes straight onto the plate. Measured on 904
 * test photos: 73 % of them reach it and 93 % of those are right; below 0.4 the first guess is right
 * only a third of the time.
 */
const SURE_SCORE = 0.6;

/**
 * „Pierogi ruskie” 0.4, „Pierogi z mięsem” 0.3: the dish is clear, only its kind is not. The family is
 * the first word of the name; when the dishes sharing it with the first one reach `SURE_SCORE`
 * together, the screen says so instead of „not sure”.
 */
function family(suggestions: readonly Suggestion[]): string | null {
  const word = (s: Suggestion) => s.dish.label.split(' ')[0]!.toLocaleLowerCase(LOCALE);
  const first = suggestions[0];
  if (!first || suggestions.filter((s) => word(s) === word(first)).length < 2) return null;
  const sum = suggestions.reduce((t, s) => t + (word(s) === word(first) ? s.score : 0), 0);
  return sum >= SURE_SCORE ? word(first) : null;
}

type Stage =
  | { kind: 'start' }
  | { kind: 'working'; progress: Progress; since: number }
  /** `notFood`: no dish fits at all (`NOT_FOOD_COS`) — until the person says it is food after all. */
  | { kind: 'done'; suggestions: Suggestion[]; notFood: boolean }
  | { kind: 'failed'; why: Failure; detail: string }
  /** The app was closed by the phone last time (`pending.ts`). */
  | { kind: 'interrupted'; at: Interrupted['stage']; tries: number };

const pct = (share: number | null) => (share === null ? null : Math.round(share * 100));

interface Props {
  date: string;
  /** The last photo run was cut short by the system (the app started again); says so on open. */
  resume?: Interrupted | null;
  /** The diary's search over products, recipes, menus and own foods: „Podobne w bazie” for each dish. */
  find?: (query: string) => readonly Food[];
  /** The product database is still loading: „nothing similar” would not be true yet. */
  findLoading?: boolean;
  onLogged: (text: string) => void;
  onDone: () => void;
}

export function PhotoMode({ date, resume = null, find, findLoading = false, onLogged, onDone }: Props) {
  const shown = useKcalShown();
  const model = useModelState();
  const [stage, setStage] = useState<Stage>(resume ? { kind: 'interrupted', at: resume.stage, tries: resume.tries } : { kind: 'start' });
  const [file, setFile] = useState<Blob | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<PlateItem[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const run = useRef(0);
  const mounted = useRef(true);
  /** The in-app viewfinder is open. */
  const [viewfinder, setViewfinder] = useState(false);
  /** The first interrupted analysis is retried by itself, once (`2026-10-29-zdjecie-aparat-design.md`). */
  const autoRetry = useRef(resume?.stage === 'reading' && resume.tries === 1);
  /** Analyses in a row the phone cut short: carried into the next marker, back to 0 after a result. */
  const tries = useRef(resume?.tries ?? 0);
  /** The kept photo has been read (or there is none): from now on closing the sheet may delete it. */
  const settled = useRef(resume?.stage !== 'reading');
  const ids = useId();

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);
  // Told once: the next start does not open the sheet with the same story.
  useEffect(() => {
    if (resume) consumeRun();
  }, [resume]);
  useEffect(() => {
    // The counter itself, not a node: the clean-up moves it on so a photo still on its way stops.
    const runs = run;
    mounted.current = true;
    clearRunOnLeave();
    void checkModel();
    // The model holds about 0.2 GB; it goes with the screen and comes back from the cache.
    // Closing the sheet is a normal ending: nothing to recover next time, and a photo still on its
    // way to the model (`markReading` takes a moment) must not start it after this.
    return () => {
      mounted.current = false;
      runs.current++;
      release();
      if (settled.current) clearRun();
    };
  }, []);

  // The photo the phone's crash left behind: shown, ready for „Spróbuj ponownie”.
  useEffect(() => {
    if (resume?.stage !== 'reading') return;
    let live = true;
    void pendingPhoto().then((kept) => {
      if (!live) return;
      settled.current = true;
      if (!kept) return;
      setFile(kept);
      setPhoto(URL.createObjectURL(kept));
    });
    return () => {
      live = false;
    };
  }, [resume]);

  // A cancelled camera or gallery is not a crash, and neither is any return to the page: a page the
  // phone killed comes back as a new start, not as `focus`. (Older Safari fires no `cancel`.) A photo
  // that does arrive writes its own marker.
  useEffect(() => {
    const inputs = [camera.current, gallery.current];
    const back = () => {
      if (document.visibilityState === 'visible') clearCamera();
    };
    inputs.forEach((i) => i?.addEventListener('cancel', clearCamera));
    addEventListener('focus', back);
    document.addEventListener('visibilitychange', back);
    return () => {
      inputs.forEach((i) => i?.removeEventListener('cancel', clearCamera));
      removeEventListener('focus', back);
      document.removeEventListener('visibilitychange', back);
    };
  }, []);

  // The answer may sit below the fold of the sheet; bring it into view once.
  useEffect(() => {
    if (stage.kind === 'done' || stage.kind === 'failed') result.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [stage.kind]);

  const onFile = async (image: Blob) => {
    const mine = ++run.current;
    settled.current = true;
    setFile(image);
    setPhoto(URL.createObjectURL(image));
    setStage({ kind: 'working', progress: { step: 'load', share: null }, since: Date.now() });
    await markReading(image, tries.current);
    // A newer photo or a closed sheet came first; a closed sheet's clean-up ran before the photo was kept.
    if (mine !== run.current) {
      if (!mounted.current) clearRun();
      return;
    }
    try {
      const suggestions = await recognize(image, (progress) => mine === run.current && setStage((s) => (s.kind === 'working' ? { ...s, progress } : s)));
      if (mine !== run.current) return;
      tries.current = 0;
      clearRun();
      const notFood = !suggestions.length || (suggestions[0]!.cos ?? 1) < NOT_FOOD_COS;
      setStage({ kind: 'done', suggestions, notFood });
      // A guess from an earlier photo stays on the plate as it is: this photo's chips are about this photo.
      setItems((list) => list.map((i) => (i.alts ? { ...i, alts: undefined } : i)));
      if (!notFood) place(suggestions);
    } catch (e) {
      // A newer photo or a closed screen ended this one; only the current photo's failure is news.
      if (mine !== run.current) return;
      console.error(e);
      tries.current = 0;
      clearRun();
      setStage({ kind: 'failed', why: failureOf(e), detail: e instanceof Error ? e.message : String(e) });
    }
  };

  // Photos only once the model is on the phone (or where it cannot be kept at all and comes with each photo).
  const canShoot = model.kind === 'ready' || model.kind === 'unsupported';

  /** The in-app camera; the model goes into memory while the person frames the shot. */
  const openCamera = () => {
    setViewfinder(true);
    if (model.kind === 'ready') preload();
  };

  // The phone's camera app or the gallery: the browser goes to the background, so only the download
  // (not the model itself) may start, and a marker is left in case the phone closes the page.
  const pick = (input: HTMLInputElement | null) => {
    // A photo already in the model keeps its marker until another one arrives.
    if (stage.kind !== 'working') markCamera(tries.current);
    input?.click();
    try {
      prepare();
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * The first dish goes onto the plate at once, so kcal and macros show without a tap. Not sure:
   * as a first guess (`alts`), its range covering the other likely dishes.
   */
  const place = (found: readonly Suggestion[]) => {
    const first = found[0];
    if (!first) return;
    const alts = first.score >= SURE_SCORE ? undefined : likelyAlts(found);
    setItems((list) => (list.some((i) => i.dish.id === first.dish.id) ? list : [...list, { ...newItem(first.dish), ...(alts && { alts }) }]));
  };

  const toggle = (dish: Dish) =>
    setItems((list) => (list.some((i) => i.dish.id === dish.id) ? list.filter((i) => i.dish.id !== dish.id) : [...list, newItem(dish)]));
  /** A suggestion tapped while the model's first guess is unconfirmed: the right dish replaces the guess. */
  const choose = (dish: Dish) =>
    setItems((list) => {
      const guess = list.findIndex((i) => i.alts);
      const on = list.some((i) => i.dish.id === dish.id);
      // „Stuknij właściwe”: the guess itself is confirmed, another dish takes its place.
      if (guess >= 0 && list[guess]!.dish.id === dish.id) return list.map((i, n) => (n === guess ? { ...i, alts: undefined } : i));
      if (guess >= 0 && !on) return list.map((i, n) => (n === guess ? newItem(dish) : i));
      return on ? list.filter((i) => i.dish.id !== dish.id) : [...list, newItem(dish)];
    });
  // Touching an item confirms it: it is no longer only the model's guess.
  const update = (id: string, patch: Partial<PlateItem>) =>
    setItems((list) => list.map((i) => (i.dish.id === id ? { ...i, ...patch, alts: undefined } : i)));

  const found = useMemo(() => searchDishes(query), [query]);
  const total = items.length ? plateTotal(items) : null;
  const notFood = stage.kind === 'done' && stage.notFood;
  const suggestions = stage.kind === 'done' && !notFood ? stage.suggestions : [];
  const lead = suggestions[0];
  const sure = (lead?.score ?? 0) >= SURE_SCORE;
  const kind = sure ? null : family(suggestions);
  const guessing = items.some((i) => i.alts);
  const showAnyway = () => {
    if (stage.kind !== 'done') return;
    setStage({ ...stage, notFood: false });
    place(stage.suggestions);
  };

  // The kept photo of an analysis the phone cut short goes back to the model by itself, once.
  useEffect(() => {
    if (!autoRetry.current || !file || stage.kind !== 'interrupted' || model.kind !== 'ready') return;
    autoRetry.current = false;
    void onFile(file);
  });

  const save = async () => {
    if (busy || !items.length) return;
    setBusy(true);
    setSaveFailed(false);
    let logged = 0;
    try {
      for (const item of items) {
        await logFood(date, plateFood(item));
        logged++;
      }
      rememberItems(items);
      onLogged(T.saved(items.length, shown && total ? formatNumber(total.kcal, 0) : null));
      onDone();
    } catch (e) {
      // What was saved leaves the plate, so „Dodaj” again does not log it twice.
      console.error(e);
      rememberItems(items.slice(0, logged));
      setItems(items.slice(logged));
      setSaveFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const chip = (dish: Dish, isLead = false, suggested = false) => {
    const on = items.some((i) => i.dish.id === dish.id);
    return (
      <li key={dish.id}>
        <button
          type="button"
          className={`fd-diet-dish${on ? ' fd-diet-dish-on' : ''}${isLead ? ' fd-diet-dish-lead' : ''}`}
          aria-pressed={on}
          onClick={() => (suggested ? choose(dish) : toggle(dish))}
        >
          {on && <Check aria-hidden="true" size={14} />}
          {dish.label}
          {shown && <span className="fd-diet-dish-kcal">{T.chipKcal(formatNumber(itemEstimate(newItem(dish)).kcal, 0))}</span>}
        </button>
      </li>
    );
  };

  const question = () => (guessing ? T.otherDish : items.length > 1 ? T.addMore : sure ? T.otherSure : T.addMore);

  /** What the model saw, in one line. */
  const verdict = () => {
    if (!lead) return '';
    if (sure) return T.sure(lead.dish.label, pct(lead.score)!);
    if (kind) return T.kind(kind);
    const alts = likelyAlts(suggestions).map((d) => d.label.toLocaleLowerCase(LOCALE));
    return T.probably(lead.dish.label, pct(lead.score)!) + (alts.length ? T.maybeAlso(alts.join(', ')) : '');
  };

  return (
    <div className="fd-diet-photo">
      {/* Once the answer is here and the model is on the phone, the card would only push it down. */}
      {(model.kind !== 'ready' || (stage.kind === 'start' && !viewfinder && !items.length)) && <ModelCard />}
      {stage.kind === 'interrupted' && (
        <div className="fd-diet-photo-note" role="alert">
          <p>{stage.at === 'camera' ? T.lostCamera : T.lostReading}</p>
          {stage.at === 'reading' && stage.tries >= 2 && <p>{T.lostAgain(stage.tries)}</p>}
          {stage.at === 'reading' && file && <p>{T.lostPhoto}</p>}
        </div>
      )}
      {stage.kind === 'start' && !items.length && <p className="fd-diet-hint">{T.lead}</p>}
      {viewfinder ? (
        <PhotoCamera
          onShot={(shot) => {
            setViewfinder(false);
            void onFile(shot);
          }}
          onSystemCamera={() => {
            setViewfinder(false);
            pick(camera.current);
          }}
          onGallery={() => {
            setViewfinder(false);
            pick(gallery.current);
          }}
          onCancel={() => setViewfinder(false)}
        />
      ) : (
        <div className="fd-diet-photo-row">
          {photo && <img className="fd-diet-photo-img" src={photo} alt={T.photo} />}
          <div className="fd-diet-photo-btns">
            {file && (stage.kind === 'failed' || stage.kind === 'interrupted') && (
              <button type="button" className="btn sm" disabled={!canShoot} onClick={() => void onFile(file)}>
                <RotateCcw aria-hidden="true" size={18} /> {T.retry}
              </button>
            )}
            <button
              type="button"
              className={file && (stage.kind === 'failed' || stage.kind === 'interrupted') ? 'btn ghost sm' : 'btn sm'}
              disabled={!canShoot || stage.kind === 'working'}
              onClick={openCamera}
            >
              <Camera aria-hidden="true" size={18} /> {photo ? T.newPhoto : T.take}
            </button>
            <button type="button" className="btn ghost sm" disabled={!canShoot || stage.kind === 'working'} onClick={() => pick(gallery.current)}>
              <ImagePlus aria-hidden="true" size={18} /> {T.gallery}
            </button>
          </div>
          {!canShoot && (
            <p className="fd-diet-meta fd-diet-photo-wait">
              {model.kind === 'downloading' ? T.waitModel(pct(model.share)) : model.kind === 'unknown' ? T.checkingModel : T.needModel}
            </p>
          )}
        </div>
      )}
      {/* Dwa pola: jedno otwiera od razu aparat (tylne), drugie galerię — zrzut ekranu z menu też się liczy. */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFile(e, onFile)} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => pickFile(e, onFile)} />
      {stage.kind === 'start' && <p className="fd-diet-meta">{T.privacy}</p>}

      {stage.kind === 'working' && <Steps progress={stage.progress} since={stage.since} />}
      <div ref={result} className="fd-diet-photo-result">
        {stage.kind === 'failed' && (
          <div role="alert">
            <p className="fd-diet-hint">{T.failed(stage.why)}</p>
            <details className="fd-diet-meta">
              <summary>{T.details}</summary>
              {stage.detail}
            </details>
          </div>
        )}
        {notFood && (
          <div className="fd-diet-answer" role="status">
            <p className="fd-diet-answer-what">{T.notFood}</p>
            {stage.kind === 'done' && stage.suggestions.length > 0 && (
              <button type="button" className="btn ghost sm" onClick={showAnyway}>
                {T.showAnyway}
              </button>
            )}
          </div>
        )}
        {suggestions.length > 0 && (
          <>
            <section className="fd-diet-answer" aria-label={T.result}>
              <p className="fd-diet-answer-what" role="status">
                {verdict()}
              </p>
              {total && (
                <>
                  {shown && (
                    <p className="fd-diet-answer-kcal">
                      <b>{T.totalBig(formatNumber(total.kcal, 0))}</b> <span>{T.range(formatNumber(total.low, 0), formatNumber(total.high, 0))}</span>
                    </p>
                  )}
                  <p className="fd-diet-answer-macros">{T.macros(num(total.protein), num(total.carbs), num(total.fat))}</p>
                  <p className="fd-diet-meta">{guessing ? T.tentative : T.confirmedNote}</p>
                </>
              )}
            </section>
            <p className="fd-diet-hint">{question()}</p>
            <ul className="fd-diet-dishes">{suggestions.map((s, i) => chip(s.dish, i === 0 && sure, true))}</ul>
          </>
        )}
      </div>

      <label className="fld fd-diet-dish-search" htmlFor={`${ids}-q`}>
        <span>{T.searchLabel}</span>
        <input id={`${ids}-q`} type="search" value={query} placeholder={T.searchPlaceholder} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
      </label>
      {query.trim() && (found.length ? <ul className="fd-diet-dishes">{found.map((d) => chip(d))}</ul> : <p className="fd-diet-meta">{T.nothing}</p>)}

      {items.length > 0 && (
        <section className="fd-diet-plate" aria-labelledby={`${ids}-plate`}>
          <h3 id={`${ids}-plate`} className="fd-diet-group">
            {T.plate}
          </h3>
          <ul className="fd-diet-plate-list">
            {items.map((item) => (
              <PlateRow key={item.dish.id} item={item} shown={shown} find={find} findLoading={findLoading} onChange={(p) => update(item.dish.id, p)} onRemove={() => toggle(item.dish)} />
            ))}
          </ul>
          {total && items.length > 1 && (
            <p className="fd-diet-plate-total">
              <b>{T.total}:</b>{' '}
              {shown ? T.estimate(formatNumber(total.kcal, 0), formatNumber(total.low, 0), formatNumber(total.high, 0)) : ''}
              {shown ? ' · ' : ''}
              {T.macros(num(total.protein), num(total.carbs), num(total.fat))}
            </p>
          )}
          <p className="fd-diet-meta">{T.why}</p>
          {saveFailed && (
            <p className="fd-diet-hint" role="alert">
              {T.saveFailed}
            </p>
          )}
          <button type="button" className="btn wide" disabled={busy} onClick={() => void save()}>
            {T.add(items.length)}
          </button>
        </section>
      )}
    </div>
  );
}

/** Where the model stands on this phone, and the button to fetch it when it is not there. */
function ModelCard() {
  const state = useModelState();
  // The card itself shows how it went; the promise has nothing to add.
  const fetchNow = () => void downloadModel().catch(() => undefined);
  // Without the model there is no photo, so fetching it is the screen's main action.
  const button = (label: string) => (
    <button type="button" className="btn sm" onClick={fetchNow}>
      <Download aria-hidden="true" size={18} /> {label}
    </button>
  );
  return (
    <section className="fd-diet-model" aria-label={T.model}>
      {/* Changes of state are announced, not every percent. */}
      <span className="sr-only" role="status">
        {state.kind === 'downloading' ? T.modelDownloading(null, null) : modelLine(state)}
      </span>
      <p className="fd-diet-model-line" aria-hidden="true">
        <ModelIcon state={state} />
        <span>
          <b>{T.model}:</b> {modelLine(state)}
        </span>
      </p>
      {state.kind === 'downloading' && (
        <>
          <progress
            className="fd-diet-model-bar"
            max={1}
            value={state.share ?? undefined}
            aria-label={T.model}
            aria-valuetext={modelLine(state)}
          />
          <p className="fd-diet-meta">{T.modelDownloadingNote}</p>
        </>
      )}
      {state.kind === 'missing' && state.wait !== 'offline' && button(T.download(MODEL_MB))}
      {state.kind === 'failed' && button(T.retryDownload)}
    </section>
  );
}

function modelLine(state: ModelState): string {
  switch (state.kind) {
    case 'unknown':
      return T.modelChecking;
    case 'ready':
      return T.modelReady;
    case 'downloading':
      return T.modelDownloading(pct(state.share), state.share === null ? null : Math.round((state.share * PHOTO_MODEL.bytes) / 1e6));
    case 'missing':
      return state.wait === 'saver' ? T.modelSaver(MODEL_MB) : state.wait === 'offline' ? T.modelOffline : T.modelMissing(MODEL_MB);
    case 'failed':
      return T.modelFailed(state.reason);
    case 'unsupported':
      return T.modelUnsupported(MODEL_MB);
  }
}

function ModelIcon({ state }: { state: ModelState }) {
  if (state.kind === 'ready') return <Check aria-hidden="true" size={16} className="fd-diet-model-ok" />;
  if (state.kind === 'downloading' || state.kind === 'unknown') return <LoaderCircle aria-hidden="true" size={16} className="fd-spin" />;
  return <Download aria-hidden="true" size={16} />;
}

type StepState = 'done' | 'now' | 'todo';

/** What happens to the photo, step by step, with the clock running. */
function Steps({ progress, since }: { progress: Progress; since: number }) {
  const model = useModelState();
  // Seconds on the clock: a slow phone should not look like a hung one.
  const [now, setNow] = useState(since);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const order = { load: 0, start: 1, read: 2 } as const;
  const at = order[progress.step];
  const of = (i: number): StepState => (i < at ? 'done' : i === at ? 'now' : 'todo');
  // The photo may wait for the background download, whose progress the shared state carries.
  const share = progress.source === 'network' ? progress.share : model.kind === 'downloading' ? model.share : null;
  const modelText =
    at > 0
      ? T.stepModelDone
      : progress.source === 'copy' || (!progress.source && model.kind === 'ready')
        ? T.stepModelCopy
        : progress.source === 'network' || model.kind === 'downloading'
          ? T.stepModelNet(pct(share))
          : T.stepModelWait;
  const seconds = Math.floor((now - since) / 1000);
  const steps: [string, StepState][] = [
    [T.stepPhoto, 'done'],
    [modelText, of(0)],
    [T.stepStart, of(1)],
    [T.stepRead, of(2)],
  ];
  return (
    <div className="fd-diet-steps">
      <ol role="status">
        {steps.map(([label, s], i) => (
          <li key={i} className={`fd-diet-step-${s}`}>
            {s === 'done' ? (
              <Check aria-hidden="true" size={16} />
            ) : s === 'now' ? (
              <LoaderCircle aria-hidden="true" size={16} className="fd-spin" />
            ) : (
              <Circle aria-hidden="true" size={16} />
            )}
            {label}
          </li>
        ))}
      </ol>
      {seconds >= 3 && <p className="fd-diet-meta">{T.elapsed(seconds)}</p>}
    </div>
  );
}

function pickFile(e: React.ChangeEvent<HTMLInputElement>, onFile: (f: File) => Promise<void>) {
  const file = e.currentTarget.files?.[0];
  e.currentTarget.value = '';
  if (file) void onFile(file);
}

interface RowProps {
  item: PlateItem;
  shown: boolean;
  find?: (query: string) => readonly Food[];
  findLoading: boolean;
  onChange: (p: Partial<PlateItem>) => void;
  onRemove: () => void;
}

function PlateRow({ item, shown, find, findLoading, onChange, onRemove }: RowProps) {
  const id = useId();
  const e = itemEstimate(item);
  const range = itemRange(item);
  const index = Math.max(0, PORTION_STEPS.indexOf(item.portion));
  const grams = gramsOf(item);
  const portionText = T.portionText(item.portion.toLocaleString(LOCALE, { maximumFractionDigits: 2 }), grams, portionWord(item.portion));
  const setChoice = (patch: Choices) => onChange({ choices: { ...item.choices, ...patch } });
  return (
    <li className="fd-diet-plate-item">
      <div className="fd-diet-chosen-head">
        <p className="fd-diet-name">
          {item.dish.label}
          {item.alts && <span className="fd-diet-tag">{T.tentativeTag}</span>}
        </p>
        <button type="button" className="btn ghost sm" onClick={onRemove} aria-label={T.remove(item.dish.label)}>
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="fd-diet-portion">
        <label htmlFor={`${id}-p`}>{T.portion}</label>
        <input
          id={`${id}-p`}
          type="range"
          min={0}
          max={PORTION_STEPS.length - 1}
          step={1}
          value={index}
          aria-valuetext={portionText}
          onChange={(ev) => onChange({ portion: PORTION_STEPS[Number(ev.target.value)]! })}
        />
        <span className="fd-diet-meta" aria-hidden="true">
          {portionText}
        </span>
      </div>
      {item.dish.adjust.fat && (
        <Scale label={FAT_SCALE.question} levels={FAT_SCALE.levels} value={item.choices.fat} onChange={(fat) => setChoice({ fat: fat as FatLevel })} />
      )}
      {item.dish.adjust.sweet && (
        <Scale label={SWEET_SCALE.question} levels={SWEET_SCALE.levels} value={item.choices.sweet} onChange={(sweet) => setChoice({ sweet: sweet as SweetLevel })} />
      )}
      {item.dish.adjust.sauce && (
        <Scale label={SAUCE_SCALE.question} levels={SAUCE_SCALE.levels} value={item.choices.sauce} onChange={(sauce) => setChoice({ sauce: sauce as SauceLevel })} />
      )}
      <p className="fd-diet-meta">
        {shown && <b>{T.estimate(formatNumber(e.kcal, 0), formatNumber(range.low, 0), formatNumber(range.high, 0))}</b>}
        {shown && ' · '}
        {T.macros(num(e.protein), num(e.carbs), num(e.fat))}
      </p>
      {find && <Similar item={item} shown={shown} find={find} findLoading={findLoading} onChange={onChange} />}
    </li>
  );
}

/** „Podobne w bazie”: foods with a similar name and their values, to check the estimate against — or count from. */
function Similar({ item, shown, find, findLoading, onChange }: Required<Pick<RowProps, 'item' | 'shown' | 'find' | 'findLoading' | 'onChange'>>) {
  const refs = useMemo(() => similarFoods(item.dish, find), [item.dish, find]);
  // Chosen values stay undoable even if the list has changed under them (the database loaded later).
  const using = item.ref && (
    <p className="fd-diet-ref-using">
      {T.refUsing(item.ref.name)}{' '}
      <button type="button" className="btn ghost sm" onClick={() => onChange({ ref: undefined })}>
        {T.refBack}
      </button>
    </p>
  );
  if (!refs.length)
    return (
      <>
        {using}
        <p className="fd-diet-meta">{findLoading ? T.refLoading : T.refNone}</p>
      </>
    );
  const kcals = refs.map((r) => r.per100.kcal);
  const summary = shown
    ? T.refSummary(refs.length, formatNumber(Math.min(...kcals), 0), formatNumber(Math.max(...kcals), 0), T.refPer100(formatNumber(item.dish.per100.kcal, 0)))
    : T.refSummaryMacros(refs.length);
  return (
    <details className="fd-diet-ref" open={!!item.ref}>
      <summary>{summary}</summary>
      {using}
      <ul className="fd-diet-ref-list">
        {refs.map((r) => (
          <li key={r.key}>
            <span>
              {r.name}
              <span className="fd-diet-meta">
                {' · '}
                {shown ? T.refPer100(formatNumber(r.per100.kcal, 0)) : T.macros(num(r.per100.protein), num(r.per100.carbs), num(r.per100.fat))}
                {r.detail ? ` · ${r.detail}` : ''}
              </span>
            </span>
            {item.ref?.key !== r.key && (
              <button type="button" className="btn ghost sm" aria-label={T.refUseLabel(r.name)} onClick={() => onChange({ ref: r })}>
                {T.refUse}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Scale({ label, levels, value, onChange }: { label: string; levels: readonly { id: string; label: string }[]; value: string | undefined; onChange: (v: string) => void }) {
  return (
    <div className="fd-diet-scale">
      <span className="seg-label">{label}</span>
      <Segmented<string> label={label} value={value ?? ''} options={levels.map((l) => ({ key: l.id, label: l.label }))} onChange={onChange} />
    </div>
  );
}
