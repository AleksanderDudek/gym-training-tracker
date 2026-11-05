import { useMemo, useState, type ReactNode } from 'react';
import { GEAR_LABEL, ex, groupLabel } from '../data/exercises';
import { MUSCLES, MUSCLE_NAME } from '../data/muscles';
import type { MuscleId } from '../data/muscles';
import { catalogId, defOf, isCatalogId, musclesOf, srcOf } from '../data/catalog/derive';
import type { CatalogRow } from '../data/catalog/derive';
import { loadCatalog, loadSteps, useLoaded } from '../data/catalog/load';
import { eqLabel, nameOf, searchCatalog } from '../data/catalog/search';
import { TWINS, twinOf } from '../data/catalog/twins';
import { splitHits } from '../engine/find';
import { plural } from '../engine/quips';
import { exercisePath, go } from '../routing';
import type { AppState, ExerciseId, Gear } from '../types';
import { ExerciseMuscles, sexOf } from './ExerciseMuscles';
import { EmptyState } from './ui';
import { LANG, pluralEn, text } from '../i18n';

const T = text({
  pl: {
    lead: 'Ponad 1300 ćwiczeń z opisem krok po kroku i mapą pracujących mięśni. Każde da się dodać do własnego treningu — od tej chwili ma progresję jak ćwiczenia z biblioteki.',
    search: 'Szukaj w katalogu',
    searchPh: 'np. wiosłowanie, wyciąg, łydki',
    muscle: 'Partia mięśni',
    anyMuscle: 'wszystkie partie',
    all: 'każdy sprzęt',
    count: (n: number) => `${n} ${plural(n, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'])}`,
    more: (n: number) => `Pokaż więcej (${n})`,
    none: 'Nic nie pasuje. Spróbuj początku słowa albo zdejmij filtr.',
    loading: 'Wczytuję katalog…',
    failed: 'Katalog się nie wczytał — sprawdź połączenie.',
    retry: 'Spróbuj jeszcze raz',
    short: { barbell: 'SZT', dumbbell: 'HANT', kettlebell: 'KB', machine: 'MASZ', band: 'GUMA', bodyweight: 'CIAŁO' } as Record<Gear, string>,
    fromCatalog: 'Z katalogu ćwiczeń',
    muscles: 'Pracujące mięśnie',
    steps: 'Krok po kroku',
    stepsLoading: 'Wczytuję kroki…',
    stepsFailed: 'Kroki się nie wczytały.',
    video: 'Jak to wygląda — wideo',
    videoText:
      'Do ćwiczeń z katalogu nie mamy jeszcze wybranych filmów. Wyszukiwanie otworzy YouTube z nazwą ćwiczenia — wybierz nagranie trenera, nie przypadkowe.',
    ytSearch: 'Szukaj nagrań w YouTube →',
    source: 'Opis i mięśnie: ExerciseDB v1 przez zbiór hasaneyldrm/exercises-dataset, licencja MIT. Polska nazwa: tłumaczenie GYM TRACKER.',
    licence: 'Licencja',
    twinTitle: 'To ćwiczenie jest w bibliotece',
    twinText: (name: string) => `„${name}” ma w bibliotece filmy, tor ruchu i dopracowaną progresję. Tam lepiej je planować.`,
    twinGo: 'Otwórz w bibliotece →',
    noExTitle: 'Nie ma takiego ćwiczenia',
    noExText: (id: string) => `W katalogu nie ma pozycji „${id}”.`,
    unit: (secs: boolean, gear: string, eq: string): ReactNode => (
      <>
        Jednostka: <b>{secs ? 'sekundy' : 'powtórzenia'}</b>. Sprzęt: <b>{eq}</b> (drabina ciężaru: {gear}).
      </>
    ),
  },
  en: {
    lead: 'Over 1,300 exercises with step-by-step instructions and a map of the working muscles. Add any of them to your own workout — from then on it progresses like the library exercises.',
    search: 'Search the catalogue',
    searchPh: 'e.g. row, cable, calves',
    muscle: 'Muscle group',
    anyMuscle: 'all groups',
    all: 'any equipment',
    count: (n: number) => `${n} ${pluralEn(n, 'exercise', 'exercises')}`,
    more: (n: number) => `Show more (${n})`,
    none: 'Nothing matches. Try the start of a word or clear a filter.',
    loading: 'Loading the catalogue…',
    failed: 'The catalogue didn’t load — check your connection.',
    retry: 'Try again',
    short: { barbell: 'BAR', dumbbell: 'DB', kettlebell: 'KB', machine: 'MACH', band: 'BAND', bodyweight: 'BODY' } as Record<Gear, string>,
    fromCatalog: 'From the exercise catalogue',
    muscles: 'Working muscles',
    steps: 'Step by step',
    stepsLoading: 'Loading the steps…',
    stepsFailed: 'The steps didn’t load.',
    video: 'What it looks like — videos',
    videoText:
      'We haven’t picked videos for catalogue exercises yet. The search opens YouTube with the exercise name — pick a coach’s video, not a random one.',
    ytSearch: 'Search YouTube →',
    source: 'Description and muscles: ExerciseDB v1 via the hasaneyldrm/exercises-dataset collection, MIT licence.',
    licence: 'Licence',
    twinTitle: 'This exercise is in the library',
    twinText: (name: string) => `“${name}” has videos, a movement path and fine-tuned progression in the library. Plan it there.`,
    twinGo: 'Open in the library →',
    noExTitle: 'No such exercise',
    noExText: (id: string) => `There’s no “${id}” in the catalogue.`,
    unit: (secs: boolean, gear: string, eq: string): ReactNode => (
      <>
        Unit: <b>{secs ? 'seconds' : 'reps'}</b>. Equipment: <b>{eq}</b> (weight ladder: {gear}).
      </>
    ),
  },
});

const PAGE = 40;
const GEARS: Gear[] = ['barbell', 'dumbbell', 'kettlebell', 'machine', 'band', 'bodyweight'];

/** Wyszukiwanie YouTube po angielskiej nazwie — tam jest najwięcej nagrań technicznych. */
export const youtubeSearch = (nameEn: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nameEn} exercise technique`)}`;

const licenceUrl = `${import.meta.env.BASE_URL}licenses/exercises-dataset.txt`;

/* Stan filtrów przeżywa wejście w ćwiczenie i powrót strzałką — tylko w tej karcie przeglądarki. */
const KEY = 'gt:catalog-filter';
type Saved = { q: string; m: MuscleId | null; g: Gear | null };
const readSaved = (): Saved => {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Saved | null;
    if (v && typeof v.q === 'string') return v;
  } catch {
    /* bez pamięci sesji — puste filtry */
  }
  return { q: '', m: null, g: null };
};
const writeSaved = (v: Saved): void => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* jw. */
  }
};

function Loading({ state, retry, text: label }: { state: 'loading' | 'error'; retry: () => void; text: string }) {
  if (state === 'loading') return <p className="tight">{label}</p>;
  return (
    <p className="tight">
      {T.failed}{' '}
      <button type="button" className="btn ghost sm" onClick={retry}>
        {T.retry}
      </button>
    </p>
  );
}

/** Spis katalogu w atlasie: szukanie, sprzęt, partia mięśni i lista porcjami po 40. */
export function CatalogBrowser() {
  const rows = useLoaded(loadCatalog);
  const [f, setF] = useState<Saved>(readSaved);
  const [shown, setShown] = useState(PAGE);
  const set = (patch: Partial<Saved>) => {
    const next = { ...f, ...patch };
    setF(next);
    setShown(PAGE);
    writeSaved(next);
  };
  const found = useMemo(
    () => (rows.state === 'ready' ? searchCatalog(rows.value, { query: f.q, muscle: f.m, gear: f.g }) : []),
    [rows, f],
  );

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead}</p>
        <label className="fld cat-search">
          <span>{T.search}</span>
          <input
            type="search"
            value={f.q}
            placeholder={T.searchPh}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => set({ q: e.target.value })}
          />
        </label>
        <div className="gearfilter">
          <button aria-pressed={f.g === null} onClick={() => set({ g: null })}>
            {T.all}
          </button>
          {GEARS.map((g) => (
            <button key={g} aria-pressed={f.g === g} onClick={() => set({ g: f.g === g ? null : g })}>
              {GEAR_LABEL[g]}
            </button>
          ))}
        </div>
        <label className="fld cat-muscle">
          <span>{T.muscle}</span>
          <select value={f.m ?? ''} onChange={(e) => set({ m: (e.target.value || null) as MuscleId | null })}>
            <option value="">{T.anyMuscle}</option>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_NAME[m]}
              </option>
            ))}
          </select>
        </label>
        {rows.state === 'ready' ? (
          <p className="tight" aria-live="polite" style={{ marginTop: 8 }}>
            {found.length ? T.count(found.length) : T.none}
          </p>
        ) : (
          <Loading state={rows.state} retry={rows.retry} text={T.loading} />
        )}
      </div>
      {found.slice(0, shown).map(({ row, hits }) => {
        const def = defOf(row);
        return (
          <button className="atlas-row" key={row.i} onClick={() => go(exercisePath(catalogId(row.i)))}>
            <div className="chip bw" aria-hidden="true">
              <span className="n">{T.short[def.gear]}</span>
            </div>
            <div>
              <div className="ex-name">
                {splitHits(nameOf(row), hits).map((p, k) => (p.on ? <mark key={k}>{p.text}</mark> : <span key={k}>{p.text}</span>))}
              </div>
              <div className="ex-target">
                {eqLabel(row)}
                {def.muscles.p.length > 0 && ` · ${def.muscles.p.map((m) => MUSCLE_NAME[m]).join(', ')}`}
              </div>
            </div>
            <div className="go">→</div>
          </button>
        );
      })}
      {found.length > shown && (
        <div className="wrap">
          <button className="btn ghost wide" onClick={() => setShown((n) => n + PAGE * 2)}>
            {T.more(found.length - shown)}
          </button>
        </div>
      )}
    </>
  );
}

/** Kroki ćwiczenia z katalogu (po id źródła), w języku strony. */
export function CatalogSteps({ src }: { src: string }) {
  const steps = useLoaded(loadSteps);
  if (steps.state !== 'ready') return <Loading state={steps.state} retry={steps.retry} text={T.stepsLoading} />;
  const list = steps.value[src];
  if (!list?.length) return <p className="tight">{T.stepsFailed}</p>;
  return (
    <ol className="cat-steps">
      {list.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  );
}

/** Źródło kroków dla ćwiczenia silnika: samo z katalogu albo bliźniak ćwiczenia z biblioteki. */
export const stepsSrcOf = (id: ExerciseId): string | undefined => (isCatalogId(id) ? srcOf(id) : twinOf(id));

/** Podpis źródła pod krokami (MIT wymaga noty). */
export function CatalogSource() {
  return (
    <p className="disclaimer cat-source">
      {T.source}{' '}
      <a href={licenceUrl} target="_blank" rel="noopener">
        {T.licence}
      </a>
    </p>
  );
}

/**
 * Strona ćwiczenia z katalogu, którego jeszcze nie ma w treningach. Po dodaniu do treningu
 * (adopcja) adres zostaje ten sam, a strona staje się zwykłą stroną ćwiczenia z poziomem i drabiną.
 * `add` dostaje wiersz katalogu — atlas wstawia tam „Dodaj do treningu” z adopcją.
 */
export function CatalogExercisePage({
  state,
  id,
  add,
}: {
  state: AppState;
  id: ExerciseId;
  add: (row: CatalogRow) => ReactNode;
}) {
  const rows = useLoaded(loadCatalog);
  if (rows.state !== 'ready')
    return (
      <div className="wrap">
        <Loading state={rows.state} retry={rows.retry} text={T.loading} />
      </div>
    );
  const row = rows.value.find((r) => r.i === srcOf(id));
  if (!row)
    return (
      <div className="wrap">
        <EmptyState title={T.noExTitle} text={T.noExText(id)} cast={{ who: 'siwy', mood: 'wise' }} />
      </div>
    );
  const twin = TWINS[row.i];
  const def = defOf(row);

  return (
    <>
      <div className="wrap">
        <div className="ex-hero">
          <div className="chip bw" aria-hidden="true">
            <span className="n">{T.short[def.gear]}</span>
          </div>
          <div>
            <div className="ex-group">
              {groupLabel(def.group)} · {eqLabel(row)}
            </div>
            <h2 className="ex-h">{nameOf(row)}</h2>
            <div className="ex-target">{T.fromCatalog}</div>
          </div>
        </div>
      </div>

      {twin && (
        <div className="grp cat-twin">
          <h2>{T.twinTitle}</h2>
          <p>{T.twinText(ex(twin).name)}</p>
          <button className="btn sm" onClick={() => go(exercisePath(twin))}>
            {T.twinGo}
          </button>
        </div>
      )}

      <div className="grp">
        <h2>{T.steps}</h2>
        <CatalogSteps src={row.i} />
        <p className="tight">{T.unit(def.unit === 'secs', GEAR_LABEL[def.gear], eqLabel(row))}</p>
      </div>

      {!twin && add(row)}

      <div className="sect-label">{T.muscles}</div>
      <div className="grp">
        <ExerciseMuscles use={musclesOf(row)} sex={sexOf(state)} />
      </div>

      <div className="sect-label">{T.video}</div>
      <div className="grp">
        <p className="tight">{T.videoText}</p>
        <a className="vidlink" href={youtubeSearch(row.n[1])} target="_blank" rel="noopener noreferrer">
          {T.ytSearch}
        </a>
      </div>

      <div className="wrap">
        <CatalogSource />
      </div>
    </>
  );
}

/** Nazwa w drugim języku — do podpowiedzi przy nazwie, gdy ktoś zna ćwiczenie z angielskiego. */
export const otherName = (row: CatalogRow): string => (LANG === 'pl' ? row.n[1] : row.n[0]);
