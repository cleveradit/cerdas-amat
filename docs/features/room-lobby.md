# Room dan Lobby

**Status:** Live

## Summary

Pemain membuat room lewat `POST /api/rooms`, lalu semua pemain tersambung ke Durable Object `Room` milik kode itu lewat satu WebSocket. Server memegang isi kursi, host, dan durasi; client hanya mengirim pesan dan menggambar snapshot `room`. Kursi pemain yang terputus di lobby ditahan 60 detik dan bisa diklaim ulang dengan token yang tersimpan di localStorage.

## Quick Reference

| Pesan client | Isi | Aturan server |
|---|---|---|
| `hello` | `token?`, `name`, `character` | Token cocok → klaim ulang kursi (socket lama ditutup); tanpa token → kursi kosong pertama, atau `ROOM_FULL` + close `4409` |
| `setProfile` | `name`, `character` | Hanya di `lobby`, pengirim harus punya kursi |
| `setDuration` | `sec` | Hanya kursi 0, selain itu `NOT_HOST` |
| `leave` | – | Kursi dikosongkan; jika host, Player 2 pindah ke kursi 0 |

| Pesan server | Isi |
|---|---|
| `welcome` | `seat`, `token`, `room`, `serverNow` |
| `room` | `room` (snapshot), `seat` (kursi penerima saat ini) |
| `error` | `code`, `message` |

| Tenggat (satu alarm) | Nilai | Akibat |
|---|---|---|
| Kursi lobby terputus | 60 detik | Diperlakukan seperti `leave` |
| Room kosong | 5 menit | `deleteAll`; kode bebas dipakai lagi |

| File | Isi |
|---|---|
| `apps/worker/src/index.ts` | Routing `POST /api/rooms`, `GET /ws/:code` |
| `apps/worker/src/room.ts` | Durable Object `Room` |
| `packages/shared/src/protocol.ts` | Skema Valibot, tipe pesan, close code |
| `apps/client/src/net/roomClient.ts` | WebSocket client, reconnect, ping |
| `apps/client/src/App.svelte` | Alur layar dan penanganan pesan |
| `apps/client/src/lib/share.ts` | Tombol Bagikan: Web Share API, fallback clipboard, lalu link manual |

## Gotchas

- `ROOM_NOT_FOUND` dikirim lewat WebSocket (upgrade 101, lalu close `4404`), bukan HTTP 404, karena browser tidak bisa membaca status upgrade yang gagal. Hanya kode berformat salah yang dibalas 404 oleh Worker.
- `room` membawa `seat` penerima karena kursi pemain bisa berubah tanpa `welcome` baru (host keluar → Player 2 menjadi kursi 0). Attachment socket ikut diperbarui di `removeSeat`.
- State disimpan setiap perubahan lobby; DO yang hibernasi kehilangan memori, dan state dimuat ulang di constructor lewat `blockConcurrencyWhile`.
- Tes alarm memundurkan tenggat lewat `runInDurableObject` lalu memanggil `runDurableObjectAlarm`; kode DO selalu membandingkan dengan `Date.now()`.
- Dua tab di profil browser yang sama berbagi token di localStorage; tab kedua akan mengklaim kursi tab pertama. Untuk tes 2 pemain, pakai jendela incognito.
- Client berhenti mencoba tersambung ulang hanya pada close code `4400`, `4404`, `4409`, `4429`, `4503`, atau setelah `leave`.
- Link Bagikan memakai `location.origin`, jadi di preview link menunjuk ke preview, bukan produksi.

## Related

- [data-model.md](../data-model.md)
- [architecture.md](../architecture.md)
- [PRD Teknis](../initiate-file/tarik-tambang-matematika-prd.md)
