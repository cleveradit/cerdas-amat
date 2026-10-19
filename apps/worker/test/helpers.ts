import type { ServerMessage } from '@cerdas-amat/shared';
import { env, exports } from 'cloudflare:workers';

export interface TestSocket {
  ws: WebSocket;
  send(msg: unknown): void;
  /** Pesan berikutnya dari server (menunggu jika belum ada). */
  next(): Promise<ServerMessage>;
  /** Menunggu socket ditutup server; mengembalikan close code. */
  closed: Promise<number>;
}

export async function createRoom(): Promise<string> {
  const res = await exports.default.fetch('https://example.com/api/rooms', { method: 'POST' });
  const body = (await res.json()) as { code: string };
  return body.code;
}

export async function connect(code: string): Promise<TestSocket> {
  const res = await exports.default.fetch(`https://example.com/ws/${code}`, {
    headers: { Upgrade: 'websocket' },
  });
  const ws = res.webSocket;
  if (!ws) throw new Error(`upgrade gagal: ${res.status}`);
  ws.accept();

  const queue: ServerMessage[] = [];
  const waiters: ((m: ServerMessage) => void)[] = [];
  ws.addEventListener('message', (e) => {
    if (e.data === 'pong') return;
    const msg = JSON.parse(e.data as string) as ServerMessage;
    const waiter = waiters.shift();
    if (waiter) waiter(msg);
    else queue.push(msg);
  });
  const closed = new Promise<number>((resolve) => {
    ws.addEventListener('close', (e) => resolve(e.code));
  });

  return {
    ws,
    send: (msg) => ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)),
    next: () => {
      const msg = queue.shift();
      return msg ? Promise.resolve(msg) : new Promise((resolve) => waiters.push(resolve));
    },
    closed,
  };
}

export function hello(name: string, extra: Record<string, unknown> = {}) {
  return { type: 'hello', name, character: 'kucing', ...extra };
}

/** Masuk room dan kembalikan socket beserta pesan welcome-nya. */
export async function join(code: string, name: string, extra: Record<string, unknown> = {}) {
  const sock = await connect(code);
  sock.send(hello(name, extra));
  const welcome = await sock.next();
  return { sock, welcome };
}

export function roomStub(code: string) {
  return env.ROOM.get(env.ROOM.idFromName(code));
}

type Msg<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;

/** Baca pesan sampai menemukan tipe `type` (pesan lain dilewati). */
export async function until<T extends ServerMessage['type']>(
  sock: TestSocket,
  type: T,
): Promise<Msg<T>> {
  for (;;) {
    const msg = await sock.next();
    if (msg.type === type) return msg as Msg<T>;
  }
}
