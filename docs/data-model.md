# Data Model Reference

**Status:** Sebagian terverifikasi. Tipe di bawah ada di [`packages/shared/src/room.ts`](../packages/shared/src/room.ts); field gameplay (`score`, `qIndex`, `decks`, `startsAt`, `endsAt`, `remainingMs`, `pause`, `result`, `pausesUsed`) sudah didefinisikan tetapi baru dipakai mulai TICKET-003.

## Data storage

| Penyimpanan | Isi | Umur |
|---|---|---|
| Storage SQLite Durable Object `Room`, key `state` | Salinan `RoomState`; ditulis setiap state lobby berubah dan saat fase berubah (maks 1×/detik selama bermain) | Dihapus `deleteAll` setelah room kosong 5 menit |
| WebSocket attachment (`serializeAttachment`) | `{ seat: SeatIndex \| null, invalid: number }` per koneksi | Selama koneksi hidup; tidak memakai kuota tulis storage |
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
| `RoomState` | `score` / `qIndex` / `decks` | tuple | Awal `[0, 0]` / `[0, 0]` / `[[], []]`; dipakai TICKET-003 |
| `RoomState` | `emptySince` | `number?` | Epoch ms; diisi saat `init()` dan saat kursi 0 kosong, dihapus saat ada yang masuk |
| `Seat` | `token` | `string` | `crypto.randomUUID()`; tidak pernah ada di `RoomSnapshot` |
| `Seat` | `name` | `string` | Di-trim, 1–12 karakter (`NAME_MAX`) |
| `Seat` | `character` | `Character` | `kucing`, `beruang`, `rubah`, `panda`, `katak` (`CHARACTERS`) |
| `Seat` | `connected` / `disconnectedAt` | `boolean` / `number?` | Kursi lobby yang terputus dikosongkan setelah 60 detik (`LOBBY_SEAT_HOLD_MS`) |
| `Seat` | `inLobby` | `boolean` | Selalu `true` di TICKET-002 |

## Relations and enums

| Enum | Nilai | Sumber |
|---|---|---|
| `Phase` | `lobby`, `countdown`, `playing`, `paused`, `result` | `room.ts` |
| `SeatIndex` | `0` (host), `1` (Player 2) | `room.ts` |
| `ErrorCode` | `ROOM_NOT_FOUND`, `ROOM_FULL`, `NOT_HOST`, `INVALID_MESSAGE` | `protocol.ts` |
| Close code | `4400` tidak valid, `4404` room tidak ada, `4409` room penuh | `protocol.ts` |
