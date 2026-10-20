# Implementation Plan: TICKET-005 (Keamanan, Kuota, dan Bagikan)

**Ticket:** `TICKET-005`  
**Status:** `DONE`  
**Target Audience:** AI Developer Agents  
**Depends On:** `TICKET-004` (DONE)

---

## 1. Business Decision Snapshot (Approved)

| Item | Approved Value |
|---|---|
| Lingkup | Bagian pertama Fase 5 PRD: filter kata kasar, batas penyalahgunaan (buat room dan kode salah), cek Origin WebSocket, pesan kuota habis, tombol Bagikan. Audio, modal Pengaturan, dan PWA ada di TICKET-006 (Fase 5 dipecah dua, dipilih user) |
| Daftar kata kasar | **Dikurasi sendiri di repo (dipilih user)**, tanpa daftar pihak ketiga. Bahasa Indonesia dan Inggris, disimpan sudah dalam bentuk ternormalisasi. Karena dicocokkan sebagai potongan kata, kata yang menimbulkan false positive pada kata/nama umum tidak dimasukkan (contoh: `tai` ada di "Pantai"/"Santai", `asu` ada di "Kasur", `ass` ada di "Kelas"/"Bass", `dick` ada di "Dickson", `rape` ada di "Grape") |
| Normalisasi filter | Sesuai PRD: huruf kecil, `4→a`, `1→i`, `0→o`, `3→e`, `5→s`, lalu semua karakter selain `a–z` dibuang (spasi, tanda baca, angka lain) |
| Nama tertolak | Server: nama di `hello`/`setProfile` yang tertolak diganti `randomName()` (server penentu). Client: di layar Pilih Karakter, nama tertolak langsung diganti nama acak dan tampil pesan singkat. Client menyamakan profil lokal dengan nama di snapshot server bila berbeda |
| Batas buat room | `CREATE_ROOM_LIMIT` (20 / 60 detik) dengan kunci IP `CF-Connecting-IP`. Terlewati: `429 { error: "RATE_LIMITED" }`; client menampilkan "Terlalu banyak room dibuat, coba lagi sebentar lagi" |
| Batas kode salah | `JOIN_LIMIT` (30 / 60 detik) dihitung **di Durable Object** saat room belum di-`init()` (hanya Durable Object yang tahu kode itu salah). IP diteruskan lewat header `CF-Connecting-IP` request yang sama. Terlewati: `error RATE_LIMITED` + close `4429` sebagai ganti `ROOM_NOT_FOUND`. Client mengunci input kode 60 detik dengan hitung mundur |
| Cek Origin | `/ws/:code` hanya diterima jika header `Origin` ada dan host-nya sama dengan host URL request; selain itu `403 { error: "FORBIDDEN_ORIGIN" }` tanpa membangunkan Durable Object. Aturan "host sama" mencakup produksi, preview, dan dev lokal lewat proxy Vite tanpa daftar origin tetap |
| Kuota habis | Sesuai PRD: setiap error dari panggilan Durable Object dianggap kuota habis. `POST /api/rooms` → `503 { error: "QUOTA" }`. `/ws/:code` → Worker sendiri menerima WebSocket, mengirim `error QUOTA`, lalu close `4503` (browser tidak bisa membaca status upgrade yang gagal). Error asli dicatat dengan `console.error` (Workers Logs) |
| Kuota request Worker habis | Worker tidak dijalankan sama sekali (halaman error Cloudflare). Client: respons `POST /api/rooms` yang bukan JSON dianggap kuota habis; WebSocket yang gagal terbuka pada percobaan pertama (sebelum `welcome`) memicu `GET /api/health` sekali, dan jika tidak `200` dianggap kuota habis |
| Tampilan kuota habis | Teks PRD "Server sedang penuh, coba lagi setelah pukul 07.00 WIB" tampil sebagai pemberitahuan di Menu Utama (dan di modal Play bila terbuka); room ditutup dan percobaan sambung ulang berhenti |
| Tombol Bagikan | Di lobby, di bawah kode room. Link `${location.origin}/?room=KODE`. `navigator.share` jika ada (pembatalan pengguna diabaikan); jika tidak, `navigator.clipboard.writeText` lalu teks "Link disalin"; jika clipboard juga gagal, link ditampilkan di input read-only agar bisa disalin manual |

Rules:

1. If any required `[FILL]` is missing, status MUST stay `DRAFT`.
2. Agent MUST NOT write production code while status is `DRAFT` or `REVIEW`.
3. Set status to `REVIEW` when the plan is ready for user review.
4. Set status to `READY` only after the user explicitly approves the plan in the chat.

---

## 2. Objective

Menutup celah penyalahgunaan sebelum rilis publik (nama kasar, spam room, tebak kode, koneksi dari situs lain) dan memastikan pemain melihat pesan yang jelas saat kuota plan gratis habis, bukan error teknis. Tombol Bagikan memudahkan host mengirim link room lewat WhatsApp. Aturan main dan gameplay tidak berubah.

---

## 3. Non-Negotiable Technical Contract

1. File: `packages/shared/src/badWords.ts`
   - ``export const BAD_WORDS: readonly string[]`` — kata kasar Indonesia dan Inggris, huruf kecil `a–z` saja (sudah ternormalisasi), masing-masing minimal 4 huruf.
2. File: `packages/shared/src/names.ts`
   - Method signature: ``export function normalizeForFilter(input: string): string``.
   - Method signature: ``export function isBadName(name: string): boolean`` — `true` jika `normalizeForFilter(name)` memuat salah satu `BAD_WORDS` sebagai potongan.
   - `randomName()` tidak berubah dan tidak pernah menghasilkan nama yang `isBadName`.
3. File: `packages/shared/src/protocol.ts`
   - `ErrorCode` ditambah `'RATE_LIMITED' | 'QUOTA'`.
   - ``export const CLOSE_RATE_LIMITED = 4429`` dan ``export const CLOSE_QUOTA = 4503``.
4. File: `apps/worker/src/index.ts`
   - `POST /api/rooms`: cek `env.CREATE_ROOM_LIMIT.limit({ key: ip })` sebelum membuat room; `ip = request.headers.get('CF-Connecting-IP') ?? 'local'`.
   - `GET /ws/:code`: cek Origin (sebelum cek format kode), lalu teruskan ke Durable Object.
   - Semua panggilan stub (`init`, `fetch`) dibungkus `try/catch` → `503 { error: "QUOTA" }` untuk HTTP, dan ``function quotaSocket(): Response`` (WebSocketPair milik Worker, kirim `error QUOTA`, close `4503`, balas 101) untuk `/ws`.
5. File: `apps/worker/src/room.ts`
   - Di `fetch()`, cabang `!this.state`: ``const { success } = await this.env.JOIN_LIMIT.limit({ key: ip })``; gagal → `sendError(server, 'RATE_LIMITED')` + close `4429`, berhasil → perilaku `ROOM_NOT_FOUND` yang sekarang. Tidak ada yang disimpan ke storage.
   - `onHello` dan `setProfile`: ``const name = isBadName(msg.name) ? randomName() : msg.name``.
6. File: `apps/client/src/net/roomClient.ts`
   - `FINAL_CLOSE_CODES` ditambah `CLOSE_RATE_LIMITED` dan `CLOSE_QUOTA`.
   - Callback baru ``onFirstOpenFailed: () => void`` dipanggil sekali bila socket tertutup sebelum pernah terbuka sejak `connect()`.
7. File: `apps/client/src/App.svelte`
   - State ``notice: string | null`` untuk pesan kuota; diteruskan ke `MenuUtama` dan `ModalPlay`.
   - `createRoom()`: `429` → teks batas buat room; `503` dengan `error: "QUOTA"` atau respons bukan JSON → kuota habis.
   - `onFirstOpenFailed` → `fetch('/api/health')`; tidak `200` → `client.close()` + kuota habis.
   - `error RATE_LIMITED` → ``joinLockedUntil = Date.now() + 60_000`` diteruskan ke `ModalPlay`.
   - `welcome`/`room`: jika nama kursi sendiri ≠ `profile.name`, profil lokal diperbarui dan disimpan.
8. File: `apps/client/src/screens/MenuUtama.svelte`
   - Prop baru ``notice: string | null`` ditampilkan sebagai `role="alert"` di atas tombol. (TICKET-006 memakai prop ini untuk pesan offline.)
9. File: `apps/client/src/screens/ModalPlay.svelte`
   - Prop baru ``joinLockedUntil: number``; selama terkunci, input kode dan tombol Masuk nonaktif dan tampil hitung mundur detik.
10. File: `apps/client/src/screens/PilihKarakter.svelte`
    - Nama yang `isBadName` diganti `randomName()` saat disimpan, dengan pesan singkat.
11. File: `apps/client/src/lib/storage.ts`
    - `loadProfile()`: nama tersimpan yang `isBadName` diganti nama acak.
12. File: `apps/client/src/screens/Lobby.svelte`, `apps/client/src/lib/share.ts`
    - ``export async function shareRoom(code: string): Promise<'shared' | 'copied' | 'manual'>``.
    - Tombol Bagikan di bawah kode room; hasil `copied` → "Link disalin"; `manual` → input read-only berisi link.
13. File: `apps/client/src/i18n/id.ts`
    - Teks baru: tombol Bagikan, "Link disalin", nama ditolak, `errors.RATE_LIMITED`, `errors.QUOTA` (teks PRD), batas buat room (teks PRD), hitung mundur kunci kode.
14. File: `docs/initiate-file/tarik-tambang-matematika-prd.md`
    - Close code aplikasi ditambah `4429` dan `4503`; aturan Origin ditulis sebagai "host Origin sama dengan host request"; kalimat lama dihapus.

Rules:

1. No "or relevant file/service" wording.
2. No scope expansion without explicit approval.

---

## 4. Scope of Changes

### A. Shared

1. `BAD_WORDS`, `normalizeForFilter`, `isBadName`, kode error dan close code baru.

### B. Worker dan Durable Object

1. Rate limit buat room, cek Origin, penanganan kuota di `index.ts`.
2. Rate limit kode salah dan filter nama di `room.ts`.

### C. Client

1. Pesan kuota, batas buat room, kunci input kode, filter nama, sinkron nama dari server, tombol Bagikan.

### D. Tes

1. Vitest shared: filter nama.
2. Vitest Worker/DO: rate limit, Origin, kuota, filter nama server.
3. Playwright: Bagikan (fallback clipboard), pesan kuota, filter nama.

### E. Docs

1. PRD (kontrak no. 14), `docs/data-model.md` (`ErrorCode`, close code), `docs/architecture.md` (status), feature doc baru `docs/features/keamanan.md` (filter, batas, Origin, kuota) terdaftar di `docs/features/index.md`, `docs/features/room-lobby.md` (Bagikan).

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| Normalisasi (unit) | `normalizeForFilter('B4.ng S4t!')` | `'bangsat'` | `[x]` |
| Kata kasar & samaran (unit) | `isBadName` untuk `anjing`, `Bangsat`, `4nj1ng`, `k.o.n.t.o.l`, `fuck`, `SHIT`, `xxbitchxx` | Semua `true` | `[x]` |
| False positive (unit, boundary) | `isBadName` untuk `Pantai`, `Santai`, `Kasur`, `Kelas`, `Bass`, `Dickson`, `Grape`, `Budi`, `Siti`, `Asep` | Semua `false` | `[x]` |
| Nama acak (unit) | `randomName()` 1000 kali | Tidak ada yang `isBadName` | `[x]` |
| Isi daftar (unit) | Setiap entri `BAD_WORDS` | Hanya `a–z`, panjang ≥ 4, tanpa duplikat | `[x]` |
| Nama kasar di server (DO, failure) | `hello` dengan nama `Anjing` | Nama di snapshot ≠ `Anjing`, lolos `cleanName`, `isBadName` = `false` | `[x]` |
| Batas buat room (DO, boundary) | 21× `POST /api/rooms` dengan `CF-Connecting-IP` yang sama | 20 pertama `200`, ke-21 `429 RATE_LIMITED`; IP lain tetap `200` | `[x]` |
| Batas kode salah (DO, boundary) | 31 koneksi ke kode yang belum dibuat, IP sama | 30 pertama close `4404`, ke-31 `error RATE_LIMITED` + close `4429` | `[x]` |
| Origin (Worker, failure) | `/ws/:code` tanpa `Origin`, dan dengan `Origin: https://evil.example` | `403 FORBIDDEN_ORIGIN` | `[x]` |
| Origin sah (Worker) | `Origin` dengan host sama dengan URL | `101` seperti sebelumnya | `[x]` |
| Kuota buat room (Worker, failure) | `env.ROOM` palsu yang stub-nya melempar error | `503 { error: "QUOTA" }` | `[x]` |
| Kuota WebSocket (Worker, failure) | Sama, ke `/ws/ABCDE` | `101`, `error QUOTA`, close `4503` | `[x]` |
| Pesan kuota (e2e) | `page.route('/api/rooms')` membalas `503 QUOTA`, klik Buat Room | Teks "Server sedang penuh, coba lagi setelah pukul 07.00 WIB" tampil | `[x]` |
| Bagikan (e2e) | Chromium tanpa `navigator.share`, izin clipboard, klik Bagikan di lobby | Clipboard berisi `<origin>/?room=KODE`, teks "Link disalin" tampil | `[x]` |
| Nama kasar di client (e2e) | Isi nama `Bangsat` di Pilih Karakter | Nama diganti nama acak, pesan penolakan tampil | `[x]` |
| Tes lama (e2e) | `pnpm e2e` | Semua tes TICKET-003/004 tetap lulus | `[x]` |

---

## 6. Verification Commands

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
5. `pnpm e2e`

Expected:

1. Semua lulus.
2. Setelah deploy produksi: `pnpm e2e` terhadap `https://cerdas-amat.radlabs.my.id` lulus semua, termasuk tes "semua request ke origin sendiri" (Web Analytics sudah dimatikan user).

---

## 7. Out of Scope

1. Audio, modal Pengaturan, PWA, pesan offline (TICKET-006).
2. Batas kiriman jawaban (keputusan produk no. 17: tidak dibatasi).
3. Membedakan jenis error Durable Object (semua dianggap kuota habis, sesuai PRD).
4. Daftar kata kasar dari sumber pihak ketiga, atau filter selain nama pemain.
5. Uji di HP nyata (Fase 6).

---

## 8. Completion Checklist

- [x] Section 1 fully filled and status set correctly.
- [x] All Non-Negotiable Technical Contract items implemented.
- [x] Acceptance Test Matrix completed.
- [x] Verification commands executed successfully.
- [x] No out-of-scope changes introduced.

---

## 9. Hasil Verifikasi

1. `pnpm lint`, `typecheck`, `test` (shared 28, client 10, worker 49 tes), dan `build` lulus. Bundle awal: JS 77,1 kB (gzip 28,7 kB), CSS 27,1 kB (gzip 8,1 kB).
2. `pnpm e2e`: 11 tes lulus (8 tes lama + 3 tes baru di `e2e/keamanan.spec.ts`). Cek Origin lolos lewat proxy Vite (host `localhost:5173` sama di `Origin` dan URL request).
3. Rate limit diuji dengan simulasi binding Rate Limiting di `@cloudflare/vitest-plugin` (Miniflare), termasuk "kode yang benar tidak dihitung".
4. Tes kuota memanggil handler Worker dengan `env.ROOM` palsu yang stub-nya melempar error (`brokenEnv` di `test/abuse.test.ts`).
5. Penyesuaian dari kontrak:
   - `test/helpers.ts`: `createRoom()` dan `connect()` mengirim `CF-Connecting-IP` acak dan `Origin`; `connect()` menerima IP opsional. Tanpa ini tes lama terkena batas 20 room per menit.
   - `BAD_WORDS` juga diekspor dari `packages/shared/src/index.ts`.
   - `MenuUtama` hanya menerima `notice` (kontrak no. 8); pesan kuota juga tampil di modal Play lewat `error` yang sudah ada.
