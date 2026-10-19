import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES, parseClientMessage } from './protocol';

const hello = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: 'hello', name: 'Budi', character: 'kucing', ...extra });

describe('parseClientMessage', () => {
  it('menerima hello yang sah dan membuang spasi nama', () => {
    expect(parseClientMessage(hello({ name: ' Budi ' }))).toEqual({
      type: 'hello',
      name: 'Budi',
      character: 'kucing',
    });
  });

  it('menerima token UUID dan menolak token lain', () => {
    const token = crypto.randomUUID();
    expect(parseClientMessage(hello({ token }))).toMatchObject({ token });
    expect(parseClientMessage(hello({ token: 'bukan-uuid' }))).toBeNull();
  });

  it('menolak nama 13 karakter dan karakter yang tidak dikenal', () => {
    expect(parseClientMessage(hello({ name: 'a'.repeat(12) }))).not.toBeNull();
    expect(parseClientMessage(hello({ name: 'a'.repeat(13) }))).toBeNull();
    expect(parseClientMessage(hello({ character: 'naga' }))).toBeNull();
  });

  it('hanya menerima durasi 30, 60, 90, 120', () => {
    expect(parseClientMessage('{"type":"setDuration","sec":90}')).toEqual({
      type: 'setDuration',
      sec: 90,
    });
    expect(parseClientMessage('{"type":"setDuration","sec":45}')).toBeNull();
  });

  it('menolak JSON rusak dan tipe pesan yang tidak dikenal', () => {
    expect(parseClientMessage('{rusak')).toBeNull();
    expect(parseClientMessage('{"type":"start"}')).toBeNull();
  });

  it('batas ukuran: tepat 1024 byte diterima, 1025 ditolak', () => {
    const base = '{"type":"leave","x":""}';
    const pad = (n: number) => base.replace('""', `"${'a'.repeat(n - base.length)}"`);
    expect(new TextEncoder().encode(pad(MAX_MESSAGE_BYTES)).length).toBe(MAX_MESSAGE_BYTES);
    expect(parseClientMessage(pad(MAX_MESSAGE_BYTES))).toEqual({ type: 'leave' });
    expect(parseClientMessage(pad(MAX_MESSAGE_BYTES + 1))).toBeNull();
  });
});
