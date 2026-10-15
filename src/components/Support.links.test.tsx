// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupportLine, SupportStrip } from './Support';

/** Przeglądarka „w miejscu”: preferowane języki i strefa czasowa. */
function place(languages: string[], timeZone: string) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...real.call(this), timeZone };
  });
}

afterEach(() => vi.restoreAllMocks());

describe('wsparcie według kraju', () => {
  it('w Polsce pasek i baner prowadzą do buycoffee.to i tak się podpisują', () => {
    place(['pl-PL'], 'Europe/Warsaw');
    render(
      <>
        <SupportStrip onSnooze={vi.fn()} />
        <SupportLine seed={1} />
      </>,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://buycoffee.to/uriel', 'https://buycoffee.to/uriel']);
    expect(screen.getByText(/^buycoffee\.to\/uriel · otwiera się/)).toBeInTheDocument();
  });

  it('poza Polską te same miejsca prowadzą do buymeacoffee.com', () => {
    place(['de-DE', 'en'], 'Europe/Berlin');
    render(
      <>
        <SupportStrip onSnooze={vi.fn()} />
        <SupportLine seed={1} />
      </>,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://buymeacoffee.com/atd_uriel',
      'https://buymeacoffee.com/atd_uriel',
    ]);
    expect(screen.getByText(/^buymeacoffee\.com\/atd_uriel · otwiera się/)).toBeInTheDocument();
  });
});
