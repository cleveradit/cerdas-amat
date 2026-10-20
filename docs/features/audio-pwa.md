# Audio, Pengaturan, dan PWA

**Status:** Live

## Summary

Game memutar 2 musik latar dan 8 efek suara lewat Web Audio API (satu `AudioContext`, gain musik dan efek suara terpisah). Volume diatur di modal Pengaturan dari Menu Utama dan disimpan di localStorage. Client adalah PWA (`vite-plugin-pwa`, `generateSW`): bisa dipasang ke layar utama dan aset disimpan service worker, tetapi game tetap butuh internet; saat offline Menu Utama menampilkan "Butuh koneksi internet untuk bermain" dan tombol Play nonaktif.

## Quick Reference

| Fungsi (`apps/client/src/audio/audio.ts`) | Perilaku |
|---|---|
| `unlockAudio()` | Idempoten. Panggilan pertama membuat `AudioContext`, dua `GainNode`, listener `visibilitychange` (tersembunyi → `suspend()`, terlihat → `resume()`), lalu memuat 10 file (`fetch` + `decodeAudioData`) |
| `playSfx(name)` | Diam tanpa error jika audio belum dibuka, context tidak `running`, atau file belum siap |
| `setMusic(track)` | `null` menghentikan musik; lagu yang sama tidak diulang dari awal; jika file belum siap, lagu mulai begitu selesai dimuat |
| `setVolumes({ music, sfx })` | Gain = `(v / 100)²` |

| Suara | Diputar saat | Tempat |
|---|---|---|
| musik `menu` | Menu utama, pilih karakter, lobby | `App.svelte` (`music` derived) |
| musik `game` | Hitung mundur sampai pesan `result` | `App.svelte` |
| (tanpa musik) | Layar hasil | `App.svelte` |
| `key` | Tombol keypad atau keyboard fisik selain Enter; juga saat slider efek suara digeser | `Permainan.svelte`, `App.svelte` (`changeVolumes`) |
| `correct` / `wrong` | Enter dengan jawaban benar / salah | `Permainan.svelte` |
| `tug` | Setiap pesan `tug` (dari pemain mana pun) | `App.svelte` |
| `countdown` | Tiap angka 3-2-1 | `Permainan.svelte` |
| `win` / `lose` / `draw` | `Hasil` di-mount; hasil `void` tanpa jingle | `Hasil.svelte` |

| PWA | Nilai |
|---|---|
| Manifest | `name` "Cerdas Amat", `short_name` "Cerdas Amat", `lang` `id`, `display` `standalone`, `orientation` `portrait`, warna `#CFEBF7` |
| Ikon | `public/icons/`: `icon-192.png`, `icon-512.png` (sudut membulat), `icon-512-maskable.png`, `apple-touch-icon-180.png`; sumber `apps/client/pwa/icon.svg` |
| Precache | `**/*.{js,css,html,png,svg,woff2,mp3}` (sekitar 2,5 MB, 50 file) |
| Navigasi | `navigateFallback` `/index.html`, kecuali `/api/` dan `/ws/` |
| iOS | `apple-touch-icon`, `apple-mobile-web-app-capable`, `theme-color` di `index.html` |

| File | Isi |
|---|---|
| `apps/client/public/audio/` | 10 MP3 (total sekitar 1,65 MB) dan `CREDITS.md` (judul, pembuat, sumber, lisensi CC0) |
| `apps/client/src/screens/ModalPengaturan.svelte` | Slider musik dan efek suara, 0–100 langkah 5 |
| `apps/client/src/lib/storage.ts` | `loadVolumes()` / `saveVolumes()`, kunci `cerdas-amat:volume` |
| `scripts/pwa-icons.mjs` | Render `icon.svg` ke 4 PNG dengan Chromium Playwright (`pnpm pwa-icons`, manual) |
| `e2e/audio.spec.ts`, `e2e/pwa.spec.ts` | Tes Pengaturan, offline, audio; manifest dan service worker |

## Gotchas

- Audio baru dibuka pada `pointerdown`/`keydown` pertama (fase capture di `window`), termasuk saat masuk lewat link `?room=`. Sebelum itu tidak ada request file audio sama sekali.
- `decodeAudioData` di Chromium memotong padding encoder MP3: hasil decode sama panjang sampel dengan WAV asli, jadi loop musik tanpa jeda. Safari belum diuji (Fase 6).
- Gagal memuat atau decode file tidak menampilkan error (game tetap jalan tanpa suara itu); `e2e/audio.spec.ts` men-decode ke-10 file langsung untuk menangkap file rusak.
- Manifest dan service worker hanya ada di hasil build, jadi `e2e/pwa.spec.ts` berjalan di proyek Playwright `pwa` terhadap `vite preview` port 4173 (`pnpm e2e` mem-build client dulu). Saat `pnpm dev` tidak ada service worker.
- `includeManifestIcons: false`, karena ikon sudah masuk lewat `globPatterns`; tanpa itu tiap ikon tercatat dua kali di precache.
- Status offline dibaca dari `navigator.onLine` dan event `online`/`offline`; pesan offline menimpa pesan kuota di Menu Utama.
- Ikon 192/512 bersudut membulat transparan; maskable dan Apple penuh sampai tepi karena sistem memotong sendiri (iOS mengisi bagian transparan dengan hitam). Kepala kucing di `icon.svg` muat di lingkaran zona aman 80%.

## Related

- [visual](visual.md)
- [keamanan](keamanan.md)
- [data-model.md](../data-model.md)
- [PRD Teknis](../initiate-file/cerdas-amat-prd.md)
