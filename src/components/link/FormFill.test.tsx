// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, cleanCoaching, isoWeek, localDay, newIdSecret } from '@gymtracker/link';
import type { FormBody, FormQuestion, SnapshotV1 } from '@gymtracker/link';
import { freshState } from '../../engine/plan';
import { fakeSztab } from '../../test/linkServer';
import type { FakeSztab } from '../../test/linkServer';
import { acceptInvite } from '../../link/accept';
import { invitePreview } from '../../link/rpc';
import { clearLink, linkState, updateLink } from '../../link/store';
import type { LinkConnection } from '../../link/store';
import { forgetKeys, syncAll } from '../../link/sync';
import LinkPages from '../Link';

/**
 * Formularz od prowadzącego na telefonie, przeciw Sztabowi w pamięci: przychodzi zaszyfrowany,
 * wypełnia się kontrolkami właściwymi dla pytań, odmawia bez wymaganych i spoza zakresu, a odpowiedź
 * trafia do paczki (`coaching`), którą prowadzący odczytuje swoim kluczem.
 */

let server: FakeSztab;
let conn: LinkConnection;
const state = freshState();
const from = { name: 'Anna Kowalska', profession: 'trainer' as const };

const q = (id: string, type: FormQuestion['type'], label: string, extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id,
  type,
  label,
  help: '',
  required: false,
  unit: '',
  min: type === 'scale' ? 0 : null,
  max: type === 'scale' ? 10 : null,
  options: [],
  ...extra,
});

const checkin: FormBody = {
  kind: 'form',
  title: 'Check-in tygodniowy',
  intro: 'Krótkie podsumowanie tygodnia.',
  repeat: 'weekly',
  weekday: 1,
  intake: false,
  questions: [
    q('q1', 'number', 'Waga', { unit: 'kg', min: 30, max: 300, required: true, help: 'Rano, na czczo.' }),
    q('q2', 'scale', 'Energia', { required: true }),
    q('q3', 'choice', 'Głód', { options: ['Mały', 'Duży'] }),
    q('q4', 'multi', 'Gdzie trenowałeś', { options: ['Siłownia', 'Dom', 'Basen'] }),
    q('q5', 'yesno', 'Treningi zgodnie z planem?', { required: true }),
    q('q6', 'text', 'Co było trudne?'),
  ],
};

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  window.location.hash = '#/sesja';
  const inv = await server.invite(['training'], ['training']);
  const r = await acceptInvite({ preview: (await invitePreview(inv.id))!, fingerprint: inv.fingerprint, chosen: ['training'], replace: [], scopes: ['training'], secret: newIdSecret() });
  if (!r.ok) throw new Error(r.reason);
  conn = r.connection;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function open(body: FormBody) {
  const id = await server.send(conn.id, { area: 'training', sentAt: Date.now(), from, body });
  await syncAll(() => state);
  const onToast = vi.fn();
  render(<LinkPages route={{ kind: 'linkAssignment', id }} state={state} ensureSecret={vi.fn((c: string) => c)} apply={vi.fn()} onToast={onToast} />);
  return { id, onToast };
}

describe('formularz od prowadzącego', () => {
  it('odpowiedź za ten tydzień: sprawdzenie, zapis, paczka u prowadzącego, poprawka i historia', async () => {
    const user = userEvent.setup();
    const { id, onToast } = await open(checkin);
    expect(screen.getByRole('heading', { name: 'Check-in tygodniowy' })).toBeInTheDocument();
    expect(screen.getByText('Krótkie podsumowanie tygodnia.')).toBeInTheDocument();
    expect(screen.getByText(/^Co tydzień, od poniedziałku · Odpowiedź za ten tydzień/)).toBeInTheDocument();

    // Pierwsza paczka poszła przy przyjęciu zaproszenia; serwer bierze jedną na 30 s — tu „dawno temu”.
    updateLink((s) => {
      for (const c of s.connections) c.lastPushAt = Date.now() - 60_000;
    });
    // Bez wymaganych — odmowa, słowa przy pytaniach i kursor na pierwszym.
    await user.click(screen.getByRole('button', { name: 'Wyślij odpowiedź' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Uzupełnij zaznaczone pytania.');
    const weight = screen.getByRole('textbox', { name: 'Waga (wymagane)' });
    expect(weight).toHaveFocus();
    expect(weight).toHaveAttribute('aria-invalid', 'true');
    expect(weight).toHaveAccessibleDescription('Rano, na czczo. Odpowiedz na to pytanie.');
    expect(linkState().answers).toEqual([]);

    // Liczba spoza zakresu, potem z przecinkiem.
    await user.type(weight, '500');
    expect(weight).toHaveAccessibleDescription(/Wpisz liczbę od 30 do 300\./);
    await user.clear(weight);
    await user.type(weight, '82,5');
    expect(weight).toHaveAttribute('inputmode', 'decimal');

    const energy = screen.getByRole('group', { name: 'Energia (wymagane)' });
    expect(within(energy).getAllByRole('radio')).toHaveLength(11);
    await user.click(within(energy).getByRole('radio', { name: '7' }));
    await user.click(screen.getByRole('radio', { name: 'Duży' }));
    await user.click(screen.getByRole('checkbox', { name: 'Siłownia' }));
    await user.click(screen.getByRole('checkbox', { name: 'Basen' }));
    const plan = screen.getByRole('group', { name: 'Treningi zgodnie z planem? (wymagane)' });
    await user.click(within(plan).getByRole('button', { name: 'Tak' }));
    expect(within(plan).getByRole('button', { name: 'Tak' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByRole('textbox', { name: 'Co było trudne?' }), 'Mało snu');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Wyślij odpowiedź' }));
    expect(onToast).toHaveBeenCalledWith('Odpowiedź zapisana — idzie do prowadzącego.');
    const done = screen.getByRole('status');
    expect(done).toHaveTextContent('Odpowiedź za ten tydzień poszła do prowadzącego');
    expect(done).toHaveTextContent('Siłownia, Basen');
    expect(done).toHaveTextContent('82,5 kg');
    expect(done).toHaveTextContent(/Następna odpowiedź od poniedziałku, \d+ \S+\./);
    const week = isoWeek(localDay());
    expect(linkState().answers).toEqual([
      { assignmentId: id, period: week, at: expect.any(Number), values: { q1: 82.5, q2: 7, q3: 1, q4: [0, 2], q5: true, q6: 'Mało snu' } },
    ]);
    await waitFor(() => expect(linkState().assignments[0]!.status).toBe('started'));

    // Paczka idzie sama po chwili — prowadzący odczytuje odpowiedź swoim kluczem.
    await waitFor(
      async () => {
        const snap = (await server.readSnapshot(conn.id)) as SnapshotV1 | null;
        expect(cleanCoaching(snap?.coaching).answers).toEqual([expect.objectContaining({ assignmentId: id, period: week, values: expect.objectContaining({ q1: 82.5, q2: 7 }) })]);
      },
      { timeout: 8000 },
    );

    // Poprawka tego samego tygodnia zastępuje odpowiedź.
    await user.click(screen.getByRole('button', { name: 'Popraw odpowiedź' }));
    expect(screen.getByRole('textbox', { name: 'Waga (wymagane)' })).toHaveValue('82,5');
    expect(screen.getByRole('radio', { name: '7' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: '9' }));
    await user.click(screen.getByRole('button', { name: 'Wyślij poprawkę' }));
    expect(linkState().answers).toHaveLength(1);
    expect(linkState().answers[0]!.values.q2).toBe(9);

    // Wcześniejszy tydzień trafia do historii.
    updateLink((s) => {
      s.answers.push({ assignmentId: id, period: isoWeek(addDays(localDay(), -7)), at: Date.now() - 7 * 86_400_000, values: { q1: 83, q2: 5, q5: false } });
    });
    const history = await screen.findByText('Wcześniejsze odpowiedzi (1)');
    await user.click(history);
    const past = history.closest('details')!;
    expect(within(past).getByText('83 kg')).toBeInTheDocument();
    expect(within(past).getByText('Nie')).toBeInTheDocument();
  }, 20_000);

  it('wywiad na start: na wierzchu, po odpowiedzi zrobiony; jednorazowy bez historii', async () => {
    const user = userEvent.setup();
    await open({
      kind: 'form',
      title: 'Wywiad na start',
      intro: '',
      repeat: 'once',
      weekday: null,
      intake: true,
      questions: [q('q1', 'text', 'Kontuzje', { required: true }), q('q2', 'scale', 'Stres', { min: 1, max: 5 })],
    });
    expect(screen.getByText(/^Odpowiedz, zanim zaczniecie/)).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Stres' })).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['1', '2', '3', '4', '5']);
    await user.type(screen.getByRole('textbox', { name: 'Kontuzje (wymagane)' }), 'brak');
    await user.click(screen.getByRole('button', { name: 'Wyślij odpowiedź' }));
    expect(screen.getByRole('status')).toHaveTextContent('Odpowiedź poszła do prowadzącego');
    expect(screen.queryByText(/^Odpowiedz, zanim zaczniecie/)).not.toBeInTheDocument();
    expect(linkState().answers[0]).toMatchObject({ period: 'once', values: { q1: 'brak', q2: null } });
    await waitFor(() => expect(linkState().assignments[0]!.status).toBe('done'));
    expect(screen.queryByRole('button', { name: 'Nie tym razem' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Wcześniejsze odpowiedzi/)).not.toBeInTheDocument();
  }, 15_000);

  it('cotygodniowy przed swoim dniem: mówi, od kiedy czeka, ale przyjmuje odpowiedź już teraz', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T10:00:00')); // poniedziałek
    const user = userEvent.setup();
    await open({ ...checkin, weekday: 4, questions: [q('q1', 'yesno', 'Wszystko dobrze?')] });
    expect(screen.getByText('Na ten tydzień czeka od czwartku, 26 listopada — możesz odpowiedzieć już teraz.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nie' }));
    await user.click(screen.getByRole('button', { name: 'Wyślij odpowiedź' }));
    expect(screen.getByRole('status')).toHaveTextContent('Następna odpowiedź od czwartku, 3 grudnia.');
    expect(linkState().answers[0]).toMatchObject({ period: '2026-W48', values: { q1: false } });
  }, 15_000);
});
