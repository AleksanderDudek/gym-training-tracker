// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { expect, test, vi } from 'vitest';
import { Sheet } from './Sheet';

/** Przycisk, który „otwiera” arkusz, i sam arkusz — jak karta produktu i jej szczegóły. */
function Harness({ shown, open, onClose }: { shown: boolean; open: boolean; onClose: () => void }) {
  return (
    <>
      <button type="button">Otwórz</button>
      {shown && (
        <Sheet open={open} onClose={onClose} title="Arkusz" footer={<span>Stopka</span>}>
          <p>Treść</p>
        </Sheet>
      )}
    </>
  );
}

/** Arkusz otwarty z fokusem na przycisku „Otwórz” — to on ma go dostać z powrotem. */
function openFromButton(onClose = vi.fn()) {
  const view = render(<Harness shown={false} open={false} onClose={onClose} />);
  const opener = screen.getByRole('button', { name: 'Otwórz' });
  opener.focus();
  view.rerender(<Harness shown open onClose={onClose} />);
  return { ...view, opener, onClose, dialog: screen.getByRole('dialog', { name: 'Arkusz' }) as HTMLDialogElement };
}

test('otwarty arkusz jest modalnym oknem z nazwą z tytułu, a fokus stoi na tytule', () => {
  const { dialog } = openFromButton();
  expect(dialog.open).toBe(true);
  expect(screen.getByRole('heading', { level: 2, name: 'Arkusz' })).toHaveFocus();
  expect(screen.getByText('Stopka')).toBeInTheDocument();
});

test('× zamyka arkusz i woła onClose dokładnie raz', async () => {
  const user = userEvent.setup();
  const { dialog, onClose, opener } = openFromButton();
  await user.click(screen.getByRole('button', { name: 'Zamknij' }));
  expect(dialog.open).toBe(false);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(opener).toHaveFocus();
});

test('zamknięcie przez przeglądarkę (Escape) też woła onClose raz', () => {
  const { dialog, onClose } = openFromButton();
  // Escape w przeglądarce kończy się `dialog.close()` i zdarzeniem `close`; jsdom klawisza nie obsługuje.
  act(() => dialog.close());
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('stuknięcie w tło zamyka, stuknięcie w treść — nie', async () => {
  const user = userEvent.setup();
  const { dialog, onClose } = openFromButton();
  await user.click(screen.getByText('Treść'));
  expect(dialog.open).toBe(true);
  await user.click(dialog);
  expect(dialog.open).toBe(false);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('rodzic zamyka arkusz (open={false}) — bez onClose, fokus wraca do przycisku', () => {
  const { dialog, onClose, opener, rerender } = openFromButton();
  rerender(<Harness shown open={false} onClose={onClose} />);
  expect(dialog.open).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
  expect(opener).toHaveFocus();
});

test('arkusz usunięty ze strony otwarty (Wstecz) zamyka się bez onClose i oddaje fokus', () => {
  const { dialog, onClose, opener, rerender } = openFromButton();
  rerender(<Harness shown={false} open onClose={onClose} />);
  expect(dialog.isConnected).toBe(false);
  expect(dialog.open).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
  expect(opener).toHaveFocus();
});

test('StrictMode: udawane odmontowanie i ponowny montaż nie wołają onClose, a arkusz zostaje otwarty', () => {
  const onClose = vi.fn();
  render(
    <StrictMode>
      <Harness shown open onClose={onClose} />
    </StrictMode>,
  );
  expect((screen.getByRole('dialog', { name: 'Arkusz' }) as HTMLDialogElement).open).toBe(true);
  expect(onClose).not.toHaveBeenCalled();
});
