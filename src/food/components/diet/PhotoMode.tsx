import { Camera, Check, ImagePlus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Segmented } from '../../../components/ui';
import { LOCALE, num, text } from '../../../i18n';
import { logFood } from '../../diet/store';
import { formatNumber } from '../../lib/format';
import { FAT_SCALE, SAUCE_SCALE, SWEET_SCALE, type Choices, type Dish, type FatLevel, type SauceLevel, type SweetLevel } from '../../photo/dishes';
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
import { MODEL_MB, modelSaved, recognize, release, warmUp, type Progress, type Suggestion } from '../../photo/recognize';
import { useKcalShown } from './kcalShown';

const T = text({
  pl: {
    lead: 'Zrób zdjęcie talerza — rozpoznam danie, a porcję i to, czego nie widać, ustawisz suwakiem i skalami.',
    take: 'Zrób zdjęcie',
    gallery: 'Z galerii',
    privacy: (mb: number) => `Zdjęcie zostaje w telefonie. Za pierwszym razem pobiorę model rozpoznawania (ok. ${mb} MB), potem działa też bez internetu.`,
    privacySaved: 'Zdjęcie zostaje w telefonie. Model rozpoznawania jest już pobrany — działa też bez internetu.',
    loading: (pct: number | null) => (pct === null ? 'Wczytuję model rozpoznawania…' : `Pobieram model rozpoznawania: ${pct}%`),
    reading: 'Rozpoznaję danie…',
    failed: 'Nie udało się rozpoznać zdjęcia. Wyszukaj danie poniżej.',
    sure: 'To chyba:',
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
    privacy: (mb: number) => `The photo stays on your phone. The first time I’ll download the recognition model (about ${mb} MB); after that it also works offline.`,
    privacySaved: 'The photo stays on your phone. The recognition model is already downloaded, so it also works offline.',
    loading: (pct: number | null) => (pct === null ? 'Loading the recognition model…' : `Downloading the recognition model: ${pct}%`),
    reading: 'Recognising the dish…',
    failed: 'Couldn’t recognise the photo. Search for the dish below.',
    sure: 'Looks like:',
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
    macros: (p: string, c: string, f: string) => `P ${p} g · C ${c} g · F ${f} g`,
    total: 'Total',
    add: (n: number) => (n > 1 ? `Add ${n} items` : 'Add to the diary'),
    saveFailed: 'Couldn’t save. What is still on the plate is not in the diary yet — try again.',
    saved: (n: number, kcal: string | null) => `Saved ${n > 1 ? `${n} items` : 'the meal'} from the photo${kcal ? ` — about ${kcal} kcal` : ''}.`,
    why: 'Values from a dish database (USDA). Portion and fat change them most — set those and the estimate gets closer to the truth.',
  },
});

/**
 * From this top probability the first dish leads („To chyba:”). Measured on 904 test photos: 73 % of
 * them reach it and 93 % of those are right; below 0.4 the first guess is right only a third of the time.
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

type Stage = { kind: 'start' } | { kind: 'working'; progress: Progress } | { kind: 'done'; suggestions: Suggestion[] } | { kind: 'failed' };

interface Props {
  date: string;
  onLogged: (text: string) => void;
  onDone: () => void;
}

export function PhotoMode({ date, onLogged, onDone }: Props) {
  const shown = useKcalShown();
  const [stage, setStage] = useState<Stage>({ kind: 'start' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<PlateItem[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const run = useRef(0);
  const ids = useId();

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);
  // The model holds about half a gigabyte; it goes with the screen and comes back from the cache.
  useEffect(() => release, []);

  const onFile = async (file: File) => {
    const mine = ++run.current;
    setPhoto(URL.createObjectURL(file));
    setStage({ kind: 'working', progress: { step: 'load', share: null } });
    try {
      const suggestions = await recognize(file, (progress) => mine === run.current && setStage({ kind: 'working', progress }));
      if (mine === run.current) setStage({ kind: 'done', suggestions });
    } catch (e) {
      // A newer photo or a closed screen ended this one; only the current photo's failure is news.
      if (mine !== run.current) return;
      console.error(e);
      setStage({ kind: 'failed' });
    }
  };

  // The download starts while the person frames the shot, not after it.
  const pick = (input: HTMLInputElement | null) => {
    input?.click();
    try {
      warmUp();
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
  const sure = (suggestions[0]?.score ?? 0) >= SURE_SCORE;
  const kind = sure ? null : family(suggestions);

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

  const chip = (dish: Dish, lead = false) => {
    const on = items.some((i) => i.dish.id === dish.id);
    return (
      <li key={dish.id}>
        <button type="button" className={`fd-diet-dish${on ? ' fd-diet-dish-on' : ''}${lead ? ' fd-diet-dish-lead' : ''}`} aria-pressed={on} onClick={() => toggle(dish)}>
          {on && <Check aria-hidden="true" size={14} />}
          {dish.label}
        </button>
      </li>
    );
  };

  return (
    <div className="fd-diet-photo">
      {stage.kind === 'start' && !items.length && <p className="fd-diet-hint">{T.lead}</p>}
      <div className="fd-diet-photo-row">
        {photo && <img className="fd-diet-photo-img" src={photo} alt={T.photo} />}
        <div className="fd-diet-photo-btns">
          <button type="button" className="btn sm" onClick={() => pick(camera.current)}>
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
      {stage.kind === 'start' && <p className="fd-diet-meta">{modelSaved() ? T.privacySaved : T.privacy(MODEL_MB)}</p>}

      {stage.kind === 'working' && (
        <p className="fd-diet-hint" role="status">
          {stage.progress.step === 'load' ? T.loading(stage.progress.share === null ? null : Math.round(stage.progress.share * 100)) : T.reading}
        </p>
      )}
      {stage.kind === 'failed' && (
        <p className="fd-diet-hint" role="alert">
          {T.failed}
        </p>
      )}
      {suggestions.length > 0 && (
        <>
          <p className="fd-diet-hint" role="status">
            {items.length ? T.addMore : sure ? T.sure : kind ? T.kind(kind) : T.unsure}
          </p>
          <ul className="fd-diet-dishes">{suggestions.map((s, i) => chip(s.dish, i === 0 && sure))}</ul>
        </>
      )}

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
