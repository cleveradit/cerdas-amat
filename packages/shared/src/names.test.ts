import { describe, expect, it } from 'vitest';
import { BAD_WORDS } from './badWords';
import { cleanName, isBadName, NAME_MAX, normalizeForFilter, randomName } from './names';

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

describe('normalizeForFilter', () => {
  it('mengganti angka mirip huruf dan membuang selain a–z', () => {
    expect(normalizeForFilter('B4.ng S4t!')).toBe('bangsat');
    expect(normalizeForFilter('4nj1ng')).toBe('anjing');
    expect(normalizeForFilter('Budi_99')).toBe('budi');
  });
});

describe('isBadName', () => {
  it('menolak kata kasar, termasuk samaran dan potongan kata', () => {
    for (const name of [
      'anjing',
      'Bangsat',
      '4nj1ng',
      'k.o.n.t.o.l',
      'fuck',
      'SHIT',
      'xxbitchxx',
    ]) {
      expect(isBadName(name), name).toBe(true);
    }
  });

  it('menerima kata dan nama umum yang memuat potongan mirip kata kasar', () => {
    const names = ['Pantai', 'Santai', 'Kasur', 'Kelas', 'Bass', 'Dickson', 'Grape', 'Budi'];
    for (const name of [...names, 'Siti', 'Asep', 'Brokoli', 'Analisa', 'Pukis', 'Hancock']) {
      expect(isBadName(name), name).toBe(false);
    }
  });

  it('nama acak tidak pernah ditolak', () => {
    for (let i = 0; i < 1000; i++) expect(isBadName(randomName())).toBe(false);
  });
});

describe('BAD_WORDS', () => {
  it('hanya a–z, minimal 4 huruf, tanpa duplikat', () => {
    for (const word of BAD_WORDS) expect(word, word).toMatch(/^[a-z]{4,}$/);
    expect(new Set(BAD_WORDS).size).toBe(BAD_WORDS.length);
  });
});
