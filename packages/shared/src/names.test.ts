import { describe, expect, it } from 'vitest';
import { cleanName, NAME_MAX, randomName } from './names';

describe('randomName', () => {
  it('selalu lolos cleanName', () => {
    for (let i = 0; i < 1000; i++) {
      const name = randomName();
      expect(cleanName(name)).toBe(name);
    }
  });
});

describe('cleanName', () => {
  it('menerima tepat NAME_MAX karakter dan menolak satu lebih', () => {
    expect(cleanName('a'.repeat(NAME_MAX))).toBe('a'.repeat(NAME_MAX));
    expect(cleanName('a'.repeat(NAME_MAX + 1))).toBeNull();
  });

  it('membuang spasi dan menolak nama kosong', () => {
    expect(cleanName('  Budi ')).toBe('Budi');
    expect(cleanName('   ')).toBeNull();
  });
});
