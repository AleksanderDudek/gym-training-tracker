// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssignmentBody } from '@gymtracker/link';
import { freshState } from '../../engine/plan';
import { markDiet } from '../../food/dietFlag';
import { applyCoachTargets, clearAll, now, readProfile, saveProfile } from '../../food/diet/store';
import { targetOn } from '../../food/diet/target';
import { newProfile } from '../../food/diet/validate';
import { clearLink, linkState } from '../../link/store';
import { forgetKeys } from '../../link/sync';
import { assignment, connection, seedLink } from '../../test/coachSeed';
import type { AppState } from '../../types';
import LinkPages from '../Link';

/**
 * „Ustaw jako moje cele” na karcie celów od prowadzącego: najpierw co się zmieni, potem zapis do
 * profilu diety i „w trakcie”; bez profilu diety — wyjaśnienie; czego nie ma gdzie ustawić — do wiadomości.
 */

const TARGETS: AssignmentBody = { kind: 'targets', kcal: 2200, protein: 140, steps: 9000, workoutsPerWeek: 3, weightGoal: 72, weeklyRate: -0.4, note: 'Spokojnie.' };

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  await clearAll();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function open(body: AssignmentBody = TARGETS, state: AppState = { ...freshState(), body: [{ day: now().date, kg: 80 }] }) {
  const a = assignment(body, { status: 'new', sent: 'new' });
  seedLink({ connections: [connection()], assignments: [a] });
  const onToast = vi.fn();
  render(<LinkPages route={{ kind: 'linkAssignment', id: a.id }} state={state} ensureSecret={(c) => c} apply={vi.fn()} onToast={onToast} />);
  return { a, onToast };
}

describe('cele od prowadzącego', () => {
  it('pokazuje, co się zmieni, i dopiero po „Tak, ustaw” zapisuje profil diety; zalecenie „w trakcie”', async () => {
    const today = now().date;
    await saveProfile(newProfile({ startDate: today }, today));
    markDiet(true);
    const user = userEvent.setup();
    const { onToast } = open();

    await user.click(screen.getByRole('button', { name: 'Ustaw jako moje cele' }));
    const panel = await screen.findByRole('group', { name: 'Ustaw jako moje cele' });
    const heading = within(panel).getByRole('heading', { name: 'Co się zmieni w profilu diety' });
    await waitFor(() => expect(heading).toHaveFocus());
    const changes = within(panel).getAllByRole('list')[0]!;
    expect(within(changes).getByText('Cel kalorii: 2100 → 2200 kcal dziennie, od dziś')).toBeInTheDocument();
    expect(within(changes).getByText('Waga docelowa: 75 → 72 kg')).toBeInTheDocument();
    expect(within(changes).getByText(/^Tempo: -0,50 → -0,[0-9]{2} kg na tydzień/)).toBeInTheDocument();
    // Do wiadomości: białko (z liczbą aplikacji po zmianie), kroki, treningi, tempo.
    expect(within(panel).getByText(/^Białko: 140 g dziennie — aplikacja liczy białko sama.*\(u ciebie 144 g\)/)).toBeInTheDocument();
    expect(within(panel).getByText(/^Kroki: 9000 dziennie/)).toBeInTheDocument();
    expect(within(panel).getByText(/^Treningi: 3 w tygodniu/)).toBeInTheDocument();
    expect(within(panel).getByText(/^Tempo: -0,40 kg na tydzień — aplikacja wylicza tempo z celu kalorii/)).toBeInTheDocument();
    // Jeszcze nic nie zapisane.
    expect(targetOn((await readProfile({ today, weighIns: [] }))!, today)).toBe(2100);

    await user.click(within(panel).getByRole('button', { name: 'Tak, ustaw' }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Cele od prowadzącego ustawione.'));
    const stored = (await readProfile({ today, weighIns: [] }))!;
    expect(targetOn(stored, today)).toBe(2200);
    expect(stored.targetWeightKg).toBe(72);
    expect(screen.getByText('Ustawione — cel 2200 kcal dziennie widać w dzienniku jedzenia.')).toHaveFocus();
    await waitFor(() => expect(linkState().assignments[0]!.status).toBe('started'));
  });

  it('w ciąży: cel kalorii poniżej utrzymania tylko do wiadomości, z powodem; nic do zapisania', async () => {
    const today = now().date;
    await saveProfile(newProfile({ sex: 'K', age: 30, heightCm: 168, startWeightKg: 80, targetWeightKg: 80, pregnancy: true, startDate: today }, today));
    markDiet(true);
    const user = userEvent.setup();
    open({ ...TARGETS, kcal: 1500 });
    await user.click(screen.getByRole('button', { name: 'Ustaw jako moje cele' }));
    const panel = await screen.findByRole('group', { name: 'Ustaw jako moje cele' });
    expect(within(panel).getByText('W profilu diety nic się nie zmieni — dlaczego, piszę niżej.')).toBeInTheDocument();
    expect(
      within(panel).getByText(/^Cel kalorii 1500 kcal — to mniej, niż potrzeba do utrzymania wagi \(u ciebie ok\. \d+ kcal\), a w ciąży i przy karmieniu piersią aplikacja nie ustawia deficytu/),
    ).toBeInTheDocument();
    // Waga docelowa: celu kalorii nie przyjęto, więc powodem jest cel profilu, a nie „taki cel kalorii”.
    expect(within(panel).getByText(/^Waga docelowa 72 kg — twój cel w profilu diety to utrzymanie wagi/)).toBeInTheDocument();
    expect(within(panel).queryByText(/przy takim celu kalorii/)).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Tak, ustaw' })).not.toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Zamknij' }));
    expect(targetOn((await readProfile({ today, weighIns: [] }))!, today)).not.toBe(1500);
  });

  it('cel poniżej twardego minimum przy zaznaczonej zgodzie lekarza: bez odsyłania do pola, którego już nie ma po co zaznaczać', async () => {
    const today = now().date;
    await saveProfile(newProfile({ belowFloorOk: true, startDate: today }, today));
    markDiet(true);
    const user = userEvent.setup();
    open({ ...TARGETS, kcal: 1200, weightGoal: null });
    await user.click(screen.getByRole('button', { name: 'Ustaw jako moje cele' }));
    const panel = await screen.findByRole('group', { name: 'Ustaw jako moje cele' });
    expect(within(panel).getByText('Prowadzący proponuje 1200 kcal — aplikacja nie ustawia celu niższego niż 1500 kcal, więc ustawię 1500.')).toBeInTheDocument();
    expect(within(panel).queryByText(/przemiana podstawowa|zaznaczając/)).not.toBeInTheDocument();
  });

  it('profil już ma najniższy cel: wyjaśnienie bez „ustawię”, nic do zapisania', async () => {
    const today = now().date;
    await saveProfile(newProfile({ belowFloorOk: true, startDate: today }, today));
    // Te same cele przyjęte już raz (1500 i tempo, które z nich wynika) — drugie otwarcie niczego nie zmienia.
    await applyCoachTargets({ kcal: 1200, weightGoal: null }, { today, weighIns: [{ day: today, kg: 80 }] });
    markDiet(true);
    const user = userEvent.setup();
    open({ ...TARGETS, kcal: 1200, weightGoal: null });
    await user.click(screen.getByRole('button', { name: 'Ustaw jako moje cele' }));
    const panel = await screen.findByRole('group', { name: 'Ustaw jako moje cele' });
    expect(within(panel).getByText('W profilu diety nic się nie zmieni — dlaczego, piszę niżej.')).toBeInTheDocument();
    expect(within(panel).getByText('Prowadzący proponuje 1200 kcal — aplikacja nie ustawia celu niższego niż 1500 kcal, więc cel zostaje bez zmian.')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Tak, ustaw' })).not.toBeInTheDocument();
  });

  it('„Anuluj” niczego nie zapisuje i oddaje fokus przyciskowi', async () => {
    const today = now().date;
    await saveProfile(newProfile({ startDate: today }, today));
    markDiet(true);
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Ustaw jako moje cele' }));
    await user.click(await screen.findByRole('button', { name: 'Anuluj' }));
    expect(screen.getByRole('button', { name: 'Ustaw jako moje cele' })).toHaveFocus();
    expect(targetOn((await readProfile({ today, weighIns: [] }))!, today)).toBe(2100);
  });

  it('bez profilu diety — wyjaśnia i prowadzi do jedzenia, nic nie zmienia', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Ustaw jako moje cele' }));
    expect(await screen.findByText(/Kalorie i wagę docelową ustawisz, gdy założysz profil diety/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Załóż profil diety' })).toHaveAttribute('href', '#/jedzenie');
    expect(linkState().assignments[0]!.status).not.toBe('started');
  });

  it('same kroki i treningi — tylko do wiadomości, bez przycisku', () => {
    open({ kind: 'targets', kcal: null, protein: null, steps: 8000, workoutsPerWeek: 4, weightGoal: null, weeklyRate: null, note: '' });
    expect(screen.queryByRole('button', { name: 'Ustaw jako moje cele' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tylko do wiadomości' })).toBeInTheDocument();
    expect(screen.getByText(/^Kroki: 8000 dziennie — aplikacja nie ma własnego celu kroków/)).toBeInTheDocument();
  });

  it('po końcu współpracy nie ma czego przyjmować', () => {
    const a = assignment(TARGETS);
    seedLink({ connections: [connection({ status: 'ended' })], assignments: [a] });
    render(<LinkPages route={{ kind: 'linkAssignment', id: a.id }} state={freshState()} ensureSecret={(c) => c} apply={vi.fn()} onToast={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Ustaw jako moje cele' })).not.toBeInTheDocument();
  });
});
