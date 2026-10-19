# Gameplay

**Status:** Live

## Summary

Host menekan Mulai, server memasang hitung mundur 3 detik dan mengirim deck 162 soal ke tiap pemain. Client mencocokkan jawaban secara lokal dan hanya mengirim jawaban benar; server memvalidasi, menaikkan skor, dan mengirim `tug` ke kedua pemain sehingga tali di kedua layar selalu sama. Pertandingan berakhir karena KO (selisih 5), waktu habis, WO, menyerah, atau batal, lalu pemain kembali ke lobby room yang sama.

## Quick Reference

| Fase | Masuk saat | Keluar saat |
|---|---|---|
| `countdown` | Host `start` (kedua kursi terisi, tersambung, di lobby) | Alarm di `startsAt` → `playing`; pemain putus → `lobby` |
| `playing` | Hitung mundur selesai; jeda selesai | KO, `endsAt`, pemain putus (→ `paused`), Keluar |
| `paused` | Pemain putus dengan jatah jeda < 3 | Pemilik jeda kembali (→ `playing`), `pause.until` lewat (WO atau `void`) |
| `result` | KO, waktu habis, WO, `surrender`, `void` | Penekan pertama Kembali ke room (→ `lobby`) |

| Konstanta (`packages/shared/src/result.ts`) | Nilai |
|---|---|
| `KO_DIFF` | 5 |
| `COUNTDOWN_MS` | 3000 |
| `PAUSE_MS` / `MAX_PAUSES` | 10.000 / 3 |
| `RESULT_RETURN_MS` | 30.000 |
| `HEARTBEAT_MS` / `HEARTBEAT_TIMEOUT_MS` | 5000 / 12.000 |
| `DECK_BATCH` / `DECK_REFILL_AT` | 162 / 150 |

| File | Isi |
|---|---|
| `packages/shared/src/deck.ts` | `makeDeck(prev)` |
| `packages/shared/src/result.ts` | `koWinner`, `timeWinner`, konstanta waktu |
| `apps/worker/src/room.ts` | Fase, jawaban, jeda, heartbeat, satu alarm |
| `apps/client/src/screens/Permainan.svelte` | HUD, arena (3D, atau tali 2D tanpa WebGL), soal, keypad, overlay |
| `apps/client/src/screens/Hasil.svelte` | Teks hasil dari sudut pandang pemain |
| `apps/client/src/game/clock.ts` | Selisih jam dengan server dari pesan `sync` |
| `e2e/match.spec.ts` | Tes Playwright 2 pemain |

## Gotchas

- Client maju ke soal berikutnya sebelum server menjawab. Jika server membalas `reject`, client kembali ke `expected`; tali tetap hanya digerakkan oleh `tug`.
- Saat pemain tersambung ulang dalam fase `paused`, perubahan jeda diproses sebelum socket-nya dipasang ke kursi, sehingga `resume`/`pause` hanya terkirim ke lawan. Pemain yang kembali membaca state dari snapshot di `welcome`.
- Setiap `save()` memasang ulang alarm, termasuk heartbeat `now + 5 detik` selama bermain; alarm heartbeat juga menulis storage, sehingga skor yang belum ditulis paling lama tertunda 5 detik.
- `removeSeat(0)` menghapus `result` di state karena nomor kursi bergeser. Client menyalin hasil saat pesan `result` tiba (`shownResult`), bukan dari snapshot.
- Pemain yang tersambung ulang saat fase sudah `lobby` tetapi kursinya masih `inLobby: false` otomatis mengirim `backToRoom`, karena hasilnya sudah tidak ada di snapshot.
- Tes e2e waktu habis memakai durasi 30 detik penuh (sekitar 1 menit untuk menang lalu seri); tidak ada jam yang disuntikkan.

## Related

- [room-lobby.md](room-lobby.md)
- [data-model.md](../data-model.md)
- [PRD Teknis](../initiate-file/tarik-tambang-matematika-prd.md)
