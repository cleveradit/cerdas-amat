import { generateRoomCode, normalizeRoomCode } from '@cerdas-amat/shared';

export { Room } from './room';

const MAX_CODE_ATTEMPTS = 5;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function createRoom(env: Env): Promise<Response> {
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const code = generateRoomCode();
    const stub = env.ROOM.get(env.ROOM.idFromName(code));
    if (await stub.init(code)) return json({ code });
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
      return createRoom(env);
    }

    const ws = pathname.match(/^\/ws\/([^/]+)$/);
    if (ws) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return json({ error: 'UPGRADE_REQUIRED' }, 426);
      }
      // Kode yang formatnya salah tidak mungkin ada; tolak tanpa membangunkan DO.
      const code = normalizeRoomCode(ws[1]!);
      if (!code) return json({ error: 'ROOM_NOT_FOUND' }, 404);
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
    }

    // Hanya /api/* dan /ws/* yang sampai ke sini (run_worker_first); sisanya dilayani aset statis.
    return json({ error: 'NOT_FOUND' }, 404);
  },
} satisfies ExportedHandler<Env>;
