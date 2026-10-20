import * as v from 'valibot';
import { NAME_MAX } from './names';
import type { Question } from './deck';
import {
  CHARACTERS,
  DURATIONS,
  type ResultReason,
  type RoomSnapshot,
  type SeatIndex,
} from './room';

export const MAX_MESSAGE_BYTES = 1024;
export const MAX_INVALID_MESSAGES = 5;

/** Kode close WebSocket aplikasi; client berhenti mencoba ulang saat menerimanya. */
export const CLOSE_INVALID = 4400;
export const CLOSE_ROOM_NOT_FOUND = 4404;
export const CLOSE_ROOM_FULL = 4409;
/** Terlalu banyak kode room salah dari IP yang sama. */
export const CLOSE_RATE_LIMITED = 4429;
/** Kuota Cloudflare plan gratis habis; dikirim Worker tanpa Durable Object. */
export const CLOSE_QUOTA = 4503;
/** Ditutup server karena tidak ada ping; client tetap mencoba tersambung ulang. */
export const CLOSE_HEARTBEAT = 4000;

const NameSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(NAME_MAX));
const CharacterSchema = v.picklist(CHARACTERS);

export const ClientMessageSchema = v.variant('type', [
  v.object({
    type: v.literal('hello'),
    token: v.optional(v.pipe(v.string(), v.uuid())),
    name: NameSchema,
    character: CharacterSchema,
  }),
  v.object({ type: v.literal('setProfile'), name: NameSchema, character: CharacterSchema }),
  v.object({ type: v.literal('setDuration'), sec: v.picklist(DURATIONS) }),
  v.object({ type: v.literal('leave') }),
  v.object({ type: v.literal('start') }),
  v.object({
    type: v.literal('answer'),
    q: v.pipe(v.number(), v.integer(), v.minValue(0)),
    value: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(99)),
  }),
  v.object({ type: v.literal('backToRoom') }),
  v.object({ type: v.literal('sync'), t: v.pipe(v.number(), v.finite()) }),
]);

export type ClientMessage = v.InferOutput<typeof ClientMessageSchema>;

export type ErrorCode =
  'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'NOT_HOST' | 'INVALID_MESSAGE' | 'RATE_LIMITED' | 'QUOTA';

export type ServerMessage =
  | { type: 'welcome'; seat: SeatIndex; token: string; room: RoomSnapshot; serverNow: number }
  // `seat` = kursi penerima saat ini; berubah saat host keluar dan Player 2 menjadi host.
  | { type: 'room'; room: RoomSnapshot; seat: SeatIndex }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'countdown'; startsAt: number }
  | { type: 'deck'; from: number; questions: Question[] }
  | { type: 'tug'; score: [number, number]; by: SeatIndex }
  | { type: 'reject'; q: number; expected: number }
  | { type: 'pause'; seat: SeatIndex; until: number; remainingMs: number }
  | { type: 'resume'; endsAt: number }
  | {
      type: 'result';
      winner: SeatIndex | null;
      reason: ResultReason;
      score: [number, number];
    }
  | { type: 'sync'; t: number; serverNow: number };

/** `null` jika lebih dari MAX_MESSAGE_BYTES, bukan JSON, atau tidak lolos skema. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = v.safeParse(ClientMessageSchema, data);
  return result.success ? result.output : null;
}
