import {
  CLOSE_QUOTA,
  generateRoomCode,
  normalizeRoomCode,
  type ServerMessage,
} from '@cerdas-amat/shared';

export { Room } from './room';

const MAX_CODE_ATTEMPTS = 5;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

/** Kunci rate limit; `CF-Connecting-IP` tidak ada saat dev lokal dan tes. */
function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'local';
}

/** WebSocket hanya dari halaman game sendiri: host Origin harus sama dengan host request. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * Error dari Durable Object dianggap kuota plan gratis habis (PRD). Untuk WebSocket,
 * Worker menerima socket sendiri lalu mengirim `QUOTA`, karena browser tidak bisa
 * membaca status HTTP dari upgrade yang gagal.
 */
function quotaSocket(): Response {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  const msg: ServerMessage = { type: 'error', code: 'QUOTA', message: 'Kuota server habis' };
  server.send(JSON.stringify(msg));
  server.close(CLOSE_QUOTA, 'QUOTA');
  return new Response(null, { status: 101, webSocket: client });
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const { success } = await env.CREATE_ROOM_LIMIT.limit({ key: clientIp(request) });
  if (!success) return json({ error: 'RATE_LIMITED' }, 429);
  try {
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      const code = generateRoomCode();
      const stub = env.ROOM.get(env.ROOM.idFromName(code));
      if (await stub.init(code)) return json({ code });
    }
  } catch (err) {
    console.error('Durable Object gagal saat membuat room', err);
    return json({ error: 'QUOTA' }, 503);
  }
  return json({ error: 'TRY_AGAIN' }, 503);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === 'GET' && pathname === '/api/health') {
      return json({ ok: true });
    }
    if (request.method === 'POST' && pathname === '/api/rooms') {
      return createRoom(request, env);
    }

    const ws = pathname.match(/^\/ws\/([^/]+)$/);
    if (ws) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return json({ error: 'UPGRADE_REQUIRED' }, 426);
      }
      if (!sameOrigin(request)) return json({ error: 'FORBIDDEN_ORIGIN' }, 403);
      // Kode yang formatnya salah tidak mungkin ada; tolak tanpa membangunkan DO.
      const code = normalizeRoomCode(ws[1]!);
      if (!code) return json({ error: 'ROOM_NOT_FOUND' }, 404);
      try {
        return await env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
      } catch (err) {
        console.error('Durable Object gagal saat membuka WebSocket', err);
        return quotaSocket();
      }
    }

    // Hanya /api/* dan /ws/* yang sampai ke sini (run_worker_first); sisanya dilayani aset statis.
    return json({ error: 'NOT_FOUND' }, 404);
  },
} satisfies ExportedHandler<Env>;
