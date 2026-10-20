# Implementation Plan: TICKET-006 (Audio, Pengaturan, dan PWA)

**Ticket:** `TICKET-006`  
**Status:** `DONE`  
**Target Audience:** AI Developer Agents  
**Depends On:** `TICKET-005` (prop `notice` di `MenuUtama`)

---

## 1. Business Decision Snapshot (Approved)

| Item | Approved Value |
|---|---|
| Lingkup | Bagian kedua Fase 5 PRD: 2 musik latar, 8 efek suara, modal Pengaturan (slider volume musik dan efek suara), PWA, pesan offline |
| Pemilihan aset audio | **Dipilih implementer (dipilih user)** dengan kriteria: lisensi CC0 saja, dari kenney.nl atau opengameart.org (halaman aset menyatakan CC0); dikonversi ke MP3 dengan `ffmpeg`; musik bisa di-loop mulus, 30–120 detik, ≤ 1 MB per file; efek suara ≤ 30 kB per file; total audio ≤ 2,5 MB. Musik ceria dan tidak mengganggu konsentrasi; lagu permainan lebih cepat dari lagu menu. Daftar final (file, judul, pembuat, URL, lisensi) dicatat di `apps/client/public/audio/CREDITS.md` dan dicek user saat review PR |
| Musik | `menu` diputar di menu utama, pilih karakter, dan lobby; `game` mulai saat hitung mundur sampai hasil. Layar hasil: musik berhenti, jingle hasil diputar; kembali ke lobby melanjutkan `menu` |
| Efek suara (8) | `key` (tombol keypad, termasuk keyboard fisik), `correct` (jawaban sendiri benar), `wrong` (jawaban sendiri salah), `tug` (setiap pesan `tug`, dari pemain mana pun), `countdown` (tiap angka 3-2-1), `win`, `lose`, `draw` (saat layar hasil tampil; hasil `void` tanpa jingle) |
| Wrapper audio | Web Audio API: satu `AudioContext`, dua `GainNode` (musik, efek suara). File di-`fetch` + `decodeAudioData` saat audio dibuka, bukan saat halaman dimuat. Audio dibuka pada `pointerdown`/`keydown` pertama di dokumen (aturan autoplay; juga mencakup masuk lewat link `?room=`). Tab tersembunyi → `suspend()`, terlihat lagi → `resume()` |
| Volume | 0–100, langkah 5; default musik 50, efek suara 80; disimpan di localStorage `cerdas-amat:volume` sebagai `{ music, sfx }`. Mengubah slider efek suara memutar `key` sebagai contoh |
| Modal Pengaturan | Tombol Pengaturan di menu utama, urutan sesuai GDD: Play, Pengaturan, Pilih Karakter. Dua slider berlabel dengan nilai persen dan tombol Tutup; gaya modal dari `theme.css` |
| PWA | `vite-plugin-pwa`, `generateSW`, `registerType: 'autoUpdate'`. Manifest: `name` "Cerdas Amat", `short_name` "Cerdas Amat", `lang` `id`, `start_url` `/`, `scope` `/`, `display` `standalone`, `orientation` `portrait`, `background_color` dan `theme_color` `#CFEBF7` (`--sky`). Precache: js, css, html, png, svg, woff2, mp3. `navigateFallback` `/index.html` dengan denylist `/api/` dan `/ws/` |
| Ikon | Kepala kucing voxel (warna dari data karakter kucing) di latar `--sky`, digambar sebagai SVG sumber `apps/client/pwa/icon.svg`, lalu dirender sekali ke PNG 192, 512, 512 maskable (konten di zona aman 80%), dan `apple-touch-icon` 180 lewat skrip Playwright `scripts/pwa-icons.mjs`. PNG di-commit ke `apps/client/public/icons/`. Dicek user saat review PR |
| iOS | `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="theme-color">`. Tidak ada tombol "Pasang" di dalam aplikasi; pemasangan lewat menu browser |
| Offline | `navigator.onLine === false` (dipantau lewat event `online`/`offline`): Menu Utama menampilkan "Butuh koneksi internet untuk bermain" lewat prop `notice` dari TICKET-005, tombol Play nonaktif |

Rules:

1. If any required `[FILL]` is missing, status MUST stay `DRAFT`.
2. Agent MUST NOT write production code while status is `DRAFT` or `REVIEW`.
3. Set status to `REVIEW` when the plan is ready for user review.
4. Set status to `READY` only after the user explicitly approves the plan in the chat.

---

## 2. Objective

Melengkapi game dengan suara, pengaturan volume, dan kemampuan dipasang di layar utama HP sebagai PWA, sehingga semua kriteria penerimaan PRD yang bisa diuji tanpa perangkat nyata tercentang. Aturan main, server, dan protokol tidak berubah.

---

## 3. Non-Negotiable Technical Contract

1. File: `apps/client/src/audio/audio.ts`
   - ``export type Sfx = 'key' | 'correct' | 'wrong' | 'tug' | 'countdown' | 'win' | 'lose' | 'draw'``.
   - ``export type Music = 'menu' | 'game'``.
   - ``export function unlockAudio(): void`` — idempoten; membuat/melanjutkan `AudioContext` dan mulai memuat file.
   - ``export function playSfx(name: Sfx): void`` — diam tanpa error jika audio belum dibuka atau file belum siap.
   - ``export function setMusic(track: Music | null): void`` — mengganti/menghentikan lagu; lagu yang sama tidak diulang dari awal.
   - ``export function setVolumes(v: Volumes): void`` dengan ``export interface Volumes { music: number; sfx: number }`` (0–100).
2. File: `apps/client/public/audio/`
   - `music-menu.mp3`, `music-game.mp3`, `sfx-key.mp3`, `sfx-correct.mp3`, `sfx-wrong.mp3`, `sfx-tug.mp3`, `sfx-countdown.mp3`, `sfx-win.mp3`, `sfx-lose.mp3`, `sfx-draw.mp3`, dan `CREDITS.md`.
3. File: `apps/client/src/lib/storage.ts`
   - ``export function loadVolumes(): Volumes`` (nilai rusak/di luar 0–100 → default) dan ``export function saveVolumes(v: Volumes): void``, kunci `cerdas-amat:volume`.
4. File: `apps/client/src/screens/ModalPengaturan.svelte`
   - Props: ``{ volumes: Volumes; onChange: (v: Volumes) => void; onClose: () => void }``.
5. File: `apps/client/src/screens/MenuUtama.svelte`
   - Tombol Pengaturan; prop baru ``onSettings: () => void`` dan ``offline: boolean`` (Play nonaktif saat offline).
6. File: `apps/client/src/App.svelte`
   - Listener `pointerdown`/`keydown` sekali untuk `unlockAudio()`.
   - `setMusic` mengikuti layar (lihat Business Decision "Musik"); `tug` → `playSfx('tug')`.
   - Status `online`/`offline` → `notice` dan `offline` untuk `MenuUtama`.
7. File: `apps/client/src/screens/Permainan.svelte`, `apps/client/src/screens/Hasil.svelte`
   - `key`, `correct`, `wrong` di keypad/Enter; `countdown` per angka; jingle `win`/`lose`/`draw` saat `Hasil` di-mount.
8. File: `apps/client/vite.config.ts`, `apps/client/package.json`, `apps/client/index.html`
   - Plugin `VitePWA` sesuai Business Decision "PWA"; devDependency `vite-plugin-pwa`; meta iOS dan `theme-color`.
9. File: `apps/client/pwa/icon.svg`, `scripts/pwa-icons.mjs`, `apps/client/public/icons/`
   - Skrip root ``"pwa-icons": "node scripts/pwa-icons.mjs"`` memakai `chromium` dari `@playwright/test` yang sudah terpasang (tanpa dependency baru); hanya dijalankan manual saat ikon diubah, tidak di build/CI.
   - Output: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png`.
10. File: `apps/client/src/i18n/id.ts`
    - Teks: tombol Pengaturan, judul modal, label slider musik dan efek suara, Tutup, pesan offline (teks PRD).

Rules:

1. No "or relevant file/service" wording.
2. No scope expansion without explicit approval.

---

## 4. Scope of Changes

### A. Audio

1. Pilih dan konversi aset sesuai kriteria, tulis `CREDITS.md`.
2. Wrapper `audio.ts`, pemicu di layar, unlock pada gestur pertama.

### B. Pengaturan

1. `ModalPengaturan`, simpan/muat volume, tombol di menu.

### C. PWA

1. `vite-plugin-pwa`, manifest, service worker, ikon, meta iOS, pesan offline.

### D. Tes

1. Vitest client: `loadVolumes`/`saveVolumes`.
2. Playwright: Pengaturan tersimpan setelah reload, offline, manifest dan ikon tersaji, tanpa error audio di console.

### E. Docs

1. Feature doc baru `docs/features/audio-pwa.md` terdaftar di `docs/features/index.md`, `docs/data-model.md` (kunci localStorage volume), `docs/architecture.md` (status).

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| Volume default (unit) | localStorage kosong | `loadVolumes()` = `{ music: 50, sfx: 80 }` | `[x]` |
| Volume rusak (unit, failure) | `cerdas-amat:volume` = `"x"`, dan `{ music: 150, sfx: -5 }` | Default dipakai | `[x]` |
| Volume batas (unit, boundary) | `{ music: 0, sfx: 100 }` disimpan lalu dimuat | Nilai sama persis | `[x]` |
| Pengaturan tersimpan (e2e) | Buka Pengaturan, geser musik ke 0 dan efek suara ke 40, reload | Slider menampilkan 0 dan 40 | `[x]` |
| Audio tanpa error (e2e) | Mainkan satu pertandingan sampai KO | Tidak ada error/warning `AudioContext` di console; semua request audio ke origin sendiri | `[x]` |
| Audio sebelum gestur (e2e, boundary) | Buka `?room=KODE` tanpa klik apa pun | Tidak ada error di console; audio dibuka setelah klik pertama | `[x]` |
| Offline (e2e, failure) | `context.setOffline(true)` di menu | Teks "Butuh koneksi internet untuk bermain" tampil, Play nonaktif; kembali online → teks hilang | `[x]` |
| Manifest (e2e) | `GET /manifest.webmanifest` dari hasil build (`vite preview`) | `display` `standalone`, `orientation` `portrait`, ikon 192 dan 512 tersaji `200` | `[x]` |
| Service worker (e2e) | Buka hasil build | `navigator.serviceWorker.ready` selesai; reload saat offline tetap menampilkan menu dengan pesan offline | `[x]` |
| Installable (manual) | Preview PR di Chrome DevTools → Application → Manifest | Tidak ada error installability | `[x]` |
| Ukuran aset (manual) | `du` di `apps/client/public/audio` | Sesuai batas di Business Decision; `CREDITS.md` lengkap untuk 10 file | `[x]` |
| Tes lama dan fps | `pnpm e2e`, `pnpm perf` | Semua lulus; fps tetap ≥ 30 rata-rata | `[x]` |

---

## 6. Verification Commands

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
5. `pnpm e2e`
6. `pnpm perf`

Expected:

1. Semua lulus.
2. Ukuran bundle awal dicatat di Hasil Verifikasi (dibandingkan TICKET-004: JS 73,9 kB, CSS 27,0 kB); audio tidak masuk bundle JS.

---

## 7. Out of Scope

1. Tombol "Pasang aplikasi" di dalam game atau prompt pemasangan kustom.
2. Mode offline (keputusan "Tidak masuk v1"); service worker hanya menyimpan aset.
3. Uji pemasangan PWA di Android dan iPhone nyata (Fase 6).
4. Musik/efek suara tambahan di luar 2 + 8 yang ditetapkan GDD.
5. Perubahan server, protokol, atau aturan main.

---

## 8. Completion Checklist

- [x] Section 1 fully filled and status set correctly.
- [x] All Non-Negotiable Technical Contract items implemented.
- [x] Acceptance Test Matrix completed.
- [x] Verification commands executed successfully.
- [x] No out-of-scope changes introduced.

---

## 9. Hasil Verifikasi

1. `pnpm lint`, `typecheck`, `test` (shared 28, client 13, worker 49 tes), dan `build` lulus. Bundle awal: JS 81,1 kB (gzip 30,1 kB), CSS 27,3 kB (gzip 8,2 kB); dibanding TICKET-004 (JS 73,9 kB) selisih +7,2 kB, sebagian dari TICKET-005. Audio tidak masuk bundle JS (dimuat dari `/audio/*.mp3`). Precache service worker: 50 file, sekitar 2,5 MB.
2. `pnpm e2e`: 17 tes lulus (11 lama + 4 di `e2e/audio.spec.ts` + 2 di `e2e/pwa.spec.ts`). Tes audio juga men-decode ke-10 file di Chromium.
3. `pnpm perf`: rata-rata 59,9 fps, detik terendah 59 fps.
4. Installable: diganti pemeriksaan otomatis lewat CDP `Page.getInstallabilityErrors` dan `Page.getAppManifest` pada hasil build (`vite preview`): tidak ada error. Tetap perlu dicek di preview PR.
5. Ukuran aset: total audio 1,65 MB; musik `music-menu.mp3` 848 kB (106 detik), `music-game.mp3` 769 kB (64 detik); efek suara 1,3–9,7 kB. `CREDITS.md` mencatat 10 file.
6. Loop musik: hasil decode Chromium sama panjang sampel dengan WAV asli (tanpa padding encoder). Safari belum diuji (Fase 6).
7. Pemilihan audio dilakukan tanpa mendengar: efek suara dipilih dari durasi/kenyaringan, jingle menang/kalah dari arah nada (naik/turun), musik dari tempo (menu sekitar 72 bpm, game sekitar 90 bpm). Perlu didengar user saat review PR.
8. Penyesuaian dari kontrak:
   - `playwright.config.ts`: dua proyek (`dev`, `pwa`) dan webServer kedua (`build` + `vite preview` port 4173) untuk tes manifest/service worker; `pnpm e2e` jadi mem-build client dulu.
   - `includeManifestIcons: false` di `VitePWA`, karena ikon sudah masuk lewat `globPatterns` dan tercatat dua kali.
   - `icon.svg` dibuat dari data voxel `kucing()` (proyeksi oblique) dengan skrip sekali pakai yang tidak di-commit; sumber ikon tetap `apps/client/pwa/icon.svg`.
   - Unit test volume di file baru `apps/client/src/lib/storage.test.ts`.
