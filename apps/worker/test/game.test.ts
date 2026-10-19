import {
  DECK_BATCH,
  HEARTBEAT_TIMEOUT_MS,
  MAX_PAUSES,
  PAUSE_MS,
  RESULT_RETURN_MS,
  type Question,
  type RoomState,
} from '@cerdas-amat/shared';
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { Room } from '../src/room';
import { createRoom, join, roomStub, until, type TestSocket } from './helpers';

async function editState(code: string, edit: (state: RoomState) => void) {
  await runInDurableObject(roomStub(code), async (instance: Room, ctx) => {
    const state = instance['state']!;
    edit(state);
    await ctx.storage.put('state', state);
  });
}

const readState = (code: string) =>
  runInDurableObject(roomStub(code), (instance: Room) => instance['state']!);

interface Player {
  sock: TestSocket;
  token: string;
  deck: Question[];
  q: number;
}

/** Room berisi 2 pemain di fase `lobby`. */
async function lobby() {
  const code = await createRoom();
  const h = await join(code, 'Budi');
  const p = await join(code, 'Sari');
  await until(h.sock, 'room');
  const token = (w: typeof h.welcome) => (w.type === 'welcome' ? w.token : '');
  const host: Player = { sock: h.sock, token: token(h.welcome), deck: [], q: 0 };
  const p2: Player = { sock: p.sock, token: token(p.welcome), deck: [], q: 0 };
  return { code, host, p2 };
}

/** Host menekan Mulai; kembalikan pemain dengan deck masing-masing (fase `countdown`). */
async function countdown() {
  const room = await lobby();
  room.host.sock.send({ type: 'start' });
  for (const pl of [room.host, room.p2]) {
    await until(pl.sock, 'countdown');
    pl.deck = (await until(pl.sock, 'deck')).questions;
  }
  return room;
}

/** Lewati hitung mundur lewat alarm; fase `playing`. */
async function playing() {
  const room = await countdown();
  await editState(room.code, (s) => (s.startsAt = Date.now() - 1));
  await runDurableObjectAlarm(roomStub(room.code));
  return room;
}

function answer(pl: Player) {
  const [a, b] = pl.deck[pl.q]!;
  pl.sock.send({ type: 'answer', q: pl.q, value: a * b });
  pl.q++;
}

async function answerAndWait(pl: Player, watcher: TestSocket) {
  answer(pl);
  return until(watcher, 'tug');
}

describe('mulai', () => {
  it('bukan host tidak boleh Mulai', async () => {
    const { code, p2 } = await lobby();
    p2.sock.send({ type: 'start' });
    expect(await until(p2.sock, 'error')).toMatchObject({ code: 'NOT_HOST' });
    expect((await readState(code)).phase).toBe('lobby');
  });

  it('Mulai ditolak jika Player 2 belum ada', async () => {
    const code = await createRoom();
    const h = await join(code, 'Budi');
    h.sock.send({ type: 'start' });
    expect(await until(h.sock, 'error')).toMatchObject({ code: 'INVALID_MESSAGE' });
    expect((await readState(code)).phase).toBe('lobby');
  });

  it('hitung mundur 3 detik, deck 162 berbeda per pemain, lalu playing', async () => {
    const before = Date.now();
    const { code, host, p2 } = await countdown();
    const s = await readState(code);
    expect(s.phase).toBe('countdown');
    expect(s.startsAt! - before).toBeGreaterThanOrEqual(3000);
    expect(s.startsAt! - before).toBeLessThan(3500);
    expect(host.deck).toHaveLength(DECK_BATCH);
    expect(p2.deck).toHaveLength(DECK_BATCH);
    expect(host.deck).not.toEqual(p2.deck);

    await editState(code, (st) => (st.startsAt = Date.now() - 1));
    await runDurableObjectAlarm(roomStub(code));
    const after = await readState(code);
    expect(after.phase).toBe('playing');
    expect(after.endsAt).toBeGreaterThan(Date.now() + 55_000);
  });

  it('jawaban saat hitung mundur ditolak', async () => {
    const { code, host } = await countdown();
    answer(host);
    expect(await until(host.sock, 'reject')).toEqual({ type: 'reject', q: 0, expected: 0 });
    expect((await readState(code)).score).toEqual([0, 0]);
  });
});

describe('jawaban', () => {
  it('jawaban benar menaikkan skor dan dikirim ke kedua pemain', async () => {
    const { code, host, p2 } = await playing();
    answer(host);
    expect(await until(host.sock, 'tug')).toEqual({ type: 'tug', score: [1, 0], by: 0 });
    expect(await until(p2.sock, 'tug')).toEqual({ type: 'tug', score: [1, 0], by: 0 });
    const s = await readState(code);
    expect(s.qIndex).toEqual([1, 0]);
  });

  it('nomor soal lama atau nilai salah ditolak dengan expected', async () => {
    const { code, host } = await playing();
    await answerAndWait(host, host.sock);
    const [a, b] = host.deck[0]!;
    host.sock.send({ type: 'answer', q: 0, value: a * b });
    expect(await until(host.sock, 'reject')).toEqual({ type: 'reject', q: 0, expected: 1 });
    host.sock.send({ type: 'answer', q: 1, value: 0 });
    expect(await until(host.sock, 'reject')).toEqual({ type: 'reject', q: 1, expected: 1 });
    expect((await readState(code)).score).toEqual([1, 0]);
  });

  it('selisih 4 belum KO, selisih 5 KO', async () => {
    const { code, host, p2 } = await playing();
    for (let i = 0; i < 4; i++) await answerAndWait(host, p2.sock);
    expect((await readState(code)).phase).toBe('playing');
    await answerAndWait(host, p2.sock);
    expect(await until(p2.sock, 'result')).toEqual({
      type: 'result',
      winner: 0,
      reason: 'ko',
      score: [5, 0],
    });
  });

  it('jawaban yang tiba setelah KO ditolak, hasil tetap KO host', async () => {
    const { code, host, p2 } = await playing();
    for (let i = 0; i < 4; i++) await answerAndWait(host, p2.sock);
    answer(host);
    answer(p2);
    expect(await until(p2.sock, 'reject')).toMatchObject({ q: 0 });
    const s = await readState(code);
    expect(s.result).toEqual({ winner: 0, reason: 'ko' });
    expect(s.score).toEqual([5, 0]);
  });

  it('deck ditambah 81 soal saat soal ke-150 tercapai', async () => {
    const { code, host } = await playing();
    await editState(code, (s) => {
      s.qIndex[0] = 149;
    });
    host.q = 149;
    answer(host);
    const more = await until(host.sock, 'deck');
    expect(more.from).toBe(DECK_BATCH);
    expect(more.questions).toHaveLength(81);
    expect((await readState(code)).decks[0]).toHaveLength(DECK_BATCH + 81);
  });
});

describe('akhir waktu', () => {
  it('waktu habis: unggul menang, sama = seri', async () => {
    const a = await playing();
    await editState(a.code, (s) => {
      s.score = [3, 1];
      s.endsAt = Date.now() - 1;
    });
    await runDurableObjectAlarm(roomStub(a.code));
    expect(await until(a.p2.sock, 'result')).toMatchObject({ winner: 0, reason: 'time' });

    const b = await playing();
    await editState(b.code, (s) => {
      s.score = [2, 2];
      s.endsAt = Date.now() - 1;
    });
    await runDurableObjectAlarm(roomStub(b.code));
    expect(await until(b.host.sock, 'result')).toMatchObject({ winner: null, reason: 'time' });
  });
});

describe('putus koneksi', () => {
  it('jeda lalu lanjut dengan sisa waktu yang sama', async () => {
    const { code, host, p2 } = await playing();
    const endsAt = (await readState(code)).endsAt!;
    p2.sock.ws.close(1000);
    const pause = await until(host.sock, 'pause');
    expect(pause.seat).toBe(1);
    expect(pause.remainingMs).toBeGreaterThan(endsAt - Date.now() - 1000);

    const back = await join(code, 'Sari', { token: p2.token });
    expect(back.welcome).toMatchObject({ type: 'welcome', seat: 1 });
    const resume = await until(host.sock, 'resume');
    expect(Math.abs(resume.endsAt - (Date.now() + pause.remainingMs))).toBeLessThan(500);
    expect((await readState(code)).phase).toBe('playing');
  });

  it('pemain yang kembali di tengah permainan mendapat deck dari soalnya', async () => {
    const { code, host, p2 } = await playing();
    await answerAndWait(p2, host.sock);
    p2.sock.ws.close(1000);
    await until(host.sock, 'pause');
    const back = await join(code, 'Sari', { token: p2.token });
    const deck = await until(back.sock, 'deck');
    expect(deck.from).toBe(1);
    expect(deck.questions[0]).toEqual(p2.deck[1]);
  });

  it('tidak kembali dalam 10 detik: lawan menang WO', async () => {
    const { code, host, p2 } = await playing();
    p2.sock.ws.close(1000);
    await until(host.sock, 'pause');
    await editState(code, (s) => (s.pause!.until = Date.now() - 1));
    await runDurableObjectAlarm(roomStub(code));
    expect(await until(host.sock, 'result')).toMatchObject({ winner: 0, reason: 'wo' });
  });

  it('putus ke-3 masih jeda, ke-4 langsung WO', async () => {
    const { code, host, p2 } = await playing();
    await editState(code, (s) => (s.seats[1]!.pausesUsed = MAX_PAUSES - 1));
    p2.sock.ws.close(1000);
    await until(host.sock, 'pause');
    const back = await join(code, 'Sari', { token: p2.token });
    await until(host.sock, 'resume');
    expect((await readState(code)).seats[1]!.pausesUsed).toBe(MAX_PAUSES);

    back.sock.ws.close(1000);
    expect(await until(host.sock, 'result')).toMatchObject({ winner: 0, reason: 'wo' });
  });

  it('keduanya putus melewati jeda: batal', async () => {
    const { code, host, p2 } = await playing();
    p2.sock.ws.close(1000);
    await until(host.sock, 'pause');
    host.sock.ws.close(1000);
    await runInDurableObject(roomStub(code), () => {}); // tunggu close diproses
    await editState(code, (s) => (s.pause!.until = Date.now() - 1));
    await runDurableObjectAlarm(roomStub(code));
    expect((await readState(code)).result).toEqual({ winner: null, reason: 'void' });
  });

  it('pemilik jeda kembali saat lawan putus: jeda pindah ke lawan', async () => {
    const { code, host, p2 } = await playing();
    p2.sock.ws.close(1000);
    await until(host.sock, 'pause');
    host.sock.ws.close(1000);
    await runInDurableObject(roomStub(code), () => {});
    const back = await join(code, 'Sari', { token: p2.token });
    expect(back.welcome.type === 'welcome' && back.welcome.room.pause?.seat).toBe(0);
    const s = await readState(code);
    expect(s.seats[0]!.pausesUsed).toBe(1);
    expect(s.phase).toBe('paused');
  });

  it('Keluar saat bermain = menyerah', async () => {
    const { host, p2 } = await playing();
    p2.sock.send({ type: 'leave' });
    expect(await until(host.sock, 'result')).toMatchObject({ winner: 0, reason: 'surrender' });
  });

  it('putus saat hitung mundur: kembali ke lobby tanpa memakai jeda', async () => {
    const { code, host, p2 } = await countdown();
    p2.sock.ws.close(1000);
    await until(host.sock, 'room');
    const s = await readState(code);
    expect(s.phase).toBe('lobby');
    expect(s.seats[1]!.pausesUsed).toBe(0);
  });

  it('tanpa ping lebih dari 12 detik: socket ditutup 4000 dan pemain dijeda', async () => {
    const { code, host, p2 } = await playing();
    await runInDurableObject(roomStub(code), (_i, ctx) => {
      for (const ws of ctx.getWebSockets()) {
        const att = ws.deserializeAttachment() as { seat: number | null; since: number };
        if (att.seat === 1) {
          ws.serializeAttachment({ ...att, since: Date.now() - HEARTBEAT_TIMEOUT_MS - 1000 });
        }
      }
    });
    // Socket host memakai `since` saat tersambung, jadi tidak ikut kedaluwarsa.
    await runDurableObjectAlarm(roomStub(code));
    expect(await p2.sock.closed).toBe(4000);
    expect(await until(host.sock, 'pause')).toMatchObject({ seat: 1 });
    expect(PAUSE_MS).toBe(10_000);
  });
});

describe('kembali ke room', () => {
  it('penekan pertama ke lobby; lawan dikeluarkan setelah 30 detik; Mulai menunggu', async () => {
    const r = await lobby();
    await editState(r.code, (s) => {
      s.phase = 'result';
      s.result = { winner: 0, reason: 'ko' };
      s.resultAt = Date.now();
      s.seats[0]!.inLobby = false;
      s.seats[1]!.inLobby = false;
    });
    r.host.sock.send({ type: 'backToRoom' });
    const seen = await until(r.p2.sock, 'room');
    expect(seen.room.phase).toBe('lobby');
    expect(seen.room.seats[1]!.inLobby).toBe(false);

    r.host.sock.send({ type: 'start' });
    expect(await until(r.host.sock, 'error')).toMatchObject({ code: 'INVALID_MESSAGE' });

    await editState(r.code, (s) => (s.resultAt = Date.now() - RESULT_RETURN_MS - 1));
    await runDurableObjectAlarm(roomStub(r.code));
    const s = await readState(r.code);
    expect(s.seats[0]!.name).toBe('Budi');
    expect(s.seats[1]).toBeNull();
  });

  it('keduanya kembali: host bisa Mulai lagi', async () => {
    const { code, host, p2 } = await playing();
    for (let i = 0; i < 5; i++) await answerAndWait(host, p2.sock);
    await until(p2.sock, 'result');
    host.sock.send({ type: 'backToRoom' });
    p2.sock.send({ type: 'backToRoom' });
    await runInDurableObject(roomStub(code), () => {});
    expect((await readState(code)).seats.every((s) => s!.inLobby)).toBe(true);
    host.sock.send({ type: 'start' });
    expect(await until(p2.sock, 'countdown')).toMatchObject({ type: 'countdown' });
  });
});
