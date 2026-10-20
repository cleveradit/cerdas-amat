import type { SeatIndex } from './room';

export const KO_DIFF = 5;
export const COUNTDOWN_MS = 3000;
export const PAUSE_MS = 10_000;
export const MAX_PAUSES = 3;
export const RESULT_RETURN_MS = 30_000;
export const HEARTBEAT_MS = 5000;
/** Durasi tanpa batas berakhir jika kedua pemain tidak menjawab benar selama ini. */
export const IDLE_LIMIT_MS = 120_000;
export const HEARTBEAT_TIMEOUT_MS = 12_000;
/** Soal yang dikirim di awal (dua deck), dan nomor soal saat deck ditambah 81 lagi. */
export const DECK_BATCH = 162;
export const DECK_REFILL_AT = 150;

/** Pemenang KO jika selisih sudah mencapai KO_DIFF, selain itu `null`. */
export function koWinner(score: [number, number]): SeatIndex | null {
  const diff = score[0] - score[1];
  if (diff >= KO_DIFF) return 0;
  if (diff <= -KO_DIFF) return 1;
  return null;
}

/** Pemenang saat waktu habis; `null` = seri. */
export function timeWinner(score: [number, number]): SeatIndex | null {
  const diff = score[0] - score[1];
  return diff > 0 ? 0 : diff < 0 ? 1 : null;
}
