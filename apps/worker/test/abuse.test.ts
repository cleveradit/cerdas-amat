import { isBadName, cleanName, type ServerMessage } from '@cerdas-amat/shared';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { connect, createRoom, join, randomIp } from './helpers';

type Welcome = Extract<ServerMessage, { type: 'welcome' }>;
type RoomMsg = Extract<ServerMessage, { type: 'room' }>;

const postRoom = (ip: string) =>
  exports.default.fetch('https://example.com/api/rooms', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': ip },
  });

const upgrade = (headers: Record<string, string>) =>
  exports.default.fetch('https://example.com/ws/ABCDE', {
    headers: { Upgrade: 'websocket', ...headers },
  });

/** Env dengan Durable Object yang selalu melempar error, seperti saat kuota habis. */
const brokenEnv = {
  ...env,
  ROOM: {
    idFromName: () => ({}),
    get: () => ({
      init: () => Promise.reject(new Error('Exceeded allowed volume of requests')),
      fetch: () => Promise.reject(new Error('Exceeded allowed volume of requests')),
    }),
  },
} as unknown as Env;

// Penghitung rate limit Miniflare memakai jendela tetap 60 detik. Jika rangkaian request
// melewati batas jendela, penghitung mulai dari nol, jadi batas bisa baru tercapai hingga
// satu kuota penuh kemudian. Tes hanya memastikan batas tidak tercapai lebih awal.

describe('batas buat room', () => {
  it('20 room per IP diterima, lalu dibalas 429; IP lain tidak terpengaruh', async () => {
    const ip = randomIp();
    for (let i = 0; i < 20; i++) expect((await postRoom(ip)).status).toBe(200);
    let limited = await postRoom(ip);
    for (let i = 0; i < 20 && limited.status === 200; i++) limited = await postRoom(ip);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'RATE_LIMITED' });
    expect((await postRoom(randomIp())).status).toBe(200);
  });
});

describe('batas kode salah', () => {
  it('30 kode salah per IP dibalas 4404, lalu RATE_LIMITED dan close 4429', async () => {
    const ip = randomIp();
    for (let i = 0; i < 30; i++) {
      const sock = await connect('ZZZZZ', ip);
      expect(await sock.closed).toBe(4404);
    }
    let closed = 4404;
    for (let i = 0; i < 31 && closed === 4404; i++) {
      const sock = await connect('ZZZZZ', ip);
      const msg = await sock.next();
      closed = await sock.closed;
      if (closed === 4429) expect(msg).toMatchObject({ type: 'error', code: 'RATE_LIMITED' });
    }
    expect(closed).toBe(4429);
  });

  it('kode yang benar tidak dihitung', async () => {
    const code = await createRoom();
    const ip = randomIp();
    for (let i = 0; i < 31; i++) {
      const sock = await connect(code, ip);
      sock.ws.close(1000);
    }
    const sock = await connect('ZZZZZ', ip);
    expect(await sock.next()).toMatchObject({ type: 'error', code: 'ROOM_NOT_FOUND' });
  });
});

describe('cek Origin', () => {
  it('tanpa Origin dibalas 403', async () => {
    const res = await upgrade({});
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'FORBIDDEN_ORIGIN' });
  });

  it('Origin situs lain dibalas 403', async () => {
    expect((await upgrade({ Origin: 'https://evil.example' })).status).toBe(403);
    expect((await upgrade({ Origin: 'https://example.com.evil.example' })).status).toBe(403);
  });

  it('Origin dengan host yang sama di-upgrade', async () => {
    const res = await upgrade({ Origin: 'https://example.com', 'CF-Connecting-IP': randomIp() });
    expect(res.status).toBe(101);
    res.webSocket?.accept();
  });
});

describe('kuota habis', () => {
  it('POST /api/rooms dibalas 503 QUOTA', async () => {
    const req = new Request('https://example.com/api/rooms', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': randomIp() },
    });
    const res = await worker.fetch(req, brokenEnv);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'QUOTA' });
  });

  it('WebSocket di-upgrade lalu menerima error QUOTA dan close 4503', async () => {
    const req = new Request('https://example.com/ws/ABCDE', {
      headers: { Upgrade: 'websocket', Origin: 'https://example.com' },
    });
    const res = await worker.fetch(req, brokenEnv);
    expect(res.status).toBe(101);
    const ws = res.webSocket!;
    const message = new Promise<ServerMessage>((resolve) =>
      ws.addEventListener('message', (e) => resolve(JSON.parse(e.data as string))),
    );
    const closed = new Promise<number>((resolve) =>
      ws.addEventListener('close', (e) => resolve(e.code)),
    );
    ws.accept();
    expect(await message).toMatchObject({ type: 'error', code: 'QUOTA' });
    expect(await closed).toBe(4503);
  });
});

describe('filter nama di server', () => {
  it('nama kasar di hello diganti nama acak', async () => {
    const code = await createRoom();
    const { welcome } = await join(code, 'Anjing');
    const name = (welcome as Welcome).room.seats[0]!.name;
    expect(name).not.toBe('Anjing');
    expect(cleanName(name)).toBe(name);
    expect(isBadName(name)).toBe(false);
  });

  it('nama kasar di setProfile diganti nama acak', async () => {
    const code = await createRoom();
    const { sock } = await join(code, 'Budi');
    sock.send({ type: 'setProfile', name: 'B4ngs4t', character: 'panda' });
    const msg = (await sock.next()) as RoomMsg;
    expect(msg.type).toBe('room');
    expect(isBadName(msg.room.seats[0]!.name)).toBe(false);
    expect(msg.room.seats[0]!.character).toBe('panda');
  });
});
