import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { LOCALE, pluralEn, text } from '../i18n';
import { plural } from '../engine/quips';
import { dayKey } from '../engine/schedule';
import {
  MEASURES,
  MEASURE_RANGE,
  formatCm,
  formatCmChange,
  measureName,
  measureSeries,
  measureSummary,
  measuresOf,
  validMeasure,
  type MeasureInput,
  type MeasureSummary,
} from '../engine/measures';
import {
  addPhoto,
  cameraWasKilled,
  clearCamera,
  deletePhoto,
  listPhotos,
  markCamera,
  photoFull,
  photosSupported,
  setPhotoDay,
  type PhotoThumb,
} from '../silhouette';
import { preparePhoto } from '../silhouetteImage';
import { Trendline } from './ui';
import type { AppState, BodyMeasures, MeasureKey } from '../types';

const T = text({
  pl: {
    title: 'Sylwetka',
    lead: (day: string) => `Obwody w centymetrach, ostatni pomiar ${day}. Zmiana liczona od pierwszego pomiaru.`,
    none: 'Obwody mówią o zmianie sylwetki więcej niż sama waga — zwłaszcza przy treningu siłowym, kiedy mięśni przybywa, a tłuszczu ubywa.',
    change: (d: string, day: string, n: number) => `${d} cm od ${day} · ${n} ${plural(n, ['pomiar', 'pomiary', 'pomiarów'])}`,
    once: (day: string) => `pierwszy pomiar ${day}`,
    noun: 'pomiarów',
    howTo: 'Jak mierzyć',
    howToText: (
      <>
        <p>
          Rano, przed jedzeniem, w bieliźnie. Taśma poziomo, przylega do skóry, ale jej nie wciska. Stój swobodnie,
          zmierz <b>na spokojnym wydechu</b>. Za każdym razem ta sama strona ciała i to samo miejsce.
        </p>
        <ul>
          <li>
            <b>Talia</b> — w połowie między dolnym żebrem a górą kości biodrowej (tak mierzy WHO), nie w pępku.
          </li>
          <li>
            <b>Biodra</b> — w najszerszym miejscu pośladków, stopy razem.
          </li>
          <li>
            <b>Klatka</b> — na wysokości sutków, ręce wzdłuż ciała.
          </li>
          <li>
            <b>Ramię</b> — w połowie między barkiem a łokciem, ręka luźno.
          </li>
          <li>
            <b>Udo</b> — w połowie między pachwiną a kolanem, ciężar na obu nogach.
          </li>
        </ul>
      </>
    ),
    formToday: 'Pomiar z dziś — puste pole zostaje, jak było',
    formNew: 'Pomiar z dziś — wpisz tyle, ile zmierzysz',
    field: (name: string) => `${name}, cm`,
    save: 'Zapisz pomiar',
    range: (name: string, min: number, max: number) => `${name}: wpisz od ${min} do ${max} cm.`,
    nothing: 'Wpisz co najmniej jeden obwód.',
    recentAria: 'Ostatnie pomiary',
    deleteDay: (day: string) => `Usuń pomiar z ${day}`,
    // Zdjęcia
    photos: 'Zdjęcia sylwetki',
    photosNote:
      'Zdjęcia zostają na tym telefonie: nigdzie ich nie wysyłamy i nie wchodzą do kopii zapasowej (są za duże). Kopię zdjęcia daje „Pobierz”. „Usuń wszystkie dane” kasuje także je.',
    noPhotos: 'Bez zdjęć. To samo światło, ta sama odległość i poza co kilka tygodni dają porównanie, które widać.',
    camera: 'Aparat',
    gallery: 'Z galerii',
    adding: 'Dodaję zdjęcie…',
    added: (n: number) => (n === 1 ? 'Zdjęcie dodane.' : `Dodane zdjęcia: ${n}.`),
    addFailed: 'Nie udało się odczytać zdjęcia. Spróbuj innego pliku (JPEG albo PNG).',
    storeFailed: 'Nie udało się zapisać zdjęcia — w przeglądarce może brakować miejsca.',
    unsupported: 'Ta przeglądarka nie zapisuje zdjęć na stałe (np. okno prywatne).',
    readFailed: 'Nie udało się odczytać zdjęć z pamięci przeglądarki.',
    killed:
      'Telefon zamknął aplikację, kiedy był otwarty aparat. Zdjęcie zwykle zostaje w galerii telefonu — dodaj je stamtąd przyciskiem „Z galerii”.',
    listAria: 'Zdjęcia według daty',
    open: (day: string) => `Zdjęcie z ${day} — otwórz`,
    alt: (day: string) => `Zdjęcie sylwetki z ${day}`,
    loading: 'Wczytuję…',
    day: 'Dzień zdjęcia',
    download: 'Pobierz',
    remove: 'Usuń',
    close: 'Zamknij',
    removeQ: 'Usunąć to zdjęcie? Nie da się tego cofnąć.',
    removeYes: 'Usuń zdjęcie',
    keep: 'Zostaw',
    removed: 'Zdjęcie usunięte.',
    more: (n: number) => `Pokaż wszystkie (${n})`,
    compare: 'Porównaj dwa zdjęcia',
    compareClose: 'Zamknij porównanie',
    before: 'Przed',
    after: 'Po',
    nth: (day: string, n: number) => `${day} (${n})`,
    file: (day: string) => `sylwetka-${day}.jpg`,
  },
  en: {
    title: 'Body shape',
    lead: (day: string) => `Measurements in centimetres, last taken ${day}. Change is counted from the first measurement.`,
    none: 'Measurements show a change in shape better than weight alone — especially with strength training, when muscle goes up and fat goes down.',
    change: (d: string, day: string, n: number) => `${d} cm since ${day} · ${n} ${pluralEn(n, 'measurement', 'measurements')}`,
    once: (day: string) => `first measured ${day}`,
    noun: 'measurements',
    howTo: 'How to measure',
    howToText: (
      <>
        <p>
          In the morning, before eating, in underwear. Keep the tape level, touching the skin without pressing in. Stand
          relaxed and measure <b>on a gentle breath out</b>. Same side of the body and same spot every time.
        </p>
        <ul>
          <li>
            <b>Waist</b> — halfway between the lowest rib and the top of the hip bone (the WHO site), not at the navel.
          </li>
          <li>
            <b>Hips</b> — at the widest part of the buttocks, feet together.
          </li>
          <li>
            <b>Chest</b> — at nipple height, arms by your sides.
          </li>
          <li>
            <b>Arm</b> — halfway between shoulder and elbow, arm relaxed.
          </li>
          <li>
            <b>Thigh</b> — halfway between groin and knee, weight on both legs.
          </li>
        </ul>
      </>
    ),
    formToday: 'Today’s measurement — an empty field stays as it was',
    formNew: 'Today’s measurement — fill in whatever you measure',
    field: (name: string) => `${name}, cm`,
    save: 'Save measurement',
    range: (name: string, min: number, max: number) => `${name}: enter ${min} to ${max} cm.`,
    nothing: 'Enter at least one measurement.',
    recentAria: 'Recent measurements',
    deleteDay: (day: string) => `Delete the measurement from ${day}`,
    photos: 'Progress photos',
    photosNote:
      'Photos stay on this phone: they’re never sent anywhere and aren’t in the backup file (they’re too big). “Download” gives you a copy. “Delete all data” deletes them too.',
    noPhotos: 'No photos yet. Same light, same distance and same pose every few weeks give you a comparison you can see.',
    camera: 'Camera',
    gallery: 'From gallery',
    adding: 'Adding the photo…',
    added: (n: number) => (n === 1 ? 'Photo added.' : `Photos added: ${n}.`),
    addFailed: 'Couldn’t read the photo. Try another file (JPEG or PNG).',
    storeFailed: 'Couldn’t save the photo — the browser may be out of space.',
    unsupported: 'This browser doesn’t keep photos (a private window, for example).',
    readFailed: 'Couldn’t read the photos from the browser’s storage.',
    killed:
      'Your phone closed the app while the camera was open. The photo is usually still in your phone’s gallery — add it from there with “From gallery”.',
    listAria: 'Photos by date',
    open: (day: string) => `Photo from ${day} — open`,
    alt: (day: string) => `Body photo from ${day}`,
    loading: 'Loading…',
    day: 'Photo date',
    download: 'Download',
    remove: 'Delete',
    close: 'Close',
    removeQ: 'Delete this photo? This can’t be undone.',
    removeYes: 'Delete photo',
    keep: 'Keep',
    removed: 'Photo deleted.',
    more: (n: number) => `Show all (${n})`,
    compare: 'Compare two photos',
    compareClose: 'Close comparison',
    before: 'Before',
    after: 'After',
    nth: (day: string, n: number) => `${day} (${n})`,
    file: (day: string) => `body-${day}.jpg`,
  },
});

/** „3 wrz”, „3 Sept” — dzień pomiaru albo zdjęcia. */
const dayLabel = (key: string): string =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Liczba z pola: przecinek albo kropka. Puste — NaN. */
const parse = (s: string): number => {
  const t = s.trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
};

const EMPTY: Record<MeasureKey, string> = { waist: '', hips: '', chest: '', arm: '', thigh: '' };

/** Wpis dnia jednym zdaniem: „talia 84,5 · biodra 98,0”. */
const dayLine = (m: BodyMeasures): string =>
  MEASURES.filter((k) => m[k] !== undefined)
    .map((k) => `${measureName(k).toLocaleLowerCase(LOCALE)} ${formatCm(m[k]!)}`)
    .join(' · ');

function MeasureTile({ sum, list }: { sum: MeasureSummary; list: readonly BodyMeasures[] }) {
  const name = measureName(sum.key);
  const values = measureSeries(list, sum.key)
    .slice(-30)
    .map((p) => p.cm);
  return (
    <div className="sil-m">
      <div className="sil-m-head">
        <span>{name}</span>
        <b>{formatCm(sum.last)} cm</b>
      </div>
      <p className="sil-m-change">
        {sum.n > 1 ? T.change(formatCmChange(sum.change), dayLabel(sum.firstDay), sum.n) : T.once(dayLabel(sum.lastDay))}
      </p>
      {values.length >= 2 && <Trendline values={values} label={name} noun={T.noun} fmt={formatCm} />}
    </div>
  );
}

/**
 * Profil → „Sylwetka”: obwody (ostatnie liczby, zmiana od pierwszego pomiaru, mini wykres
 * każdego) i zdjęcia. Waga zostaje w karcie obok — to dwa dzienniki, każdy ze swoim formularzem.
 * Liczby bez ocen i bez progów.
 */
export function SilhouetteCard({
  state,
  onMeasures,
  onDeleteMeasures,
  onToast,
}: {
  state: AppState;
  /** Pomiar z dziś; pola puste nie przychodzą wcale, więc zostają, jak były. */
  onMeasures: (input: MeasureInput) => void;
  onDeleteMeasures: (day: string) => void;
  onToast: (m: string) => void;
}) {
  const list = measuresOf(state);
  const [vals, setVals] = useState(EMPTY);
  const today = dayKey(Date.now());
  const sums = MEASURES.map((k) => measureSummary(list, k)).filter((s): s is MeasureSummary => s !== null);
  const last = list.at(-1);
  const recent = list.slice(-5).reverse();
  const todayDone = last?.day === today;

  const save = (e: FormEvent) => {
    e.preventDefault();
    const input: MeasureInput = {};
    for (const key of MEASURES) {
      if (!vals[key].trim()) continue;
      const v = parse(vals[key]);
      if (!validMeasure(key, v)) {
        onToast(T.range(measureName(key), MEASURE_RANGE[key].min, MEASURE_RANGE[key].max));
        return;
      }
      input[key] = v;
    }
    if (!Object.keys(input).length) {
      onToast(T.nothing);
      return;
    }
    onMeasures(input);
    setVals(EMPTY);
  };

  return (
    <div className="grp sil">
      <h2>{T.title}</h2>
      <p className="tight">{last ? T.lead(dayLabel(last.day)) : T.none}</p>
      {sums.length > 0 && (
        <div className="sil-grid">
          {sums.map((s) => (
            <MeasureTile key={s.key} sum={s} list={list} />
          ))}
        </div>
      )}
      <details className="why sil-how">
        <summary>{T.howTo}</summary>
        <div>{T.howToText}</div>
      </details>
      <form className="sil-form" onSubmit={save} noValidate>
        <fieldset>
          <legend>{todayDone ? T.formToday : T.formNew}</legend>
          <div className="sil-fields">
            {MEASURES.map((key) => {
              const prev = measureSummary(list, key);
              return (
                <label className="fld" key={key}>
                  <span>{T.field(measureName(key))}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="num"
                    autoComplete="off"
                    placeholder={prev ? formatCm(prev.last) : ''}
                    value={vals[key]}
                    onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))}
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
        <button className="btn sm" type="submit">
          {T.save}
        </button>
      </form>
      {recent.length > 0 && (
        <div className="body-list" aria-label={T.recentAria}>
          {recent.map((m) => (
            <div className="sil-day" key={m.day}>
              <span className="cardio-name">{dayLabel(m.day)}</span>
              <span className="sil-day-vals">{dayLine(m)}</span>
              <button className="snack-del" onClick={() => onDeleteMeasures(m.day)} aria-label={T.deleteDay(dayLabel(m.day))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <SilhouettePhotos onToast={onToast} />
    </div>
  );
}

/* ---------------- Zdjęcia ---------------- */

/** Pełne zdjęcie jako adres `blob:` na czas oglądania; adres znika razem z widokiem. */
function useFullUrl(id: string | null): string | null {
  const [got, setGot] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    let made: string | null = null;
    void photoFull(id)
      .then((blob) => {
        if (!live || !blob) return;
        made = URL.createObjectURL(blob);
        setGot({ id, url: made });
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return got && got.id === id ? got.url : null;
}

/** Dzień zdjęcia z galerii: data pliku, jeśli ma sens; inaczej dziś. */
const fileDay = (file: File, today: string): string => {
  const at = file.lastModified;
  if (!Number.isFinite(at) || at <= 0) return today;
  const d = dayKey(at);
  return d > today ? today : d;
};

/** Napis zdjęcia w wyborze: dzień, a przy kilku z tego samego dnia — numer. */
function photoLabels(photos: readonly PhotoThumb[]): Map<string, string> {
  const perDay = new Map<string, number>();
  photos.forEach((p) => perDay.set(p.day, (perDay.get(p.day) ?? 0) + 1));
  const seen = new Map<string, number>();
  const out = new Map<string, string>();
  photos.forEach((p) => {
    const n = (seen.get(p.day) ?? 0) + 1;
    seen.set(p.day, n);
    out.set(p.id, (perDay.get(p.day) ?? 0) > 1 ? T.nth(dayLabel(p.day), n) : dayLabel(p.day));
  });
  return out;
}

const SHOWN = 9;

export function SilhouettePhotos({ onToast }: { onToast: (m: string) => void }) {
  const supported = photosSupported();
  const [photos, setPhotos] = useState<PhotoThumb[] | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [pair, setPair] = useState<{ before: string; after: string } | null>(null);
  const [killed, setKilled] = useState(() => cameraWasKilled());
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      setPhotos(await listPhotos());
      setReadFailed(false);
    } catch {
      setPhotos([]);
      setReadFailed(true);
    }
  }, []);

  useEffect(() => {
    if (supported) void reload();
  }, [supported, reload]);

  // Miniatury jako adresy `blob:` — tworzone raz na listę i oddawane, gdy lista się zmieni.
  useEffect(() => {
    if (!photos) return;
    const map: Record<string, string> = {};
    photos.forEach((p) => {
      map[p.id] = URL.createObjectURL(new Blob([p.thumb], { type: 'image/jpeg' }));
    });
    setThumbs(map);
    return () => Object.values(map).forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  // Zwykły powrót z aparatu (zdjęcie albo „Anuluj”): strona żyje, więc znacznik nie jest potrzebny.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === 'visible') clearCamera();
    };
    const input = camera.current;
    document.addEventListener('visibilitychange', back);
    input?.addEventListener('cancel', clearCamera);
    return () => {
      document.removeEventListener('visibilitychange', back);
      input?.removeEventListener('cancel', clearCamera);
    };
  }, [supported]);

  if (!supported) {
    return (
      <div className="sil-photos">
        <h3 className="sil-sub">{T.photos}</h3>
        <p className="tight">{T.unsupported}</p>
      </div>
    );
  }

  const today = dayKey(Date.now());

  const add = async (files: FileList | null, fromCamera: boolean) => {
    clearCamera();
    setKilled(false);
    const picked = files ? [...files] : [];
    if (!picked.length) return;
    setBusy(true);
    let added = 0;
    let problem: string | null = null;
    // Po jednym: dwanaście zdjęć z galerii naraz to dwanaście pełnych obrazów w pamięci.
    for (const file of picked) {
      let prepared: Awaited<ReturnType<typeof preparePhoto>>;
      try {
        prepared = await preparePhoto(file);
      } catch {
        problem = T.addFailed;
        continue;
      }
      try {
        await addPhoto({ day: fromCamera ? today : fileDay(file, today), ...prepared });
        added++;
      } catch {
        problem = T.storeFailed;
        break;
      }
    }
    setBusy(false);
    await reload();
    onToast(problem && !added ? problem : problem ? `${T.added(added)} ${problem}` : T.added(added));
  };

  const list = photos ?? [];
  const labels = photoLabels(list);
  const newest = [...list].reverse();
  const shown = all ? newest : newest.slice(0, SHOWN);
  const opened = openId ? list.find((p) => p.id === openId) ?? null : null;

  return (
    <div className="sil-photos">
      <h3 className="sil-sub">{T.photos}</h3>
      <p className="tight">{T.photosNote}</p>
      {killed && (
        <p className="sil-killed" role="status">
          {T.killed}
        </p>
      )}
      <div className="sil-add">
        <button
          type="button"
          className="btn sm"
          disabled={busy}
          onClick={() => {
            markCamera();
            camera.current?.click();
          }}
        >
          {T.camera}
        </button>
        <button type="button" className="btn sm ghost" disabled={busy} onClick={() => gallery.current?.click()}>
          {T.gallery}
        </button>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          data-testid="sil-camera"
          onChange={(e) => {
            const input = e.currentTarget;
            void add(input.files, true).finally(() => (input.value = ''));
          }}
        />
        <input
          ref={gallery}
          type="file"
          accept="image/*"
          multiple
          hidden
          data-testid="sil-gallery"
          onChange={(e) => {
            const input = e.currentTarget;
            void add(input.files, false).finally(() => (input.value = ''));
          }}
        />
      </div>
      {busy && (
        <p className="tight" role="status">
          {T.adding}
        </p>
      )}
      {readFailed && <p className="tight">{T.readFailed}</p>}
      {photos && !list.length && !readFailed && <p className="tight sil-soft">{T.noPhotos}</p>}

      {list.length > 0 && (
        <ul className="sil-thumbs" aria-label={T.listAria}>
          {shown.map((p) => {
            const label = labels.get(p.id) ?? dayLabel(p.day);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="sil-thumb"
                  aria-label={T.open(label)}
                  aria-pressed={openId === p.id}
                  onClick={() => setOpenId(openId === p.id ? null : p.id)}
                >
                  {thumbs[p.id] ? <img src={thumbs[p.id]} alt="" /> : <span className="sil-ph" />}
                  <span className="sil-thumb-day">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {newest.length > shown.length && (
        <button type="button" className="btn sm ghost" onClick={() => setAll(true)}>
          {T.more(newest.length)}
        </button>
      )}

      {/* Pod miniaturami, nie nad nimi: stuknięta miniatura zostaje na miejscu, a zdjęcie wchodzi tuż pod nią. */}
      {opened && (
        <PhotoViewer
          key={opened.id}
          photo={opened}
          label={labels.get(opened.id) ?? dayLabel(opened.day)}
          today={today}
          onClose={() => setOpenId(null)}
          onDay={async (day) => {
            await setPhotoDay(opened.id, day).catch(() => undefined);
            await reload();
          }}
          onDelete={async () => {
            try {
              await deletePhoto(opened.id);
              onToast(T.removed);
            } catch {
              onToast(T.storeFailed);
            }
            setOpenId(null);
            if (pair && (pair.before === opened.id || pair.after === opened.id)) setPair(null);
            await reload();
          }}
        />
      )}

      {list.length >= 2 &&
        (pair ? (
          <Compare photos={list} labels={labels} pair={pair} onPair={setPair} onClose={() => setPair(null)} />
        ) : (
          <button
            type="button"
            className="btn sm ghost sil-compare-btn"
            onClick={() => setPair({ before: list[0]!.id, after: list[list.length - 1]!.id })}
          >
            {T.compare}
          </button>
        ))}
    </div>
  );
}

/** Jedno zdjęcie w pełnym rozmiarze: dzień do poprawienia, „Pobierz”, „Usuń” z potwierdzeniem. */
function PhotoViewer({
  photo,
  label,
  today,
  onClose,
  onDay,
  onDelete,
}: {
  photo: PhotoThumb;
  label: string;
  today: string;
  onClose: () => void;
  onDay: (day: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const url = useFullUrl(photo.id);
  const [confirm, setConfirm] = useState(false);

  const download = async () => {
    const blob = await photoFull(photo.id).catch(() => null);
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = T.file(photo.day);
    a.click();
    // Safari zaczyna pobieranie chwilę po kliknięciu — adres musi jeszcze żyć.
    const href = a.href;
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <section className="sil-view" aria-label={T.alt(label)}>
      <div className="sil-frame" style={{ aspectRatio: `${photo.w} / ${photo.h}` }}>
        {url ? <img src={url} alt={T.alt(label)} /> : <span className="sil-ph">{T.loading}</span>}
      </div>
      <label className="fld">
        <span>{T.day}</span>
        <input
          type="date"
          value={photo.day}
          max={today}
          onChange={(e) => {
            if (e.target.value) void onDay(e.target.value);
          }}
        />
      </label>
      {confirm ? (
        <div className="sil-confirm" role="group" aria-label={T.removeQ}>
          <p className="tight">{T.removeQ}</p>
          <div className="sil-actions">
            <button type="button" className="btn sm" onClick={() => void onDelete()}>
              {T.removeYes}
            </button>
            <button type="button" className="btn sm ghost" onClick={() => setConfirm(false)}>
              {T.keep}
            </button>
          </div>
        </div>
      ) : (
        <div className="sil-actions">
          <button type="button" className="btn sm" onClick={() => void download()}>
            {T.download}
          </button>
          <button type="button" className="btn sm ghost" onClick={() => setConfirm(true)}>
            {T.remove}
          </button>
          <button type="button" className="btn sm ghost" onClick={onClose}>
            {T.close}
          </button>
        </div>
      )}
    </section>
  );
}

function ComparePhoto({ photo, label }: { photo: PhotoThumb | undefined; label: string }) {
  const url = useFullUrl(photo?.id ?? null);
  return (
    <figure className="sil-fig">
      <div className="sil-frame" style={photo ? { aspectRatio: `${photo.w} / ${photo.h}` } : undefined}>
        {url ? <img src={url} alt={T.alt(label)} /> : <span className="sil-ph">{T.loading}</span>}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** „Przed” i „Po” obok siebie — pełne zdjęcia wczytują się dopiero tutaj. */
function Compare({
  photos,
  labels,
  pair,
  onPair,
  onClose,
}: {
  photos: readonly PhotoThumb[];
  labels: Map<string, string>;
  pair: { before: string; after: string };
  onPair: (p: { before: string; after: string }) => void;
  onClose: () => void;
}) {
  const by = (id: string) => photos.find((p) => p.id === id);
  const options = photos.map((p) => (
    <option key={p.id} value={p.id}>
      {labels.get(p.id) ?? dayLabel(p.day)}
    </option>
  ));
  return (
    <section className="sil-compare" aria-label={T.compare}>
      <div className="sil-pick">
        <label className="fld">
          <span>{T.before}</span>
          <select value={pair.before} onChange={(e) => onPair({ ...pair, before: e.target.value })}>
            {options}
          </select>
        </label>
        <label className="fld">
          <span>{T.after}</span>
          <select value={pair.after} onChange={(e) => onPair({ ...pair, after: e.target.value })}>
            {options}
          </select>
        </label>
      </div>
      <div className="sil-pair">
        <ComparePhoto photo={by(pair.before)} label={`${T.before} · ${labels.get(pair.before) ?? ''}`} />
        <ComparePhoto photo={by(pair.after)} label={`${T.after} · ${labels.get(pair.after) ?? ''}`} />
      </div>
      <button type="button" className="btn sm ghost" onClick={onClose}>
        {T.compareClose}
      </button>
    </section>
  );
}
