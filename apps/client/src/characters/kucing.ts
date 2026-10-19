import { base, C, eyes, fill, fillS, K, paint, paintS, setS, type PartMaps } from './voxel';

export function kucing(): PartMaps {
  const fur = 0x9aa1ab;
  const st = 0x636a74;
  const wh = 0xf3f0ea;
  const or = 0xf0952c;
  const P = base({ fur, leg: fur, belly: wh });
  const h = P.head;
  [-2, 0, 2].forEach((x) => {
    paint(h, x, x, 17, 17, -2, 2, st);
    paint(h, x, x, 15, 16, 3, 3, st);
  });
  fillS(h, 1, 3, 18, 18, -1, 0, fur);
  fillS(h, 2, 3, 19, 19, -1, 0, fur);
  fillS(h, 3, 3, 20, 20, -1, 0, fur);
  setS(h, 2, 18, 0, C.pink);
  eyes(h, 13);
  paint(h, -2, 2, 10, 12, 3, 3, wh);
  fill(h, -1, 1, 11, 12, 4, 4, wh);
  h.set(K(0, 12, 4), C.pink);
  paintS(h, 3, 3, 12, 12, 3, 3, C.blush);
  [5, 7].forEach((y) => paint(P.body, -3, 3, y, y, -2, 1, st));
  paint(P.body, -3, 3, 9, 9, -2, 2, or);
  paint(P.legL, -3, -1, 0, 0, -1, 1, wh);
  paint(P.legR, 1, 3, 0, 0, -1, 1, wh);
  paint(P.armL, -5, -4, 5, 5, -1, 0, wh);
  paint(P.armR, 4, 5, 5, 5, -1, 0, wh);
  (
    [
      [0, 5, -3],
      [0, 5, -4],
      [0, 6, -5],
      [0, 7, -5],
      [0, 8, -5],
      [0, 9, -6],
      [0, 10, -6],
    ] as const
  ).forEach(([x, y, z], i) => P.tail.set(K(x, y, z), i >= 5 ? st : fur));
  return P;
}
