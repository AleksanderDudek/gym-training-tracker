import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { plural } from '@gt/food/lib/format';
import { LOCALE, num, text } from '@gt/i18n';
import type { BodyWeight } from '@gt/types';
import { Dialog, Failure, Loading, useLoad } from '../../components/ui';
import { listPhotos, readSnapshot } from '../../lib/data';
import type { Connection, Photo } from '../../lib/data';
import { useReady } from '../../session';
import './photos.css';

/**
 * Zakładka „Zdjęcia” podopiecznego: zdjęcia sylwetki z GYM TRACKERa (osobna zgoda `photos`),
 * miesiącami, z dużym podglądem i porównaniem dwóch obok siebie — z odstępem w dniach i wagą
 * z paczki, gdy podopieczny pokazuje też ciało.
 *
 * Zdjęcia odszyfrowuje przeglądarka kluczem z sejfu i trzyma tylko w pamięci karty. **Celowo bez
 * przycisku „Pobierz”**: to najwrażliwsze dane w systemie, a każda kopia na dysku prowadzącego
 * przeżyłaby zabranie zgody i koniec współpracy (serwer kasuje wtedy swoje od razu). Przeglądarka
 * i tak pozwala zapisać obraz — brak przycisku ogranicza kopie przypadkowe, nie jest zabezpieczeniem.
 */

const T = text({
  pl: {
    privacy:
      'Zdjęcia odszyfrowuje tylko ta przeglądarka, kluczem z twojego sejfu. Celowo bez pobierania: mniej kopii najwrażliwszych danych. Gdy podopieczny zabierze zgodę albo zakończy współpracę, zdjęcia znikną stąd od razu.',
    count: (n: number) => `${n} ${plural(n, 'zdjęcie', 'zdjęcia', 'zdjęć')} · najnowsze z „Sylwetki”, najwyżej 60`,
    compare: 'Porównaj',
    compareTitle: 'Porównanie',
    closeCompare: 'Zamknij porównanie',
    left: 'Zdjęcie po lewej',
    right: 'Zdjęcie po prawej',
    alt: (date: string, k: number, n: number) => `Zdjęcie sylwetki z ${date}${n > 1 ? ` (${k} z ${n})` : ''}`,
    option: (date: string, k: number, n: number) => `${date}${n > 1 ? ` (${k} z ${n})` : ''}`,
    open: (date: string) => `Zdjęcie z ${date}`,
    older: '← Starsze',
    newer: 'Nowsze →',
    compareOldest: 'Porównaj z najstarszym',
    compareNewest: 'Porównaj z najnowszym',
    gap: (d: number) => (d === 0 ? 'Ten sam dzień' : `${d} ${d === 1 ? 'dzień' : 'dni'} między zdjęciami`),
    weightDiff: (s: string) => `waga ${s} kg`,
    weight: (kg: string) => `${kg} kg`,
    weighedOn: (d: string) => `ważenie ${d}`,
    noWeight: 'Bez ważenia w pobliżu tego dnia',
    emptyTitle: 'Zdjęcia jeszcze nie przyszły',
    emptyText:
      'Podopieczny zgodził się je pokazywać. Telefon wysyła zmniejszone kopie przy otwarciu GYM TRACKERa, kilka naraz. Jeśli nie robi zdjęć w „Sylwetce”, nic tu nie będzie.',
  },
  en: {
    privacy:
      'Photos are decrypted only in this browser, with the key from your vault. No download on purpose: fewer copies of the most sensitive data. When the client withdraws consent or ends the collaboration, the photos disappear from here at once.',
    count: (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'} · latest from “Body shape”, up to 60`,
    compare: 'Compare',
    compareTitle: 'Comparison',
    closeCompare: 'Close comparison',
    left: 'Left photo',
    right: 'Right photo',
    alt: (date: string, k: number, n: number) => `Body photo from ${date}${n > 1 ? ` (${k} of ${n})` : ''}`,
    option: (date: string, k: number, n: number) => `${date}${n > 1 ? ` (${k} of ${n})` : ''}`,
    open: (date: string) => `Photo from ${date}`,
    older: '← Older',
    newer: 'Newer →',
    compareOldest: 'Compare with the oldest',
    compareNewest: 'Compare with the newest',
    gap: (d: number) => (d === 0 ? 'Same day' : `${d} ${d === 1 ? 'day' : 'days'} apart`),
    weightDiff: (s: string) => `weight ${s} kg`,
    weight: (kg: string) => `${kg} kg`,
    weighedOn: (d: string) => `weighed ${d}`,
    noWeight: 'No weigh-in near this day',
    emptyTitle: 'No photos yet',
    emptyText:
      'The client agreed to share them. The phone sends downscaled copies when GYM TRACKER opens, a few at a time. If they take no photos in “Body shape”, nothing will show up here.',
  },
});

/* ── Daty i waga ───────────────────────────────────────────────────────────────────── */

const local = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const utc = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
};

const longFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const longDay = (day: string) => longFmt.format(local(day));
const shortDay = (day: string) => shortFmt.format(local(day));

/** Dni między dwoma dniami `yyyy-mm-dd`, bez znaku. */
export const daysBetween = (a: string, b: string): number => Math.abs(Math.round((utc(b) - utc(a)) / 86_400_000));

/** Ważenie najbliższe danemu dniowi, najwyżej `within` dni obok; przy remisie — wcześniejsze. */
export function weightNear(weights: readonly BodyWeight[], day: string, within = 3): BodyWeight | null {
  let best: BodyWeight | null = null;
  let bestGap = Infinity;
  for (const w of weights) {
    const gap = daysBetween(w.day, day);
    if (gap > within) continue;
    if (gap < bestGap || (gap === bestGap && best && w.day < best.day)) {
      best = w;
      bestGap = gap;
    }
  }
  return best;
}

export interface MonthGroup {
  month: string;
  photos: Photo[];
}

/** Zdjęcia (od najnowszego) w miesiącach, od najnowszego. */
export function byMonth(photos: readonly Photo[]): MonthGroup[] {
  const out: MonthGroup[] = [];
  for (const p of photos) {
    const month = p.day.slice(0, 7);
    const last = out.at(-1);
    if (last?.month === month) last.photos.push(p);
    else out.push({ month, photos: [p] });
  }
  return out;
}

/** Numer zdjęcia w jego dniu (1 = najwcześniej dodane) i ile było tego dnia. */
function dayIndex(photos: readonly Photo[]): Map<string, { k: number; n: number }> {
  const out = new Map<string, { k: number; n: number }>();
  const days = new Map<string, Photo[]>();
  for (const p of photos) days.set(p.day, [...(days.get(p.day) ?? []), p]);
  for (const list of days.values()) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    sorted.forEach((p, i) => out.set(p.id, { k: i + 1, n: sorted.length }));
  }
  return out;
}

const src = (p: Photo) => `data:image/jpeg;base64,${p.jpeg}`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${num(Math.abs(n), 1)}`;

/* ── Zakładka ──────────────────────────────────────────────────────────────────────── */

export function PhotosTab({ c }: { c: Connection }) {
  const { key } = useReady();
  const list = useLoad(() => listPhotos(key, c), [c.id]);
  const [open, setOpen] = useState<string | null>(null);
  // Stałe zamknięcie: okno nie przenosi fokusu przy każdym przejściu do innego zdjęcia.
  const closeBig = useCallback(() => setOpen(null), []);
  const [pair, setPair] = useState<[string, string] | null>(null);
  // Waga tylko na potrzeby porównania — paczka czytana dopiero, gdy prowadzący porównuje.
  const [wantWeights, setWantWeights] = useState(false);
  const weights = useLoad<BodyWeight[]>(
    async () => (wantWeights && c.scopes.includes('body') ? ((await readSnapshot(key, c).catch(() => null))?.snapshot?.body?.body ?? []) : []),
    [c.id, wantWeights],
  );

  const photos = useMemo(() => list.data ?? [], [list.data]);
  const index = useMemo(() => dayIndex(photos), [photos]);

  if (list.error) return <Failure error={list.error} retry={list.reload} />;
  if (list.data === undefined) return <Loading />;

  const label = (p: Photo, f: (d: string, k: number, n: number) => string, fmt = longDay) => {
    const at = index.get(p.id) ?? { k: 1, n: 1 };
    return f(fmt(p.day), at.k, at.n);
  };

  const compare = (a: Photo, b: Photo) => {
    const [early, late] = a.day <= b.day ? [a, b] : [b, a];
    setPair([early.id, late.id]);
    setWantWeights(true);
    setOpen(null);
  };

  if (!photos.length) {
    return (
      <div className="stack">
        <p className="note small">{T.privacy}</p>
        <div className="empty">
          <h3>{T.emptyTitle}</h3>
          <p>{T.emptyText}</p>
        </div>
      </div>
    );
  }

  const shown = open ? photos.findIndex((p) => p.id === open) : -1;
  const oldest = photos.at(-1)!;
  const newest = photos[0]!;

  return (
    <div className="stack sz-photo">
      <div className="sz-photo-head">
        <p className="small soft">{T.count(photos.length)}</p>
        <button type="button" className="btn blue small" disabled={photos.length < 2} onClick={() => compare(oldest, newest)}>
          {T.compare}
        </button>
      </div>
      <p className="note small">{T.privacy}</p>

      {pair ? (
        <Compare
          photos={photos}
          pair={pair}
          label={label}
          weights={c.scopes.includes('body') ? (weights.data ?? null) : null}
          onPick={setPair}
          onClose={() => setPair(null)}
        />
      ) : null}

      {byMonth(photos).map((g) => (
        <section key={g.month} className="sz-photo-month">
          <h3>{monthFmt.format(local(`${g.month}-01`))}</h3>
          <ul className="sz-photo-grid">
            {g.photos.map((p) => (
              <li key={p.id}>
                <button type="button" className="sz-photo-tile" onClick={() => setOpen(p.id)}>
                  <img src={src(p)} alt={label(p, T.alt)} loading="lazy" decoding="async" width={p.w} height={p.h} />
                  <span>{label(p, T.option, shortDay)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {shown >= 0 ? (
        <BigView
          photo={photos[shown]!}
          label={label}
          onOlder={shown < photos.length - 1 ? () => setOpen(photos[shown + 1]!.id) : null}
          onNewer={shown > 0 ? () => setOpen(photos[shown - 1]!.id) : null}
          compareWith={photos.length < 2 ? null : photos[shown]!.id === oldest.id ? 'newest' : 'oldest'}
          onCompare={() => compare(photos[shown]!, photos[shown]!.id === oldest.id ? newest : oldest)}
          onClose={closeBig}
        />
      ) : null}
    </div>
  );
}

type Label = (p: Photo, f: (d: string, k: number, n: number) => string, fmt?: (day: string) => string) => string;

function BigView({
  photo,
  label,
  onOlder,
  onNewer,
  compareWith,
  onCompare,
  onClose,
}: {
  photo: Photo;
  label: Label;
  onOlder: (() => void) | null;
  onNewer: (() => void) | null;
  /** Z którym zdjęciem porównać; `null` — jest tylko jedno. */
  compareWith: 'oldest' | 'newest' | null;
  onCompare: () => void;
  onClose: () => void;
}) {
  // Strzałki przeglądają zdjęcia; Esc zamyka (okno samo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft' && onOlder) onOlder();
      if (e.key === 'ArrowRight' && onNewer) onNewer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOlder, onNewer]);
  return (
    <Dialog title={label(photo, T.open)} onClose={onClose} wide>
      <figure className="sz-photo-big">
        <img src={src(photo)} alt={label(photo, T.alt)} decoding="async" style={{ aspectRatio: `${photo.w} / ${photo.h}` }} />
      </figure>
      <div className="row between">
        <div className="row">
          <button type="button" className="btn ghost small" disabled={!onOlder} onClick={() => onOlder?.()}>
            {T.older}
          </button>
          <button type="button" className="btn ghost small" disabled={!onNewer} onClick={() => onNewer?.()}>
            {T.newer}
          </button>
        </div>
        {compareWith ? (
          <button type="button" className="btn blue small" onClick={onCompare}>
            {compareWith === 'oldest' ? T.compareOldest : T.compareNewest}
          </button>
        ) : null}
      </div>
    </Dialog>
  );
}

function Compare({
  photos,
  pair,
  label,
  weights,
  onPick,
  onClose,
}: {
  photos: readonly Photo[];
  pair: [string, string];
  label: Label;
  /** `null` — podopieczny nie pokazuje wagi albo paczka jeszcze się wczytuje. */
  weights: readonly BodyWeight[] | null;
  onPick: (p: [string, string]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    ref.current?.querySelector('select')?.focus({ preventScroll: true });
  }, []);
  const a = photos.find((p) => p.id === pair[0]) ?? photos.at(-1)!;
  const b = photos.find((p) => p.id === pair[1]) ?? photos[0]!;
  const wa = weights ? weightNear(weights, a.day) : null;
  const wb = weights ? weightNear(weights, b.day) : null;
  const [early, late] = a.day <= b.day ? [wa, wb] : [wb, wa];
  const diff = early && late ? late.kg - early.kg : null;

  const side = (p: Photo, w: BodyWeight | null, which: 0 | 1, name: string) => (
    <div className="sz-photo-side">
      <label className="field">
        <span>{name}</span>
        <select
          id={`sz-photo-pick-${which}`}
          value={p.id}
          onChange={(e) => onPick(which === 0 ? [e.target.value, pair[1]] : [pair[0], e.target.value])}
        >
          {photos.map((x) => (
            <option key={x.id} value={x.id}>
              {label(x, T.option)}
            </option>
          ))}
        </select>
      </label>
      <figure>
        <img src={src(p)} alt={label(p, T.alt)} decoding="async" style={{ aspectRatio: `${p.w} / ${p.h}` }} />
        <figcaption>
          <strong>{label(p, T.option)}</strong>
          {weights ? (
            <span className="soft">
              {w ? `${T.weight(num(w.kg, 1))}${w.day !== p.day ? ` · ${T.weighedOn(shortDay(w.day))}` : ''}` : T.noWeight}
            </span>
          ) : null}
        </figcaption>
      </figure>
    </div>
  );

  return (
    <section ref={ref} className="card sz-photo-compare" aria-labelledby="sz-photo-compare-title">
      <div className="row between">
        <h2 id="sz-photo-compare-title">{T.compareTitle}</h2>
        <button type="button" className="btn ghost small" onClick={onClose}>
          {T.closeCompare}
        </button>
      </div>
      <p className="sz-photo-gap" aria-live="polite">
        {T.gap(daysBetween(a.day, b.day))}
        {diff !== null && a.day !== b.day ? <span className="soft"> · {T.weightDiff(signed(diff))}</span> : null}
      </p>
      <div className="sz-photo-pair">
        {side(a, wa, 0, T.left)}
        {side(b, wb, 1, T.right)}
      </div>
    </section>
  );
}
