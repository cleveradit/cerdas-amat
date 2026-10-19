import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

const fetchWorker = (path: string) => exports.default.fetch(`https://example.com${path}`);

describe('Worker', () => {
  it('GET /api/health membalas ok', async () => {
    const res = await fetchWorker('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('path API tidak dikenal membalas 404', async () => {
    const res = await fetchWorker('/api/tidak-ada');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
  });

  it('path /ws/* belum tersedia membalas 404', async () => {
    const res = await fetchWorker('/ws/ABCDE');
    expect(res.status).toBe(404);
  });
});
