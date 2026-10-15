// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContactDialog } from './Contact';
import { TopBar } from './TopBar';

const bar = (extra: Partial<Parameters<typeof TopBar>[0]> = {}) =>
  render(<TopBar title="Dziś" parent={null} strip={false} onSnooze={vi.fn()} settings {...extra} />);

describe('kontakt z autorem', () => {
  it('„@” stoi w pasku tuż przed dymkiem „Napisz do autora” i otwiera kontakt', async () => {
    const user = userEvent.setup();
    const onContact = vi.fn();
    bar({ onContact, onFeedback: vi.fn() });
    const header = screen.getByRole('banner');
    const names = within(header)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Kontakt z autorem', 'Napisz do autora — uwaga albo błąd']);
    await user.click(screen.getByRole('button', { name: 'Kontakt z autorem' }));
    expect(onContact).toHaveBeenCalledOnce();
  });

  it('bez serwera wiadomości kontakt i tak jest; w trakcie treningu go nie ma', () => {
    const { unmount } = bar({ onContact: vi.fn() });
    expect(screen.getByRole('button', { name: 'Kontakt z autorem' })).toBeInTheDocument();
    unmount();
    bar();
    expect(screen.queryByRole('button', { name: 'Kontakt z autorem' })).not.toBeInTheDocument();
  });

  it('w Polsce: Instagram, Discord i kawa przez buycoffee.to, w nowej karcie, z adresem pod nazwą', () => {
    render(<ContactDialog onClose={vi.fn()} pl />);
    const dialog = screen.getByRole('dialog', { name: 'Kontakt z autorem' });
    expect(within(dialog).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      'https://instagram.com/aleksanderdudek',
      'https://discord.gg/U6jCW6tvg',
      'https://buycoffee.to/uriel',
    ]);
    const instagram = within(dialog).getByRole('link', { name: /^Instagram/ });
    expect(instagram).toHaveTextContent('instagram.com/aleksanderdudek');
    const discord = within(dialog).getByRole('link', { name: /^Discord/ });
    expect(discord).toHaveAttribute('href', 'https://discord.gg/U6jCW6tvg');
    expect(discord).toHaveAttribute('target', '_blank');
    expect(discord).toHaveAttribute('rel', 'noopener noreferrer');
    expect(discord).toHaveTextContent('discord.gg/U6jCW6tvg');
    expect(within(dialog).getByRole('link', { name: /^Postaw espresso/ })).toHaveAttribute(
      'href',
      'https://buycoffee.to/uriel',
    );
    // Fokus od razu na pierwszym odnośniku.
    expect(instagram).toHaveFocus();
  });

  it('poza Polską: Instagram, bez Discorda, kawa przez buymeacoffee.com', () => {
    render(<ContactDialog onClose={vi.fn()} pl={false} />);
    const dialog = screen.getByRole('dialog', { name: 'Kontakt z autorem' });
    expect(within(dialog).getByRole('link', { name: /^Instagram/ })).toHaveAttribute(
      'href',
      'https://instagram.com/aleksanderdudek',
    );
    expect(within(dialog).queryByRole('link', { name: /^Discord/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /^Buy me a coffee/ })).toHaveAttribute(
      'href',
      'https://buymeacoffee.com/atd_uriel',
    );
  });

  it('Escape, tło i „Zamknij” zamykają; „Napisz w aplikacji” przechodzi do wiadomości', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onFeedback = vi.fn();
    render(<ContactDialog onClose={onClose} onFeedback={onFeedback} pl />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalledTimes(3);
    await user.click(screen.getByRole('button', { name: 'Napisz w aplikacji' }));
    expect(onFeedback).toHaveBeenCalledOnce();
  });

  it('bez serwera wiadomości okno nie proponuje pisania w aplikacji', () => {
    render(<ContactDialog onClose={vi.fn()} pl />);
    expect(screen.queryByRole('button', { name: 'Napisz w aplikacji' })).not.toBeInTheDocument();
  });

  it('po zamknięciu fokus wraca na przycisk, który otworzył okno', () => {
    render(<button>@</button>);
    const opener = screen.getByRole('button', { name: '@' });
    opener.focus();
    const { unmount } = render(<ContactDialog onClose={vi.fn()} pl />);
    expect(opener).not.toHaveFocus();
    unmount();
    expect(opener).toHaveFocus();
  });
});
