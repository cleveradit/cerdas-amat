import { base, C, delS, eyes, fill, fillS, K, paint, paintS, setS, type PartMaps } from './voxel';

export function beruang(): PartMaps {
  const fur = 0x8b5a3a;
  const lt = 0xe2bf93;
  const dk = 0x2a1d17;
  const paw = 0x6e4730;
  const P = base({ fur, leg: fur, belly: lt });
  const h = P.head;
  fillS(h, 2, 4, 18, 19, -1, 0, fur);
  delS(h, 4, 19, -1);
  delS(h, 4, 19, 0);
  setS(h, 3, 18, 0, lt);
  eyes(h, 13);
  fill(h, -2, 2, 10, 12, 4, 4, lt);
  paint(h, -1, 1, 12, 12, 4, 4, dk);
  h.set(K(0, 11, 4), dk);
  paintS(h, 3, 3, 12, 12, 3, 3, C.blush);
  paint(P.armL, -5, -4, 5, 5, -1, 0, paw);
  paint(P.armR, 4, 5, 5, 5, -1, 0, paw);
  fill(P.tail, -1, 1, 5, 6, -3, -3, fur);
  return P;
}
