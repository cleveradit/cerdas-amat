import { describe, expect, it } from 'vitest';
import { koWinner, timeWinner } from './result';

describe('koWinner', () => {
  it('selisih 4 belum KO, selisih 5 KO', () => {
    expect(koWinner([13, 9])).toBeNull();
    expect(koWinner([14, 9])).toBe(0);
    expect(koWinner([9, 14])).toBe(1);
    expect(koWinner([9, 13])).toBeNull();
  });
});

describe('timeWinner', () => {
  it('positif host, negatif Player 2, nol seri', () => {
    expect(timeWinner([3, 1])).toBe(0);
    expect(timeWinner([1, 3])).toBe(1);
    expect(timeWinner([2, 2])).toBeNull();
  });
});
