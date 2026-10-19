import type { Character } from '@cerdas-amat/shared';

/** Semua teks antarmuka (Bahasa Indonesia). */
export const id = {
  title: 'Tarik Tambang Matematika',
  menu: {
    play: 'Play',
    character: 'Pilih Karakter',
  },
  play: {
    create: 'Buat Room',
    join: 'Join Room',
    codeLabel: 'Kode room',
    codePlaceholder: 'ABCDE',
    submitJoin: 'Masuk',
    close: 'Tutup',
    back: 'Kembali',
    connecting: 'Menghubungkan...',
  },
  character: {
    title: 'Pilih Karakter',
    nameLabel: 'Nama',
    random: 'Acak',
    back: '‹ Kembali',
    names: {
      kucing: 'Kucing',
      beruang: 'Beruang',
      rubah: 'Rubah',
      panda: 'Panda',
      katak: 'Katak',
    } satisfies Record<Character, string>,
  },
  lobby: {
    code: 'Kode room',
    host: 'Host',
    player2: 'Player 2',
    you: '(kamu)',
    waiting: 'Menunggu pemain...',
    disconnected: 'Terputus...',
    reconnecting: 'Menyambung ulang...',
    duration: 'Durasi',
    seconds: (sec: number) => `${sec} detik`,
    changeCharacter: 'Pilih Karakter',
    leave: 'Keluar',
  },
  errors: {
    invalidCode: 'Kode room harus 5 huruf/angka',
    ROOM_NOT_FOUND: 'Room tidak ditemukan',
    ROOM_FULL: 'Room sudah penuh',
    NOT_HOST: 'Hanya host yang boleh melakukan ini',
    INVALID_MESSAGE: 'Terjadi kesalahan, coba lagi',
    createFailed: 'Gagal membuat room, coba lagi',
  },
} as const;
