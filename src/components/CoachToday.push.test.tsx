// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshState } from '../engine/plan';
import { clearLink } from '../link/store';
import { connection, message, seedLink } from '../test/coachSeed';
import { fakeDevice, forgetDevice } from '../test/pushDevice';
import { CoachToday } from './CoachToday';

/**
 * „Włącz powiadomienia od prowadzącego” na ekranie Dziś: pytanie o zgodę pada jeszcze w samym stuknięciu,
 * zanim wczyta się moduł powiadomień — Safari po `await import(…)` gestu już by nie uznał. Odmowa — bez
 * włączania i bez drugiego pytania.
 */

vi.hoisted(() => {
  vi.stubEnv('VITE_API_URL', 'https://api.example');
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
});

const push = vi.hoisted(() => ({ enable: vi.fn() }));
vi.mock('../link/notify', () => ({
  coachPushState: vi.fn(async () => (Notification.permission === 'denied' ? 'denied' : Notification.permission === 'granted' ? 'on' : 'off')),
  enableCoachPush: push.enable,
}));

beforeEach(() => {
  localStorage.clear();
  clearLink();
  push.enable.mockReset();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
  seedLink({ connections: [connection()], messages: [message('Hej')] });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  forgetDevice();
});

const ON = 'Włącz powiadomienia od prowadzącego';

describe('zgoda z dotknięcia', () => {
  it('pytanie o zgodę w samym stuknięciu, przed wczytaniem modułu; potem włączenie', async () => {
    const device = fakeDevice();
    push.enable.mockResolvedValue('on');
    const state = freshState();
    render(<CoachToday state={state} />);
    fireEvent.click(await screen.findByRole('button', { name: ON }));
    // Synchronicznie, w tym samym zdarzeniu — bez żadnego `await` po drodze.
    expect(device.requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Powiadomienia od prowadzącego włączone.')).toBeInTheDocument();
    expect(push.enable).toHaveBeenCalledWith('c1', state);
    expect(device.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('odmowa: bez włączania, z podpowiedzią o ustawieniach strony', async () => {
    const device = fakeDevice({ answer: 'denied' });
    render(<CoachToday state={freshState()} />);
    fireEvent.click(await screen.findByRole('button', { name: ON }));
    expect(device.requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Przeglądarka blokuje powiadomienia — zmienisz to w ustawieniach strony.')).toBeInTheDocument();
    expect(push.enable).not.toHaveBeenCalled();
  });
});
