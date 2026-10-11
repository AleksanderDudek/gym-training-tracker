// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queueSave } from './storage';
import type { AppState } from '../types';

/** Zapis w kolejce mówi, czy trafił na dysk — od tego zależy usunięcie ważeń z dziennika diety. */

const state = { log: [] } as unknown as AppState;

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('zapis w kolejce', () => {
  it('udany zapis: obietnica mówi „tak”, pasek zepsutego zapisu znika', async () => {
    const onFail = vi.fn();
    await expect(queueSave(state, onFail)).resolves.toBe(true);
    expect(onFail).toHaveBeenCalledWith(false);
    expect(window.localStorage.getItem('kb-trener-v3')).toBe('{"log":[]}');
  });

  it('przeglądarka odmawia zapisu: obietnica mówi „nie”, a kolejny zapis i tak idzie', async () => {
    const onFail = vi.fn();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('pełno', 'QuotaExceededError');
    });
    const first = queueSave(state, onFail);
    const second = queueSave(state, onFail);
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    expect(onFail.mock.calls).toEqual([[true], [false]]);
    expect(setItem).toHaveBeenCalledTimes(2);
  });
});
