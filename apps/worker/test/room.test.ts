import type { RoomState, ServerMessage } from '@cerdas-amat/shared';
import { exports } from 'cloudflare:workers';
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { EMPTY_ROOM_TTL_MS, LOBBY_SEAT_HOLD_MS, type Room } from '../src/room';
import { connect, createRoom, hello, join, roomStub } from './helpers';

type Welcome = Extract<ServerMessage, { type: 'welcome' }>;
type RoomMsg = Extract<ServerMessage, { type: 'room' }>;
type ErrorMsg = Extract<ServerMessage, { type: 'error' }>;

/** Ubah state DO langsung (misalnya memundurkan waktu tenggat), lalu simpan. */
async function editState(code: string, edit: (state: RoomState) => void) {
  await runInDurableObject(roomStub(code), async (instance: Room, ctx) => {
    const state = instance['state']!;
    edit(state);
    await ctx.storage.put('state', state);
  });
}

async function readState(code: string) {
  return runInDurableObject(roomStub(code), (instance: Room) => instance['state']);
}

describe('POST /api/rooms', () => {
  it('membuat room dengan kode sah', async () => {
    const res = await exports.default.fetch('https://example.com/api/rooms', { method: 'POST' });
    expect(res.status).toBe(200);
    const { code } = (await res.json()) as { code: string };
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/);
  });
});

describe('GET /ws/:code', () => {
  it('kode berformat salah dibalas 404 tanpa upgrade', async () => {
    const res = await exports.default.fetch('https://example.com/ws/OOOOO', {
      headers: { Upgrade: 'websocket', Origin: 'https://example.com' },
    });
    expect(res.status).toBe(404);
  });

  it('tanpa header Upgrade dibalas 426', async () => {
    const res = await exports.default.fetch('https://example.com/ws/ABCDE');
    expect(res.status).toBe(426);
  });

  it('room yang belum di-init: ROOM_NOT_FOUND, close 4404, storage tetap kosong', async () => {
    const sock = await connect('ZZZZZ');
    expect(await sock.next()).toMatchObject({ type: 'error', code: 'ROOM_NOT_FOUND' });
    expect(await sock.closed).toBe(4404);
    const keys = await runInDurableObject(roomStub('ZZZZZ'), (_i, ctx) => ctx.storage.list());
    expect(keys.size).toBe(0);
  });
});

describe('lobby', () => {
  it('host dan Player 2 masuk dan saling melihat', async () => {
    const code = await createRoom();
    const host = await join(code, 'Budi');
    const welcome = host.welcome as Welcome;
    expect(welcome).toMatchObject({ type: 'welcome', seat: 0 });
    expect(welcome.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(welcome.room)).not.toContain(welcome.token);

    const p2 = await join(code, 'Sari', { character: 'panda' });
    expect(p2.welcome).toMatchObject({ type: 'welcome', seat: 1 });

    const seen = (await host.sock.next()) as RoomMsg;
    expect(seen.room.seats).toEqual([
      { name: 'Budi', character: 'kucing', connected: true, inLobby: true },
      { name: 'Sari', character: 'panda', connected: true, inLobby: true },
    ]);
  });

  it('pemain ketiga mendapat ROOM_FULL dan close 4409', async () => {
    const code = await createRoom();
    await join(code, 'Budi');
    await join(code, 'Sari');
    const third = await connect(code);
    third.send(hello('Joko'));
    expect(await third.next()).toMatchObject({ type: 'error', code: 'ROOM_FULL' });
    expect(await third.closed).toBe(4409);
    expect((await readState(code))!.seats[1]!.name).toBe('Sari');
  });

  it('setProfile terlihat oleh lawan', async () => {
    const code = await createRoom();
    const host = await join(code, 'Budi');
    const p2 = await join(code, 'Sari');
    await host.sock.next(); // room setelah p2 masuk
    p2.sock.send({ type: 'setProfile', name: 'Sari Baru', character: 'katak' });
    const seen = (await host.sock.next()) as RoomMsg;
    expect(seen.room.seats[1]).toMatchObject({ name: 'Sari Baru', character: 'katak' });
  });

  it('hanya host yang boleh mengubah durasi', async () => {
    const code = await createRoom();
    const host = await join(code, 'Budi');
    const p2 = await join(code, 'Sari');
    await host.sock.next();

    p2.sock.send({ type: 'setDuration', sec: 90 });
    expect((await p2.sock.next()) as ErrorMsg).toMatchObject({ code: 'NOT_HOST' });
    expect((await readState(code))!.durationSec).toBe(60);

    host.sock.send({ type: 'setDuration', sec: 90 });
    expect(((await p2.sock.next()) as RoomMsg).room.durationSec).toBe(90);

    p2.sock.send({ type: 'setDuration', sec: 0 });
    expect((await p2.sock.next()) as ErrorMsg).toMatchObject({ code: 'NOT_HOST' });
    host.sock.send({ type: 'setDuration', sec: 0 });
    expect(((await p2.sock.next()) as RoomMsg).room.durationSec).toBe(0);
  });

  it('durasi di luar pilihan ditolak sebagai INVALID_MESSAGE', async () => {
    const code = await createRoom();
    const host = await join(code, 'Budi');
    host.sock.send({ type: 'setDuration', sec: 45 });
    expect(await host.sock.next()).toMatchObject({ code: 'INVALID_MESSAGE' });
  });

  it('nama 12 karakter diterima, 13 ditolak', async () => {
    const code = await createRoom();
    const ok = await join(code, 'a'.repeat(12));
    expect(ok.welcome.type).toBe('welcome');
    const bad = await connect(code);
    bad.send(hello('a'.repeat(13)));
    expect(await bad.next()).toMatchObject({ code: 'INVALID_MESSAGE' });
  });

  it('socket ditutup 4400 tepat setelah pesan tidak valid ke-5', async () => {
    const code = await createRoom();
    const sock = await connect(code);
    let closedCode: number | null = null;
    void sock.closed.then((c) => (closedCode = c));
    for (let i = 0; i < 4; i++) {
      sock.send('{rusak');
      await sock.next();
    }
    expect(closedCode).toBeNull();
    sock.send('{rusak');
    await sock.next();
    expect(await sock.closed).toBe(4400);
  });

  it('pesan 1025 byte ditolak', async () => {
    const code = await createRoom();
    const host = await join(code, 'Budi');
    host.sock.send(JSON.stringify({ type: 'leave', x: 'a'.repeat(1010) }));
    expect(await host.sock.next()).toMatchObject({ code: 'INVALID_MESSAGE' });
  });
});

describe('keluar dan terputus', () => {
  it('host keluar: Player 2 menjadi host di kursi 0 dan bisa mengubah durasi', async () => {
    const code = await createRoom();
    const host = await join(code, 'Budi');
    const p2 = await join(code, 'Sari');
    await host.sock.next();

    host.sock.send({ type: 'leave' });
    const seen = (await p2.sock.next()) as RoomMsg;
    expect(seen.room.code).toBe(code);
    expect(seen.room.seats[0]).toMatchObject({ name: 'Sari' });
    expect(seen.room.seats[1]).toBeNull();
    expect(seen.seat).toBe(0);

    // Attachment socket ikut pindah ke kursi 0.
    p2.sock.send({ type: 'setDuration', sec: 30 });
    expect(((await p2.sock.next()) as RoomMsg).room.durationSec).toBe(30);
  });

  it('token mengklaim ulang kursi dan menutup socket lama', async () => {
    const code = await createRoom();
    const first = await join(code, 'Budi');
    const token = (first.welcome as Welcome).token;

    const again = await join(code, 'Budi', { token });
    expect(again.welcome).toMatchObject({ type: 'welcome', seat: 0, token });
    expect(await first.sock.closed).toBe(1000);
    expect((await readState(code))!.seats[1]).toBeNull();
  });

  it('kursi terputus ditahan sampai 60 detik, lalu dianggap keluar', async () => {
    const code = await createRoom();
    const host = await join(code, 'Budi');
    const p2 = await join(code, 'Sari');
    await host.sock.next();

    host.sock.ws.close(1000, 'pergi');
    const seen = (await p2.sock.next()) as RoomMsg;
    expect(seen.room.seats[0]).toMatchObject({ name: 'Budi', connected: false });

    await editState(code, (s) => (s.seats[0]!.disconnectedAt = Date.now() - 59_000));
    await runDurableObjectAlarm(roomStub(code));
    expect((await readState(code))!.seats[0]!.name).toBe('Budi');

    await editState(
      code,
      (s) => (s.seats[0]!.disconnectedAt = Date.now() - LOBBY_SEAT_HOLD_MS - 1_000),
    );
    await runDurableObjectAlarm(roomStub(code));
    const state = (await readState(code))!;
    expect(state.seats[0]!.name).toBe('Sari');
    expect(state.seats[1]).toBeNull();
  });

  it('room kosong 5 menit dihapus dan kodenya tidak ditemukan lagi', async () => {
    const code = await createRoom();
    const host = await join(code, 'Budi');
    host.sock.send({ type: 'leave' });
    expect(await host.sock.closed).toBe(1000);

    await editState(code, (s) => (s.emptySince = Date.now() - EMPTY_ROOM_TTL_MS - 1_000));
    await runDurableObjectAlarm(roomStub(code));
    expect(await readState(code)).toBeNull();

    const sock = await connect(code);
    expect(await sock.next()).toMatchObject({ code: 'ROOM_NOT_FOUND' });
  });
});
