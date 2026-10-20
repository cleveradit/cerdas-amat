export const CHARACTERS = ['kucing', 'beruang', 'rubah', 'panda', 'katak'] as const;
/** Durasi `UNLIMITED` = tanpa batas: berakhir lewat KO, WO, menyerah, atau batas diam. */
export const UNLIMITED = 0;
export const DURATIONS = [30, 60, 90, 120, UNLIMITED] as const;

export type Phase = 'lobby' | 'countdown' | 'playing' | 'paused' | 'result';
export type SeatIndex = 0 | 1; // 0 = host (kiri), 1 = Player 2 (kanan)
export type Character = (typeof CHARACTERS)[number];
export type Duration = (typeof DURATIONS)[number];
/**
 * `surrender` = lawan menekan Keluar saat bermain; `void` = kedua pemain terputus;
 * `idle` = durasi tanpa batas dan tidak ada jawaban benar selama `IDLE_LIMIT_MS`.
 */
export type ResultReason = 'ko' | 'time' | 'wo' | 'surrender' | 'void' | 'idle';

export interface Result {
  winner: SeatIndex | null; // null = seri atau batal
  reason: ResultReason;
}

export interface Pause {
  seat: SeatIndex;
  until: number;
}

export interface Seat {
  token: string; // rahasia 128-bit, untuk klaim ulang kursi
  name: string;
  character: Character;
  connected: boolean;
  disconnectedAt?: number;
  inLobby: boolean; // false selama masih di layar hasil
  pausesUsed: number;
}

export interface RoomState {
  code: string;
  phase: Phase;
  seats: [Seat | null, Seat | null];
  durationSec: Duration;
  score: [number, number];
  qIndex: [number, number];
  decks: [[number, number][], [number, number][]];
  startsAt?: number;
  endsAt?: number;
  remainingMs?: number;
  pause?: Pause;
  result?: Result;
  resultAt?: number; // awal layar hasil; dasar batas 30 detik kembali ke room
  emptySince?: number;
}

/** Kursi seperti yang dilihat pemain: tanpa token. */
export interface SeatView {
  name: string;
  character: Character;
  connected: boolean;
  inLobby: boolean;
}

/** Room seperti yang dilihat pemain: tanpa token dan deck. */
export interface RoomSnapshot {
  code: string;
  phase: Phase;
  durationSec: Duration;
  seats: [SeatView | null, SeatView | null];
  score: [number, number];
  qIndex: [number, number];
  startsAt?: number;
  endsAt?: number;
  remainingMs?: number;
  pause?: Pause;
  result?: Result;
}
