import { describe, expect, it } from 'vitest';
import { keyBytes, pushStateOf } from './push';
import type { PushEnv } from './push';

const env = (over: Partial<PushEnv> = {}): PushEnv => ({
  configured: true,
  ios: false,
  standalone: false,
  hasPush: true,
  worker: true,
  permission: 'default',
  subscribed: false,
  ...over,
});

describe('stan przypomnień na tym telefonie', () => {
  it('bez serwera w buildzie karty nie ma — nic innego się nie liczy', () => {
    expect(pushStateOf(env({ configured: false, subscribed: true, permission: 'granted' }))).toBe('unconfigured');
  });

  it('iPhone w karcie Safari dostaje instrukcję dodania do ekranu, a nie „nie obsługuje”', () => {
    expect(pushStateOf(env({ ios: true, hasPush: false }))).toBe('ios-install');
    expect(pushStateOf(env({ ios: true, standalone: true }))).toBe('off');
  });

  it('kolejno: brak Web Push, brak service workera, zgoda odebrana', () => {
    expect(pushStateOf(env({ hasPush: false }))).toBe('unsupported');
    expect(pushStateOf(env({ worker: false }))).toBe('no-worker');
    expect(pushStateOf(env({ permission: 'denied' }))).toBe('denied');
  });

  it('włączone tylko przy zgodzie i subskrypcji jednocześnie', () => {
    expect(pushStateOf(env({ permission: 'granted', subscribed: true }))).toBe('on');
    expect(pushStateOf(env({ permission: 'granted', subscribed: false }))).toBe('off');
    expect(pushStateOf(env({ permission: 'default', subscribed: true }))).toBe('off');
  });

  it('klucz serwera z base64url to 65 bajtów punktu P-256', () => {
    const k = keyBytes('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
    expect(k.length).toBe(65);
    expect(k[0]).toBe(4);
  });
});
