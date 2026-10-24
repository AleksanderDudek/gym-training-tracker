import { Check, ChevronRight, ExternalLink, ScanBarcode, Trash2, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LOCALE, text } from '../../../i18n';
import { Segmented } from '../../../components/ui';
import { dietPath } from '../../../routing';
import type { DietProfile, Fit } from '../../diet/profiles';
import { logFood } from '../../diet/store';
import { BAND, r10 } from '../../diet/target';
import { compare, useCompare } from '../../hooks/useCompare';
import { useCodeLookup, type Lookup } from '../../hooks/useCodeLookup';
import { useEatNow } from '../../hooks/useEatNow';
import { formatNumber, formatPrice, UNKNOWN } from '../../lib/format';
import type { Dictionaries, Product } from '../../lib/types';
import {
  goalMetric,
  portionOf,
  pricePer100,
  pricePer10gProtein,
  rankForGoal,
  scanFood,
  type RankedItem,
  type ScanItem,
} from '../../scan/compare';
import type { SavedCompare } from '../../scan/compareStore';
import type { Per100 } from '../../scan/off';
import { BarcodeCamera } from '../common/BarcodeCamera';
import { CodeEntry } from '../common/CodeEntry';
import { ProductImage } from '../common/ProductImage';
import { Sheet } from '../common/Sheet';
import { StarButton } from '../common/StarButton';
import { COMMON } from '../common/text';
import { DT } from '../diet/dietText';
import { FitBadge } from '../diet/SuggestionList';
// Ocena dopasowania („pasuje”) ma style w dzienniku — skaner bywa pierwszym ekranem jedzenia.
import '../diet/diet.css';

const T = text({
  pl: {
    title: 'Skaner kodów',
    subtitle: 'Makro od razu i porównanie pod Twój cel',
    startCamera: 'Skanuj aparatem',
    first: 'Zeskanuj pierwszy produkt — wynik pokaże się tutaj, a każdy kolejny trafi do porównania.',
    searching: (code: string) => `Szukam kodu ${code} w Open Food Facts…`,
    unknown: (code: string) => `Nie znam produktu o kodzie ${code}.`,
    unknownHint: 'Nie ma go w bazie aplikacji ani w Open Food Facts. Możesz go tam dodać — przyda się następnej osobie.',
    badDigits: 'Sprawdź cyfry — ostatnia się nie zgadza.',
    addOff: 'Dodaj go do Open Food Facts',
    inStore: (code: string) =>
      `${code} to kod sklepowy: towar ważony albo pakowany w sklepie. Takich kodów nie ma w żadnej bazie produktów.`,
    failed: (code: string) => `Kodu ${code} nie ma w bazie aplikacji, a Open Food Facts teraz nie odpowiada.`,
    fromOff: 'z Open Food Facts',
    head: { what: 'Ilość', kcal: 'kcal', protein: 'Białko', carbs: 'Węgl.', fat: 'Tłuszcz' },
    per100: 'w 100 g',
    pack: (g: number) => `opak. ${g} g`,
    fits: (left: string) => `Na dziś: mieści się — zostało ok. ${left} kcal.`,
    over: (by: string, left: string) => `Na dziś: ok. ${by} kcal więcej, niż zostało (ok. ${left} kcal).`,
    done: 'Na dziś: kalorii już wystarczy.',
    details: 'Szczegóły',
    eaten: (g: number) => `Zjadłem ${g} g`,
    saved: (name: string, kcal: string) => `Zapisane w dzienniku: ${name} · ${kcal} kcal.`,
    saveFailed: 'Nie udało się zapisać. Spróbuj jeszcze raz.',
    partial: 'Etykieta nie podaje wszystkich makroskładników — porównam, ale nie wybiorę go jako najlepszego.',
    bestOf: (n: number) => `Najlepszy na Twój cel z ${n} zeskanowanych.`,
    placeOf: (place: number, n: number, name: string, value: string) =>
      `${place}. z ${n} na Twój cel — najlepszy jest ${name} (${value}).`,
    added: (name: string, kcal: string, protein: string) => `${name}: ${kcal} kcal i ${protein} g białka w 100 g. Dodany do porównania.`,
    compare: 'Porównanie',
    clear: 'Wyczyść',
    clearLabel: 'Wyczyść porównanie',
    cleared: 'Porównanie wyczyszczone.',
    undo: 'Cofnij',
    expires: (time: string) => `Zniknie samo o ${time} — godzinę po ostatnim skanie.`,
    scanMore: 'Zeskanuj kolejny produkt, żeby porównać.',
    winner: (profile: string, name: string, value: string) => `Na Twój cel (${profile}) najlepszy: ${name} — ${value}.`,
    noWinner: 'Żaden nie ma na etykiecie wszystkich makroskładników — nie wybieram najlepszego.',
    proteinPer: (g: string) => `${g} g białka na 100 kcal`,
    carbsPer: (g: string) => `${g} g węglowodanów na 100 kcal`,
    price10: (price: string) => `${price} za 10 g białka`,
    price100: (price: string) => `${price} za 100 g`,
    best: 'najlepszy',
    remove: (name: string) => `Usuń z porównania: ${name}`,
    values: 'Wartości',
    view100: 'Na 100 g',
    viewPack: 'Na opakowanie',
    noProfile: 'Bez profilu diety porównuję dla diety zbilansowanej.',
    setProfile: 'Ustaw profil diety',
    prices: 'Ceny: ostatnie zgłoszone w Open Prices — w sklepie mogą być inne.',
    privacy: 'Obraz z aparatu nie opuszcza telefonu. Kod spoza bazy aplikacji sprawdzam w Open Food Facts (world.openfoodfacts.org).',
  },
  en: {
    title: 'Barcode scanner',
    subtitle: 'Macros at once and a comparison for your goal',
    startCamera: 'Scan with the camera',
    first: 'Scan the first product — the result shows here, and each next one goes into the comparison.',
    searching: (code: string) => `Looking for code ${code} on Open Food Facts…`,
    unknown: (code: string) => `I don’t know the product with code ${code}.`,
    unknownHint: 'It isn’t in the app’s database or on Open Food Facts. You can add it there — the next person will thank you.',
    badDigits: 'Check the digits — the last one doesn’t match.',
    addOff: 'Add it to Open Food Facts',
    inStore: (code: string) => `${code} is a shop’s own code: goods weighed or packed in the shop. No product database has these.`,
    failed: (code: string) => `Code ${code} isn’t in the app’s database, and Open Food Facts isn’t answering right now.`,
    fromOff: 'from Open Food Facts',
    head: { what: 'Amount', kcal: 'kcal', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' },
    per100: 'per 100 g',
    pack: (g: number) => `pack ${g} g`,
    fits: (left: string) => `For today: it fits — about ${left} kcal left.`,
    over: (by: string, left: string) => `For today: about ${by} kcal more than is left (about ${left} kcal).`,
    done: 'For today: that’s enough calories.',
    details: 'Details',
    eaten: (g: number) => `I ate ${g} g`,
    saved: (name: string, kcal: string) => `Saved to the diary: ${name} · ${kcal} kcal.`,
    saveFailed: 'Couldn’t save. Try again.',
    partial: 'The label doesn’t give all the macros — I’ll compare it, but won’t pick it as the best.',
    bestOf: (n: number) => `The best for your goal of the ${n} scanned.`,
    placeOf: (place: number, n: number, name: string, value: string) =>
      `No. ${place} of ${n} for your goal — the best is ${name} (${value}).`,
    added: (name: string, kcal: string, protein: string) => `${name}: ${kcal} kcal and ${protein} g protein per 100 g. Added to the comparison.`,
    compare: 'Comparison',
    clear: 'Clear',
    clearLabel: 'Clear the comparison',
    cleared: 'Comparison cleared.',
    undo: 'Undo',
    expires: (time: string) => `It clears itself at ${time} — an hour after the last scan.`,
    scanMore: 'Scan another product to compare.',
    winner: (profile: string, name: string, value: string) => `For your goal (${profile}) the best: ${name} — ${value}.`,
    noWinner: 'None of them has all the macros on the label — I’m not picking the best.',
    proteinPer: (g: string) => `${g} g protein per 100 kcal`,
    carbsPer: (g: string) => `${g} g carbs per 100 kcal`,
    price10: (price: string) => `${price} per 10 g protein`,
    price100: (price: string) => `${price} per 100 g`,
    best: 'best',
    remove: (name: string) => `Remove from the comparison: ${name}`,
    values: 'Values',
    view100: 'Per 100 g',
    viewPack: 'Per pack',
    noProfile: 'Without a diet profile I compare for a balanced diet.',
    setProfile: 'Set up your diet profile',
    prices: 'Prices: the latest reported on Open Prices — the shop may differ.',
    privacy: 'The camera picture never leaves your phone. A code the app doesn’t know is looked up on Open Food Facts (world.openfoodfacts.org).',
  },
});

const TIME = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
/** „Cofnij” stays this long after emptying the comparison. */
const UNDO_MS = 8000;

const offPage = (code: string) => `https://world.openfoodfacts.org/product/${encodeURIComponent(code)}`;
const n1 = (v: number | null) => (v === null ? UNKNOWN : formatNumber(v, 1));
const kcalText = (v: number | null) => (v === null ? UNKNOWN : formatNumber(v, 0));

/** „13,3 g białka na 100 kcal” — the number the ranking goes by. */
function metricText(r: RankedItem, profile: DietProfile): string | null {
  if (r.value === null) return null;
  return goalMetric(profile) === 'protein' ? T.proteinPer(formatNumber(r.value, 1)) : T.carbsPer(formatNumber(r.value, 1));
}

function fitOf(per100: Per100, profile: DietProfile): Fit | null {
  const { kcal, protein, carbs, fat } = per100;
  return kcal === null || protein === null || carbs === null || fat === null ? null : profile.fit({ kcal, protein, carbs, fat });
}

/** The label's numbers for another amount; unknown stays unknown. */
function scaled(per100: Per100, grams: number): Pick<Per100, 'kcal' | 'protein' | 'carbs' | 'fat'> {
  const f = grams / 100;
  const r = (v: number | null, digits: number) => (v === null ? null : Math.round(v * f * 10 ** digits) / 10 ** digits);
  return { kcal: r(per100.kcal, 0), protein: r(per100.protein, 1), carbs: r(per100.carbs, 1), fat: r(per100.fat, 1) };
}

interface Props {
  products: readonly Product[];
  dict: Dictionaries;
  /** Opened to scan (the camera starts) or to look at the comparison (it waits for a tap). */
  camera: boolean;
  /** A product card is open over the scanner: the camera rests meanwhile. */
  covered: boolean;
  onOpenProduct: (code: string) => void;
  onClose: () => void;
}

/**
 * „Skaner kodów”: point the camera at a barcode and the product's macros are there at once - per
 * 100 g and per pack, its verdict for the diet profile, what one pack means for what is left of
 * today, and „Zjadłem”. Every scan also lands in the comparison below, ranked for the user's goal
 * with the winner named and why; it is a shopping-trip list that empties itself an hour after the
 * last scan, or at one tap (with „Cofnij”). A code the camera cannot see can be typed.
 */
export function ScanSheet({ products, dict, camera, covered, onOpenProduct, onClose }: Props) {
  const [cameraOn, setCameraOn] = useState(camera);
  const [lookup, look] = useCodeLookup(products, dict);
  const [announce, setAnnounce] = useState('');
  const { items, expiresAt } = useCompare();
  const eat = useEatNow();
  const profile = eat.needs.profile;
  const ranked = useMemo(() => rankForGoal(items, profile), [items, profile]);

  const onCode = useCallback(
    async (code: string) => {
      const result = await look(code);
      if (result.status !== 'found') return;
      compare.add(result.item);
      const { per100, name } = result.item;
      setAnnounce(T.added(name, kcalText(per100.kcal), n1(per100.protein)));
    },
    [look],
  );

  return (
    <Sheet open full onClose={onClose} title={T.title} subtitle={T.subtitle} className="fd-scan-sheet">
      <div className="fd-scan-input">
        {cameraOn ? (
          <BarcodeCamera onCode={(code) => void onCode(code)} active={!covered} />
        ) : (
          <button type="button" className="btn fd-scan-start" onClick={() => setCameraOn(true)}>
            <ScanBarcode size={20} strokeWidth={2} aria-hidden />
            {T.startCamera}
          </button>
        )}
        <CodeEntry onCode={(code) => void onCode(code)} />
      </div>
      <p className="sr-only" role="status">
        {announce}
      </p>

      <LookupView
        lookup={lookup}
        ranked={ranked}
        profile={profile}
        // Without calorie counting the scanner says nothing about today; while the diary loads, nothing yet.
        left={eat.loading || eat.hidesKcal ? null : eat.needs.remaining.kcal}
        today={eat.today}
        empty={items.length === 0}
        onOpenProduct={onOpenProduct}
        onRetry={(code) => void onCode(code)}
      />

      <CompareList
        ranked={ranked}
        expiresAt={expiresAt}
        profile={profile}
        // While the diary loads, no note about a missing profile flashes up.
        hasProfile={eat.loading || eat.profile !== null}
        onOpenProduct={onOpenProduct}
      />

      <p className="hint fd-scan-privacy">{T.privacy}</p>
    </Sheet>
  );
}

function LookupView({
  lookup,
  ranked,
  profile,
  left,
  today,
  empty,
  onOpenProduct,
  onRetry,
}: {
  lookup: Lookup;
  ranked: RankedItem[];
  profile: DietProfile;
  /** kcal left today (a planned bigger meal set aside); `null` while the diary loads or without calorie counting. */
  left: number | null;
  today: string;
  empty: boolean;
  onOpenProduct: (code: string) => void;
  onRetry: (code: string) => void;
}) {
  if (lookup.status === 'idle') return empty ? <p className="fd-scan-note">{T.first}</p> : null;
  if (lookup.status === 'searching') return <p className="fd-scan-note">{T.searching(lookup.code)}</p>;
  if (lookup.status === 'failed')
    return (
      <div className="fd-scan-note">
        <p>{T.failed(lookup.code)}</p>
        <button type="button" className="btn ghost sm" onClick={() => onRetry(lookup.code)}>
          {COMMON.retry}
        </button>
      </div>
    );
  if (lookup.status === 'unknown')
    return (
      <div className="fd-scan-note">
        {lookup.inStore ? (
          <p>{T.inStore(lookup.code)}</p>
        ) : (
          <>
            <p>
              <b>{T.unknown(lookup.code)}</b> {lookup.valid ? T.unknownHint : T.badDigits}
            </p>
            {lookup.valid && (
              <a href={offPage(lookup.code)} target="_blank" rel="noopener noreferrer">
                {T.addOff} <ExternalLink size={14} strokeWidth={2} aria-hidden />
                <span className="sr-only">{COMMON.newTab}</span>
              </a>
            )}
          </>
        )}
      </div>
    );
  return (
    <ResultCard
      key={`${lookup.item.code}:${lookup.item.addedAt}`}
      item={lookup.item}
      product={lookup.product}
      ranked={ranked}
      profile={profile}
      left={left}
      today={today}
      onOpenProduct={onOpenProduct}
    />
  );
}

/** The product just scanned: what it is, its numbers per 100 g and per pack, its fit, today. */
function ResultCard({
  item,
  product,
  ranked,
  profile,
  left,
  today,
  onOpenProduct,
}: {
  item: ScanItem;
  product: Product | null;
  /** The comparison, best first: where this product stands in it. */
  ranked: RankedItem[];
  profile: DietProfile;
  left: number | null;
  today: string;
  onOpenProduct: (code: string) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const fit = fitOf(item.per100, profile);
  const portion = portionOf(item);
  const food = scanFood(item);
  const pack = portion ? scaled(item.per100, portion) : null;
  // Right after the second scan the verdict is here, not below the fold.
  const winner = ranked.find((r) => r.winner);
  const place = ranked.findIndex((r) => r.item.code === item.code);
  const standing =
    !winner || place < 0 || ranked[place]!.value === null
      ? null
      : winner.item.code === item.code
        ? { best: true, text: T.bestOf(ranked.length) }
        : { best: false, text: T.placeOf(place + 1, ranked.length, winner.item.name, metricText(winner, profile) ?? '') };

  const eat = async () => {
    if (!food) return;
    try {
      await logFood(today, food);
      setStatus(T.saved(food.name, formatNumber(food.nutrients.kcal, 0)));
    } catch {
      setStatus(T.saveFailed);
    }
  };

  // On the ±100 kcal band: what is left within it is enough already; a pack that ends inside it fits.
  const todayLine = (() => {
    if (!food || left === null) return null;
    if (left <= BAND) return T.done;
    const after = left - food.nutrients.kcal;
    const leftText = formatNumber(r10(left), 0);
    return after >= -BAND ? T.fits(leftText) : T.over(formatNumber(r10(-after), 0), leftText);
  })();

  const row = (label: string, v: Pick<Per100, 'kcal' | 'protein' | 'carbs' | 'fat'>) => (
    <tr>
      <th scope="row">{label}</th>
      <td>{kcalText(v.kcal)}</td>
      <td>{n1(v.protein)}</td>
      <td>{n1(v.carbs)}</td>
      <td>{n1(v.fat)}</td>
    </tr>
  );

  return (
    <article className="fd-scan-result" aria-labelledby="fd-scan-result-name">
      <div className="fd-scan-result-head">
        <ProductImage path={item.image} size={100} alt="" className="fd-scan-thumb" padded />
        <div className="fd-scan-result-titles">
          <h3 id="fd-scan-result-name">{item.name}</h3>
          <p className="fd-scan-meta">
            {[item.brand, item.quantity, item.source === 'off' ? T.fromOff : null].filter(Boolean).join(' · ')}
          </p>
          {fit && (
            <p className="fd-scan-fit">
              <FitBadge fit={fit} /> <span>{fit.reason}</span>
            </p>
          )}
        </div>
        {food && <StarButton food={food} />}
      </div>

      {standing && <p className={`fd-scan-standing${standing.best ? ' fd-scan-standing-best' : ''}`}>{standing.text}</p>}

      <table className="fd-scan-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{T.head.what}</span>
            </th>
            <th scope="col">{T.head.kcal}</th>
            <th scope="col">{T.head.protein}</th>
            <th scope="col">{T.head.carbs}</th>
            <th scope="col">{T.head.fat}</th>
          </tr>
        </thead>
        <tbody>
          {row(T.per100, item.per100)}
          {pack && portion && row(T.pack(portion), pack)}
        </tbody>
      </table>
      {!fit && <p className="fd-scan-soft">{T.partial}</p>}
      {todayLine && <p className="fd-scan-today">{todayLine}</p>}

      <div className="btnrow fd-scan-acts">
        {product ? (
          <button type="button" className="btn ghost sm" onClick={() => onOpenProduct(product.code)}>
            {T.details} <ChevronRight size={16} strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <a className="btn ghost sm" href={offPage(item.code)} target="_blank" rel="noopener noreferrer">
            {T.details} <ExternalLink size={16} strokeWidth={2} aria-hidden />
            <span className="sr-only">{COMMON.newTab}</span>
          </a>
        )}
        {food && food.grams !== null && (
          <button type="button" className="btn sm" onClick={() => void eat()}>
            <Check size={18} strokeWidth={2} aria-hidden /> {T.eaten(food.grams)}
          </button>
        )}
      </div>
      <p role="status" className="fd-scan-status">
        {status}
      </p>
    </article>
  );
}

type Per = '100' | 'pack';

/** The comparison: best first for the goal, the winner and why, one tap to remove one or all. */
function CompareList({
  ranked,
  expiresAt,
  profile,
  hasProfile,
  onOpenProduct,
}: {
  ranked: RankedItem[];
  expiresAt: number | null;
  profile: DietProfile;
  hasProfile: boolean;
  onOpenProduct: (code: string) => void;
}) {
  const [per, setPer] = useState<Per>('100');
  const [undo, setUndo] = useState<SavedCompare | null>(null);
  const metric = goalMetric(profile);
  const items = ranked.map((r) => r.item);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  if (items.length === 0)
    return undo ? (
      <section className="fd-scan-compare" aria-label={T.compare}>
        <p className="fd-scan-cleared" role="status">
          {T.cleared}{' '}
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              compare.restore(undo);
              setUndo(null);
            }}
          >
            <Undo2 size={16} strokeWidth={2} aria-hidden /> {T.undo}
          </button>
        </p>
      </section>
    ) : null;

  const winner = ranked.find((r) => r.winner);
  const valueText = (r: RankedItem) => metricText(r, profile);
  const anyPrice = items.some((i) => i.price);

  return (
    <section className="fd-scan-compare" aria-labelledby="fd-scan-compare-h">
      <div className="fd-scan-compare-head">
        <h3 id="fd-scan-compare-h">
          {T.compare} <span className="fd-scan-count">({items.length})</span>
        </h3>
        <button
          type="button"
          className="btn ghost sm"
          aria-label={T.clearLabel}
          onClick={() => {
            setUndo(compare.clear());
          }}
        >
          <Trash2 size={16} strokeWidth={2} aria-hidden /> {T.clear}
        </button>
      </div>
      {expiresAt !== null && <p className="fd-scan-soft">{T.expires(TIME.format(expiresAt))}</p>}

      {items.length === 1 ? (
        <p className="fd-scan-goal">{T.scanMore}</p>
      ) : winner ? (
        <p className="fd-scan-goal">{T.winner(profile.label, winner.item.name, valueText(winner) ?? '')}</p>
      ) : (
        <p className="fd-scan-goal">{T.noWinner}</p>
      )}
      {!hasProfile && (
        <p className="fd-scan-soft">
          {T.noProfile} <a href={dietPath('profile')}>{T.setProfile}</a>
        </p>
      )}

      {items.length > 1 && (
        <Segmented<Per>
          label={T.values}
          options={[
            { key: '100', label: T.view100 },
            { key: 'pack', label: T.viewPack },
          ]}
          value={per}
          onChange={setPer}
        />
      )}

      <ol className="fd-scan-list">
        {ranked.map((r, i) => {
          const portion = per === 'pack' ? portionOf(r.item) : null;
          const v = portion ? scaled(r.item.per100, portion) : r.item.per100;
          const price = metric === 'protein' ? pricePer10gProtein(r.item) : pricePer100(r.item);
          const extra = [
            valueText(r),
            price === null ? null : metric === 'protein' ? T.price10(formatPrice(price)) : T.price100(formatPrice(price)),
          ].filter(Boolean);
          return (
            <li key={r.item.code} className={`fd-scan-row${r.winner ? ' fd-scan-win' : ''}`}>
              <span className="fd-scan-rank" aria-hidden="true">
                {i + 1}
              </span>
              <div className="fd-scan-row-main">
                <p className="fd-scan-name">
                  {r.item.source === 'base' ? (
                    <button type="button" className="fd-scan-open" onClick={() => onOpenProduct(r.item.code)}>
                      {r.item.name}
                    </button>
                  ) : (
                    <a className="fd-scan-open" href={offPage(r.item.code)} target="_blank" rel="noopener noreferrer">
                      {r.item.name}
                      <span className="sr-only">{COMMON.newTab}</span>
                    </a>
                  )}{' '}
                  {r.winner && <span className="fd-scan-best">{T.best}</span>} {r.fit && <FitBadge fit={r.fit} />}
                </p>
                <p className="fd-scan-meta">
                  {[r.item.brand, r.item.quantity, r.item.source === 'off' ? T.fromOff : null].filter(Boolean).join(' · ')}
                </p>
                <p className="fd-scan-nums">
                  {kcalText(v.kcal)} kcal · {DT.p} {n1(v.protein)} · {DT.c} {n1(v.carbs)} · {DT.f} {n1(v.fat)}{' '}
                  <span className="fd-scan-soft">{portion ? T.pack(portion) : T.per100}</span>
                </p>
                {extra.length > 0 && <p className="fd-scan-key">{extra.join(' · ')}</p>}
              </div>
              <button type="button" className="fd-scan-x" aria-label={T.remove(r.item.name)} onClick={() => compare.remove(r.item.code)}>
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
      {anyPrice && <p className="fd-scan-soft">{T.prices}</p>}
    </section>
  );
}
