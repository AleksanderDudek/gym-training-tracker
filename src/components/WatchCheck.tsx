import { useDeferredValue, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { CircleAlert, CircleCheck, CircleQuestionMark, CircleX } from 'lucide-react';
import { GARMIN_APP_URL } from '../garmin';
import { HEALTH_ANDROID_URL, HEALTH_IOS_URL, phoneConfigured, platformOf } from '../phone';
import { cardioAddPath } from '../routing';
import { EXTRA, POPULAR } from '../watches/extra';
import { answer, answerFor, suggest } from '../watches/find';
import { GARMIN, supportedById, supportedByLine } from '../watches/list';
import { rememberWatch } from '../watches/remember';
import type { RememberedWatch } from '../watches/remember';
import type { Answer, Cap, Hit, Short, Verdict } from '../watches/types';
import { deviceCardPath, goToCard } from './DeviceStatus';
import { T } from './WatchCheck.text';
import { CAPS, W, lacksText } from './WatchCheck.words';

/**
 * „Czy mój zegarek jest obsługiwany?” — pierwszy widok karty zegarka i `#/zegarek`.
 *
 * Pole z podpowiedziami według wzorca combobox z WAI-ARIA (jak wybór ćwiczenia): podpowiedzi od
 * dwóch znaków, nic nie jest podświetlone samo, strzałki chodzą po liście, Enter wybiera
 * podświetloną albo sprawdza wpisane, Escape najpierw zamyka listę, potem czyści pole. Każdy wybór
 * przenosi fokus na nagłówek wyniku — zamyka klawiaturę telefonu, a czytnik ekranu od razu czyta
 * nazwę i odpowiedź. Każda odpowiedź kończy się jednym następnym krokiem: połączyć zegarek, połączyć
 * telefon albo wpisywać kroki.
 *
 * Moduł jest leniwy (lista zegarków, wyszukiwarka, ikony): karta w głównej paczce zna tylko
 * zapamiętany model i kilka słów (`WatchCheck.words.ts`).
 */

type Os = 'ios' | 'android';
type One = Extract<Answer, { kind: 'one' }>;
type Look = 'ok' | 'part' | 'no' | 'other';

/** Co widać po sprawdzeniu — dla cichych przycisków karty pod spodem. */
export type CheckShown = 'supported' | 'unsupported' | null;

interface Result {
  /** Tekst, o który zapytano — do „Nie znam „…””. */
  q: string;
  a: Answer;
}

/** ®, ™ i © w polu i na skrótach: tak, jak ludzie piszą nazwy. */
const MARKS = /[®™©]/g;
const plainName = (name: string): string => name.replace(MARKS, '').replace(/\s+/g, ' ').trim();

const lower1 = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/* ---------------- odpowiedź słowami ---------------- */

/** Krótka odpowiedź na werdykt — nagłówek, wiersz listy, zapamiętany model. */
export function shortOf(v: Verdict): Short {
  switch (v.kind) {
    case 'full':
      return 'ok';
    case 'update':
      // „Po aktualizacji” to pole w „Więcej” i krok połączenia, nigdy nagłówek.
      return v.lacks.length ? 'part' : 'ok';
    case 'limited':
    case 'apac':
      return 'part';
    case 'notYet':
      return 'notYet';
    case 'otherBrand':
      return 'other';
    default:
      return 'no';
  }
}

/** Kolor i ikona stanu tylko wspierają słowo — każdy z czterech stanów ma własną ikonę. */
const lookOf = (s: Short): Look => (s === 'notYet' ? 'no' : s);

const ICON: Record<Look, typeof CircleCheck> = {
  ok: CircleCheck,
  part: CircleAlert,
  no: CircleX,
  other: CircleQuestionMark,
};

const isSupported = (s: Short): boolean => s === 'ok' || s === 'part';

export const shownOf = (a: Answer | null): CheckShown => {
  if (a?.kind !== 'one') return null;
  return isSupported(shortOf(a.hit.target.verdict)) ? 'supported' : 'unsupported';
};

/** Czego model nie udostępnia aplikacjom; dla wersji azjatyckiej — jej braki. */
const lacksOf = (v: Verdict): Cap[] => ('lacks' in v ? v.lacks : []);

/** „kroki, przejazdy rowerem, tętno, stres i Body Battery” — bez tego, czego model nie da. */
const arriving = (lacks: readonly Cap[]): string[] => [
  W.steps,
  ...(lacks.includes('rides') ? [] : [W.cap.rides]),
  W.hr,
  ...(['stress', 'bodyBattery'] as const).filter((c) => !lacks.includes(c)).map((c) => W.cap[c]),
];

/** Dane w mianowniku, w stałej kolejności: „stres, Body Battery i przejazdy rowerem”. */
const capsText = (caps: readonly Cap[]): string => W.and(CAPS.filter((c) => caps.includes(c)).map((c) => W.cap[c]));

/** Model do zapamiętania: nazwa jak w nagłówku, krótka odpowiedź, braki i to, co wymaga aktualizacji. */
function toRemember(a: One): RememberedWatch {
  const v = a.hit.target.verdict;
  const product = a.hit.target.id ? supportedById(a.hit.target.id) : undefined;
  const lacks = lacksOf(v);
  return {
    key: a.hit.target.key,
    name: a.title,
    v: shortOf(v),
    ...(lacks.length ? { lacks } : {}),
    ...(v.kind === 'update' && v.newest.length ? { newest: v.newest } : {}),
    ...(product?.bg ? { bg: product.bg } : {}),
  };
}

/**
 * Odpowiedź dla jednego modelu wybranego z listy, skrótu albo przycisku: pełna, z podobnymi
 * nazwami, gdy nazwa prowadzi do tego modelu; inaczej sam model pod wybraną nazwą.
 */
function chosen(key: string, name: string): Answer {
  const a = answer(name);
  if (a.kind === 'one' && a.hit.target.key === key) return a;
  const b = answerFor(key);
  return b.kind === 'one' ? { ...b, title: name } : b;
}

/** Na starcie: identyfikator (`fr265`, zapamiętany model) albo tekst (`?model=fr 265`). */
function startOf(initial: string | undefined): { query: string; result: Result | null } {
  const q = initial?.trim();
  if (!q) return { query: '', result: null };
  const byKey = answerFor(q);
  if (byKey.kind === 'one') return { query: plainName(byKey.title), result: { q, a: chosen(q, byKey.title) } };
  return { query: q, result: { q, a: answer(q) } };
}

/**
 * Podobna nazwa, inna odpowiedź — po jednej na każdą inną odpowiedź. Wersja azjatycka siedzi
 * w notce pod „Więcej”, więc jako pytanie wraca tylko wtedy, gdy pytano o nią samą.
 */
function othersOf(a: One): Hit[] {
  const main = a.hit.target.verdict.kind;
  const region = main === 'apac' || main === 'regional';
  const mine = shortOf(a.hit.target.verdict);
  const seen = new Set<Short>([mine]);
  return a.other.filter((h) => {
    const k = h.target.verdict.kind;
    if (!region && (k === 'apac' || k === 'regional')) return false;
    const s = shortOf(h.target.verdict);
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

/** „W Connect IQ to ten sam zegarek co …”: pisownia ze sklepu albo model innej linii (tactix® 7 → fēnix® 7X). */
function twinOf(a: One): string | null {
  if (a.hit.target.verdict.kind === 'otherBrand') return null;
  if (a.hit.as) return a.hit.name;
  const first = a.hit.target.names[0]!;
  const brand = (n: string) => n.split(' ')[0];
  return brand(a.hit.name) !== brand(first) ? first : null;
}

/** Produkty, których wersji azjatyckiej sklep nie przyjmuje (notka w „Więcej”). */
const REFUSED_APAC = new Set(EXTRA.filter((x) => x.reason === 'regional' && x.of).map((x) => x.of!));

/* ---------------- telefon zamiast zegarka ---------------- */

/** Telefony, o których mówi rada: ten, na którym otwarto stronę, na komputerze oba; Apple Watch — iPhone. */
function phonesHere(apple: boolean): { systems: Os[]; has: (os: Os) => boolean } {
  const here = platformOf(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const systems: Os[] = apple ? ['ios'] : here === 'other' ? ['android', 'ios'] : [here];
  const has = (os: Os) => phoneConfigured() && (os === 'ios' ? HEALTH_IOS_URL : HEALTH_ANDROID_URL) !== '';
  return { systems, has };
}

/** Pudełko „Zamiast tego — telefon”: ta sama droga co karta telefonu, dobrana do marki i systemu. */
function PhoneRoute({ verdict }: { verdict: Verdict }) {
  const apple = verdict.kind === 'otherBrand' && verdict.only === 'ios';
  // Garmin — przez Garmin Connect; inna marka — przez jej aplikację, nazwaną tylko tam, gdzie wiadomo.
  const from = verdict.kind === 'otherBrand' ? (verdict.app ?? '') : null;
  const { systems, has } = phonesHere(apple);
  const any = systems.some(has);
  const lines =
    !any && systems.length > 1
      ? [T.byHand]
      : systems.map((os) =>
          os === 'android'
            ? has(os)
              ? T.viaAndroid(from)
              : T.byHand
            : has(os)
              ? apple
                ? T.viaIosApple
                : T.viaIos(from)
              : T.iosNotYet,
        );
  return (
    <div className="wc-instead">
      <p className="wc-instead-title">{T.instead}</p>
      {lines.map((line) => (
        <p className="tight" key={line}>
          {line}
        </p>
      ))}
      <div className="watch-actions">
        {any ? (
          <a
            className="btn sm"
            href={deviceCardPath('phone')}
            onClick={(e) => {
              e.preventDefault();
              goToCard('phone');
            }}
          >
            {T.toPhone}
          </a>
        ) : (
          <a className="btn sm" href={cardioAddPath('steps')}>
            {T.toSteps}
          </a>
        )}
        {any && systems.some((os) => !has(os)) && (
          <a className="vidlink" href={cardioAddPath('steps')}>
            {T.toSteps}
          </a>
        )}
      </div>
    </div>
  );
}

/* ---------------- karty wyniku ---------------- */

type Pick = (key: string, name: string) => void;

/** Nagłówek wyniku: na niego idzie fokus po każdym wyborze. */
function Heading({ headRef, children }: { headRef: RefObject<HTMLHeadingElement | null>; children: ReactNode }) {
  return (
    <h3 className="wc-head" tabIndex={-1} ref={headRef}>
      {children}
    </h3>
  );
}

/** Ikona stanu — obok słowa, nigdy zamiast niego. */
function StateIcon({ look }: { look: Look }) {
  const Icon = ICON[look];
  return <Icon className="wc-icon" size={18} aria-hidden="true" focusable="false" />;
}

/** Nazwa, którą da się sprawdzić jednym stuknięciem. */
function NameButton({ hit, onPick, tag = false }: { hit: Hit; onPick: Pick; tag?: boolean }) {
  const s = shortOf(hit.target.verdict);
  const name = hit.as ?? hit.name;
  return (
    <button type="button" className="wc-name" onClick={() => onPick(hit.target.key, name)}>
      <span className="wc-n">{name}</span>
      {tag && (
        <>
          {' '}
          <span className={`wc-tag ${lookOf(s)}`}>· {W.short[s]}</span>
        </>
      )}
    </button>
  );
}

function Question({ hit, onPick }: { hit: Hit; onPick: Pick }) {
  return (
    <p className="tight wc-question">
      {T.otherQuestion(<NameButton hit={hit} onPick={onPick} />, lower1(T.verdict[shortOf(hit.target.verdict)]))}
    </p>
  );
}

/** „Tak samo: …” — modele z tą samą odpowiedzią. */
function sameText(a: One): string | null {
  if (!a.same.length) return null;
  const names = a.same.slice(0, 4).map((h) => h.as ?? h.name);
  return T.same(names.join(', '), a.same.length - names.length);
}

/** Dlaczego zegarek nie zadziała z aplikacją — jedno zdanie, z nazwą z nagłówka. */
function reasonText(v: Verdict, name: string): string {
  switch (v.kind) {
    case 'oldCiq':
      return T.oldCiq(name, v.ciq);
    case 'noBackground':
      return T.noBackground(name, v.ciq);
    case 'noApps':
      return T.noApps(name);
    case 'noCiq':
      return T.noCiq(name);
    case 'notWatch':
      return T[v.what](name);
    case 'notYet':
      return T.notYet;
    case 'regional':
      return T.regional;
    case 'otherBrand':
      return v.bike ? T.brandBike(name) : `${T.brand(name)}${v.only === 'ios' ? ` ${T.apple}` : ''}`;
    default:
      return '';
  }
}

function OneCard({
  a,
  headRef,
  onPick,
  onConnect,
  onFeedback,
}: {
  a: One;
  headRef: RefObject<HTMLHeadingElement | null>;
  onPick: Pick;
  onConnect?: (() => void) | undefined;
  onFeedback?: (() => void) | undefined;
}) {
  const v = a.hit.target.verdict;
  const s = shortOf(v);
  const look = lookOf(s);
  const others = othersOf(a);
  const twin = twinOf(a);
  const same = sameText(a);
  const head = (
    <Heading headRef={headRef}>
      <span className="wc-title">{a.title}</span> ·{' '}
      <span className="wc-verdict">
        <StateIcon look={look} />
        {T.verdict[s]}
      </span>
    </Heading>
  );

  if (!isSupported(s))
    return (
      <div className={`wc-result ${look}`}>
        {head}
        {/* Najpierw pytanie o podobną nazwę: najczęstsza poprawka „nie” to inny model z tej samej linii. */}
        {others.map((h) => (
          <Question key={h.target.key} hit={h} onPick={onPick} />
        ))}
        {twin && <p className="tight wc-sub">{T.sameWatch(twin)}</p>}
        <p className="tight">{reasonText(v, a.title)}</p>
        <PhoneRoute verdict={v} />
        {same && <p className="tight wc-sub">{same}</p>}
      </div>
    );

  const lacks = lacksOf(v);
  const product = a.hit.target.id ? supportedById(a.hit.target.id) : undefined;
  const { systems, has } = phonesHere(false);
  const newest = v.kind === 'update' ? v.newest : [];
  return (
    <div className={`wc-result ${look}`}>
      {head}
      {twin && <p className="tight wc-sub">{T.sameWatch(twin)}</p>}
      {v.kind === 'apac' ? (
        <p className="tight">
          <span className="wc-tag part">{T.asian}</span> {T.asianCard(W.and(arriving(lacks)), capsText(lacks), lacks.length > 1)}
        </p>
      ) : (
        <>
          <p className="tight">{T.arrive(W.and(arriving(lacks)))}</p>
          {lacks.length > 0 && <p className="tight">{T.lacks(lacksText(lacks))}</p>}
        </>
      )}
      {onConnect && (
        <button type="button" className="btn sm wc-connect" onClick={onConnect}>
          {T.connect}
        </button>
      )}
      <details className="dev-check wc-more">
        <summary>{T.more}</summary>
        {same && <p className="tight">{same}</p>}
        {others.map((h) => (
          <Question key={h.target.key} hit={h} onPick={onPick} />
        ))}
        {systems.some(has) && <p className="tight">{lacks.includes('rides') ? T.bothWaysRides : T.bothWays}</p>}
        {newest.length > 0 && (
          <p className="tight">
            {T.newest(capsText(newest), newest.length > 1)} {T.howUpdate}
          </p>
        )}
        {product && <p className="tight">{T.ciqLine(product.ciq)}</p>}
        {product?.apac && v.kind !== 'apac' && <p className="tight">{T.asianNote(lacksText(product.apac.lacks))}</p>}
        {product && REFUSED_APAC.has(product.id) && <p className="tight">{T.regionalNote}</p>}
        {onFeedback && (
          <button type="button" className="wc-linkbtn" onClick={onFeedback}>
            {T.feedback}
          </button>
        )}
      </details>
    </div>
  );
}

/** Linia, w której modele się różnią — pogrupowane według odpowiedzi. */
function LineCard({ hits, headRef, onPick }: { hits: Hit[]; headRef: RefObject<HTMLHeadingElement | null>; onPick: Pick }) {
  const order: Short[] = ['ok', 'part', 'no', 'notYet', 'other'];
  const groups = order
    .map((s) => ({ s, hits: hits.filter((h) => shortOf(h.target.verdict) === s) }))
    .filter((g) => g.hits.length);
  const what = hits[0]?.target.series || hits[0]?.name || '';
  return (
    <div className="wc-result line">
      <Heading headRef={headRef}>{T.line(what)}</Heading>
      {groups.map((g) => (
        <div key={g.s} className="wc-group">
          <p className={`wc-group-title ${lookOf(g.s)}`}>{T.group[g.s]}</p>
          <ul className="wc-names">
            {g.hits.map((h) => (
              <li key={h.target.key}>
                <NameButton hit={h} onPick={onPick} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GuessCard({ q, hits, headRef, onPick }: { q: string; hits: Hit[]; headRef: RefObject<HTMLHeadingElement | null>; onPick: Pick }) {
  return (
    <div className="wc-result other">
      <Heading headRef={headRef}>
        <span className="wc-verdict">
          <StateIcon look="other" />
          {T.guess(q)}
        </span>
      </Heading>
      <ul className="wc-names">
        {hits.map((h) => (
          <li key={h.target.key}>
            <NameButton hit={h} onPick={onPick} tag />
          </li>
        ))}
      </ul>
    </div>
  );
}

function UnknownCard({
  q,
  near,
  headRef,
  onPick,
  onFeedback,
}: {
  q: string;
  near: Hit[];
  headRef: RefObject<HTMLHeadingElement | null>;
  onPick: Pick;
  onFeedback?: (() => void) | undefined;
}) {
  return (
    <div className="wc-result other">
      <Heading headRef={headRef}>
        <span className="wc-verdict">
          <StateIcon look="other" />
          {T.unknown(q)}
        </span>
      </Heading>
      <p className="tight">{T.unknownText}</p>
      {near.length > 0 && (
        <>
          <p className="tight wc-sub">{T.near}</p>
          <ul className="wc-names">
            {near.map((h) => (
              <li key={h.target.key}>
                <NameButton hit={h} onPick={onPick} tag />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="tight">
        <a href={GARMIN_APP_URL} target="_blank" rel="noopener noreferrer">
          {T.storeList}
        </a>
      </p>
      {onFeedback && (
        <button type="button" className="btn ghost sm" onClick={onFeedback}>
          {T.write}
        </button>
      )}
    </div>
  );
}

/* ---------------- pole i całość ---------------- */

export default function WatchCheck({
  onConnect,
  onFeedback,
  onShown,
  initial,
  compact = false,
}: {
  /** „Połącz zegarek” na karcie obsługiwanego modelu; bez niego (zegarek już połączony) przycisku nie ma. */
  onConnect?: (() => void) | undefined;
  /** „Napisz do autora” — okno uwag; bez niego przycisków nie ma. */
  onFeedback?: (() => void) | undefined;
  /** Co widać po każdej zmianie wyniku — karta dobiera do tego ciche przyciski. */
  onShown?: ((shown: CheckShown) => void) | undefined;
  /** Identyfikator albo tekst do sprawdzenia od razu (zapamiętany model, `?model=`) — bez ruszania fokusu. */
  initial?: string | undefined;
  /** W połączonej karcie: bez skrótów, pełnej listy i źródła; pole dostaje fokus, gdy nie ma `initial`. */
  compact?: boolean | undefined;
}) {
  const uid = useId();
  const inputId = `${uid}-in`;
  const listId = `${uid}-list`;
  const optId = (i: number): string => `${uid}-opt-${i}`;
  const [start] = useState(() => startOf(initial));
  const [query, setQuery] = useState(start.query);
  const [result, setResult] = useState<Result | null>(start.result);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [whereOpen, setWhereOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [allSeen, setAllSeen] = useState(false);
  const [said, setSaid] = useState<{ q: string; text: string } | null>(null);
  const deferred = useDeferredValue(query);
  const field = useRef<HTMLInputElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const where = useRef<HTMLElement>(null);
  const focusTo = useRef<'head' | 'where' | 'field' | null>(null);
  const shownTo = useRef(onShown);

  // Niski ekran (telefon z klawiaturą): mniej podpowiedzi, żeby lista nie zeszła pod klawiaturę.
  const limit = window.innerHeight < 700 ? 5 : 8;
  const typed = deferred.trim();
  const found = open && typed.length >= 2 ? suggest(deferred, limit) : null;
  const hits = found?.hits ?? [];
  const listOpen = hits.length > 0;
  const activeHit = active >= 0 ? hits[active] : undefined;
  const total = found ? found.total : null;
  const idle = !result || result.a.kind === 'prompt';

  useEffect(() => {
    shownTo.current = onShown;
  });

  useEffect(() => {
    shownTo.current?.(shownOf(result?.a ?? null));
  }, [result]);

  // Fokus po wyborze: na nagłówek wyniku (albo na „Gdzie znajdę…”, albo z powrotem do pola).
  useEffect(() => {
    const to = focusTo.current;
    focusTo.current = null;
    if (to === 'head') head.current?.focus();
    else if (to === 'where') where.current?.focus();
    else if (to === 'field') field.current?.focus();
  }, [result]);

  // Otwarte przyciskiem w połączonej karcie („Zmień model”, „Sprawdź →”): od razu do pisania.
  const [focusFirst] = useState(() => compact && !initial);
  useEffect(() => {
    if (focusFirst) field.current?.focus();
  }, [focusFirst]);

  // Liczba podpowiedzi dla czytnika ekranu — pół sekundy po ostatnim znaku, nie przy każdej literze.
  useEffect(() => {
    if (total === null) return;
    const t = window.setTimeout(() => setSaid({ q: deferred, text: T.count(total) }), 500);
    return () => window.clearTimeout(t);
  }, [deferred, total]);

  const show = (q: string, a: Answer) => {
    setOpen(false);
    setActive(-1);
    if (a.kind === 'help') {
      setWhereOpen(true);
      focusTo.current = 'where';
    } else focusTo.current = a.kind === 'prompt' ? 'field' : 'head';
    setResult({ q, a });
    if (a.kind === 'one') rememberWatch(toRemember(a));
  };

  const submit = () => {
    const q = query.trim();
    show(q, answer(q));
  };

  const pick: Pick = (key, name) => {
    setQuery(plainName(name));
    show(name, chosen(key, name));
  };

  const clear = () => {
    setQuery('');
    setResult(null);
    setOpen(false);
    setActive(-1);
    field.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!hits.length) return;
      const down = e.key === 'ArrowDown';
      setActive((a) => (a < 0 ? (down ? 0 : hits.length - 1) : Math.min(hits.length - 1, Math.max(0, a + (down ? 1 : -1)))));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (listOpen && activeHit) pick(activeHit.target.key, activeHit.as ?? activeHit.name);
      else submit();
      return;
    }
    if (e.key === 'Escape') {
      if (listOpen) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (query || result) {
        e.preventDefault();
        setQuery('');
        setResult(null);
      }
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      setActive(-1);
    }
  };

  const a = result?.a ?? null;

  return (
    <div className={`wc${compact ? ' compact' : ''}`}>
      <label className="wc-label" htmlFor={inputId}>
        {T.label}
      </label>
      <div className="wc-row">
        <div className="wc-box">
          <input
            id={inputId}
            ref={field}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-activedescendant={listOpen && activeHit ? optId(active) : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={T.placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onBlur={() => {
              setOpen(false);
              setActive(-1);
            }}
            onKeyDown={onKey}
          />
          {query && (
            <button type="button" className="wc-clear" aria-label={T.clear} onClick={clear}>
              ×
            </button>
          )}
          {listOpen && (
            <div className="wc-pop">
              <ul className="wc-opts" id={listId} role="listbox" aria-label={T.label}>
                {hits.map((h, i) => {
                  const s = shortOf(h.target.verdict);
                  return (
                    <li
                      key={`${h.target.key}-${i}`}
                      id={optId(i)}
                      role="option"
                      aria-selected={i === active}
                      className="wc-opt"
                      // Wciśnięcie nie może zabrać pola fokusu — blur zamknąłby listę przed kliknięciem.
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={() => i !== active && setActive(i)}
                      onClick={() => pick(h.target.key, h.as ?? h.name)}
                    >
                      <span className="wc-opt-name">{h.as ?? h.name}</span>{' '}
                      <span className={`wc-tag ${lookOf(s)}`}>{W.short[s]}</span>
                    </li>
                  );
                })}
              </ul>
              {found && found.total > hits.length && <p className="wc-pop-more">{T.moreHits(found.total - hits.length)}</p>}
            </div>
          )}
        </div>
        <button type="button" className={`btn sm${idle ? '' : ' ghost'}`} onClick={submit}>
          {T.check}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {open && typed.length >= 2 && said?.q === deferred ? said.text : ''}
      </span>

      {!compact && !query && idle && (
        <div className="wc-popular">
          <span className="wc-popular-label" id={`${uid}-pop`}>
            {T.popular}
          </span>
          <div className="chips" role="group" aria-labelledby={`${uid}-pop`}>
            {POPULAR.map((id) => {
              const name = supportedById(id)?.names[0];
              return name ? (
                <button key={id} type="button" onClick={() => pick(id, name)}>
                  {plainName(name)}
                </button>
              ) : null;
            })}
          </div>
        </div>
      )}

      {a?.kind === 'prompt' && <p className="tight wc-prompt">{T.prompt}</p>}
      {a?.kind === 'one' && <OneCard a={a} headRef={head} onPick={pick} onConnect={onConnect} onFeedback={onFeedback} />}
      {a?.kind === 'line' && <LineCard hits={a.hits} headRef={head} onPick={pick} />}
      {a?.kind === 'guess' && <GuessCard q={result!.q} hits={a.hits} headRef={head} onPick={pick} />}
      {a?.kind === 'unknown' && (
        <UnknownCard q={result!.q} near={a.near} headRef={head} onPick={pick} onFeedback={onFeedback} />
      )}

      {/* Rozwijane sterowane stanem: „nie wiem” otwiera „Gdzie znajdę…” i przenosi tam fokus. */}
      <details className="dev-check wc-where" open={whereOpen}>
        <summary
          ref={where}
          onClick={(e) => {
            e.preventDefault();
            setWhereOpen((o) => !o);
          }}
        >
          {T.where}
        </summary>
        <p className="tight">{T.whereText}</p>
      </details>
      {!compact && (
        <>
          <details className="dev-check wc-all" open={allOpen}>
            <summary
              onClick={(e) => {
                e.preventDefault();
                setAllOpen((o) => !o);
                setAllSeen(true);
              }}
            >
              {T.all(GARMIN.supported.length)}
            </summary>
            {/* 118 przycisków dopiero po pierwszym otwarciu — większość tej listy nigdy nie zobaczy. */}
            {allSeen &&
              supportedByLine().map((line) => (
                <div key={line.series} className="wc-line">
                  <p className="wc-series">{line.series === 'Legacy' ? T.legacy : line.series}</p>
                  <ul className="wc-names">
                    {line.models.map((m) => {
                      const part = !!supportedById(m.id)?.lacks?.length;
                      return (
                        <li key={m.id}>
                          <button type="button" className="wc-name" onClick={() => pick(m.id, m.name)}>
                            <span className="wc-n">{m.name}</span>
                            {part && (
                              <>
                                {' '}
                                <span className="wc-tag part">· {W.short.part}</span>
                              </>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
          </details>
          <p className="hint wc-source">{T.source}</p>
        </>
      )}
    </div>
  );
}
