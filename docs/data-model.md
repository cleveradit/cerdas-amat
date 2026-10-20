# Data Model Reference

**Status:** Terverifikasi terhadap kode. Tipe di bawah ada di [`packages/shared/src/room.ts`](../packages/shared/src/room.ts).

## Data storage

| Penyimpanan | Isi | Umur |
|---|---|---|
| Storage SQLite Durable Object `Room`, key `state` | Salinan `RoomState`; ditulis setiap state lobby berubah, saat fase berubah, dan selama bermain saat jawaban benar (jika tulisan terakhir ≥ 1 detik lalu) serta tiap alarm heartbeat 5 detik | Dihapus `deleteAll` setelah room kosong 5 menit |
| WebSocket attachment (`serializeAttachment`) | `{ seat: SeatIndex \| null, invalid: number, since: number }` per koneksi | Selama koneksi hidup; tidak memakai kuota tulis storage |
| localStorage `cerdas-amat:profile` | `{ name, character }` | Permanen di perangkat pemain |
| localStorage `cerdas-amat:token:<KODE>` | Token kursi untuk room itu | Dihapus saat pemain menekan Keluar atau room tidak ditemukan |

Tidak ada database eksternal (keputusan produk no. 5).

## Entities or tables

| Entity/table | Purpose | Definition source |
|---|---|---|
| `RoomState` | State lengkap satu room (hanya di server) | `packages/shared/src/room.ts` |
| `Seat` | Data satu kursi, termasuk token rahasia | `packages/shared/src/room.ts` |
| `RoomSnapshot` / `SeatView` | Bentuk room yang dikirim ke pemain, tanpa token dan deck | `packages/shared/src/room.ts` |

## Key fields

| Entity/table | Field | Type | Rules or constraints |
|---|---|---|---|
| `RoomState` | `code` | `string` | 5 karakter dari `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (`ROOM_CODE_ALPHABET`) |
| `RoomState` | `phase` | `Phase` | Awal `lobby` |
| `RoomState` | `seats` | `[Seat \| null, Seat \| null]` | Indeks 0 = host; `seats[0] === null` berarti `seats[1]` juga `null` (Player 2 selalu digeser ke kursi 0) |
| `RoomState` | `durationSec` | `Duration` (`30 \| 60 \| 90 \| 120`) | Awal `60`; hanya kursi 0 yang boleh mengubah |
| `RoomState` | `score` | `[number, number]` | Jawaban benar per kursi; posisi tali = `score[0] - score[1]`; selisih 5 = KO |
| `RoomState` | `qIndex` | `[number, number]` | Nomor soal aktif per kursi; jawaban hanya diterima untuk nomor ini |
| `RoomState` | `decks` | `[Question[], Question[]]` | 162 soal saat Mulai, +81 saat `qIndex` mencapai 150; tidak pernah ada di snapshot |
| `RoomState` | `startsAt` / `endsAt` | `number?` | Epoch ms; akhir hitung mundur (3 detik) / akhir permainan |
| `RoomState` | `remainingMs` / `pause` | `number?` / `{ seat, until }?` | Hanya saat `paused`; `until` = 10 detik setelah terputus |
| `RoomState` | `result` / `resultAt` | `{ winner, reason }?` / `number?` | `reason`: `ko`, `time`, `wo`, `surrender`, `void`; `result` dihapus saat fase kembali ke `lobby` atau kursi bergeser |
| `RoomState` | `emptySince` | `number?` | Epoch ms; diisi saat `init()` dan saat kursi 0 kosong, dihapus saat ada yang masuk |
| `Seat` | `token` | `string` | `crypto.randomUUID()`; tidak pernah ada di `RoomSnapshot` |
| `Seat` | `name` | `string` | Di-trim, 1–12 karakter (`NAME_MAX`); nama yang `isBadName` diganti `randomName()` oleh server |
| `Seat` | `character` | `Character` | `kucing`, `beruang`, `rubah`, `panda`, `katak` (`CHARACTERS`) |
| `Seat` | `connected` / `disconnectedAt` | `boolean` / `number?` | Kursi lobby yang terputus dikosongkan setelah 60 detik (`LOBBY_SEAT_HOLD_MS`) |
| `Seat` | `inLobby` | `boolean` | `false` sejak hasil sampai pemain menekan Kembali ke room; dikeluarkan setelah 30 detik |
| `Seat` | `pausesUsed` | `number` | Direset saat Mulai; maks 3, terputus ke-4 = WO |

## Relations and enums

| Enum | Nilai | Sumber |
|---|---|---|
| `Phase` | `lobby`, `countdown`, `playing`, `paused`, `result` | `room.ts` |
| `SeatIndex` | `0` (host), `1` (Player 2) | `room.ts` |
| `ResultReason` | `ko`, `time`, `wo`, `surrender`, `void` | `room.ts` |
| `ErrorCode` | `ROOM_NOT_FOUND`, `ROOM_FULL`, `NOT_HOST`, `INVALID_MESSAGE`, `RATE_LIMITED`, `QUOTA` | `protocol.ts` |
| Close code | `4000` heartbeat (client tersambung ulang), `4400` tidak valid, `4404` room tidak ada, `4409` room penuh, `4429` terlalu banyak kode salah, `4503` kuota habis | `protocol.ts` |
