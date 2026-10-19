import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './roomCode';

describe('ROOM_CODE_ALPHABET', () => {
  it('berisi 31 karakter unik', () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(31);
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(31);
  });

  it('tidak memuat karakter yang mudah tertukar', () => {
    for (const ch of ['0', 'O', '1', 'I', 'L']) {
      expect(ROOM_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it('panjang kode 5 karakter', () => {
    expect(ROOM_CODE_LENGTH).toBe(5);
  });
});
