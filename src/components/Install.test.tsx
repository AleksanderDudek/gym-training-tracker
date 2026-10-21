// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InstallSteps } from './Install';
import { TopBar } from './TopBar';

const bar = (extra: Partial<Parameters<typeof TopBar>[0]> = {}) =>
  render(<TopBar title="Dziś" parent={null} strip onSnooze={vi.fn()} settings {...extra} />);

describe('pasek „dodaj do ekranu początkowego”', () => {
  it('stoi w miejscu paska wsparcia: całość otwiera instrukcję, × chowa go', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onHide = vi.fn();
    bar({ install: { onOpen, onHide } });
    expect(screen.queryByText('Espresso')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Dodaj do ekranu początkowego/ }));
    expect(onOpen).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Schowaj podpowiedź o ekranie początkowym' }));
    expect(onHide).toHaveBeenCalledOnce();
  });

  it('bez niego wraca pasek wsparcia', () => {
    bar({ install: null });
    expect(screen.getByText('Espresso')).toBeInTheDocument();
    expect(screen.queryByText(/ekranu początkowego/)).not.toBeInTheDocument();
  });
});

describe('instrukcja', () => {
  it('Safari: Udostępnij, Do ekranu początkowego, ikona — i jak zabrać zapisy z karty', () => {
    render(<InstallSteps place="safari" reminders />);
    const steps = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain('Udostępnij');
    expect(steps[0]).toContain('„⋯”');
    expect(steps[1]).toContain('Do ekranu początkowego');
    expect(screen.getByText(/może przypominać o treningu/)).toBeInTheDocument();
    expect(screen.getByText(/Eksportuj plik/)).toBeInTheDocument();
    expect(screen.getByText(/Importuj plik/)).toBeInTheDocument();
  });

  it('z przeglądarki w Instagramie najpierw do Safari; bez serwera nie obiecuje przypomnień', () => {
    render(<InstallSteps place="in-app" reminders={false} />);
    expect(screen.getAllByRole('listitem')[0]!.textContent).toContain('Otwórz tę stronę w Safari');
    expect(screen.queryByText(/przypominać/)).not.toBeInTheDocument();
  });
});
