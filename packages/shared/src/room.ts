export const CHARACTERS = ['kucing', 'beruang', 'rubah', 'panda', 'katak'] as const;
export const DURATIONS = [30, 60, 90, 120] as const;

export type Phase = 'lobby' | 'countdown' | 'playing' | 'paused' | 'result';
export type SeatIndex = 0 | 1; // 0 = host (kiri), 1 = Player 2 (kanan)
export type Character = (typeof CHARACTERS)[number];
export type Duration = (typeof DURATIONS)[number];

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
  pause?: { seat: SeatIndex; until: number };
  result?: { winner: SeatIndex | null; reason: 'ko' | 'time' | 'wo' | 'void' };
  emptySince?: number;
}

/** Kursi seperti yang dilihat pemain: tanpa token. */
export interface SeatView {
  name: string;
  character: Character;
  connected: boolean;
  inLobby: boolean;
}

export interface RoomSnapshot {
  code: string;
  phase: Phase;
  durationSec: Duration;
  seats: [SeatView | null, SeatView | null];
}
