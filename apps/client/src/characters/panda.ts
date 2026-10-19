import { base, C, delS, fill, fillS, K, paint, type PartMaps } from './voxel';

export function panda(): PartMaps {
  const wh = 0xf3f3ee;
  const bk = 0x232428;
  const P = base({ fur: wh, leg: bk, arm: bk });
  const h = P.head;
  paint(P.body, -3, 3, 8, 9, -2, 2, bk);
  fillS(h, 2, 4, 18, 19, -1, 0, bk);
  delS(h, 4, 19, -1);
  delS(h, 4, 19, 0);
  paint(h, -3, -1, 12, 15, 3, 3, bk);
  paint(h, 1, 3, 12, 15, 3, 3, bk);
  h.set(K(-2, 14, 3), C.white);
  h.set(K(2, 14, 3), C.white);
  fill(h, -1, 1, 10, 11, 4, 4, wh);
  paint(h, 0, 0, 11, 11, 4, 4, bk);
  fill(P.tail, -1, 1, 5, 6, -3, -3, wh);
  return P;
}
