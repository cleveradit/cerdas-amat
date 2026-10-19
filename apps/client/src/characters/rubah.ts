import { base, eyes, fill, fillS, paint, paintS, setS, type PartMaps } from './voxel';

export function rubah(): PartMaps {
  const fur = 0xe8742a;
  const wh = 0xfff4e6;
  const dk = 0x35261f;
  const P = base({ fur, leg: fur, belly: wh });
  const h = P.head;
  paint(P.body, -2, 2, 9, 9, 2, 2, wh);
  paint(P.legL, -3, -1, 0, 1, -1, 1, dk);
  paint(P.legR, 1, 3, 0, 1, -1, 1, dk);
  paint(P.armL, -5, -4, 5, 6, -1, 0, dk);
  paint(P.armR, 4, 5, 5, 6, -1, 0, dk);
  fillS(h, 1, 3, 18, 18, -1, 0, fur);
  fillS(h, 2, 3, 19, 19, -1, 0, fur);
  fillS(h, 3, 3, 20, 21, -1, 0, fur);
  setS(h, 3, 21, -1, dk);
  setS(h, 3, 21, 0, dk);
  setS(h, 2, 18, 0, wh);
  eyes(h, 13);
  paint(h, -3, 3, 10, 12, 3, 3, wh);
  paintS(h, 4, 4, 10, 12, -2, 2, wh);
  fill(h, -1, 1, 10, 11, 4, 5, wh);
  paint(h, 0, 0, 11, 11, 5, 5, dk);
  fill(P.tail, -1, 1, 5, 7, -3, -4, fur);
  fill(P.tail, -1, 1, 6, 9, -5, -6, fur);
  fill(P.tail, -1, 1, 8, 11, -7, -7, wh);
  fill(P.tail, -1, 1, 10, 11, -6, -6, wh);
  return P;
}
