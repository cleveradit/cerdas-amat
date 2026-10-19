import { DurableObject } from 'cloudflare:workers';

/** Room satu per kode room. Logika lobby dan permainan masuk di Fase 2. */
export class Room extends DurableObject<Env> {}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === 'GET' && pathname === '/api/health') {
      return json({ ok: true });
    }

    // Hanya /api/* dan /ws/* yang sampai ke sini (run_worker_first); sisanya dilayani aset statis.
    return json({ error: 'NOT_FOUND' }, 404);
  },
} satisfies ExportedHandler<Env>;
