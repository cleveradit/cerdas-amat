# Architecture Map

**Status:** Rencana — belum ada kode. Isi dokumen ini diturunkan dari [PRD Teknis](initiate-file/tarik-tambang-matematika-prd.md) dan wajib diverifikasi ulang terhadap kode setelah tiap fase selesai.

## Summary

Satu Cloudflare Worker menyajikan client (SPA + PWA), membuat room, dan meneruskan WebSocket ke Durable Object `Room` milik kode room tersebut. Seluruh logika permainan (skor, tali, fase, timer) berjalan di Durable Object; client Svelte + Three.js hanya mengirim input dan menggambar state dari server. Tidak ada akun dan tidak ada database eksternal.

## Components

| Component | Responsibility | Code location | Dependencies |
|---|---|---|---|
| Client | Layar (menu, pengaturan, pilih karakter, lobby, permainan, hasil), keypad, render voxel (diport dari [preview karakter](initiate-file/karakter-tarik-tambang.html)), audio, PWA, localStorage | `apps/client/` | Svelte 5, Vite, Three.js, vite-plugin-pwa, `packages/shared` |
| Worker | Aset statis, `POST /api/rooms` (buat room + rate limit), `GET /ws/:code` (upgrade WebSocket), cek Origin, tangkap error kuota | `apps/worker/src/index.ts` | Durable Object `Room`, binding Rate Limiting |
| Durable Object `Room` | State room otoritatif, protokol pesan, alarm tunggal, persistensi ke storage SQLite, heartbeat | `apps/worker/` | WebSocket Hibernation API, `packages/shared` |
| Shared | Tipe pesan, skema Valibot, `makeDeck`, aturan hasil, filter nama, pembuat kode room | `packages/shared/` | Valibot |

## Main flows

1. **Buat room:** client `POST /api/rooms` → Worker mengacak kode 5 karakter, memanggil `init()` di DO (acak ulang maks 5 kali bila bentrok) → client membuka `/ws/:code`, kirim `hello`, terima `welcome` (kursi 0, token).
2. **Join room:** input kode atau link `?room=KODE` → `/ws/:code` → `hello` → kursi 1, atau error `ROOM_FULL` / `ROOM_NOT_FOUND`.
3. **Mulai permainan:** host kirim `start` → DO set `startsAt = now + 3000`, kirim `countdown` + `deck` → alarm di `startsAt` mengubah fase ke `playing`, `endsAt = startsAt + durasi`.
4. **Jawaban benar:** client cek lokal, tampilkan soal berikutnya, kirim `answer { q, value }` → DO validasi fase, `qIndex`, nilai → skor naik, `tug` ke kedua pemain → selisih 5 memicu `result` (`ko`).
5. **Akhir waktu / jeda / WO:** semua tenggat diproses oleh satu alarm DO; putus koneksi saat bermain memicu `pause` 10 detik, maks 3 jeda per pemain.
6. **Reconnect:** client retry 0,5 s, 1 s, 2 s, lalu tiap 4 s, dan langsung saat `visibilitychange`; token kursi dari localStorage mengklaim ulang kursi.

## External integrations

| Sistem | Arah | Keterangan |
|---|---|---|
| Cloudflare Workers + Durable Objects | Hosting | Plan gratis; kuota harian reset 00:00 UTC (07:00 WIB) |
| Cloudflare Rate Limiting binding | Worker → binding | 20 buat room / 60 s per IP, 30 kode salah / 60 s per IP; ketersediaan di plan gratis dicek di Fase 1 |
| Cloudflare DNS + Custom Domain | Konfigurasi | `cerdas-amat.radlabs.my.id`; record GitHub Pages portofolio tetap DNS only |
| GitHub Actions + `cloudflare/wrangler-action` | CI → Cloudflare | Deploy preview tiap PR, produksi tiap merge ke `main` |
