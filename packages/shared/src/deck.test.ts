import { describe, expect, it } from 'vitest';
import { makeDeck, type Question } from './deck';

const clash = (p: Question, q: Question) =>
  (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);

describe('makeDeck', () => {
  it('10.000 deck berantai: 81 soal unik, tanpa pasangan tukar berurutan, sambungan aman', () => {
    let prev: Question | null = null;
    for (let n = 0; n < 10_000; n++) {
      const deck = makeDeck(prev);
      expect(deck).toHaveLength(81);
      expect(new Set(deck.map(([a, b]) => `${a}x${b}`)).size).toBe(81);
      if (prev && clash(prev, deck[0]!)) throw new Error(`sambungan deck ${n} bentrok`);
      for (let i = 0; i < 80; i++) {
        if (clash(deck[i]!, deck[i + 1]!)) throw new Error(`deck ${n} bentrok di soal ${i}`);
      }
      prev = deck[80]!;
    }
  });

  it('semua soal berada di rentang 1–9', () => {
    for (const [a, b] of makeDeck(null)) {
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(9);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(9);
    }
  });
});
