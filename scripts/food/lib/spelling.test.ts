import { expect, test } from 'vitest';
import { SpellingCounter } from './spelling';

test('the most frequent spelling names the key', () => {
  const counter = new SpellingCounter();
  counter.add('piatnica', 'Piatnica');
  counter.add('piatnica', 'Piątnica');
  counter.add('piatnica', 'Piątnica');
  expect(counter.best()).toEqual({ piatnica: 'Piątnica' });
});

test('a tie goes to the spelling seen first', () => {
  const counter = new SpellingCounter();
  counter.add('x', 'First');
  counter.add('x', 'Second');
  expect(counter.best()).toEqual({ x: 'First' });
});
