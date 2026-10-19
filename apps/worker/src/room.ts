import {
  CLOSE_INVALID,
  CLOSE_ROOM_FULL,
  CLOSE_ROOM_NOT_FOUND,
  MAX_INVALID_MESSAGES,
  parseClientMessage,
  type ClientMessage,
  type ErrorCode,
  type RoomSnapshot,
  type RoomState,
  type SeatIndex,
  type ServerMessage,
} from '@cerdas-amat/shared';
import { DurableObject } from 'cloudflare:workers';

/** Kursi lobby yang terputus ditahan selama ini sebelum dianggap Keluar. */
export const LOBBY_SEAT_HOLD_MS = 60_000;
/** Room tanpa pemain dihapus setelah selama ini. */
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;

/** Disimpan per WebSocket lewat serializeAttachment, bertahan saat hibernasi. */
interface Attachment {
  seat: SeatIndex | null;
  invalid: number;
}

const STATE_KEY = 'state';

/**
 * Satu Durable Object per kode room (`idFromName(code)`). Satu-satunya pemegang
 * keputusan isi kursi, host, dan fase. State disimpan ke storage setiap berubah,
 * karena DO dikeluarkan dari memori saat lobby diam (Hibernation API).
 */
export class Room extends DurableObject<Env> {
  private state: RoomState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Ping dijawab runtime tanpa membangunkan DO.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<RoomState>(STATE_KEY)) ?? null;
    });
  }

  /** Dipanggil Worker saat membuat room. `false` jika kode sudah dipakai. */
  async init(code: string): Promise<boolean> {
    if (this.state) return false;
    this.state = {
      code,
      phase: 'lobby',
      seats: [null, null],
      durationSec: 60,
      score: [0, 0],
      qIndex: [0, 0],
      decks: [[], []],
      emptySince: Date.now(),
    };
    await this.save();
    return true;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    setAttachment(server, { seat: null, invalid: 0 });
    if (!this.state) {
      // Browser tidak bisa membaca status HTTP upgrade yang gagal, jadi
      // "room tidak ada" dikirim sebagai pesan + close code.
      sendError(server, 'ROOM_NOT_FOUND');
      server.close(CLOSE_ROOM_NOT_FOUND, 'ROOM_NOT_FOUND');
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const state = this.state;
    if (!state) {
      ws.close(CLOSE_ROOM_NOT_FOUND, 'ROOM_NOT_FOUND');
      return;
    }
    const msg = typeof raw === 'string' ? parseClientMessage(raw) : null;
    if (!msg) {
      this.rejectInvalid(ws);
      return;
    }
    const att = getAttachment(ws);

    if (msg.type === 'hello') {
      if (att.seat !== null) return this.rejectInvalid(ws);
      return this.onHello(ws, state, msg);
    }
    if (att.seat === null || state.phase !== 'lobby') return this.rejectInvalid(ws);
    const seat = state.seats[att.seat]!;

    switch (msg.type) {
      case 'setProfile':
        seat.name = msg.name;
        seat.character = msg.character;
        break;
      case 'setDuration':
        if (att.seat !== 0) {
          sendError(ws, 'NOT_HOST');
          return;
        }
        state.durationSec = msg.sec;
        break;
      case 'leave':
        this.removeSeat(state, att.seat);
        setAttachment(ws, { ...att, seat: null });
        ws.close(1000, 'leave');
        break;
    }
    await this.save();
    this.broadcastRoom();
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    await this.onDisconnect(ws);
    try {
      // Balas close dari client; 1005/1006 tidak boleh dikirim ulang.
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye');
    } catch {
      // Sudah tertutup.
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.onDisconnect(ws);
  }

  async alarm(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const now = Date.now();

    // Kursi 1 dulu, supaya pergeseran kursi 1 → 0 tidak melewatkan pemeriksaan.
    for (const i of [1, 0] as const) {
      const seat = state.seats[i];
      if (seat && !seat.connected && seat.disconnectedAt! + LOBBY_SEAT_HOLD_MS <= now) {
        this.removeSeat(state, i);
      }
    }

    if (!state.seats[0] && !state.seats[1] && state.emptySince! + EMPTY_ROOM_TTL_MS <= now) {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      this.state = null;
      return;
    }
    await this.save();
    this.broadcastRoom();
  }

  private async onHello(
    ws: WebSocket,
    state: RoomState,
    msg: Extract<ClientMessage, { type: 'hello' }>,
  ): Promise<void> {
    let index = msg.token ? findSeatByToken(state, msg.token) : null;

    if (index !== null) {
      // Klaim ulang: socket lama untuk kursi ini dilepas lalu ditutup.
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && getAttachment(other).seat === index) {
          setAttachment(other, { ...getAttachment(other), seat: null });
          other.close(1000, 'replaced');
        }
      }
      const seat = state.seats[index]!;
      seat.connected = true;
      delete seat.disconnectedAt;
      seat.name = msg.name;
      seat.character = msg.character;
    } else {
      index = !state.seats[0] ? 0 : !state.seats[1] ? 1 : null;
      if (index === null || state.phase !== 'lobby') {
        sendError(ws, 'ROOM_FULL');
        ws.close(CLOSE_ROOM_FULL, 'ROOM_FULL');
        return;
      }
      state.seats[index] = {
        token: crypto.randomUUID(),
        name: msg.name,
        character: msg.character,
        connected: true,
        inLobby: true,
        pausesUsed: 0,
      };
      delete state.emptySince;
    }

    setAttachment(ws, { ...getAttachment(ws), seat: index });
    await this.save();
    send(ws, {
      type: 'welcome',
      seat: index,
      token: state.seats[index]!.token,
      room: snapshot(state),
      serverNow: Date.now(),
    });
    this.broadcastRoom(ws);
  }

  private async onDisconnect(ws: WebSocket): Promise<void> {
    const att = getAttachment(ws);
    const state = this.state;
    if (att.seat === null || !state) return;
    setAttachment(ws, { ...att, seat: null });
    const seat = state.seats[att.seat];
    if (!seat) return;
    seat.connected = false;
    seat.disconnectedAt = Date.now();
    await this.save();
    this.broadcastRoom();
  }

  /** Kosongkan kursi; jika host keluar, Player 2 menjadi host di kursi 0. */
  private removeSeat(state: RoomState, index: SeatIndex): void {
    if (index === 0) {
      state.seats = [state.seats[1], null];
      for (const ws of this.ctx.getWebSockets()) {
        const att = getAttachment(ws);
        if (att.seat === 1) setAttachment(ws, { ...att, seat: 0 });
      }
    } else {
      state.seats[1] = null;
    }
    if (!state.seats[0]) state.emptySince = Date.now();
  }

  private rejectInvalid(ws: WebSocket): void {
    const att = getAttachment(ws);
    const invalid = att.invalid + 1;
    setAttachment(ws, { ...att, invalid });
    sendError(ws, 'INVALID_MESSAGE');
    if (invalid >= MAX_INVALID_MESSAGES) ws.close(CLOSE_INVALID, 'INVALID_MESSAGE');
  }

  private broadcastRoom(except?: WebSocket): void {
    if (!this.state) return;
    const room = snapshot(this.state);
    for (const ws of this.ctx.getWebSockets()) {
      const { seat } = getAttachment(ws);
      if (ws !== except && seat !== null) send(ws, { type: 'room', room, seat });
    }
  }

  /** Simpan state lalu pasang alarm ke tenggat terdekat (satu alarm untuk semua). */
  private async save(): Promise<void> {
    const state = this.state;
    if (!state) return;
    await this.ctx.storage.put(STATE_KEY, state);

    const deadlines: number[] = [];
    for (const seat of state.seats) {
      if (seat && !seat.connected) deadlines.push(seat.disconnectedAt! + LOBBY_SEAT_HOLD_MS);
    }
    if (state.emptySince !== undefined) deadlines.push(state.emptySince + EMPTY_ROOM_TTL_MS);

    if (deadlines.length) await this.ctx.storage.setAlarm(Math.min(...deadlines));
    else await this.ctx.storage.deleteAlarm();
  }
}

function snapshot(state: RoomState): RoomSnapshot {
  const view = (i: SeatIndex) => {
    const s = state.seats[i];
    return s
      ? { name: s.name, character: s.character, connected: s.connected, inLobby: s.inLobby }
      : null;
  };
  return {
    code: state.code,
    phase: state.phase,
    durationSec: state.durationSec,
    seats: [view(0), view(1)],
  };
}

function findSeatByToken(state: RoomState, token: string): SeatIndex | null {
  if (state.seats[0]?.token === token) return 0;
  if (state.seats[1]?.token === token) return 1;
  return null;
}

function getAttachment(ws: WebSocket): Attachment {
  return (ws.deserializeAttachment() as Attachment | null) ?? { seat: null, invalid: 0 };
}

function setAttachment(ws: WebSocket, att: Attachment): void {
  ws.serializeAttachment(att);
}

function send(ws: WebSocket, msg: ServerMessage): void {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // Socket sudah tertutup; perubahan akan terlihat saat pemain tersambung lagi.
  }
}

const ERROR_TEXT: Record<ErrorCode, string> = {
  ROOM_NOT_FOUND: 'Room tidak ditemukan',
  ROOM_FULL: 'Room sudah penuh',
  NOT_HOST: 'Hanya host yang boleh melakukan ini',
  INVALID_MESSAGE: 'Pesan tidak valid',
};

function sendError(ws: WebSocket, code: ErrorCode): void {
  send(ws, { type: 'error', code, message: ERROR_TEXT[code] });
}
