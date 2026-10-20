/**
 * Helper pembuat model voxel, port langsung dari preview karakter yang disetujui
 * (docs/initiate-file/karakter-cerdas-amat.html). Tanpa Three.js agar bisa dites di Node.
 */

export type Part = 'head' | 'body' | 'armL' | 'armR' | 'legL' | 'legR' | 'tail';
/** Kunci `"x,y,z"`, nilai warna hex. */
export type PartMaps = Record<Part, Map<string, number>>;
type Voxels = Map<string, number>;

export const C = { ink: 0x1d2026, white: 0xffffff, pink: 0xf2899e, blush: 0xf4a0a0 };

export const K = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function fill(
  m: Voxels,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  c: number,
): void {
  const za = Math.min(z0, z1);
  const zb = Math.max(z0, z1);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) for (let z = za; z <= zb; z++) m.set(K(x, y, z), c);
}

/** Seperti `fill`, tapi hanya mewarnai voxel yang sudah ada. */
export function paint(
  m: Voxels,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  c: number,
): void {
  const za = Math.min(z0, z1);
  const zb = Math.max(z0, z1);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = za; z <= zb; z++) {
        const k = K(x, y, z);
        if (m.has(k)) m.set(k, c);
      }
}

/** `fill` simetris terhadap x = 0. */
export function fillS(
  m: Voxels,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  c: number,
): void {
  fill(m, x0, x1, y0, y1, z0, z1, c);
  fill(m, -x1, -x0, y0, y1, z0, z1, c);
}

/** `paint` simetris terhadap x = 0. */
export function paintS(
  m: Voxels,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  c: number,
): void {
  paint(m, x0, x1, y0, y1, z0, z1, c);
  paint(m, -x1, -x0, y0, y1, z0, z1, c);
}

export function setS(m: Voxels, x: number, y: number, z: number, c: number): void {
  m.set(K(x, y, z), c);
  m.set(K(-x, y, z), c);
}

export function delS(m: Voxels, x: number, y: number, z: number): void {
  m.delete(K(x, y, z));
  m.delete(K(-x, y, z));
}

/** Badan dasar semua karakter: kaki 4, badan 6, kepala 8 dengan sudut terpotong. */
export function base(p: { fur: number; leg: number; belly?: number; arm?: number }): PartMaps {
  const P: PartMaps = {
    head: new Map(),
    body: new Map(),
    armL: new Map(),
    armR: new Map(),
    legL: new Map(),
    legR: new Map(),
    tail: new Map(),
  };
  fill(P.legL, -3, -1, 0, 3, -1, 1, p.leg);
  fill(P.legR, 1, 3, 0, 3, -1, 1, p.leg);
  fill(P.body, -3, 3, 4, 9, -2, 2, p.fur);
  if (p.belly) fill(P.body, -2, 2, 4, 8, 2, 2, p.belly);
  fill(P.armL, -5, -4, 5, 9, -1, 0, p.arm ?? p.fur);
  fill(P.armR, 4, 5, 5, 9, -1, 0, p.arm ?? p.fur);
  const h = P.head;
  fill(h, -4, 4, 10, 17, -3, 3, p.fur);
  for (const x of [-4, 4]) {
    for (const y of [10, 17]) for (let z = -3; z <= 3; z++) h.delete(K(x, y, z));
    for (const z of [-3, 3]) for (let y = 10; y <= 17; y++) h.delete(K(x, y, z));
  }
  for (const z of [-3, 3])
    for (const y of [10, 17]) for (let x = -4; x <= 4; x++) h.delete(K(x, y, z));
  return P;
}

export function eyes(m: Voxels, y: number): void {
  fill(m, -3, -2, y, y + 1, 3, 3, C.ink);
  fill(m, 2, 3, y, y + 1, 3, 3, C.ink);
  m.set(K(-2, y + 1, 3), C.white);
  m.set(K(3, y + 1, 3), C.white);
}
