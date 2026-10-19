import { base, C, delS, fill, fillS, paint, paintS, setS, type PartMaps } from './voxel';

export function katak(): PartMaps {
  const g = 0x66b84a;
  const lt = 0xcfe88d;
  const dk = 0x2f5a24;
  const P = base({ fur: g, leg: g, belly: lt });
  const h = P.head;
  fillS(h, 1, 3, 18, 20, -1, 1, g);
  [1, 3].forEach((x) => {
    for (let z = -1; z <= 1; z++) delS(h, x, 20, z);
  });
  paintS(h, 1, 3, 18, 19, 1, 1, C.white);
  paintS(h, 2, 2, 18, 19, 1, 1, C.ink);
  setS(h, 2, 19, 1, C.ink);
  paint(h, -3, 3, 10, 10, 3, 3, lt);
  paint(h, -3, 3, 12, 12, 3, 3, dk);
  paintS(h, 4, 4, 12, 12, 0, 2, dk);
  paintS(h, 3, 3, 13, 13, 3, 3, C.blush);
  (
    [
      [-2, 17, -1],
      [1, 17, -2],
      [2, 17, 1],
      [0, 15, -3],
      [-3, 13, -3],
      [2, 12, -3],
    ] as const
  ).forEach(([x, y, z]) => paint(h, x, x, y, y, z, z, dk));
  (
    [
      [-2, 7, -2],
      [1, 5, -2],
      [2, 8, -2],
    ] as const
  ).forEach(([x, y, z]) => paint(P.body, x, x, y, y, z, z, dk));
  fill(P.legL, -4, -1, 0, 0, -1, 2, g);
  fill(P.legR, 1, 4, 0, 0, -1, 2, g);
  return P;
}
