# Visual

**Status:** Live

## Summary

Lima karakter voxel dari [preview yang disetujui](../initiate-file/karakter-tarik-tambang.html) tampil di layar pilih karakter (preview berputar), slot lobby dan deretan avatar (gambar statis), arena permainan, dan layar hasil (pose Menang/Kalah/Diam). Satu `WebGLRenderer` dipakai bergantian oleh semua layar; canvas-nya dipindah ke layar yang sedang tampil. Semua layar memakai tema global dari preview (garis tinta, bayangan keras, latar langit, font Lilita One dan Rubik). Tanpa WebGL, permainan tetap jalan dengan tali 2D.

## Quick Reference

| File | Isi |
|---|---|
| `apps/client/src/characters/voxel.ts` | Tipe `Part`/`PartMaps`, helper `fill`, `paint`, `fillS`, `paintS`, `setS`, `delS`, `base`, `eyes` (tanpa Three.js) |
| `apps/client/src/characters/{kucing,beruang,rubah,panda,katak}.ts`, `index.ts` | Data voxel per karakter; `SPECS: Record<Character, () => PartMaps>` |
| `apps/client/src/game/arena.ts` | `arenaLayout(diff)`, `poseFor(seat, diff, result)` (fungsi murni) |
| `apps/client/src/three/stage.ts` | `loadStage()`, tipe `Stage` dan `View`; tanpa import nilai dari Three.js |
| `apps/client/src/three/engine.ts` | `createStage(gl)`: renderer bersama, avatar, loop render, hitung fps (di-import dinamis) |
| `apps/client/src/three/rig.ts` | `buildChar`, `animChar`, `disposeChar`; target sudut tiap pose |
| `apps/client/src/three/common.ts` | Lampu preview (intensitas × π), bayangan bulat |
| `apps/client/src/three/views/{pilih,arena,hasil}.ts` | Scene dan kamera tiap layar |
| `apps/client/src/lib/stage.svelte.ts` | `stage.current` (`undefined` dimuat, `null` tanpa WebGL), `initStage()`, `showFps` |
| `apps/client/src/components/Stage3D.svelte` | Memasang `View` ke stage saat mount, melepas saat destroy |
| `apps/client/src/components/Arena2D.svelte` | Tali 2D saat WebGL tidak tersedia |
| `apps/client/src/styles/theme.css` | Token warna, font, gaya dasar tombol, input, kartu, modal, avatar, keypad |
| `e2e/visual.spec.ts` | Satu canvas, avatar, tanpa WebGL, tanpa request ke host lain, layar 320 px |
| `perf/arena.perf.ts`, `playwright.perf.config.ts` | `pnpm perf` |

| Pose | Dipakai di |
|---|---|
| `idle` (Diam) | Preview pilih karakter (berputar 0,9 rad/detik; 0,35 jika gerak dikurangi), avatar, hasil seri dan dibatalkan |
| `pull` (Menarik) | Arena saat unggul atau seri |
| `drag` (Terseret) | Arena saat tertinggal |
| `win` / `lose` | Layar hasil |

| Arena (satuan voxel) | Nilai |
|---|---|
| `STEP` | 6 (satu langkah tali) |
| `VIEW_W` | `13.6 * STEP` (lebar kamera ortografis) |
| Tangan awal | `±5 * STEP` dari zona netral; host di kiri (negatif) |
| Tinggi arena | 214 px |

| Efek | Perilaku |
|---|---|
| Jawaban benar | Kotak soal berlatar hijau 220 ms |
| Jawaban salah | Goyang 0,32 s (blok `#key` membuat ulang kotak soal); mati jika `prefers-reduced-motion` |
| Timer | Berlatar merah saat ≤ 10 detik |
| `?fps=1` | Angka fps di pojok kanan atas arena |

## Gotchas

- `stage.current` disimpan dengan `$state.raw`. Proxy `$state` biasa menyalin objek `Stage`, sehingga `fps` yang diubah engine tidak pernah terbaca layar.
- Objek view Three.js juga disimpan dengan `$state.raw`, agar `Scene` dan isinya tidak dibungkus proxy Svelte.
- Konteks WebGL dibuat sendiri di `loadStage()` lalu diberikan ke `WebGLRenderer`. Three.js menulis error ke console saat gagal membuat konteks, dan konteks uji terpisah akan menambah satu konteks lagi.
- Hanya konteks WebGL 2 yang dibuat, karena Three.js r163+ tidak lagi mendukung WebGL 1. Perangkat yang hanya punya WebGL 1 memakai tali 2D (`Arena2D`) seperti perangkat tanpa WebGL.
- Melepas view (`attach` berikutnya atau fungsi lepas) men-dispose geometri dan material scene-nya; view tidak bisa dipasang ulang. Geometri dan material voxel dipakai bersama, sehingga diunggah ulang ke GPU saat dipakai lagi.
- `Stage3D` memasang canvas setelah frame pertama layar digambar, karena render 3D pertama bisa lama (kompilasi shader).
- Avatar dirender satu per tugas (`setTimeout`) agar layar yang sedang dibuka, misalnya kembali ke permainan setelah putus, tidak tertahan.
- Tes e2e menutup semua konteks browser di `afterEach`. Konteks dari `browser.newContext()` tidak ditutup otomatis, dan halaman tes sebelumnya yang masih merender 3D membuat tes peka waktu (timer setelah tersambung ulang) gagal.
- `pnpm e2e` meminta GPU (`--enable-gpu`); di runner CI tanpa GPU Chromium memakai SwiftShader, sehingga batas waktu tes dinaikkan ke 120 detik. `pnpm perf` tidak dijalankan di CI.

## Related

- [gameplay.md](gameplay.md)
- [architecture.md](../architecture.md)
- [PRD Teknis](../initiate-file/tarik-tambang-matematika-prd.md)
