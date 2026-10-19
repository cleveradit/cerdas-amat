# Implementation Plan: TICKET-002 (Server room dan lobby)

**Ticket:** `TICKET-002`  
**Status:** `DONE`  
**Target Audience:** AI Developer Agents  
**Depends On:** `TICKET-001` (DONE)

---

## 1. Business Decision Snapshot (Approved)

| Item | Approved Value |
|---|---|
| Lingkup | Fase 2 PRD: Durable Object `Room`, `POST /api/rooms`, protokol lobby, token kursi, pergantian host, kursi lobby ditahan 60 detik, penghapusan room kosong, tes Durable Object, dan UI lobby sederhana |
| Syarat lolos | Dua jendela browser (satu incognito) masuk lobby yang sama dan saling melihat nama serta karakter |
| Pesan client → server di tiket ini | `hello`, `setProfile`, `setDuration`, `leave` (fase `lobby` saja). `start`, `answer`, `backToRoom`, `sync` masuk TICKET-003 |
| Pesan server → client di tiket ini | `welcome`, `room`, `error` (`ROOM_NOT_FOUND`, `ROOM_FULL`, `NOT_HOST`, `INVALID_MESSAGE`) |
| Snapshot `room` | `{ code, phase, durationSec, seats: [SeatView \| null, SeatView \| null] }` dengan `SeatView = { name, character, connected, inLobby }`. Token dan deck tidak pernah ikut |
| Room tidak ditemukan | **Berbeda dari PRD:** `/ws/:code` dengan kode berformat valid selalu di-upgrade (101); jika room belum di-`init()`, DO mengirim `error ROOM_NOT_FOUND` lalu menutup socket dengan kode `4404`, tanpa menyimpan apa pun. Alasan: browser tidak bisa membaca status HTTP dari upgrade WebSocket yang gagal, sehingga 404 tidak bisa dibedakan dari gangguan jaringan. Kode berformat tidak valid tetap dibalas `404` oleh Worker tanpa menyentuh DO. PRD diperbarui sesuai ini |
| Persistensi lobby | **Tambahan dari PRD:** state disimpan ke storage setiap kali state lobby berubah (join, keluar, ganti profil, durasi), bukan hanya saat fase berubah. Alasan: dengan Hibernation API, DO dikeluarkan dari memori saat lobby diam, dan state yang hanya ada di memori hilang. Perubahan lobby jarang, jadi kuota tulis aman |
| Identitas koneksi | `serializeAttachment({ seat: SeatIndex \| null })`; saat host keluar dan Player 2 pindah ke kursi 0, attachment socket Player 2 ikut diperbarui |
| Heartbeat | `setWebSocketAutoResponse('ping' → 'pong')` dan client mengirim `ping` tiap 5 detik sudah dipasang. Cek "tanpa ping 12 detik" di alarm masuk TICKET-003 (hanya berlaku saat bermain); di lobby, putus koneksi dideteksi dari `webSocketClose`/`webSocketError` |
| Strategi tes alarm | Tes menulis tenggat yang sudah lewat lewat `runInDurableObject` (misalnya `disconnectedAt` 61 detik lalu), lalu memanggil `runDurableObjectAlarm`. Kode DO selalu membandingkan tenggat dengan `Date.now()`, tanpa jam yang disuntikkan |
| Kunci localStorage client | `cerdas-amat:profile` (nama, karakter) dan `cerdas-amat:token:<KODE>` (token kursi) |
| UI client | Fungsional tanpa gaya final dan tanpa 3D: Menu utama (Play, Pilih Karakter), Modal Play (Buat Room, Join Room + input kode), Pilih Karakter (input nama + 5 tombol teks), Lobby (kode, 2 slot, durasi untuk host, tombol Keluar). Link `?room=KODE` langsung membuka Join |
| Nama acak | `randomName()` di shared, memakai daftar nama dari preview karakter (`Kilat`, `Gesit`, ... + 2 digit) |
| Validasi nama | Di-trim, 1–12 karakter; filter kata kasar masuk Fase 5 |
| Ditunda ke Fase 5 | Rate limiting, cek Origin WebSocket, filter kata kasar, tombol Bagikan, error `QUOTA` |

Rules:

1. If any required `[FILL]` is missing, status MUST stay `DRAFT`.
2. Agent MUST NOT write production code while status is `DRAFT` or `REVIEW`.
3. Set status to `REVIEW` when the plan is ready for user review.
4. Set status to `READY` only after the user explicitly approves the plan in the chat.

---

## 2. Objective

Membuat room multiplayer yang benar-benar jalan: pemain bisa membuat room, membagikan kode, bergabung, melihat lawan di lobby, mengganti nama dan karakter, dan tetap memegang kursinya saat koneksi putus sebentar (misalnya pindah ke WhatsApp). Server menjadi satu-satunya penentu isi kursi dan host, sesuai aturan otoritas PRD. Ini fondasi untuk gameplay di TICKET-003.

---

## 3. Non-Negotiable Technical Contract

1. File: `packages/shared/src/roomCode.ts`
   - Method signature: ``export function generateRoomCode(random: () => number = Math.random): string`` — 5 karakter dari `ROOM_CODE_ALPHABET`.
   - Method signature: ``export function normalizeRoomCode(input: string): string | null`` — trim + huruf besar; `null` jika panjang bukan 5 atau ada karakter di luar alfabet.
2. File: `packages/shared/src/names.ts`
   - Ekspor: ``export const NAME_MAX = 12``, ``export function randomName(random: () => number = Math.random): string``, ``export function cleanName(input: string): string | null`` (trim; `null` jika kosong atau lebih dari 12 karakter).
3. File: `packages/shared/src/room.ts`
   - Ekspor tipe `Phase`, `SeatIndex`, `Character`, `Seat`, `RoomState` (persis seperti PRD "Model state room"), `SeatView`, `RoomSnapshot`; konstanta ``CHARACTERS = ['kucing', 'beruang', 'rubah', 'panda', 'katak'] as const`` dan ``DURATIONS = [30, 60, 90, 120] as const``.
4. File: `packages/shared/src/protocol.ts`
   - Skema Valibot `ClientMessageSchema` (union `hello` / `setProfile` / `setDuration` / `leave` dengan field `type`), tipe `ClientMessage` dan `ServerMessage`.
   - Method signature: ``export function parseClientMessage(raw: string): ClientMessage | null`` — `null` jika lebih dari 1024 byte, bukan JSON, atau tidak lolos skema.
   - Konstanta: ``MAX_MESSAGE_BYTES = 1024``, ``MAX_INVALID_MESSAGES = 5``, ``CLOSE_ROOM_NOT_FOUND = 4404``, ``CLOSE_ROOM_FULL = 4409``, ``CLOSE_INVALID = 4400``.
5. File: `apps/worker/src/index.ts`
   - `POST /api/rooms` → acak kode, panggil ``env.ROOM.get(env.ROOM.idFromName(code)).init(code)`` maks 5 kali; berhasil `200 { "code": string }`, gagal semua `503 { "error": "TRY_AGAIN" }`.
   - `GET /ws/:code` → bukan upgrade WebSocket: `426`; kode tidak valid (`normalizeRoomCode` null): `404 { "error": "ROOM_NOT_FOUND" }`; selain itu teruskan `request` ke stub DO.
   - `GET /api/health` tetap.
6. File: `apps/worker/src/room.ts` (class `Room` dipindah dari `index.ts`, tetap diekspor ulang dari `index.ts`)
   - RPC: ``async init(code: string): Promise<boolean>`` — `false` jika state sudah ada; `true` setelah menyimpan state awal (`phase: 'lobby'`, `durationSec: 60`, kursi kosong, `emptySince: now`) dan memasang alarm.
   - ``fetch(request: Request): Promise<Response>`` — `acceptWebSocket`, attachment `{ seat: null }`; jika state tidak ada: kirim `error ROOM_NOT_FOUND`, `close(4404)`.
   - ``webSocketMessage``, ``webSocketClose``, ``webSocketError``, ``alarm`` sesuai tabel "Keluar dan terputus di lobby" PRD.
   - Satu alarm: tenggat terdekat dari kursi terputus (`disconnectedAt + 60 s`) dan room kosong (`emptySince + 5 menit`); room kosong 5 menit → `ctx.storage.deleteAll()` dan `deleteAlarm()`.
7. File: `apps/client/src/net/roomClient.ts`
   - Class `RoomClient` dengan ``connect(code: string): void``, ``send(msg: ClientMessage): void``, ``close(): void``, dan callback `onMessage`/`onStatus`.
   - Reconnect: 0,5 s, 1 s, 2 s, lalu tiap 4 s; langsung mencoba saat `visibilitychange` ke `visible`; berhenti pada close code `4404`, `4409`, `4400`, atau setelah `leave`.
   - Kirim teks `ping` tiap 5 detik selama tersambung.
8. File: `apps/client/src/` — `App.svelte`, `screens/MenuUtama.svelte`, `screens/ModalPlay.svelte`, `screens/PilihKarakter.svelte`, `screens/Lobby.svelte`, `lib/storage.ts`, `i18n/id.ts`
   - Semua teks UI dari `id.ts` (Rule 4). Durasi dan kontrol host hanya tampil untuk kursi 0.
9. File: `docs/initiate-file/tarik-tambang-matematika-prd.md`
   - Change: tabel endpoint (`GET /ws/:code`), tabel pesan `error`, dan paragraf persistensi diperbarui sesuai dua keputusan "Berbeda dari PRD" / "Tambahan dari PRD" di atas; kalimat lama dihapus.

Rules:

1. No "or relevant file/service" wording.
2. No scope expansion without explicit approval.

---

## 4. Scope of Changes

### A. Shared

1. Kode room, nama, tipe room, skema dan parser pesan, beserta unit test.

### B. Worker

1. Routing `POST /api/rooms` dan `GET /ws/:code`.
2. Durable Object `Room`: init, hello (kursi baru atau klaim ulang lewat token), setProfile, setDuration, leave, close/error, alarm, penghapusan room.
3. Validasi pesan: tolak > 1 KB atau tidak valid dengan `error INVALID_MESSAGE`; tutup `4400` setelah 5 kali.
4. Tes DO dengan `@cloudflare/vitest-plugin`.

### C. Client

1. `RoomClient` dengan reconnect, ping, dan penyimpanan token.
2. Layar menu, modal play, pilih karakter, lobby.

### D. Docs

1. PRD diperbarui (kontrak no. 9); `docs/data-model.md` dan `docs/architecture.md` diverifikasi terhadap kode; feature doc `docs/features/room-lobby.md`.

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| Buat room | `POST /api/rooms` | `200 { code }`, kode 5 karakter dari alfabet | `[x]` |
| Host masuk | `/ws/:code` + `hello` tanpa token | `welcome` dengan `seat: 0`, token 128-bit, snapshot tanpa token | `[x]` |
| Player 2 masuk | Socket kedua + `hello` | `welcome seat: 1`; kedua socket menerima `room` berisi 2 kursi | `[x]` |
| Room penuh (failure) | Socket ketiga + `hello` tanpa token | `error ROOM_FULL`, close `4409`; kursi tidak berubah | `[x]` |
| Room tidak ada (failure) | `/ws/ABCDE` belum di-init | `error ROOM_NOT_FOUND`, close `4404`; storage DO tetap kosong | `[x]` |
| Kode tidak valid (failure) | `GET /ws/OOOOO` | `404`, DO tidak dipanggil | `[x]` |
| Bukan host ubah durasi (failure) | Kursi 1 kirim `setDuration` | `error NOT_HOST`; durasi tetap | `[x]` |
| Durasi tidak valid (failure) | `setDuration { sec: 45 }` | `error INVALID_MESSAGE` | `[x]` |
| Pesan terlalu besar (boundary) | Pesan 1025 byte | Ditolak; pesan 1024 byte yang valid diterima | `[x]` |
| 5 pesan tidak valid (boundary) | 4 lalu 5 pesan rusak | Setelah ke-4 masih terbuka; setelah ke-5 close `4400` | `[x]` |
| Nama (boundary) | Nama 12 lalu 13 karakter | 12 diterima; 13 `INVALID_MESSAGE` | `[x]` |
| Host keluar | Kursi 0 kirim `leave` | Player 2 pindah ke kursi 0 (host), kursi 1 kosong, kode sama, attachment socket diperbarui | `[x]` |
| Klaim ulang kursi | Socket baru + `hello` dengan token kursi 0 | Kembali ke kursi 0; socket lama ditutup | `[x]` |
| Kursi ditahan (boundary) | Host terputus; alarm di 59 s lalu 61 s | 59 s: kursi tetap `connected: false`; 61 s: diperlakukan seperti Keluar | `[x]` |
| Room kosong dihapus | Kedua kursi kosong; alarm setelah 5 menit | `deleteAll`; `/ws/:code` berikutnya `ROOM_NOT_FOUND` | `[x]` |
| Lolos fase (manual) | Dua jendela (satu incognito), Buat Room lalu Join lewat kode dan lewat link `?room=` | Kedua layar menampilkan nama dan karakter keduanya; ganti nama/karakter langsung terlihat di layar lawan | `[x]` |
| Pindah aplikasi (manual) | Host menutup tab lalu membuka lagi dalam 60 detik | Tetap host dengan kode sama | `[x]` |

---

## 6. Verification Commands

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
2. `pnpm dev`, lalu skenario manual di `http://localhost:5173` (jendela normal + incognito)
3. Setelah merge: skenario manual yang sama di `https://cerdas-amat.radlabs.my.id`

Expected:

1. Semua perintah exit 0 dan semua baris Acceptance Test Matrix tercentang.
2. Preview PR dan produksi menjalankan skenario manual tanpa error.

---

## 7. Out of Scope

1. Hitung mundur, deck, jawaban, timer, hasil, jeda, WO, `backToRoom`, `sync`, cek heartbeat 12 detik (TICKET-003).
2. Karakter 3D, arena, avatar gambar (Fase 4).
3. Rate limiting, cek Origin, filter kata kasar, tombol Bagikan, pesan kuota habis, audio, PWA (Fase 5).
4. Gaya visual final layar.

---

## 8. Completion Checklist

- [x] Section 1 fully filled and status set correctly.
- [x] All Non-Negotiable Technical Contract items implemented.
- [x] Acceptance Test Matrix completed.
- [x] Verification commands executed successfully.
- [x] No out-of-scope changes introduced.

---

## 9. Hasil Verifikasi

1. `pnpm lint`, `typecheck`, `test` (shared 17, worker 18 tes; worker dijalankan 3× tanpa flaky), dan `build` lulus.
2. Skenario manual dijalankan otomatis dengan Chrome headless (`playwright-core` di luar repo, 3 konteks browser terpisah) terhadap `pnpm dev`: buat room, join lewat kode, saling melihat nama/karakter, ganti profil dari lobby, tab host ditutup lalu dibuka lagi (tetap host), join lewat link `?room=`, room penuh, kode tidak dikenal, host keluar → Player 2 menjadi host. 13/13 lulus.
3. Perubahan kecil dari kontrak: pesan `room` membawa `seat` (kursi penerima), karena kursi Player 2 berubah saat host keluar tanpa `welcome` baru. PRD dan `protocol.ts` sudah memuatnya.
4. PR #3: CI hijau; skenario 13/13 lulus di preview.
5. Merge ke `main`: workflow Deploy sukses; skenario 13/13 lulus di `https://cerdas-amat.radlabs.my.id`.
