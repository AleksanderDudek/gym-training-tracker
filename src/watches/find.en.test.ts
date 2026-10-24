import { describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { answer, answerFor, suggest } from './find';

describe('the watch check in English', () => {
  test('the „first generation” labels are English, and English words find them', () => {
    for (const q of ['instinct 1', 'Instinct 1st gen', 'instinct first generation', 'instinct pierwszej generacji']) {
      const a = answer(q);
      expect(a.kind === 'one' && a.title, q).toBe('Instinct® (1st gen)');
    }
    expect(answerFor('swim1')).toMatchObject({ kind: 'one', title: 'Garmin Swim™ (1st gen)' });
    expect(JSON.stringify(suggest('instinct', 50).hits.map((h) => h.name))).not.toContain('generacja');
  });

  test('English „I don’t know” asks for help too', () => {
    for (const q of ["I don't know", 'dont know', 'no idea', 'not sure']) expect(answer(q), q).toEqual({ kind: 'help' });
  });
});
