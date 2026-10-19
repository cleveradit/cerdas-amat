import { describe, expect, it } from 'vitest';
import {
  generateRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './roomCode';

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

describe('generateRoomCode', () => {
  it('menghasilkan kode sah dari alfabet', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateRoomCode();
      expect(normalizeRoomCode(code)).toBe(code);
    }
  });

  it('memakai simbol pertama dan terakhir alfabet di ujung rentang random', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAAA');
    expect(generateRoomCode(() => 0.9999)).toBe('99999');
  });
});

describe('normalizeRoomCode', () => {
  it('mengubah ke huruf besar dan membuang spasi', () => {
    expect(normalizeRoomCode('  abcde ')).toBe('ABCDE');
  });

  it('menolak panjang selain 5', () => {
    expect(normalizeRoomCode('ABCD')).toBeNull();
    expect(normalizeRoomCode('ABCDEF')).toBeNull();
  });

  it('menolak karakter di luar alfabet', () => {
    expect(normalizeRoomCode('ABCD0')).toBeNull();
    expect(normalizeRoomCode('abcdl')).toBeNull();
  });
});
