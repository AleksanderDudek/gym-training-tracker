import { useState } from 'react';
import { plural } from '@gt/food/lib/format';
import { pluralEn, text } from '@gt/i18n';
import type { Connection } from '../lib/data';
import type { CreateStep } from '../lib/demo/client';
import type { SimReport, SimStep } from '../lib/demo/phone';
import { isDemo, loadDemo } from '../lib/demo/state';
import { forgetReview } from '../lib/reviewLoad';
import { navigate } from '../lib/router';
import { useReady } from '../session';
import { Dialog, toast } from './ui';
import './demo.css';

/**
 * Dane do obejrzenia w samym Sztabie (spec `2026-11-25-sztab-powiadomienia-design.md`): „Dodaj przykłady”
 * w bibliotece i „Podopieczny demonstracyjny” — telefon symulowany w tej przeglądarce. Kod przykładów
 * i symulacji (przepisy, składniki, protokół telefonu) wczytuje się dopiero po kliknięciu.
 */

const T = text({
  pl: {
    examples: 'Dodaj przykłady',
    examplesHint: 'Gotowe treningi, plan, cele, badania, zalecenia, formularze, nawyki, jadłospisy i program — do obejrzenia i przerobienia na swoje.',
    adding: (d: number, t: number) => (t ? `Dodaję… ${d} z ${t}` : 'Dodaję…'),
    examplesTitle: 'Dodać przykłady?',
    examplesText: (n: number) =>
      `W bibliotece masz już ${n} ${plural(n, 'element', 'elementy', 'elementów')}. Przykłady dojdą obok nich jako osobne kopie — niczego nie zmieniam ani nie usuwam.`,
    examplesWhat:
      'Trzy treningi z atlasu, plan na 8 tygodni, cele, pakiet badań, dwa zalecenia, sześć formularzy, dwie listy nawyków, dwa jadłospisy z przepisów GYM TRACKERa i program na pierwszy miesiąc współpracy.',
    examplesDone: (n: number) => `Dodano ${n} ${plural(n, 'przykład', 'przykłady', 'przykładów')} do biblioteki`,
    examplesFailed: (e: string) => `Nie udało się dodać przykładów (${e}). To, co zdążyło się zapisać, jest w bibliotece.`,
    cancel: 'Anuluj',
    demoAdd: 'Dodaj podopiecznego demo',
    demoExplain: 'Telefon symulowany w tej przeglądarce: prawdziwa, szyfrowana współpraca z przykładowymi danymi, którą usuniesz jednym przyciskiem.',
    demoTitle: 'Podopieczny demonstracyjny',
    demoIncludes:
      'Dostaniesz siedem tygodni treningów, wagi, jedzenia, kroków i badanie; wywiad, check-in, nawyki, jadłospis i plan wysłane cztery tygodnie temu — z odpowiedziami i odhaczeniami; dwie wiadomości i trzy zdjęcia sylwetki. „Symuluj telefon” na jego karcie odpowie na to, co mu wyślesz.',
    demoSteps: {
      invite: 'Zaproszenie „DEMO”…',
      accept: 'Telefon przyjmuje zaproszenie…',
      history: 'Zalecenia sprzed czterech tygodni…',
      phone: 'Telefon odpowiada i wysyła paczkę danych…',
      messages: 'Wiadomości od podopiecznego…',
      photos: 'Zdjęcia sylwetki…',
    } as Record<CreateStep, string>,
    demoDone: 'Podopieczny demo gotowy',
    demoFailed: (e: string) => `Nie udało się założyć podopiecznego demo (${e}).`,
    chipTitle: 'Podopieczny demonstracyjny — telefon symulowany w tej przeglądarce',
    simulate: 'Symuluj telefon',
    simulateHint: 'Telefon demo odbierze to, co wysłałeś, odpowie na formularze, odhaczy nawyki i posiłki, odpisze na wiadomość i wyśle paczkę danych.',
    simSteps: {
      pull: 'Telefon odbiera zalecenia…',
      receipts: 'Telefon potwierdza odczyt…',
      push: 'Telefon wysyła paczkę danych…',
      messages: 'Telefon odpisuje…',
      booking: 'Telefon rezerwuje termin…',
    } as Record<Exclude<SimStep, 'wait'>, string>,
    simWait: (s: number) => `Serwer przyjmuje jedną paczkę na 30 s — telefon czeka ${s} s…`,
    simDone: (r: SimReport) =>
      [
        `Telefon odebrał ${r.assignments} ${plural(r.assignments, 'zalecenie', 'zalecenia', 'zaleceń')}`,
        `${r.answers} ${plural(r.answers, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')} na formularze`,
        `${r.ticks} ${plural(r.ticks, 'dzień', 'dni', 'dni')} z odhaczeniami`,
        ...(r.replied ? ['odpowiedź na wiadomość'] : []),
        ...(r.booked ? ['rezerwacja terminu'] : []),
      ].join(', ') + (r.push === 'sent' ? '' : ' — paczka pójdzie przy następnej symulacji'),
    simEnded: 'Współpraca demo jest zakończona — telefon symulowany zniknął z tej przeglądarki.',
    simFailed: (e: string) => `Symulacja się nie udała (${e}).`,
    remove: 'Usuń demo',
    removeTitle: 'Usunąć podopiecznego demo?',
    removeText:
      'Współpraca demo zakończy się jak każda inna: paczka danych, zalecenia, wiadomości i zdjęcia znikną z serwera, a telefon symulowany — z tej przeglądarki. Na liście zostanie wpis w „Zakończonych”.',
    removeYes: 'Tak, usuń demo',
    removed: 'Podopieczny demo usunięty',
    removeFailed: (e: string) => `Nie udało się usunąć demo (${e}).`,
  },
  en: {
    examples: 'Add examples',
    examplesHint: 'Ready workouts, a plan, targets, labs, advice, forms, habits, meal plans and a program — to look at and make your own.',
    adding: (d: number, t: number) => (t ? `Adding… ${d} of ${t}` : 'Adding…'),
    examplesTitle: 'Add examples?',
    examplesText: (n: number) =>
      `Your library already has ${n} ${pluralEn(n, 'item', 'items')}. The examples are added next to them as separate copies — nothing is changed or deleted.`,
    examplesWhat:
      'Three workouts from the atlas, an 8-week plan, targets, a lab panel, two pieces of advice, six forms, two habit lists, two meal plans from GYM TRACKER recipes and a program for the first month of coaching.',
    examplesDone: (n: number) => `Added ${n} ${pluralEn(n, 'example', 'examples')} to the library`,
    examplesFailed: (e: string) => `Could not add the examples (${e}). Whatever was saved is in the library.`,
    cancel: 'Cancel',
    demoAdd: 'Add a demo client',
    demoExplain: 'A phone simulated in this browser: a real, encrypted collaboration with sample data that you remove with one button.',
    demoTitle: 'Demo client',
    demoIncludes:
      'You get seven weeks of workouts, weight, food, steps and a lab test; an interview, check-in, habits, meal plan and training plan sent four weeks ago — with answers and ticks; two messages and three body photos. “Simulate phone” on their page answers whatever you send.',
    demoSteps: {
      invite: 'The “DEMO” invite…',
      accept: 'The phone accepts the invite…',
      history: 'Advice from four weeks ago…',
      phone: 'The phone answers and sends its data package…',
      messages: 'Messages from the client…',
      photos: 'Body photos…',
    } as Record<CreateStep, string>,
    demoDone: 'Demo client ready',
    demoFailed: (e: string) => `Could not create the demo client (${e}).`,
    chipTitle: 'Demo client — a phone simulated in this browser',
    simulate: 'Simulate phone',
    simulateHint: 'The demo phone receives what you sent, answers forms, ticks habits and meals, replies to your message and sends its data package.',
    simSteps: {
      pull: 'The phone receives advice…',
      receipts: 'The phone confirms reading…',
      push: 'The phone sends its data package…',
      messages: 'The phone replies…',
      booking: 'The phone books a slot…',
    } as Record<Exclude<SimStep, 'wait'>, string>,
    simWait: (s: number) => `The server accepts one package per 30 s — the phone waits ${s} s…`,
    simDone: (r: SimReport) =>
      [
        `The phone received ${r.assignments} ${pluralEn(r.assignments, 'item', 'items')} of advice`,
        `${r.answers} form ${pluralEn(r.answers, 'answer', 'answers')}`,
        `${r.ticks} ${pluralEn(r.ticks, 'day', 'days')} with ticks`,
        ...(r.replied ? ['a reply to your message'] : []),
        ...(r.booked ? ['a booked slot'] : []),
      ].join(', ') + (r.push === 'sent' ? '' : ' — the package goes with the next simulation'),
    simEnded: 'The demo collaboration has ended — the simulated phone is gone from this browser.',
    simFailed: (e: string) => `The simulation failed (${e}).`,
    remove: 'Remove demo',
    removeTitle: 'Remove the demo client?',
    removeText:
      'The demo collaboration ends like any other: the data package, advice, messages and photos are deleted from the server, and the simulated phone from this browser. An entry stays under “Ended”.',
    removeYes: 'Yes, remove demo',
    removed: 'Demo client removed',
    removeFailed: (e: string) => `Could not remove the demo (${e}).`,
  },
});

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/* ── Biblioteka ───────────────────────────────────────────────────────────────────── */

/**
 * „Dodaj przykłady”. `count` — ile elementów biblioteka ma teraz (`undefined` — jeszcze się wczytuje):
 * przy niepustej pyta, bo przykłady dochodzą jako kopie.
 */
export function AddExamples({ count, onDone, primary = false }: { count: number | undefined; onDone: () => void; primary?: boolean }) {
  const { coach } = useReady();
  const [ask, setAsk] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);

  const run = async () => {
    setAsk(false);
    setProgress([0, 0]);
    let saved = 0;
    try {
      const { addExamples } = await import('../lib/demo/library');
      const items = await addExamples(coach.id, {
        onProgress: (d, t) => {
          saved = d;
          setProgress([d, t]);
        },
      });
      toast(T.examplesDone(items.length));
    } catch (e) {
      toast(T.examplesFailed(message(e)));
    } finally {
      setProgress(null);
      if (saved) onDone();
    }
  };

  return (
    <>
      <button
        type="button"
        className={`btn ${primary ? 'blue' : 'ghost small'}`}
        disabled={count === undefined || progress !== null}
        aria-busy={progress !== null || undefined}
        title={T.examplesHint}
        onClick={() => (count ? setAsk(true) : void run())}
      >
        {progress ? T.adding(progress[0], progress[1]) : T.examples}
      </button>
      {progress ? (
        <span className="sr" role="status">
          {T.adding(progress[0], progress[1])}
        </span>
      ) : null}
      {ask ? (
        <Dialog title={T.examplesTitle} onClose={() => setAsk(false)}>
          <p>{T.examplesText(count ?? 0)}</p>
          <p className="small soft">{T.examplesWhat}</p>
          <div className="row">
            <button type="button" className="btn blue" onClick={() => void run()}>
              {T.examples}
            </button>
            <button type="button" className="btn ghost" onClick={() => setAsk(false)}>
              {T.cancel}
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/* ── Podopieczni ──────────────────────────────────────────────────────────────────── */

/**
 * „Dodaj podopiecznego demo”: okno z jednym zdaniem wyjaśnienia, potem kroki zakładania (bez zamykania
 * w trakcie) i przejście na kartę. Gdy demo z tej przeglądarki już trwa — nic (widać je na liście).
 * `explain` — zdanie pod przyciskiem (pusta lista).
 */
export function AddDemoClient({ connections, explain = false }: { connections: readonly Connection[] | undefined; explain?: boolean }) {
  const { user, coach, key } = useReady();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<CreateStep | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const demo = loadDemo(user.id);
  if (!connections || (demo && connections.some((c) => c.id === demo.connectionId && c.status === 'active'))) return null;

  const run = async () => {
    setErr(null);
    setStep('invite');
    try {
      const { createDemoClient } = await import('../lib/demo/client');
      const s = await createDemoClient({ coach, userId: user.id, key }, { onStep: setStep });
      toast(T.demoDone);
      navigate(`/podopieczni/${s.connectionId}`);
    } catch (e) {
      setErr(T.demoFailed(message(e)));
      setStep(null);
    }
  };
  const close = () => {
    if (!step) setOpen(false);
  };

  return (
    <>
      <button type="button" className="btn ghost" onClick={() => setOpen(true)}>
        {T.demoAdd}
      </button>
      {explain ? <p className="small soft sz-demo-explain">{T.demoExplain}</p> : null}
      {open ? (
        <Dialog title={T.demoTitle} onClose={close}>
          <p>{T.demoExplain}</p>
          <p className="small soft">{T.demoIncludes}</p>
          {step ? (
            <p className="note blue" role="status">
              {T.demoSteps[step]}
            </p>
          ) : null}
          {err ? (
            <p className="err" role="alert">
              {err}
            </p>
          ) : null}
          <div className="row">
            <button type="button" className="btn blue" disabled={!!step} aria-busy={!!step || undefined} onClick={() => void run()}>
              {T.demoAdd}
            </button>
            <button type="button" className="btn ghost" disabled={!!step} onClick={close}>
              {T.cancel}
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** „DEMO” przy podopiecznym, którego telefon symuluje ta przeglądarka. */
export function DemoChip({ connectionId }: { connectionId: string }) {
  const { user } = useReady();
  if (!isDemo(user.id, connectionId)) return null;
  return (
    <span className="chip sz-demo-chip" title={T.chipTitle}>
      DEMO
    </span>
  );
}

/* ── Karta podopiecznego ──────────────────────────────────────────────────────────── */

/** „Symuluj telefon” i „Usuń demo” w nagłówku karty — tylko dla współpracy demo z tej przeglądarki. */
export function DemoActions({ c, onChanged }: { c: Pick<Connection, 'id' | 'status'>; onChanged: () => void }) {
  const { user, coach, key } = useReady();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (c.status !== 'active' || !isDemo(user.id, c.id)) return null;

  const simulate = async () => {
    setBusy(T.simSteps.pull);
    try {
      const { simulateDemo } = await import('../lib/demo/client');
      const r = await simulateDemo(
        { coach, userId: user.id },
        { onStep: (s, detail) => setBusy(s === 'wait' ? T.simWait(detail ?? 30) : T.simSteps[s]) },
      );
      forgetReview(key, c.id);
      toast(T.simDone(r));
      onChanged();
    } catch (e) {
      if (message(e) === 'bad_token') {
        toast(T.simEnded);
        navigate('/podopieczni');
      } else toast(T.simFailed(message(e)));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setErr(null);
    setBusy(T.remove);
    try {
      const { removeDemo } = await import('../lib/demo/client');
      await removeDemo(user.id);
      forgetReview(key, c.id);
      toast(T.removed);
      navigate('/podopieczni');
    } catch (e) {
      setErr(T.removeFailed(message(e)));
      setBusy(null);
    }
  };

  // „DEMO” na karcie mówi już etykieta zaproszenia w nagłówku (`c.label`) — tu tylko przyciski.
  return (
    <>
      <button type="button" className="btn ghost" disabled={!!busy} aria-busy={!!busy || undefined} title={T.simulateHint} onClick={() => void simulate()}>
        {busy && !confirm ? busy : T.simulate}
      </button>
      {busy && !confirm ? (
        <span className="sr" role="status">
          {busy}
        </span>
      ) : null}
      <button type="button" className="btn ghost" disabled={!!busy} onClick={() => setConfirm(true)}>
        {T.remove}
      </button>
      {confirm ? (
        <Dialog title={T.removeTitle} onClose={() => !busy && setConfirm(false)}>
          <p>{T.removeText}</p>
          {err ? (
            <p className="err" role="alert">
              {err}
            </p>
          ) : null}
          <div className="row">
            <button type="button" className="btn danger" disabled={!!busy} onClick={() => void remove()}>
              {T.removeYes}
            </button>
            <button type="button" className="btn ghost" disabled={!!busy} onClick={() => setConfirm(false)}>
              {T.cancel}
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
