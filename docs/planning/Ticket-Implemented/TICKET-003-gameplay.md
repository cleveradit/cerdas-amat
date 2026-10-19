# Implementation Plan: TICKET-003 (Gameplay tanpa 3D)

**Ticket:** `TICKET-003`  
**Status:** `DONE`  
**Target Audience:** AI Developer Agents  
**Depends On:** `TICKET-002` (DONE)

---

## 1. Business Decision Snapshot (Approved)

| Item | Approved Value |
|---|---|
| Lingkup | Fase 3 PRD: Mulai, hitung mundur 3 detik, deck, keypad, timer, KO, akhir waktu, hasil, jeda karena putus koneksi, WO, batal, kembali ke room, sinkron jam, cek heartbeat. Tali digambar sebagai garis 2D sementara |
| Syarat lolos | Tes Playwright di repo memainkan pertandingan penuh sampai KO dan sampai waktu habis, dan jalan di CI |
| Pesan client baru | `start`, `answer { q, value }`, `backToRoom`, `sync { t }`; `leave` saat `countdown`/`playing`/`paused` = menyerah |
| Pesan server baru | `countdown { startsAt }`, `deck { from, questions }`, `tug { score, by }`, `reject { q, expected }`, `pause { seat, until, remainingMs }`, `resume { endsAt }`, `result { winner, reason, score }`, `sync { t, serverNow }` |
| Snapshot `room` diperluas | **Tambahan dari PRD:** snapshot juga membawa `score`, `qIndex`, `startsAt?`, `endsAt?`, `remainingMs?`, `pause?`, `result?` (semuanya tidak rahasia). Alasan: pemain yang tersambung ulang di tengah permainan harus bisa menggambar ulang layar dari `welcome` saja. Setelah `welcome`, server mengirim `deck` mulai dari `qIndex` pemain itu |
| `reject` | **Tambahan dari PRD:** membawa `expected` (nomor soal yang benar menurut server). Client yang terlanjur maju secara optimis kembali ke soal `expected` |
| Deck | `makeDeck(prev)` di shared sesuai aturan PRD. Saat hitung mundur tiap pemain dikirim 162 soal (dua deck); saat `qIndex` pemain mencapai 150, server menambah 81 soal dan mengirim `deck` lanjutan |
| Tulis storage saat bermain | Ditulis saat fase berubah, saat jawaban benar jika tulisan terakhir sudah ≥ 1 detik lalu, dan di setiap alarm heartbeat (tiap 5 detik). Kehilangan skor terburuk saat DO dikeluarkan dari memori ≤ 5 detik, dan DO hanya dikeluarkan saat tidak ada pesan masuk |
| Heartbeat | Alarm tiap 5 detik selama `countdown`/`playing`/`paused`; socket yang `getWebSocketAutoResponseTimestamp`-nya lebih dari 12 detik lalu ditutup dengan close `4000` (bukan final, client tersambung ulang) dan diproses sebagai terputus |
| Putus saat hitung mundur | Permainan dibatalkan, fase kembali ke `lobby`, jeda tidak terpakai |
| Jeda berantai | **Memperjelas PRD:** saat pemain A dijeda dan B ikut terputus, jeda tetap milik A. Di tenggat A: A masih putus dan B tersambung → B menang WO; keduanya putus → `void`. Jika A kembali sementara B masih putus → jeda baru untuk B (memakai jatah jeda B; jika jatah B habis, A menang WO) |
| Jatah jeda | Maks 3 per pemain per pertandingan; terputus keempat kali → lawan langsung menang WO |
| Layar hasil | Teks "Kamu Menang"/"Kamu Kalah"/"Seri", keterangan "KO"/"Waktu habis"/"Menang WO"/"Lawan menyerah", skor kedua pemain. **Tambahan dari GDD:** hasil `void` ditampilkan "Dibatalkan" dengan keterangan "Kedua pemain terputus". Pose karakter masuk Fase 4 |
| Kembali ke room | Penekan pertama memindahkan fase ke `lobby`; pemain lain tampil "Melihat hasil..."; tidak menekan dalam 30 detik sejak hasil → dikeluarkan (host keluar → pemain di lobby jadi host). `start` aktif hanya jika kedua kursi terisi, tersambung, dan `inLobby` |
| Keluar di layar hasil | Sama dengan Keluar di lobby |
| Sinkron jam | Client mengirim `sync` saat tersambung dan tiap 30 detik; offset = `serverNow − (t + rtt/2)`, dipakai untuk menghitung sisa waktu dari `endsAt` |
| Keyboard fisik | Angka, Backspace = Hapus, Escape = AC, Enter = kirim (sama dengan preview). Jawaban maks 2 digit |
| Playwright | `@playwright/test ^1.64.1` di root, browser Chromium (`pnpm exec playwright install chromium`; CI memakai `--with-deps`). Server tes = `pnpm dev`. Waktu tidak dipercepat: tes waktu habis memakai durasi 30 detik penuh |

Rules:

1. If any required `[FILL]` is missing, status MUST stay `DRAFT`.
2. Agent MUST NOT write production code while status is `DRAFT` or `REVIEW`.
3. Set status to `REVIEW` when the plan is ready for user review.
4. Set status to `READY` only after the user explicitly approves the plan in the chat.

---

## 2. Objective

Membuat game bisa dimainkan dari awal sampai akhir: host menekan Mulai, kedua pemain menjawab soal perkalian masing-masing, tali bergeser sama persis di kedua layar, dan pertandingan berakhir karena KO, waktu habis, WO, atau batal. Putus koneksi sebentar tidak merusak pertandingan. Tampilan masih sederhana; karakter 3D dan arena datang di Fase 4.

---

## 3. Non-Negotiable Technical Contract

1. File: `packages/shared/src/deck.ts`
   - Method signature: ``export function makeDeck(prev: [number, number] | null, random: () => number = Math.random): [number, number][]`` — 81 pasangan unik (1–9 × 1–9), tanpa pasangan tukar berurutan, dan soal pertama bukan `prev` maupun pasangan tukarnya.
2. File: `packages/shared/src/result.ts`
   - Method signature: ``export function koWinner(score: [number, number]): SeatIndex | null`` — selisih ≥ 5 → pemenang, selain itu `null`.
   - Method signature: ``export function timeWinner(score: [number, number]): SeatIndex | null`` — positif → 0, negatif → 1, nol → `null` (seri).
   - Konstanta: ``KO_DIFF = 5``, ``COUNTDOWN_MS = 3000``, ``PAUSE_MS = 10_000``, ``MAX_PAUSES = 3``, ``RESULT_RETURN_MS = 30_000``, ``HEARTBEAT_MS = 5000``, ``HEARTBEAT_TIMEOUT_MS = 12_000``, ``DECK_BATCH = 162``, ``DECK_REFILL_AT = 150``.
3. File: `packages/shared/src/room.ts`
   - `RoomState` ditambah `resultAt?: number`; `result.reason` ditambah `'surrender'` (Keluar saat bermain); `RoomSnapshot` ditambah field game di Business Decision Snapshot.
4. File: `packages/shared/src/protocol.ts`
   - Skema pesan client baru dan tipe pesan server baru persis seperti Business Decision Snapshot.
5. File: `apps/worker/src/room.ts`
   - Handler `start`, `answer`, `backToRoom`, `sync`, dan `leave` saat bermain.
   - Alarm memproses semua tenggat yang sudah lewat: `startsAt`, `endsAt`, `pause.until`, heartbeat, kursi lobby 60 detik, layar hasil 30 detik, room kosong 5 menit; lalu memasang alarm ke tenggat terdekat.
   - Urutan pesan dijamin oleh DO: jawaban yang tiba setelah fase `result` dibalas `reject`.
6. File: `apps/client/src/screens/Permainan.svelte`, `apps/client/src/screens/Hasil.svelte`, `apps/client/src/game/clock.ts`
   - `Permainan`: HUD (nama, skor, waktu), garis tali 2D dengan penanda yang bergeser 1/13,6 lebar per langkah, soal + jawaban, keypad 4 kolom seperti preview, overlay hitung mundur dan jeda.
   - `clock.ts`: ``export function serverNow(): number`` dan ``export function applySync(t: number, serverNow: number, receivedAt: number): void``.
   - Lobby: tombol Mulai untuk host; slot "Melihat hasil..." untuk pemain yang belum kembali.
7. File: `playwright.config.ts`, `e2e/match.spec.ts`
   - `webServer: { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI }`.
8. File: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
   - Langkah `pnpm exec playwright install --with-deps chromium` lalu `pnpm e2e` setelah `pnpm build`, sebelum deploy.
9. File: `docs/initiate-file/tarik-tambang-matematika-prd.md`
   - Tabel pesan, aturan jeda, dan paragraf persistensi diperbarui sesuai baris "Tambahan dari PRD" dan "Memperjelas PRD" di atas; kalimat lama dihapus.

Rules:

1. No "or relevant file/service" wording.
2. No scope expansion without explicit approval.

---

## 4. Scope of Changes

### A. Shared

1. `makeDeck`, aturan hasil, konstanta waktu, skema dan tipe pesan baru, unit test (termasuk `makeDeck` 10.000 kali).

### B. Worker

1. Fase `countdown` → `playing` → `paused` → `result` → `lobby` dan semua tenggatnya di satu alarm.
2. Tes DO untuk tiap baris Acceptance Test Matrix yang berlabel DO.

### C. Client

1. Layar Permainan dan Hasil, overlay hitung mundur dan jeda, keypad dan keyboard fisik, sinkron jam.
2. Lobby: tombol Mulai dan status "Melihat hasil...".

### D. E2E dan CI

1. Playwright: KO, waktu habis (menang dan seri), putus koneksi (lanjut dan WO).
2. Langkah e2e di kedua workflow.

### E. Docs

1. PRD (kontrak no. 9), `docs/data-model.md`, feature doc `docs/features/gameplay.md`, `ai-context.md` §4 (perintah `pnpm e2e`).

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| `makeDeck` (unit) | 10.000 kali, masing-masing dengan `prev` dari deck sebelumnya | Selalu 81 soal unik, tanpa pasangan tukar berurutan, sambungan aman | `[x]` |
| Mulai bukan host (DO, failure) | Kursi 1 kirim `start` | `error NOT_HOST`; fase tetap `lobby` | `[x]` |
| Mulai sendirian (DO, failure) | Host kirim `start` dengan kursi 1 kosong | `error INVALID_MESSAGE`; fase tetap `lobby` | `[x]` |
| Hitung mundur (DO) | Host kirim `start` | Kedua pemain menerima `countdown` (`startsAt` = sekarang + 3000) dan `deck` 162 soal yang berbeda; alarm di `startsAt` → `playing`, `endsAt = startsAt + durasi` | `[x]` |
| Jawaban saat hitung mundur (DO, failure) | `answer` sebelum `playing` | `reject` dengan `expected: 0`; skor tetap | `[x]` |
| Jawaban benar (DO) | `answer { q: qIndex, value: a×b }` | `qIndex` dan skor naik 1; kedua pemain menerima `tug` | `[x]` |
| Jawaban kedaluwarsa (DO, failure) | `answer` dengan `q` lama atau nilai salah | `reject { q, expected }`; skor tetap | `[x]` |
| KO (DO, boundary) | Selisih 4 lalu satu jawaban benar lagi | Selisih 4 belum selesai; selisih 5 → `result { winner, reason: 'ko' }` | `[x]` |
| Dua jawaban bersamaan di selisih 4 (DO, boundary) | Host mencapai selisih 5, lalu jawaban Player 2 tiba | Jawaban kedua dibalas `reject`; hasil tetap KO host | `[x]` |
| Waktu habis (DO) | Alarm di `endsAt` dengan skor 3–1 lalu 2–2 | `result time` host menang; skor sama → `winner: null` (seri) | `[x]` |
| Jeda dan lanjut (DO) | Pemain putus saat `playing`, kembali dalam 10 detik | `pause` (sisa waktu disimpan), lalu `resume` dengan `endsAt = sekarang + remainingMs` | `[x]` |
| Jeda habis (DO) | Tenggat `pause.until` lewat | Lawan menang `wo` | `[x]` |
| Jatah jeda (DO, boundary) | Putus ke-3 lalu ke-4 | Ke-3 masih `pause`; ke-4 langsung `result wo` | `[x]` |
| Keduanya putus (DO) | A dijeda, B ikut putus, tenggat lewat | `result void`, `winner: null` | `[x]` |
| Menyerah (DO) | `leave` saat `playing` | Lawan menang, `reason: 'surrender'` | `[x]` |
| Putus saat hitung mundur (DO) | Pemain putus sebelum `startsAt` | Fase kembali `lobby`; `pausesUsed` tetap 0 | `[x]` |
| Heartbeat (DO) | Socket tanpa ping > 12 detik saat `playing` | Socket ditutup `4000` dan pemain dijeda | `[x]` |
| Kembali ke room (DO, boundary) | Satu pemain `backToRoom`, lawan diam 30 detik | Fase `lobby`, lawan `inLobby: false` sampai 30 detik lalu dikeluarkan; `start` ditolak selama lawan belum kembali | `[x]` |
| Isi ulang deck (DO) | `qIndex` mencapai 150 | Server mengirim `deck { from: 162, questions: 81 }` | `[x]` |
| E2E KO | 2 browser; host menjawab 5 soal benar | Kedua layar: penanda tali sama di setiap langkah; host "Kamu Menang · KO", lawan "Kamu Kalah · KO" | `[x]` |
| E2E waktu habis | Durasi 30 detik; host menjawab 2 benar, lawan 1 | "Kamu Menang · Waktu habis" / "Kamu Kalah"; skor 2 : 1 di kedua layar | `[x]` |
| E2E seri | Durasi 30 detik; tidak ada yang menjawab | Kedua layar "Seri" | `[x]` |
| E2E putus koneksi | Lawan offline 3 detik, lalu offline 12 detik di pertandingan berikutnya | 3 detik: jeda lalu lanjut dengan sisa waktu yang sama (±1 detik); 12 detik: host "Menang WO" | `[x]` |
| E2E kembali ke room | Kedua pemain menekan Kembali ke room | Keduanya di lobby yang sama; host bisa Mulai lagi | `[x]` |

---

## 6. Verification Commands

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
2. `pnpm exec playwright install chromium && pnpm e2e`
3. Setelah merge: main satu pertandingan manual di `https://cerdas-amat.radlabs.my.id` dari dua perangkat

Expected:

1. Semua perintah exit 0; semua baris Acceptance Test Matrix tercentang.
2. CI PR menjalankan e2e sebelum deploy preview.

---

## 7. Out of Scope

1. Karakter voxel, arena 3D, pose Menang/Kalah/Diam, avatar gambar (Fase 4).
2. Audio, PWA, filter kata kasar, rate limiting, cek Origin, tombol Bagikan, pesan kuota habis (Fase 5).
3. Gaya visual final.
4. Efek visual jawaban benar/salah selain mengosongkan kolom dan pesan singkat.

---

## 8. Completion Checklist

- [x] Section 1 fully filled and status set correctly.
- [x] All Non-Negotiable Technical Contract items implemented.
- [x] Acceptance Test Matrix completed.
- [x] Verification commands executed successfully.
- [x] No out-of-scope changes introduced.

---

## 9. Hasil Verifikasi

1. `pnpm lint`, `typecheck`, `test` (shared 23, worker 39 tes; worker dijalankan 3× tanpa flaky), dan `build` lulus.
2. `pnpm e2e`: 4 tes Playwright (KO dengan tali sama di kedua layar, jawaban salah, waktu habis menang 2:1 → kembali ke room → seri, putus sebentar lalu lanjut → putus > 10 detik WO) lulus 2× berturut-turut, sekitar 1,3 menit.
3. Penyesuaian dari kontrak: pemain yang tersambung ulang saat `paused` tidak menerima `pause`/`resume` sendiri; state-nya dibaca dari snapshot `welcome` (urutan pesan: `welcome` selalu pertama). Tes e2e putus koneksi memakai tutup-buka tab, bukan mode offline.
4. PR #4: CI hijau, termasuk `pnpm e2e` dan smoke test preview.
5. Merge ke `main`: workflow Deploy sukses (termasuk `pnpm e2e`); 4 tes Playwright lulus terhadap `https://cerdas-amat.radlabs.my.id`.
