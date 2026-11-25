import { useEffect, useId, useRef, useState } from 'react';
import type { HabitsBody } from '@gymtracker/link';
import { localDay } from '@gymtracker/link/coaching';
import { linkConfigured } from '../link/config';
import { laterIds, rememberLater } from '../link/notifyMemo';
import { askCoachPermission } from '../link/permission';
import { linkState, newAssignments, ticksOn, unreadMessages, useLink } from '../link/store';
import type { LinkConnection, LinkState, StoredAssignment } from '../link/store';
import { coachOf, formsDue, habitsToday, mealsToday } from '../link/today';
import type { DayProgress } from '../link/today';
import { soonVisit } from '../link/visits';
import { LINK_PATH, linkAssignmentPath, linkChatPath, linkConnectionPath, linkVisitsPath, planPath } from '../routing';
import { LOCALE, text } from '../i18n';
import type { AppState, PlanTemplate } from '../types';
import type { TodayPlan } from './SessionHome';
import { W } from './Link.words';
import './coach.css';

/**
 * „Od prowadzącego” na samej górze ekranu Dziś (spec 2026-11-25 „powiadomienia”, decyzja „Prowadzący
 * na pierwszym planie”): jedna karta na prowadzącego, tylko gdy współpraca trwa i jest coś do pokazania.
 * Najważniejsze pierwsze: wiadomości, formularz na dziś, nawyki z odhaczaniem na miejscu, jadłospis,
 * wizyta w ciągu doby, nowe zalecenia, plan czekający na start. Pod spodem koniec współpracy ze strony
 * prowadzącego i — gdy telefon może, a nie są włączone — jedna cicha linia o powiadomieniach.
 *
 * Główna paczka: czyta tylko zapis współprac (`store.ts`, `today.ts`, `visits.ts`) i pamięć powiadomień
 * urządzenia (`notifyMemo.ts`). Odhaczenie (`sync.ts`) i powiadomienia (`notify.ts`) wczytują się dopiero
 * na żądanie — poza pytaniem o zgodę (`permission.ts`), które musi paść jeszcze w stuknięciu.
 */

const T = text({
  pl: {
    tag: 'Od prowadzącego',
    message: 'Nowa wiadomość',
    messages: (n: number) => `Nowe wiadomości: ${n}`,
    quote: (t: string) => `„${t}”`,
    form: (title: string) => `Do wypełnienia dziś: ${title}`,
    intake: 'Prowadzący czeka na odpowiedzi, zanim zacznie.',
    habits: (done: number, due: number) => (done === due ? `wszystko zrobione (${due})` : `zrobione ${done} z ${due}`),
    moreHabits: (n: number) => `Pozostałe na dziś: ${n}`,
    meals: (done: number, due: number) => (done === due ? `Jadłospis: wszystko zjedzone (${due} z ${due})` : `Jadłospis: ${done} z ${due} zjedzone`),
    visit: (tomorrow: boolean, time: string, title: string) => `Wizyta ${tomorrow ? 'jutro' : 'dziś'} o ${time} — ${title}`,
    startPlan: (name: string) => `Uruchom plan od prowadzącego: ${name}`,
    newWorkout: (name: string) => `Nowy trening od prowadzącego: ${name}`,
    newTargets: 'Nowe cele — sprawdź i ustaw jako swoje',
    newLabs: 'Badania do zrobienia',
    newOther: (title: string) => `Nowe zalecenie: ${title}`,
    moreNew: (n: number) => `Więcej nowych: ${n}`,
    planWaiting: (name: string) => `Plan od prowadzącego czeka na start: ${name}`,
    planFrom: (name: string, prof: string) => `Plan od prowadzącego: ${name} · ${prof}`,
    ended: (name: string) => `Współpraca z: ${name} — zakończona przez prowadzącego. Twoich danych już nie widzi.`,
    pushOn: 'Włącz powiadomienia od prowadzącego',
    pushIos: 'Powiadomienia od prowadzącego działają na iPhonie po dodaniu GYM TRACKERa do ekranu początkowego (Udostępnij → Do ekranu początkowego).',
    later: 'Nie teraz',
    pushDone: 'Powiadomienia od prowadzącego włączone.',
    pushDenied: 'Przeglądarka blokuje powiadomienia — zmienisz to w ustawieniach strony.',
    pushFailed: 'Nie udało się włączyć powiadomień. Spróbujesz jeszcze na stronie współpracy.',
  },
  en: {
    tag: 'From your coach',
    message: 'New message',
    messages: (n: number) => `${n} new messages`,
    quote: (t: string) => `“${t}”`,
    form: (title: string) => `To fill in today: ${title}`,
    intake: 'Your coach is waiting for your answers before starting.',
    habits: (done: number, due: number) => (done === due ? `all done (${due})` : `${done} of ${due} done`),
    moreHabits: (n: number) => `${n} more for today`,
    meals: (done: number, due: number) => (done === due ? `Meal plan: all eaten (${due} of ${due})` : `Meal plan: ${done} of ${due} eaten`),
    visit: (tomorrow: boolean, time: string, title: string) => `Appointment ${tomorrow ? 'tomorrow' : 'today'} at ${time} — ${title}`,
    startPlan: (name: string) => `Start the plan from your coach: ${name}`,
    newWorkout: (name: string) => `New workout from your coach: ${name}`,
    newTargets: 'New targets — check them and make them yours',
    newLabs: 'Lab tests to do',
    newOther: (title: string) => `New from your coach: ${title}`,
    moreNew: (n: number) => `${n} more new`,
    planWaiting: (name: string) => `A plan from your coach is waiting to start: ${name}`,
    planFrom: (name: string, prof: string) => `Plan from your coach: ${name} · ${prof}`,
    ended: (name: string) => `${name} has ended working with you. They no longer see your data.`,
    pushOn: 'Turn on notifications from your coach',
    pushIos: 'On iPhone, notifications from your coach work once GYM TRACKER is on your Home Screen (Share → Add to Home Screen).',
    later: 'Not now',
    pushDone: 'Notifications from your coach are on.',
    pushDenied: 'Your browser blocks notifications — you can change that in the site settings.',
    pushFailed: 'Notifications could not be turned on. You can try again on the coaching page.',
  },
});

/** Najwyżej tyle punktów listy nawyków na karcie — reszta jednym odnośnikiem. */
const HABITS_SHOWN = 6;
/** Najwyżej tyle nowych zaleceń osobnymi liniami. */
const NEW_SHOWN = 3;
/** Połowa ekranu telefonu na podgląd wiadomości wystarczy; resztę tnie CSS. */
const PREVIEW_CHARS = 120;

type Item =
  | { key: string; kind: 'link'; href: string; text: string; sub?: string | undefined }
  | { key: string; kind: 'habits'; p: DayProgress<HabitsBody> };

interface Group {
  c: LinkConnection;
  items: Item[];
}

const assignmentLine = (x: StoredAssignment): string => {
  const b = x.a.body;
  switch (b.kind) {
    case 'plan':
      return T.startPlan(b.plan.name);
    case 'workout':
      return T.newWorkout(b.workout.name);
    case 'targets':
      return T.newTargets;
    case 'labs':
      return T.newLabs;
    case 'note':
    case 'form':
    case 'habits':
    case 'meals':
      return T.newOther(b.title);
  }
};

const RANK: Partial<Record<StoredAssignment['a']['body']['kind'], number>> = { plan: 0, workout: 1, targets: 2, labs: 3 };
const rank = (x: StoredAssignment): number => RANK[x.a.body.kind] ?? 4;

const timeText = (iso: string): string => new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

/**
 * Co pokazać od każdego prowadzącego, w kolejności ważności. `plans` i `noPlan` — tylko z ekranu
 * Dziś: plan od prowadzącego, który czeka na start, pokazuje się wtedy, gdy nie biegnie żaden inny.
 */
export function coachGroups(s: LinkState, opts: { day: string; now: number; plans?: readonly PlanTemplate[]; noPlan?: boolean }): Group[] {
  const { day, now } = opts;
  const forms = formsDue(s, day);
  const habits = habitsToday(s, day);
  const meals = mealsToday(s, day);
  const visit = soonVisit(s, now);
  const fresh = newAssignments(s);
  return s.connections
    .filter((c) => c.status === 'active')
    .map((c): Group => {
      const items: Item[] = [];
      const mine = <X extends { connectionId: string }>(x: X) => x.connectionId === c.id;
      // Zalecenie z własną linią (formularz, nawyki, jadłospis) nie dostaje drugiej jako „nowe”.
      const covered = new Set<string>();

      const unread = unreadMessages(s, c.id);
      if (unread.length) {
        const last = unread.reduce((a, b) => ((b.serverAt ?? '') > (a.serverAt ?? '') || (b.serverAt === a.serverAt && b.at > a.at) ? b : a));
        items.push({
          key: 'messages',
          kind: 'link',
          href: linkChatPath(c.id),
          text: unread.length === 1 ? T.message : T.messages(unread.length),
          sub: T.quote(last.text.slice(0, PREVIEW_CHARS).replace(/\s+/g, ' ').trim()),
        });
      }
      for (const f of forms.filter(mine)) {
        covered.add(f.id);
        items.push({ key: `form:${f.id}`, kind: 'link', href: linkAssignmentPath(f.id), text: T.form(f.a.body.title), sub: f.a.body.intake ? T.intake : undefined });
      }
      for (const h of habits.filter((p) => p.x.connectionId === c.id)) {
        covered.add(h.x.id);
        items.push({ key: `habits:${h.x.id}`, kind: 'habits', p: h });
      }
      for (const m of meals.filter((p) => p.x.connectionId === c.id)) {
        covered.add(m.x.id);
        items.push({ key: `meals:${m.x.id}`, kind: 'link', href: linkAssignmentPath(m.x.id), text: T.meals(m.done.length, m.due.length), sub: m.x.a.body.title });
      }
      if (visit?.connection.id === c.id) {
        items.push({ key: 'visit', kind: 'link', href: linkVisitsPath(c.id), text: T.visit(visit.tomorrow, timeText(visit.booking.startsAt), visit.booking.title) });
      }
      // Nowe: plan i trening (do uruchomienia) przed celami i badaniami, reszta po nich; w środku najnowsze.
      const fresher = fresh.filter((x) => mine(x) && !covered.has(x.id)).sort((a, b) => rank(a) - rank(b));
      for (const x of fresher.slice(0, NEW_SHOWN)) items.push({ key: `new:${x.id}`, kind: 'link', href: linkAssignmentPath(x.id), text: assignmentLine(x) });
      if (fresher.length > NEW_SHOWN) items.push({ key: 'more', kind: 'link', href: linkConnectionPath(c.id), text: T.moreNew(fresher.length - NEW_SHOWN) });

      if (opts.noPlan) {
        const waiting = (opts.plans ?? []).filter((p) => coachOf(s, p.id)?.connection?.id === c.id).at(-1);
        if (waiting) items.push({ key: `plan:${waiting.id}`, kind: 'link', href: planPath(waiting.id), text: T.planWaiting(waiting.name) });
      }
      return { c, items };
    })
    .filter((g) => g.items.length > 0);
}

/* ── Powiadomienia: jedna cicha linia ─────────────────────────────────────────────── */

type PushState = 'unconfigured' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

/** Stan powiadomień dla współprac na karcie; do czasu odpowiedzi — nic (linia się nie pokazuje). */
function usePushStates(ids: readonly string[]): [Record<string, PushState>, (id: string, v: PushState) => void] {
  const [states, setStates] = useState<Record<string, PushState>>({});
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    let alive = true;
    import('../link/notify')
      .then(async (m) => {
        const list = await Promise.all(key.split(',').map(async (id) => [id, await m.coachPushState(id)] as const));
        if (alive) setStates(Object.fromEntries(list));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key]);
  return [states, (id, v) => setStates((x) => ({ ...x, [id]: v }))];
}

/** Zegar karty co minutę: wizyta „w ciągu doby” i dzień nawyków przesuwają się same, także po północy. */
function useClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/* ── Karta ─────────────────────────────────────────────────────────────────────────── */

/**
 * Karta „Od prowadzącego” (bez Sztabu w buildzie — nic). `state` i `today` przychodzą z ekranu Dziś:
 * odhaczenie wysyła paczkę z bieżącym stanem, a plan od prowadzącego czekający na start pokazuje się
 * tylko wtedy, gdy nie biegnie żaden plan.
 */
export function CoachToday({ state, today }: { state?: AppState | undefined; today?: TodayPlan | undefined }) {
  const s = useLink();
  // Odhaczenie wysyła paczkę z tym stanem, który jest w chwili wysyłki — nie z chwili renderu.
  const live = useRef(state ?? null);
  useEffect(() => {
    live.current = state ?? null;
  });
  const now = useClock();
  const day = localDay(now);
  const configured = linkConfigured();
  const groups = configured ? coachGroups(s, { day, now, plans: state?.plans, noPlan: today?.kind === 'none' }) : [];
  const [push, setPush] = usePushStates(groups.map((g) => g.c.id));
  const [later, setLater] = useState(laterIds);
  const ended = configured ? s.connections.filter((c) => c.endNotice) : [];
  if (!groups.length && !ended.length) return null;
  return (
    <div className="lk-coach-wrap">
      {groups.map((g) => (
        <CoachSection
          key={g.c.id}
          group={g}
          day={day}
          state={state ?? null}
          getState={() => live.current}
          push={later.includes(g.c.id) ? null : (push[g.c.id] ?? null)}
          onPush={(v) => setPush(g.c.id, v)}
          onLater={() => {
            rememberLater(g.c.id);
            setLater(laterIds());
          }}
        />
      ))}
      {ended.map((c) => (
        <p key={c.id} className="lk-coach-ended">
          <a href={LINK_PATH}>{T.ended(c.coach.name)}</a>
        </p>
      ))}
    </div>
  );
}

function CoachSection({
  group,
  day,
  state,
  getState,
  push,
  onPush,
  onLater,
}: {
  group: Group;
  day: string;
  state: AppState | null;
  getState: () => AppState | null;
  push: PushState | null;
  onPush: (v: PushState) => void;
  onLater: () => void;
}) {
  const { c, items } = group;
  const id = useId();
  const head = useRef<HTMLAnchorElement>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  // Linia powiadomień znika po „Włącz” albo „Nie teraz” — fokus wraca na nagłówek karty, nie na <body>.
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    head.current?.focus();
  });

  const enable = async (asked: Promise<NotificationPermission> | null) => {
    if (!state) return;
    setBusy(true);
    let next: PushState;
    try {
      const m = await import('../link/notify');
      // Odmowa albo zamknięte pytanie — drugi raz, już bez gestu, się nie pyta.
      next = asked && (await asked) !== 'granted' ? await m.coachPushState(c.id) : await m.enableCoachPush(c.id, state);
    } catch {
      next = 'off';
      setStatus(T.pushFailed);
    }
    if (next !== 'off') refocus.current = true;
    setBusy(false);
    if (next === 'on') setStatus(T.pushDone);
    else if (next === 'denied') setStatus(T.pushDenied);
    onPush(next);
  };

  return (
    <section className="grp lk-coach" aria-labelledby={`${id}-tag ${id}-who`}>
      <div className="today-tag lk-coach-tag" id={`${id}-tag`}>
        {T.tag}
      </div>
      <h2 className="lk-coach-who" id={`${id}-who`}>
        <a ref={head} href={linkConnectionPath(c.id)}>
          {c.coach.name}{' '}
          <span className="lk-coach-prof">· {W.profession[c.coach.profession]}</span>
        </a>
      </h2>
      <ul className="lk-coach-list">
        {items.map((it) =>
          it.kind === 'habits' ? (
            <li key={it.key}>
              <HabitsBlock p={it.p} day={day} getState={getState} />
            </li>
          ) : (
            <li key={it.key}>
              <a className="lk-coach-row" href={it.href}>
                <span className="lk-coach-text">{it.text}</span>
                {it.sub ? <span className="lk-coach-sub">{it.sub}</span> : null}
              </a>
            </li>
          ),
        )}
      </ul>
      {push === 'off' && state ? (
        <p className="lk-coach-push">
          <button
            type="button"
            className="lk-coach-act"
            disabled={busy}
            // Pytanie o zgodę wprost w stuknięciu, przed wczytaniem `notify.ts` — Safari po `await` gestu już nie uzna.
            onClick={() => void enable(askCoachPermission())}
          >
            {T.pushOn}
          </button>
          <button
            type="button"
            className="lk-coach-later"
            onClick={() => {
              refocus.current = true;
              onLater();
            }}
          >
            {T.later}
          </button>
        </p>
      ) : push === 'ios-install' ? (
        <p className="lk-coach-push lk-coach-hint">
          {T.pushIos}{' '}
          <button
            type="button"
            className="lk-coach-later"
            onClick={() => {
              refocus.current = true;
              onLater();
            }}
          >
            {T.later}
          </button>
        </p>
      ) : null}
      <p className="lk-coach-status" role="status">
        {status}
      </p>
    </section>
  );
}

/** Dzisiejsze nawyki z odhaczaniem na miejscu — to samo co na stronie zalecenia, w skrócie. */
function HabitsBlock({ p, day, getState }: { p: DayProgress<HabitsBody>; day: string; getState: () => AppState | null }) {
  const s = useLink();
  const id = useId();
  const b = p.x.a.body;
  const ticked = new Set(ticksOn(s, p.x.id, day));
  const done = p.due.filter((i) => ticked.has(i)).length;
  const toggle = (i: number) => {
    const { x, due } = p;
    // Lista liczona dopiero po wczytaniu `sync.ts`, z zapisu w tej chwili — nie z chwili renderu: dwa szybkie
    // stuknięcia przed wczytaniem inaczej zgubiłyby pierwsze.
    void import('../link/sync')
      .then((m) => {
        const now = linkState();
        const next = new Set(ticksOn(now, x.id, day));
        if (next.has(i)) next.delete(i);
        else next.add(i);
        m.setDayTicks(x, day, due.filter((d) => next.has(d)), getState);
        // Jak na stronie nawyków: pierwsze odhaczenie robi z listy „w trakcie”, także po „Nie tym razem”.
        const st = now.assignments.find((a) => a.id === x.id)?.status ?? x.status;
        if (st === 'new' || st === 'seen' || st === 'declined') void m.setAssignmentStatus(x.id, 'started');
      })
      .catch(() => undefined);
  };
  return (
    <div className="lk-coach-habits">
      <p className="lk-coach-line" id={`${id}-h`}>
        <a href={linkAssignmentPath(p.x.id)}>{b.title}</a>
        <span className="lk-coach-count" aria-live="polite">
          {' · '}
          {T.habits(done, p.due.length)}
        </span>
      </p>
      <ul className="lk-coach-ticks" aria-labelledby={`${id}-h`}>
        {p.due.slice(0, HABITS_SHOWN).map((i) => {
          const item = b.items[i]!;
          const on = ticked.has(i);
          return (
            <li key={`${p.x.id}:${i}`}>
              <label className={`lk-coach-tick${on ? ' lk-coach-done' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(i)} />
                <span className="lk-coach-label">{item.label}</span>
                {item.dose ? (
                  <>
                    {' '}
                    <span className="lk-coach-dose">{item.dose}</span>
                  </>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
      {p.due.length > HABITS_SHOWN ? (
        <a className="lk-coach-more" href={linkAssignmentPath(p.x.id)}>
          {T.moreHabits(p.due.length - HABITS_SHOWN)}
        </a>
      ) : null}
    </div>
  );
}

/**
 * Linijka „Plan od prowadzącego: …” w karcie dzisiejszego treningu — ekran Dziś i tak mówi, co dziś
 * według planu, więc karta „Od prowadzącego” nie powtarza tego drugi raz, a tutaj widać, czyj to plan.
 */
export function CoachPlanNote({ planId }: { planId: string | null | undefined }) {
  const s = useLink();
  if (!linkConfigured()) return null;
  const who = coachOf(s, planId);
  if (!who?.active || !who.connection) return null;
  return (
    <p className="tight lk-coach-from">
      <a href={linkConnectionPath(who.connection.id)}>{T.planFrom(who.name, W.profession[who.profession])}</a>
    </p>
  );
}
