import { Camera, Check, Circle, Download, ImagePlus, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Segmented } from '../../../components/ui';
import { LOCALE, num, text } from '../../../i18n';
import { logFood } from '../../diet/store';
import { formatNumber } from '../../lib/format';
import { FAT_SCALE, SAUCE_SCALE, SWEET_SCALE, type Choices, type Dish, type FatLevel, type SauceLevel, type SweetLevel } from '../../photo/dishes';
import { PHOTO_MODEL } from '../../photo/model';
import { checkModel, useModelState, type ModelState } from '../../photo/modelState';
import { clearRun, clearRunOnLeave, markCamera, markReading, pendingPhoto, type Interrupted } from '../../photo/pending';
import {
  PORTION_STEPS,
  gramsOf,
  itemEstimate,
  newItem,
  plateFood,
  plateTotal,
  portionWord,
  rememberItems,
  searchDishes,
  type PlateItem,
} from '../../photo/plate';
import { MODEL_MB, downloadModel, failureOf, prepare, recognize, release, type Failure, type Progress, type Suggestion } from '../../photo/recognize';
import { useKcalShown } from './kcalShown';

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
    modelDownloadingNote: 'Możesz już zrobić zdjęcie — poczeka na model.',
    modelMissing: (mb: number) => `Jeszcze go nie ma w telefonie (ok. ${mb} MB). Pobiorę go sam przy pierwszym zdjęciu albo od razu:`,
    modelMobile: (mb: number) =>
      `Jeszcze go nie ma w telefonie. Nie pobieram sam ok. ${mb} MB na danych komórkowych ani przy oszczędzaniu danych — zrobię to po połączeniu z Wi-Fi, przy pierwszym zdjęciu albo od razu:`,
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
      'Telefon zamknął aplikację, kiedy był otwarty aparat — tak zwalnia pamięć dla aparatu. Zdjęcie do mnie nie dotarło. Spróbuj jeszcze raz, a jeśli to się powtarza: zrób zdjęcie zwykłym aparatem i wybierz je przyciskiem „Z galerii”.',
    lostReading: 'Analiza poprzedniego zdjęcia została przerwana — telefon zamknął aplikację, pewnie z braku pamięci.',
    lostAgain: (n: number) => `Przerwało się już ${n} razy z rzędu — na tym telefonie model może się nie mieścić w pamięci. Zamknij inne aplikacje albo wyszukaj danie poniżej.`,
    lostPhoto: 'Zdjęcie jest zachowane:',
    sure: (name: string, pct: number) => `To chyba ${name} (${pct}%) — już na talerzu. Jeśli to coś innego, stuknij właściwe:`,
    sureKept: (name: string, pct: number) => `To chyba ${name} (${pct}%) — stuknij, żeby dodać na talerz:`,
    unsure: 'Nie jestem pewien — wybierz, co pasuje, albo wyszukaj:',
    kind: (family: string) => `To chyba ${family} — wybierz rodzaj:`,
    addMore: 'Co jeszcze jest na talerzu? Stuknij wszystko, co widać.',
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
    modelDownloadingNote: 'You can take the photo now — it will wait for the model.',
    modelMissing: (mb: number) => `Not on the phone yet (about ${mb} MB). I’ll download it with the first photo, or now:`,
    modelMobile: (mb: number) =>
      `Not on the phone yet. I don’t download about ${mb} MB by myself on mobile data or with data saver on — I’ll do it on Wi-Fi, with the first photo, or now:`,
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
      'The phone closed the app while the camera was open — that is how it frees memory for the camera. The photo never reached me. Try again, and if it keeps happening: take the photo with the camera app and pick it with “From gallery”.',
    lostReading: 'The analysis of the last photo was cut short — the phone closed the app, probably for lack of memory.',
    lostAgain: (n: number) => `It has stopped ${n} times in a row — the model may not fit in this phone’s memory. Close other apps, or search for the dish below.`,
    lostPhoto: 'The photo is kept:',
    sure: (name: string, pct: number) => `Looks like ${name} (${pct}%) — already on the plate. If it’s something else, tap the right one:`,
    sureKept: (name: string, pct: number) => `Looks like ${name} (${pct}%) — tap to put it on the plate:`,
    unsure: 'I’m not sure — pick what fits, or search:',
    kind: (family: string) => `Looks like ${family} — pick the kind:`,
    addMore: 'What else is on the plate? Tap everything you see.',
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
  | { kind: 'done'; suggestions: Suggestion[] }
  | { kind: 'failed'; why: Failure; detail: string }
  /** The app was closed by the phone last time (`pending.ts`). */
  | { kind: 'interrupted'; at: Interrupted['stage']; tries: number };

const pct = (share: number | null) => (share === null ? null : Math.round(share * 100));

interface Props {
  date: string;
  /** The last photo run was cut short by the system (the app started again); says so on open. */
  resume?: Interrupted | null;
  onLogged: (text: string) => void;
  onDone: () => void;
}

export function PhotoMode({ date, resume = null, onLogged, onDone }: Props) {
  const shown = useKcalShown();
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
  /** Analyses in a row the phone cut short: carried into the next marker, back to 0 after a result. */
  const tries = useRef(resume?.tries ?? 0);
  /** The kept photo has been read (or there is none): from now on closing the sheet may delete it. */
  const settled = useRef(resume?.stage !== 'reading');
  const ids = useId();

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);
  useEffect(() => {
    clearRunOnLeave();
    void checkModel();
    // The model holds about 0.2 GB; it goes with the screen and comes back from the cache.
    // Closing the sheet is a normal ending: nothing to recover next time.
    return () => {
      release();
      if (settled.current) clearRun();
    };
  }, []);

  // The photo the phone's crash left behind: shown, ready for „Spróbuj ponownie”.
  useEffect(() => {
    if (resume?.stage !== 'reading') return;
    let live = true;
    void pendingPhoto().then((kept) => {
      settled.current = true;
      if (!live || !kept) return;
      setFile(kept);
      setPhoto(URL.createObjectURL(kept));
    });
    return () => {
      live = false;
    };
  }, [resume]);

  // A cancelled camera or gallery is not a crash.
  useEffect(() => {
    const inputs = [camera.current, gallery.current];
    const cancel = () => clearRun();
    inputs.forEach((i) => i?.addEventListener('cancel', cancel));
    return () => inputs.forEach((i) => i?.removeEventListener('cancel', cancel));
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
    try {
      const suggestions = await recognize(image, (progress) => mine === run.current && setStage((s) => (s.kind === 'working' ? { ...s, progress } : s)));
      if (mine !== run.current) return;
      tries.current = 0;
      clearRun();
      setStage({ kind: 'done', suggestions });
      const first = suggestions[0];
      // A sure guess goes onto the plate at once: kcal and macros show without another tap.
      if (first && first.score >= SURE_SCORE) setItems((list) => (list.some((i) => i.dish.id === first.dish.id) ? list : [...list, newItem(first.dish)]));
    } catch (e) {
      // A newer photo or a closed screen ended this one; only the current photo's failure is news.
      if (mine !== run.current) return;
      console.error(e);
      tries.current = 0;
      clearRun();
      setStage({ kind: 'failed', why: failureOf(e), detail: e instanceof Error ? e.message : String(e) });
    }
  };

  // The download (not the model itself) starts while the person frames the shot.
  const pick = (input: HTMLInputElement | null) => {
    markCamera(tries.current);
    input?.click();
    try {
      prepare();
    } catch (e) {
      console.error(e);
    }
  };

  const toggle = (dish: Dish) =>
    setItems((list) => (list.some((i) => i.dish.id === dish.id) ? list.filter((i) => i.dish.id !== dish.id) : [...list, newItem(dish)]));
  const update = (id: string, patch: Partial<PlateItem>) => setItems((list) => list.map((i) => (i.dish.id === id ? { ...i, ...patch } : i)));

  const found = useMemo(() => searchDishes(query), [query]);
  const total = items.length ? plateTotal(items) : null;
  const suggestions = stage.kind === 'done' ? stage.suggestions : [];
  const lead = suggestions[0];
  const sure = (lead?.score ?? 0) >= SURE_SCORE;
  const kind = sure ? null : family(suggestions);
  const leadOn = !!lead && items.some((i) => i.dish.id === lead.dish.id);

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

  const chip = (dish: Dish, isLead = false) => {
    const on = items.some((i) => i.dish.id === dish.id);
    return (
      <li key={dish.id}>
        <button type="button" className={`fd-diet-dish${on ? ' fd-diet-dish-on' : ''}${isLead ? ' fd-diet-dish-lead' : ''}`} aria-pressed={on} onClick={() => toggle(dish)}>
          {on && <Check aria-hidden="true" size={14} />}
          {dish.label}
          {shown && <span className="fd-diet-dish-kcal">{T.chipKcal(formatNumber(itemEstimate(newItem(dish)).kcal, 0))}</span>}
        </button>
      </li>
    );
  };

  const question = () => {
    if (items.length && !(sure && leadOn && items.length === 1)) return T.addMore;
    if (sure && lead) return (leadOn ? T.sure : T.sureKept)(lead.dish.label, pct(lead.score)!);
    return kind ? T.kind(kind) : T.unsure;
  };

  return (
    <div className="fd-diet-photo">
      <ModelCard />
      {stage.kind === 'interrupted' && (
        <div className="fd-diet-photo-note" role="alert">
          <p>{stage.at === 'camera' ? T.lostCamera : T.lostReading}</p>
          {stage.at === 'reading' && stage.tries >= 2 && <p>{T.lostAgain(stage.tries)}</p>}
          {stage.at === 'reading' && file && <p>{T.lostPhoto}</p>}
        </div>
      )}
      {stage.kind === 'start' && !items.length && <p className="fd-diet-hint">{T.lead}</p>}
      <div className="fd-diet-photo-row">
        {photo && <img className="fd-diet-photo-img" src={photo} alt={T.photo} />}
        <div className="fd-diet-photo-btns">
          {file && (stage.kind === 'failed' || stage.kind === 'interrupted') && (
            <button type="button" className="btn sm" onClick={() => void onFile(file)}>
              <RotateCcw aria-hidden="true" size={18} /> {T.retry}
            </button>
          )}
          <button type="button" className={file && (stage.kind === 'failed' || stage.kind === 'interrupted') ? 'btn ghost sm' : 'btn sm'} onClick={() => pick(camera.current)}>
            <Camera aria-hidden="true" size={18} /> {photo ? T.newPhoto : T.take}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => pick(gallery.current)}>
            <ImagePlus aria-hidden="true" size={18} /> {T.gallery}
          </button>
        </div>
      </div>
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
        {suggestions.length > 0 && (
          <>
            <p className="fd-diet-hint" role="status">
              {question()}
            </p>
            <ul className="fd-diet-dishes">{suggestions.map((s, i) => chip(s.dish, i === 0 && sure))}</ul>
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
              <PlateRow key={item.dish.id} item={item} shown={shown} onChange={(p) => update(item.dish.id, p)} onRemove={() => toggle(item.dish)} />
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
  const button = (label: string) => (
    <button type="button" className="btn ghost sm" onClick={fetchNow}>
      <Download aria-hidden="true" size={18} /> {label}
    </button>
  );
  return (
    <section className="fd-diet-model" aria-label={T.model}>
      <p className="fd-diet-model-line">
        <ModelIcon state={state} />
        <span>
          <b>{T.model}:</b> {modelLine(state)}
        </span>
      </p>
      {state.kind === 'downloading' && (
        <>
          <progress className="fd-diet-model-bar" max={1} value={state.share ?? undefined} aria-label={T.model} />
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
      return state.wait === 'mobile' ? T.modelMobile(MODEL_MB) : state.wait === 'offline' ? T.modelOffline : T.modelMissing(MODEL_MB);
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
    <div className="fd-diet-steps" role="status">
      <ol>
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

function PlateRow({ item, shown, onChange, onRemove }: { item: PlateItem; shown: boolean; onChange: (p: Partial<PlateItem>) => void; onRemove: () => void }) {
  const id = useId();
  const e = itemEstimate(item);
  const index = Math.max(0, PORTION_STEPS.indexOf(item.portion));
  const grams = gramsOf(item);
  const portionText = T.portionText(item.portion.toLocaleString(LOCALE, { maximumFractionDigits: 2 }), grams, portionWord(item.portion));
  const setChoice = (patch: Choices) => onChange({ choices: { ...item.choices, ...patch } });
  return (
    <li className="fd-diet-plate-item">
      <div className="fd-diet-chosen-head">
        <p className="fd-diet-name">{item.dish.label}</p>
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
        {shown && <b>{T.estimate(formatNumber(e.kcal, 0), formatNumber(e.low, 0), formatNumber(e.high, 0))}</b>}
        {shown && ' · '}
        {T.macros(num(e.protein), num(e.carbs), num(e.fat))}
      </p>
    </li>
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
