# Keamanan dan Kuota

**Status:** Live

## Summary

Nama pemain disaring dari kata kasar di client (umpan balik cepat) dan di server (penentu). Pembuatan room dan tebakan kode salah dibatasi per IP dengan binding Rate Limiting, WebSocket hanya diterima dari halaman game sendiri, dan saat kuota plan gratis habis pemain melihat pesan "Server sedang penuh, coba lagi setelah pukul 07.00 WIB", bukan error teknis.

## Quick Reference

| Batas | Nilai | Dicek di | Saat terlewati |
|---|---|---|---|
| Buat room | 20 / 60 detik per IP (`CREATE_ROOM_LIMIT`) | Worker, `POST /api/rooms` | `429 { error: "RATE_LIMITED" }`; client: "Terlalu banyak room dibuat, coba lagi sebentar lagi" |
| Kode salah | 30 / 60 detik per IP (`JOIN_LIMIT`) | DO room yang belum di-`init()` | `error RATE_LIMITED` + close `4429`; input kode di modal Play dikunci 60 detik |
| Origin WebSocket | Host `Origin` = host request | Worker, `GET /ws/:code` | `403 { error: "FORBIDDEN_ORIGIN" }`, DO tidak dibangunkan |

| Kuota habis | Deteksi | Tampilan |
|---|---|---|
| Durable Object (error dari stub) | Worker `try/catch`: `POST /api/rooms` → `503 { error: "QUOTA" }`; `/ws/:code` → WebSocket milik Worker mengirim `error QUOTA` + close `4503` | Pesan kuota di Menu Utama (`notice`) dan modal Play |
| Request Worker (Worker tidak jalan) | `POST /api/rooms` membalas bukan JSON; atau WebSocket gagal terbuka pada percobaan pertama lalu `GET /api/health` tidak 200 | Sama |

| Fungsi (shared) | Isi |
|---|---|
| `normalizeForFilter(input)` | Huruf kecil, `4→a`, `1→i`, `0→o`, `3→e`, `5→s`, selain `a–z` dibuang |
| `isBadName(name)` | `true` jika hasil normalisasi memuat salah satu `BAD_WORDS` |
| `BAD_WORDS` | Daftar kurasi sendiri (Indonesia + Inggris), hanya `a–z`, minimal 4 huruf |

| File | Isi |
|---|---|
| `packages/shared/src/badWords.ts` | Daftar kata kasar beserta kata yang sengaja tidak dimasukkan |
| `packages/shared/src/names.ts` | `normalizeForFilter`, `isBadName` |
| `apps/worker/src/index.ts` | Rate limit buat room, cek Origin, `quotaSocket()` |
| `apps/worker/src/room.ts` | Rate limit kode salah, `safeName()` di `hello`/`setProfile` |
| `apps/client/src/App.svelte` | `showQuota()`, `onFirstOpenFailed`, kunci kode, `syncName()` |

## Gotchas

- Filter dicocokkan sebagai potongan kata, jadi kata pendek yang muncul di kata umum tidak boleh masuk daftar (`tai` di "Pantai", `asu` di "Kasur", `coli` di "Brokoli"). Menambah kata baru wajib disertai cek false positive di `names.test.ts`.
- Server mengganti nama kasar dengan nama acak tanpa pesan error; client menyamakan profil lokal dengan nama di snapshot (`syncName`, hanya di fase `lobby`).
- Batas kode salah hanya menghitung koneksi ke room yang tidak ada; tersambung ulang ke room yang sah tidak dihitung. Setiap kode salah tetap memakai satu request Durable Object.
- Semua error dari Durable Object dianggap kuota habis (sesuai PRD), termasuk error sementara lainnya. Error asli tercatat di Workers Logs (`console.error`).
- Tes Worker memakai IP acak per panggilan (`randomIp()` di `test/helpers.ts`), karena penghitung rate limit Miniflare bertahan antar tes dalam satu file.
- Dev lokal tidak punya `CF-Connecting-IP`; semua request memakai kunci `local`.

## Related

- [room-lobby.md](room-lobby.md)
- [data-model.md](../data-model.md)
- [PRD Teknis](../initiate-file/cerdas-amat-prd.md)
