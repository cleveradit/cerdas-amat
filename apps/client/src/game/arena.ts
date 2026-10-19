import { KO_DIFF, type Result, type SeatIndex } from '@cerdas-amat/shared';

export type Pose = 'idle' | 'pull' | 'drag' | 'win' | 'lose';

/**
 * Posisi tangan kedua karakter dan penanda tali, dalam satuan langkah dari zona netral
 * (host negatif). `diff` = skor host − skor Player 2. Tangan mulai 5 langkah dari zona netral;
 * yang tertinggal terseret ke tengah, dan menyentuh zona netral tepat saat KO.
 */
export function arenaLayout(diff: number): { hostHand: number; p2Hand: number; marker: number } {
  return {
    hostHand: -KO_DIFF + Math.max(0, -diff),
    p2Hand: KO_DIFF - Math.max(0, diff),
    marker: 0 - diff,
  };
}

/** Pose karakter di kursi `seat`: Menarik saat unggul/seri, Terseret saat tertinggal, lalu pose hasil. */
export function poseFor(seat: SeatIndex, diff: number, result: Result | null): Pose {
  if (result) {
    if (result.winner === null) return 'idle';
    return result.winner === seat ? 'win' : 'lose';
  }
  const mine = seat === 0 ? diff : -diff;
  return mine < 0 ? 'drag' : 'pull';
}
