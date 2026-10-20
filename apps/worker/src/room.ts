import {
  CLOSE_HEARTBEAT,
  CLOSE_INVALID,
  CLOSE_RATE_LIMITED,
  CLOSE_ROOM_FULL,
  CLOSE_ROOM_NOT_FOUND,
  COUNTDOWN_MS,
  DECK_BATCH,
  DECK_REFILL_AT,
  HEARTBEAT_MS,
  HEARTBEAT_TIMEOUT_MS,
  IDLE_LIMIT_MS,
  isBadName,
  koWinner,
  makeDeck,
  MAX_INVALID_MESSAGES,
  MAX_PAUSES,
  parseClientMessage,
  PAUSE_MS,
  randomName,
  RESULT_RETURN_MS,
  timeWinner,
  type ClientMessage,
  type ErrorCode,
  type Question,
  type ResultReason,
  type RoomSnapshot,
  type RoomState,
  type SeatIndex,
  type ServerMessage,
  UNLIMITED,
} from '@cerdas-amat/shared';
import { DurableObject } from 'cloudflare:workers';

/** Kursi lobby yang terputus ditahan selama ini sebelum dianggap Keluar. */
export const LOBBY_SEAT_HOLD_MS = 60_000;
/** Room tanpa pemain dihapus setelah selama ini. */
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;
/** Selama bermain, state ditulis paling sering sekali per selang ini. */
const PLAY_WRITE_INTERVAL_MS = 1000;

/** Disimpan per WebSocket lewat serializeAttachment, bertahan saat hibernasi. */
interface Attachment {
  seat: SeatIndex | null;
  invalid: number;
  /** Waktu tersambung; dasar cek heartbeat sebelum ping pertama. */
  since: number;
}

const STATE_KEY = 'state';
const GAME_PHASES = new Set(['countdown', 'playing', 'paused']);

const other = (seat: SeatIndex): SeatIndex => (seat === 0 ? 1 : 0);

/**
 * Satu Durable Object per kode room (`idFromName(code)`). Satu-satunya pemegang
 * keputusan isi kursi, host, fase, skor, dan waktu. State disimpan ke storage
 * setiap berubah, karena DO dikeluarkan dari memori saat diam (Hibernation API);
 * selama bermain tulisan dibatasi PLAY_WRITE_INTERVAL_MS ditambah alarm heartbeat.
 */
export class Room extends DurableObject<Env> {
  private state: RoomState | null = null;
  private lastWrite = 0;

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
    setAttachment(server, { seat: null, invalid: 0, since: Date.now() });
    if (!this.state) {
      // Browser tidak bisa membaca status HTTP upgrade yang gagal, jadi
      // "room tidak ada" dikirim sebagai pesan + close code. Hanya DO yang tahu
      // kode ini salah, jadi batas tebakan kode per IP dihitung di sini.
      const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
      const { success } = await this.env.JOIN_LIMIT.limit({ key: ip });
      if (success) {
        sendError(server, 'ROOM_NOT_FOUND');
        server.close(CLOSE_ROOM_NOT_FOUND, 'ROOM_NOT_FOUND');
      } else {
        sendError(server, 'RATE_LIMITED');
        server.close(CLOSE_RATE_LIMITED, 'RATE_LIMITED');
      }
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
    if (!msg) return this.rejectInvalid(ws);
    const att = getAttachment(ws);

    if (msg.type === 'sync') {
      send(ws, { type: 'sync', t: msg.t, serverNow: Date.now() });
      return;
    }
    if (msg.type === 'hello') {
      if (att.seat !== null) return this.rejectInvalid(ws);
      return this.onHello(ws, state, msg);
    }
    if (att.seat === null) return this.rejectInvalid(ws);
    const index = att.seat;
    const seat = state.seats[index]!;

    switch (msg.type) {
      case 'answer':
        return this.onAnswer(ws, state, index, msg.q, msg.value);
      case 'leave':
        if (GAME_PHASES.has(state.phase)) this.finish(state, 'surrender', other(index));
        this.removeSeat(state, index);
        setAttachment(ws, { ...att, seat: null });
        ws.close(1000, 'leave');
        break;
      case 'backToRoom':
        if (state.phase !== 'result' && state.phase !== 'lobby') return this.rejectInvalid(ws);
        if (seat.inLobby) return;
        seat.inLobby = true;
        if (state.phase === 'result') {
          state.phase = 'lobby';
          delete state.result;
        }
        break;
      case 'start':
        if (index !== 0) return sendError(ws, 'NOT_HOST');
        if (!this.canStart(state)) return this.rejectInvalid(ws);
        return this.startCountdown(state);
      case 'setProfile':
        if (state.phase !== 'lobby') return this.rejectInvalid(ws);
        seat.name = safeName(msg.name);
        seat.character = msg.character;
        break;
      case 'setDuration':
        if (index !== 0) return sendError(ws, 'NOT_HOST');
        if (state.phase !== 'lobby') return this.rejectInvalid(ws);
        state.durationSec = msg.sec;
        break;
    }
    await this.save();
    this.broadcastRoom();
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    await this.onSocketGone(ws);
    try {
      // Balas close dari client; 1005/1006 tidak boleh dikirim ulang.
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye');
    } catch {
      // Sudah tertutup.
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.onSocketGone(ws);
  }

  /** Satu alarm untuk semua tenggat: proses semua yang sudah lewat, lalu pasang yang terdekat. */
  async alarm(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const now = Date.now();

    if (GAME_PHASES.has(state.phase)) this.checkHeartbeats(state, now);

    if (state.phase === 'countdown' && state.startsAt! <= now) {
      state.phase = 'playing';
      state.endsAt = deadlineFrom(state, state.startsAt!);
      delete state.startsAt;
    }
    if (state.phase === 'playing' && state.endsAt! <= now) {
      this.finish(
        state,
        state.durationSec === UNLIMITED ? 'idle' : 'time',
        timeWinner(state.score),
      );
    }
    if (state.phase === 'paused' && state.pause!.until <= now) {
      const rival = other(state.pause!.seat);
      if (state.seats[rival]?.connected) this.finish(state, 'wo', rival);
      else this.finish(state, 'void', null);
    }

    if (state.phase === 'lobby' || state.phase === 'result') {
      // Kursi 1 dulu, supaya pergeseran kursi 1 → 0 tidak melewatkan pemeriksaan.
      for (const i of [1, 0] as const) {
        const seat = state.seats[i];
        if (!seat) continue;
        const holdOver =
          seat.inLobby && !seat.connected && seat.disconnectedAt! + LOBBY_SEAT_HOLD_MS <= now;
        const resultOver = !seat.inLobby && state.resultAt! + RESULT_RETURN_MS <= now;
        if (holdOver || resultOver) this.removeSeat(state, i);
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
    const reclaim = index !== null;

    if (index !== null) {
      // Klaim ulang: socket lama untuk kursi ini dilepas lalu ditutup.
      for (const old of this.ctx.getWebSockets()) {
        if (old !== ws && getAttachment(old).seat === index) {
          setAttachment(old, { ...getAttachment(old), seat: null });
          old.close(1000, 'replaced');
        }
      }
      const seat = state.seats[index]!;
      seat.connected = true;
      delete seat.disconnectedAt;
      if (state.phase === 'lobby') {
        seat.name = safeName(msg.name);
        seat.character = msg.character;
      }
    } else {
      index = !state.seats[0] ? 0 : !state.seats[1] ? 1 : null;
      if (index === null || state.phase !== 'lobby') {
        sendError(ws, 'ROOM_FULL');
        ws.close(CLOSE_ROOM_FULL, 'ROOM_FULL');
        return;
      }
      state.seats[index] = {
        token: crypto.randomUUID(),
        name: safeName(msg.name),
        character: msg.character,
        connected: true,
        inLobby: true,
        pausesUsed: 0,
      };
      delete state.emptySince;
    }

    // Jeda diproses sebelum socket ini dipasang ke kursinya, supaya `resume`/`pause`
    // hanya terkirim ke lawan; pemain yang kembali membaca state dari `welcome`.
    if (reclaim && state.phase === 'paused') this.onReturnDuringPause(state, index);
    setAttachment(ws, { ...getAttachment(ws), seat: index });
    await this.save();

    send(ws, {
      type: 'welcome',
      seat: index,
      token: state.seats[index]!.token,
      room: snapshot(state),
      serverNow: Date.now(),
    });
    if (GAME_PHASES.has(state.phase)) {
      send(ws, {
        type: 'deck',
        from: state.qIndex[index],
        questions: state.decks[index].slice(state.qIndex[index]),
      });
    }
    this.broadcastRoom(ws);
  }

  private async onAnswer(
    ws: WebSocket,
    state: RoomState,
    index: SeatIndex,
    q: number,
    value: number,
  ): Promise<void> {
    const expected = state.qIndex[index];
    const question = state.decks[index][expected];
    if (state.phase !== 'playing' || q !== expected || value !== question![0] * question![1]) {
      send(ws, { type: 'reject', q, expected });
      return;
    }
    state.qIndex[index]++;
    state.score[index]++;
    // Batas diam dihitung ulang; alarm yang berbunyi di tenggat lama hanya memasang ulang alarm.
    if (state.durationSec === UNLIMITED) state.endsAt = deadlineFrom(state, Date.now());

    const deck = state.decks[index];
    if (deck.length - state.qIndex[index] <= DECK_BATCH - DECK_REFILL_AT) {
      const more = makeDeck(deck[deck.length - 1]!);
      send(ws, { type: 'deck', from: deck.length, questions: more });
      deck.push(...more);
    }

    this.broadcast({ type: 'tug', score: state.score, by: index });
    const winner = koWinner(state.score);
    if (winner !== null) {
      this.finish(state, 'ko', winner);
      await this.save();
      this.broadcastRoom();
    } else if (Date.now() - this.lastWrite >= PLAY_WRITE_INTERVAL_MS) {
      await this.save();
    }
  }

  private canStart(state: RoomState): boolean {
    return (
      state.phase === 'lobby' && state.seats.every((s) => s !== null && s.connected && s.inLobby)
    );
  }

  private async startCountdown(state: RoomState): Promise<void> {
    const now = Date.now();
    state.phase = 'countdown';
    state.startsAt = now + COUNTDOWN_MS;
    state.score = [0, 0];
    state.qIndex = [0, 0];
    state.decks = [newDecks(), newDecks()];
    for (const seat of state.seats) seat!.pausesUsed = 0;
    delete state.endsAt;
    delete state.pause;
    delete state.remainingMs;
    delete state.result;
    delete state.resultAt;
    await this.save();

    for (const ws of this.ctx.getWebSockets()) {
      const { seat } = getAttachment(ws);
      if (seat === null) continue;
      send(ws, { type: 'countdown', startsAt: state.startsAt });
      send(ws, { type: 'deck', from: 0, questions: state.decks[seat] });
    }
    this.broadcastRoom();
  }

  private async onSocketGone(ws: WebSocket): Promise<void> {
    const att = getAttachment(ws);
    if (att.seat === null || !this.state) return;
    setAttachment(ws, { ...att, seat: null });
    this.onDisconnect(this.state, att.seat);
    await this.save();
    this.broadcastRoom();
  }

  private onDisconnect(state: RoomState, index: SeatIndex): void {
    const seat = state.seats[index];
    if (!seat) return;
    seat.connected = false;
    seat.disconnectedAt = Date.now();
    if (state.phase === 'countdown') {
      // Putus sebelum mulai: batal tanpa memakai jatah jeda.
      state.phase = 'lobby';
      delete state.startsAt;
      state.decks = [[], []];
    } else if (state.phase === 'playing') {
      this.startPause(state, index);
    }
  }

  /** Jeda untuk kursi `index`, atau WO jika jatah jedanya sudah habis. */
  private startPause(state: RoomState, index: SeatIndex): void {
    const seat = state.seats[index]!;
    if (seat.pausesUsed >= MAX_PAUSES) {
      this.finish(state, 'wo', other(index));
      return;
    }
    seat.pausesUsed++;
    const now = Date.now();
    if (state.phase === 'playing') {
      state.remainingMs = Math.max(0, state.endsAt! - now);
      delete state.endsAt;
      state.phase = 'paused';
    }
    state.pause = { seat: index, until: now + PAUSE_MS };
    this.broadcast({
      type: 'pause',
      seat: index,
      until: state.pause.until,
      remainingMs: state.remainingMs!,
    });
  }

  /** Pemain kembali saat fase `paused`. */
  private onReturnDuringPause(state: RoomState, index: SeatIndex): void {
    if (state.pause!.seat !== index) return; // yang kembali bukan pemilik jeda
    const rival = other(index);
    if (state.seats[rival]!.connected) {
      state.phase = 'playing';
      state.endsAt = Date.now() + state.remainingMs!;
      delete state.pause;
      delete state.remainingMs;
      this.broadcast({ type: 'resume', endsAt: state.endsAt });
    } else {
      // Lawan ikut terputus selama jeda: jeda pindah ke lawan dengan jatahnya sendiri.
      this.startPause(state, rival);
    }
  }

  private checkHeartbeats(state: RoomState, now: number): void {
    for (const ws of this.ctx.getWebSockets()) {
      const att = getAttachment(ws);
      if (att.seat === null) continue;
      const last = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? att.since;
      if (now - Math.max(last, att.since) <= HEARTBEAT_TIMEOUT_MS) continue;
      setAttachment(ws, { ...att, seat: null });
      ws.close(CLOSE_HEARTBEAT, 'heartbeat');
      this.onDisconnect(state, att.seat);
    }
  }

  private finish(state: RoomState, reason: ResultReason, winner: SeatIndex | null): void {
    state.phase = 'result';
    state.result = { winner, reason };
    state.resultAt = Date.now();
    for (const seat of state.seats) if (seat) seat.inLobby = false;
    delete state.startsAt;
    delete state.endsAt;
    delete state.pause;
    delete state.remainingMs;
    this.broadcast({ type: 'result', winner, reason, score: state.score });
  }

  /** Kosongkan kursi; jika host keluar, Player 2 menjadi host di kursi 0. */
  private removeSeat(state: RoomState, index: SeatIndex): void {
    if (index === 0) {
      state.seats = [state.seats[1], null];
      for (const ws of this.ctx.getWebSockets()) {
        const att = getAttachment(ws);
        if (att.seat === 1) setAttachment(ws, { ...att, seat: 0 });
      }
      // Nomor kursi di hasil tidak lagi cocok setelah pergeseran.
      delete state.result;
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

  private broadcast(msg: ServerMessage): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (getAttachment(ws).seat !== null) send(ws, msg);
    }
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
    const now = Date.now();
    await this.ctx.storage.put(STATE_KEY, state);
    this.lastWrite = now;

    const deadlines: number[] = [];
    if (GAME_PHASES.has(state.phase)) deadlines.push(now + HEARTBEAT_MS);
    if (state.phase === 'countdown') deadlines.push(state.startsAt!);
    if (state.phase === 'playing') deadlines.push(state.endsAt!);
    if (state.phase === 'paused') deadlines.push(state.pause!.until);
    if (state.phase === 'lobby' || state.phase === 'result') {
      for (const seat of state.seats) {
        if (!seat) continue;
        if (!seat.inLobby) deadlines.push(state.resultAt! + RESULT_RETURN_MS);
        else if (!seat.connected) deadlines.push(seat.disconnectedAt! + LOBBY_SEAT_HOLD_MS);
      }
    }
    if (state.emptySince !== undefined) deadlines.push(state.emptySince + EMPTY_ROOM_TTL_MS);

    if (deadlines.length) await this.ctx.storage.setAlarm(Math.min(...deadlines));
    else await this.ctx.storage.deleteAlarm();
  }
}

/** Tenggat `endsAt` dihitung dari `from`: akhir waktu, atau batas diam untuk durasi tanpa batas. */
function deadlineFrom(state: RoomState, from: number): number {
  return from + (state.durationSec === UNLIMITED ? IDLE_LIMIT_MS : state.durationSec * 1000);
}

/** Dua deck berturut-turut (162 soal) dengan sambungan yang aman. */
function newDecks(): Question[] {
  const first = makeDeck(null);
  return [...first, ...makeDeck(first[first.length - 1]!)];
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
    score: state.score,
    qIndex: state.qIndex,
    startsAt: state.startsAt,
    endsAt: state.endsAt,
    remainingMs: state.remainingMs,
    pause: state.pause,
    result: state.result,
  };
}

/** Server penentu filter nama: nama kasar diganti nama acak. */
function safeName(name: string): string {
  return isBadName(name) ? randomName() : name;
}

function findSeatByToken(state: RoomState, token: string): SeatIndex | null {
  if (state.seats[0]?.token === token) return 0;
  if (state.seats[1]?.token === token) return 1;
  return null;
}

function getAttachment(ws: WebSocket): Attachment {
  return (ws.deserializeAttachment() as Attachment | null) ?? { seat: null, invalid: 0, since: 0 };
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
  RATE_LIMITED: 'Terlalu banyak kode salah',
  QUOTA: 'Kuota server habis',
};

function sendError(ws: WebSocket, code: ErrorCode): void {
  send(ws, { type: 'error', code, message: ERROR_TEXT[code] });
}
