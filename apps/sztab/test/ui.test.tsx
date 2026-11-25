import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Dialog } from '../src/components/ui';

/** Okno nie przenosi fokusu przy odświeżeniu rodzica (`onClose` pisane w miejscu), a Escape dalej działa. */
function Host() {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setTick((n) => n + 1)}>
        odśwież {tick}
      </button>
      {open ? (
        <Dialog title="Okno" onClose={() => setOpen(false)}>
          <input aria-label="pierwsze" />
          <input aria-label="drugie" />
        </Dialog>
      ) : null}
    </>
  );
}

describe('Dialog', () => {
  it('fokus zostaje tam, gdzie jest, gdy rodzic się odświeża', () => {
    render(<Host />);
    expect(document.activeElement).toBe(screen.getByLabelText('pierwsze'));
    screen.getByLabelText('drugie').focus();
    act(() => {
      fireEvent.click(screen.getByText(/odśwież/));
    });
    screen.getByLabelText('drugie').focus();
    act(() => {
      fireEvent.click(screen.getByText(/odśwież/));
    });
    expect(document.activeElement).toBe(screen.getByLabelText('drugie'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
