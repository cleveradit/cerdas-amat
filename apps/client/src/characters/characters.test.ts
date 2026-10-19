import { CHARACTERS } from '@cerdas-amat/shared';
import { expect, test } from 'vitest';
import { SPECS } from '.';

// Jumlah voxel per bagian dicek sama dengan kode preview saat port, lalu dikunci di snapshot.
test.each(CHARACTERS)('jumlah voxel per bagian: %s', (c) => {
  const parts = SPECS[c]();
  const counts = Object.fromEntries(Object.entries(parts).map(([k, m]) => [k, m.size]));
  expect(counts).toMatchSnapshot();
});
