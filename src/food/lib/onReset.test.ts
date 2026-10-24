import { describe, expect, it, vi } from 'vitest';

/** Moduł trzyma zapisane funkcje na poziomie modułu, więc każdy test wczytuje go od nowa. */
async function load() {
  vi.resetModules();
  return import('./onReset');
}

describe('co zapominają wczytane moduły', () => {
  it('reset woła każdą zapisaną funkcję, przy każdym resecie', async () => {
    const { forgetAll, onReset } = await load();
    const leaves = vi.fn();
    const index = vi.fn();
    onReset(leaves);
    onReset(index);
    forgetAll();
    expect(leaves).toHaveBeenCalledTimes(1);
    expect(index).toHaveBeenCalledTimes(1);
    forgetAll();
    expect(leaves).toHaveBeenCalledTimes(2);
  });

  it('bez wczytanych modułów nie ma czego zapominać', async () => {
    const { forgetAll } = await load();
    expect(() => forgetAll()).not.toThrow();
  });

  it('moduł, który zawiedzie, nie zatrzymuje pozostałych', async () => {
    const { forgetAll, onReset } = await load();
    const after = vi.fn();
    onReset(() => {
      throw new Error('zepsuty moduł');
    });
    onReset(after);
    expect(() => forgetAll()).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
  });
});
