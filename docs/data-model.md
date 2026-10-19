# Data Model Reference

**Status:** Rencana — belum ada kode. Diturunkan dari [PRD Teknis](initiate-file/tarik-tambang-matematika-prd.md) bagian "Model state room"; verifikasi ulang terhadap `packages/shared` setelah Fase 2.

## Data storage

| Penyimpanan | Isi | Umur |
|---|---|---|
| Storage SQLite Durable Object `Room` | Salinan `RoomState` (ditulis saat fase berubah, maks 1×/detik selama bermain) | Dihapus `deleteAll` setelah room kosong 5 menit |
| WebSocket attachment (`serializeAttachment`) | Identitas kursi per koneksi | Selama koneksi hidup; tidak memakai kuota tulis storage |
| localStorage client | Nama, karakter, volume musik, volume efek suara, token kursi per kode room | Permanen di perangkat pemain |

Tidak ada database eksternal (keputusan produk no. 5).

## Entities or tables

| Entity/table | Purpose | Definition source |
|---|---|---|
| `RoomState` | State lengkap satu room | `packages/shared` (rencana) |
| `Seat` | Data satu kursi pemain | `packages/shared` (rencana) |

## Key fields

| Entity/table | Field | Type | Rules or constraints |
|---|---|---|---|
| `RoomState` | `code` | `string` | 5 karakter dari `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, input diubah ke huruf besar |
| `RoomState` | `phase` | `Phase` | Lihat enum di bawah |
| `RoomState` | `seats` | `[Seat \| null, Seat \| null]` | Indeks 0 = host (kiri), 1 = Player 2 (kanan) |
| `RoomState` | `durationSec` | `30 \| 60 \| 90 \| 120` | Hanya diubah host saat `lobby` |
| `RoomState` | `score` | `[number, number]` | Posisi tali = `score[0] - score[1]`; selisih ±5 = KO |
| `RoomState` | `qIndex` | `[number, number]` | Nomor soal aktif per pemain |
| `RoomState` | `decks` | `[[number, number][], [number, number][]]` | Deck per pemain; tidak pernah dikirim di snapshot `room` |
| `RoomState` | `startsAt` / `endsAt` | `number?` | Epoch ms; akhir hitung mundur / akhir permainan |
| `RoomState` | `remainingMs` | `number?` | Sisa waktu saat `paused` |
| `RoomState` | `pause` | `{ seat, until }?` | Jeda 10 detik karena pemain terputus |
| `RoomState` | `result` | `{ winner: SeatIndex \| null, reason }?` | `winner` null = seri atau batal |
| `RoomState` | `emptySince` | `number?` | Dicatat saat kedua kursi kosong |
| `Seat` | `token` | `string` | 128-bit (`crypto.randomUUID()`); rahasia, tidak pernah dikirim ke pemain lain |
| `Seat` | `name` | `string` | Maks 12 karakter, lolos filter kata kasar |
| `Seat` | `character` | enum | `kucing`, `beruang`, `rubah`, `panda`, `katak` |
| `Seat` | `connected` / `disconnectedAt` | `boolean` / `number?` | Kursi lobby ditahan 60 detik setelah terputus |
| `Seat` | `inLobby` | `boolean` | `false` selama masih di layar hasil; dikeluarkan setelah 30 detik |
| `Seat` | `pausesUsed` | `number` | Maks 3 per pertandingan |

## Relations and enums

| Enum | Nilai |
|---|---|
| `Phase` | `lobby`, `countdown`, `playing`, `paused`, `result` |
| `SeatIndex` | `0` (host), `1` (Player 2) |
| `result.reason` | `ko`, `time`, `wo`, `void` |
| Kode `error` | `ROOM_NOT_FOUND`, `ROOM_FULL`, `NOT_HOST`, `RATE_LIMITED`, `QUOTA` |
