# Implementation Plan: TICKET-009 (Durasi tanpa batas)

**Ticket:** `TICKET-009`  
**Status:** `DONE`  
**Target Audience:** AI Developer Agents  
**Depends On:** `None`

---

## 1. Business Decision Snapshot (Approved)

| Item | Approved Value |
|---|---|
| Pilihan durasi | `30`, `60`, `90`, `120` detik, ditambah **Tanpa batas** (urutan terakhir di daftar lobby) |
| Nilai protokol | `sec: 0` = tanpa batas (tetap angka, tetap `v.picklist(DURATIONS)`) |
| Default room baru | Tetap 60 detik |
| Cara berakhir mode tanpa batas | KO (selisih 5), WO, menyerah, batal (keduanya terputus), atau **batas diam** |
| Batas diam | 2 menit (`IDLE_LIMIT_MS = 120_000`) tanpa jawaban benar dari kedua pemain → pertandingan berakhir, pemenang dari selisih skor seperti waktu habis (positif host, negatif Player 2, nol seri) |
| Alasan hasil batas diam | Alasan baru `idle`, teks "Tidak ada jawaban 2 menit" |
| Timer di layar permainan | Menampilkan `∞`, tidak pernah berlatar merah |
| Jeda saat putus | Sama seperti mode berwaktu: sisa batas diam dibekukan selama jeda, lanjut saat pemain kembali |

---

## 2. Objective

Host bisa memilih durasi "Tanpa batas" di lobby, sehingga pertandingan hanya berakhir lewat KO atau keluar/putus. Agar room yang dibiarkan menyala tidak menghabiskan kuota Durable Object, pertandingan tanpa batas berakhir otomatis setelah 2 menit tanpa satu pun jawaban benar.

---

## 3. Non-Negotiable Technical Contract

1. File: `packages/shared/src/room.ts`
   - `DURATIONS = [30, 60, 90, 120, 0] as const`; tambah `export const UNLIMITED = 0;` dengan komentar.
   - `ResultReason` ditambah `'idle'`.
2. File: `packages/shared/src/result.ts`
   - Tambah `export const IDLE_LIMIT_MS = 120_000;`.
3. File: `apps/worker/src/room.ts`
   - Fungsi baru `deadlineFrom(state: RoomState, from: number): number` → `from + (state.durationSec === UNLIMITED ? IDLE_LIMIT_MS : state.durationSec * 1000)`.
   - Alarm `countdown → playing`: `state.endsAt = deadlineFrom(state, state.startsAt!)`.
   - Alarm `endsAt <= now`: `finish(state, state.durationSec === UNLIMITED ? 'idle' : 'time', timeWinner(state.score))`.
   - `onAnswer` (jawaban benar, belum KO): jika `UNLIMITED`, `state.endsAt = deadlineFrom(state, Date.now())`. Tidak ada pesan tambahan ke client (client tidak menampilkan sisa batas diam).
   - Jeda/lanjut (`remainingMs`/`endsAt`) tidak berubah; batas diam ikut dibekukan otomatis.
   - Alarm tetap satu: tenggat `endsAt` yang mundur dipasang ulang lewat `save()`/alarm berikutnya (alarm yang berbunyi lebih awal hanya memasang ulang).
4. File: `apps/client/src/i18n/id.ts`
   - `lobby.seconds(sec)` mengembalikan `'Tanpa batas'` untuk `0`.
   - `game.unlimited: '∞'`, `result.idle: 'Tidak ada jawaban 2 menit'`.
5. File: `apps/client/src/screens/Permainan.svelte`
   - Jika `room.durationSec === UNLIMITED`: timer menampilkan `id.game.unlimited`, kelas `low` tidak pernah aktif.
6. File: `apps/client/src/screens/Hasil.svelte`
   - Peta alasan ditambah `idle: id.result.idle`.
7. File: `apps/client/src/screens/Lobby.svelte`
   - Tidak ada perubahan logika; label diambil dari `id.lobby.seconds`.
8. Dokumen: PRD (`durationSec`, tabel `setDuration`, Akhir waktu, layar Lobby, `ResultReason`), GDD (Durasi, kondisi menang), `docs/features/gameplay.md` (durasi & alasan hasil).

---

## 4. Scope of Changes

### A. Shared

1. Tambah `0` ke `DURATIONS`, konstanta `UNLIMITED`, `IDLE_LIMIT_MS`, alasan `idle`.
2. Tes `protocol.test.ts`: `setDuration` `sec: 0` diterima.

### B. Worker

1. `deadlineFrom`, reset tenggat saat jawaban benar, alasan `idle`.
2. Tes `game.test.ts` (lihat matriks).

### C. Client

1. Label lobby, timer `∞`, teks hasil `idle`.

### D. Dokumen

1. PRD, GDD, feature doc.

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| Pilih tanpa batas | Host kirim `setDuration` `sec: 0` | Snapshot `durationSec: 0`; lobby menampilkan "Tanpa batas" | `[x]` |
| Validasi | `setDuration` `sec: 45` | Ditolak (tes lama tetap lolos) | `[x]` |
| KO tetap jalan | Mode tanpa batas, host benar 5× | Hasil `ko`, host menang | `[x]` |
| Batas diam direset | Jawaban benar di menit 1:50 | Tidak berakhir di 2:00; tenggat baru = waktu jawaban + 2 menit | `[x]` |
| Boundary: batas diam | 2 menit tanpa jawaban benar, skor 2:1 | Hasil `idle`, host menang; skor 1:1 → seri | `[x]` |
| Jeda | Pemain putus lalu kembali dalam 10 detik | Sisa batas diam dibekukan lalu dilanjutkan | `[x]` |
| Failure: non-host | Player 2 kirim `setDuration` `sec: 0` | `NOT_HOST`, durasi tidak berubah | `[x]` |
| Timer client | Mode tanpa batas sedang bermain | Kotak timer `∞`, tidak merah | `[x]` |

---

## 6. Verification Commands

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm e2e`

Expected:

1. Semua lolos tanpa error.

---

## 7. Out of Scope

1. Stopwatch / tampilan waktu berjalan.
2. Tombol "akhiri pertandingan" bersama.
3. Mengubah default durasi atau durasi lain.
4. Menampilkan sisa batas diam ke pemain.

---

## 8. Completion Checklist

- [x] Section 1 fully filled and status set correctly.
- [x] All Non-Negotiable Technical Contract items implemented.
- [x] Acceptance Test Matrix completed.
- [x] Verification commands executed successfully.
- [x] No out-of-scope changes introduced.
