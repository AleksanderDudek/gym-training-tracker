// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import { exportAll, restoreAll } from '../../diet/store';
import { loadReports, saveReport } from '../../labs/store';
import { renderWithBridge } from '../../test/bridge';
import LabsPage from './LabsPage';

const TODAY = '2026-10-14';

const PRINTOUT = `Diagnostyka S. A.
Data/godz. pobrania: 2026-10-02 08:32
HGB - hemoglobina 11,4 g/dl 12,0-16,0 L
MCV 76 fl 80-100 L
Ferrytyna 8 ng/ml 13-150 L
Witamina D3 metabolit 25(OH) 17 ng/ml 30-50 L
Testosteron 0,4 ng/ml`;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/#/jedzenie/badania');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Badania', () => {
  test('bez wyników: wstęp, sposoby dodania i „Co zbadać” z NFZ i pakietami', async () => {
    await saveProfile(completeProfile({ sex: 'K', age: 34 }));
    renderWithBridge(<LabsPage />);
    expect(await screen.findByRole('heading', { name: 'Dieta pod wyniki badań' })).toBeInTheDocument();
    expect(screen.getByText(/zdjęcie albo zrzut ekranu/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Podstawowe — od lekarza rodzinnego (NFZ)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Moje Zdrowie/ })).toBeInTheDocument();
    expect(screen.getByText(/Witaminy D, magnezu, insuliny/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jak się przygotować' })).toBeInTheDocument();
  });

  test('wklejony wydruk: przegląd z datą i nierozpoznanym wierszem, zapis, cele z produktami i plan', async () => {
    await saveProfile(completeProfile({ sex: 'K', age: 34 }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithBridge(<LabsPage />);
    await user.click(await screen.findByRole('button', { name: 'Dodaj wyniki' }));
    const sheet = screen.getByRole('dialog', { name: 'Dodaj wyniki' });
    await user.click(within(sheet).getByRole('button', { name: /Wklej tekst/ }));
    await user.click(within(sheet).getByLabelText('Tekst z wynikami'));
    await user.paste(PRINTOUT);
    await user.click(within(sheet).getByRole('button', { name: 'Odczytaj' }));

    expect(within(sheet).getByLabelText('Data pobrania')).toHaveValue('2026-10-02');
    expect(within(sheet).getByLabelText('Wynik: Ferrytyna')).toHaveValue('8,0');
    expect(within(sheet).getByText(/Nie rozpoznałem 1 wiersza/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Zapisz 4 wyniki' }));

    await waitFor(async () => expect(await loadReports()).toHaveLength(1));
    const [report] = await loadReports();
    expect(report).toMatchObject({ date: '2026-10-02', lab: 'Diagnostyka', source: 'text' });

    expect(await screen.findByRole('heading', { name: 'Najpierw lekarz' })).toBeInTheDocument();
    expect(screen.getByText('Uzupełnij żelazo')).toBeInTheDocument();
    expect(screen.getByText('Podnieś witaminę D')).toBeInTheDocument();
    expect(screen.getAllByText(/Wątróbka/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Zaczynam plan' }));
    expect(await screen.findByText(/Tydzień 1 z 12/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Strączki .* — dodaj/ })[0]!);
    await waitFor(async () => expect((await db.days.get(TODAY))?.labHabits).toEqual({ legumes: 1 }));
    expect((await screen.findAllByText('1 z 4')).length).toBeGreaterThan(0);
  });

  test('wegańsko: bez mięsa w produktach, B12 mówi o suplemencie', async () => {
    await saveProfile(completeProfile({ sex: 'M', age: 40 }));
    await saveReport({
      date: '2026-10-01',
      lab: null,
      source: 'manual',
      addedAt: '2026-10-01T10:00:00.000Z',
      results: [{ marker: 'b12', value: 210, cmp: null, qual: null, printed: '210 pg/ml', ref: [197, 771] }],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithBridge(<LabsPage />);
    await user.click(await screen.findByRole('button', { name: 'Wegańsko' }));
    expect(await screen.findByText(/B12 z jedzenia nie wystarczy/)).toBeInTheDocument();
    expect(screen.queryByText(/Wątróbka/)).toBeNull();
  });

  test('ręcznie: wynik w innej jednostce zapisany po przeliczeniu', async () => {
    await saveProfile(completeProfile({ sex: 'K', age: 34 }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithBridge(<LabsPage />);
    await user.click(await screen.findByRole('button', { name: 'Dodaj wyniki' }));
    const sheet = screen.getByRole('dialog', { name: 'Dodaj wyniki' });
    await user.click(within(sheet).getByRole('button', { name: /Wpisz ręcznie/ }));
    await user.selectOptions(within(sheet).getByLabelText('Dodaj badanie'), 'glucose');
    await user.type(within(sheet).getByLabelText('Wynik: Glukoza na czczo'), '6,1');
    await user.selectOptions(within(sheet).getByLabelText('Jednostka: Glukoza na czczo'), 'mmol/l');
    expect(within(sheet).getByText(/Za wysoko/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Zapisz 1 wynik' }));
    await waitFor(async () => expect(await loadReports()).toHaveLength(1));
    const [report] = await loadReports();
    expect(report!.results[0]!.value).toBeCloseTo(109.9, 1);
    expect(report!.date).toBe(TODAY);
  });

  test('bez profilu diety pyta o płeć i wiek', async () => {
    renderWithBridge(<LabsPage />);
    expect(await screen.findByRole('heading', { name: 'Do zakresów norm' })).toBeInTheDocument();
  });
});

test('wyniki są w kopii zapasowej i wracają z niej', async () => {
  await saveReport({
    date: '2026-10-01',
    lab: 'ALAB',
    source: 'pdf',
    addedAt: '2026-10-01T10:00:00.000Z',
    results: [{ marker: 'ferritin', value: 20, cmp: null, qual: null, printed: '20 ng/ml', ref: [13, 150] }],
  });
  await db.days.put({ date: TODAY, labHabits: { legumes: 2 } });
  const backup = await exportAll();
  expect(backup.labs).toHaveLength(1);
  await clearAll();
  expect(await loadReports()).toHaveLength(0);
  await restoreAll(JSON.parse(JSON.stringify({ ...backup, labs: [...backup.labs!, { date: 'nie', results: [] }] })));
  expect(await loadReports()).toMatchObject([{ lab: 'ALAB', results: [{ marker: 'ferritin', value: 20 }] }]);
  expect((await db.days.get(TODAY))?.labHabits).toEqual({ legumes: 2 });
});
