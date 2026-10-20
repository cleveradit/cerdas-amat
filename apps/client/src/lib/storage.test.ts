import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadVolumes, saveVolumes } from './storage';

// Tes berjalan di Node tanpa localStorage; cukup Map sederhana.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});

describe('loadVolumes', () => {
  beforeEach(() => store.clear());

  test('localStorage kosong: default musik 50, efek suara 80', () => {
    expect(loadVolumes()).toEqual({ music: 50, sfx: 80 });
  });

  test('data rusak atau di luar 0–100: default', () => {
    store.set('cerdas-amat:volume', 'x');
    expect(loadVolumes()).toEqual({ music: 50, sfx: 80 });
    store.set('cerdas-amat:volume', JSON.stringify({ music: 150, sfx: -5 }));
    expect(loadVolumes()).toEqual({ music: 50, sfx: 80 });
    store.set('cerdas-amat:volume', JSON.stringify({ music: '40', sfx: 2.5 }));
    expect(loadVolumes()).toEqual({ music: 50, sfx: 80 });
  });

  test('batas 0 dan 100 tersimpan apa adanya', () => {
    saveVolumes({ music: 0, sfx: 100 });
    expect(store.get('cerdas-amat:volume')).toBe('{"music":0,"sfx":100}');
    expect(loadVolumes()).toEqual({ music: 0, sfx: 100 });
  });
});
