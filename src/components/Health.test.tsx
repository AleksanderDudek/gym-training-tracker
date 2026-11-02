// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vitest';
import { HEALTH_PATH } from '../routing';
import { HealthAck, HealthCard, HealthNote, HealthPage } from './Health';
import { HEALTH_ACK_KEY, resetHealthAckCache } from './healthAck';

beforeEach(() => {
  window.localStorage.removeItem(HEALTH_ACK_KEY);
  resetHealthAckCache();
});

describe('Zdrowie i bezpieczeństwo', () => {
  test('karta potwierdzenia znika na „Rozumiem” wszędzie naraz i nie wraca', async () => {
    const { unmount } = render(
      <>
        <HealthAck />
        <HealthAck />
      </>,
    );
    expect(screen.getAllByRole('heading', { name: 'Zanim skorzystasz z podpowiedzi o jedzeniu' })).toHaveLength(2);
    expect(screen.getAllByText(/Każdy organizm jest inny/)).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Przeczytaj całość' })[0]).toHaveAttribute('href', HEALTH_PATH);

    await userEvent.click(screen.getAllByRole('button', { name: 'Rozumiem' })[0]!);
    expect(screen.queryByRole('heading', { name: 'Zanim skorzystasz z podpowiedzi o jedzeniu' })).toBeNull();
    expect(window.localStorage.getItem(HEALTH_ACK_KEY)).toBe('1');

    unmount();
    resetHealthAckCache();
    render(<HealthAck />);
    expect(screen.queryByRole('heading', { name: 'Zanim skorzystasz z podpowiedzi o jedzeniu' })).toBeNull();
  });

  test('starsza wersja potwierdzenia pyta jeszcze raz', () => {
    window.localStorage.setItem(HEALTH_ACK_KEY, '0');
    render(<HealthAck />);
    expect(screen.getByRole('button', { name: 'Rozumiem' })).toBeInTheDocument();
  });

  test('linijka przy jedzeniu mówi o specjaliście i prowadzi do pełnej strony', () => {
    render(<HealthNote kind="food" more />);
    expect(screen.getByText(/ustal z lekarzem lub dietetykiem/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Więcej o zdrowiu i bezpieczeństwie' })).toHaveAttribute('href', HEALTH_PATH);
  });

  test('linijka treningu bez `more` nie wyprowadza ze wprowadzenia', () => {
    render(<HealthNote />);
    expect(screen.getByText(/nie zastępuje fizjoterapeuty/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  test('ustawienia mają skrót z przejściem do strony', () => {
    render(<HealthCard />);
    expect(screen.getByRole('link', { name: 'Przeczytaj' })).toHaveAttribute('href', HEALTH_PATH);
  });

  test('pełna strona: kto najpierw do specjalisty, relacja z jedzeniem, kiedy dzwonić i dokąd', () => {
    render(<HealthPage />);
    expect(screen.getByText(/Nie jest wyrobem medycznym/)).toBeInTheDocument();
    for (const name of [
      'Każdy organizm jest inny',
      'Kiedy od razu po pomoc',
      'Trening',
      'Jedzenie i dieta',
      'Relacja z jedzeniem',
      'Wyniki badań',
      'Gdzie szukać pomocy',
      'Twoje dane',
    ])
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getByText(/Bez liczenia kalorii/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '112' })).toHaveAttribute('href', 'tel:112');
    expect(screen.getByRole('link', { name: '116 123' })).toHaveAttribute('href', 'tel:116123');
    expect(screen.getByRole('link', { name: '116 111' })).toHaveAttribute('href', 'tel:116111');
  });
});
