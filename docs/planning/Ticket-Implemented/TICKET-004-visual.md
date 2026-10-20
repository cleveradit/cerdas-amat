# Implementation Plan: TICKET-004 (Visual)

**Ticket:** `TICKET-004`  
**Status:** `DONE`  
**Target Audience:** AI Developer Agents  
**Depends On:** `TICKET-003` (DONE)

---

## 1. Business Decision Snapshot (Approved)

| Item | Approved Value |
|---|---|
| Lingkup | Fase 4 PRD: 5 karakter voxel dari [preview](../initiate-file/karakter-cerdas-amat.html), arena 3D, layar pilih karakter dengan preview berputar, avatar, pose Menang/Kalah/Diam di layar hasil. **Tambahan dari PRD:** gaya UI umum semua layar (menu, modal Play, pilih karakter, lobby, permainan, hasil) |
| Gaya UI | Ikuti preview (dipilih user): garis tinta 3 px `--ink #1F2A33`, bayangan keras `0 3px 0`, latar langit (`--sky #CFEBF7`, `--sky-2 #EEF7FB`, `--sky-deep #9FD3EC`), aksen `--sun #FFC83D`, host `--host #2F6FD0`, Player 2 `--p2 #DD4449`. Hanya tema terang (`color-scheme: light`), sama dengan preview |
| Font | Lilita One (judul, angka, keypad) dan Rubik 400/500/600/700 (teks), lewat paket `@fontsource/lilita-one` dan `@fontsource/rubik` yang di-bundle Vite, jadi di-host sendiri bersama aset. Tidak ada request ke Google Fonts atau CDN lain |
| Three.js | Paket `three ^0.186.1` + `@types/three`, di-import dinamis setelah menu tampil supaya layar pertama tetap ringan |
| Kalibrasi warna | Preview memakai r128. Agar warna dan terang sama: `ColorManagement.enabled = false`, `renderer.outputColorSpace = LinearSRGBColorSpace`, dan intensitas lampu dari preview dikali `Math.PI` (r155 menghapus mode lampu lama). Dicek dengan screenshot berdampingan preview vs game untuk karakter dan pose yang sama |
| Satu konteks WebGL | Satu `WebGLRenderer` untuk seluruh aplikasi; canvas-nya dipindah ke wadah layar yang aktif. Tiap layar punya scene dan kamera sendiri. Loop render hanya jalan saat ada layar 3D yang tampil. `devicePixelRatio` dibatasi 2 |
| Avatar | 5 gambar avatar (160×160, pose Diam, putar 0,45 rad) dirender sekali dengan renderer yang sama, disimpan sebagai data URL, dipakai di layar pilih karakter dan slot lobby |
| Pilih karakter | Input nama + Acak, preview berputar 360° pose Diam di atas alas hijau (0,9 rad/detik; 0,35 jika `prefers-reduced-motion`), deretan 5 avatar. Tombol pilihan animasi (Putar/Menarik/...) di preview **tidak** dipindah, sesuai GDD |
| Arena | Port langsung dari preview: kamera ortografis `STEP = 6`, `VIEW_W = 13.6 * STEP`, tangan mulai `±5 * STEP`, tanah, lajur, zona netral semi-transparan, tali, penanda kuning, bayangan, Player 2 dicerminkan (`scale.x = -1`). Tinggi 214 px. Pose: Menarik saat unggul atau seri, Terseret saat tertinggal. Nama di atas kepala (biru host, merah Player 2) dan label "Selisih N · KO di 5" |
| Layar hasil | Kanvas dengan kedua karakter berdampingan: pemenang pose Menang, yang kalah pose Kalah; seri dan dibatalkan keduanya pose Diam |
| Efek jawaban | Dari preview: jawaban benar = kotak soal berkedip hijau 220 ms; salah = goyang 0,32 s (mati jika `prefers-reduced-motion`). Timer berlatar merah saat ≤ 10 detik |
| Tanpa WebGL | Pesan singkat di layar permainan, tali 2D yang sekarang tetap dipakai, avatar diganti nama karakter. Game tetap bisa dimainkan |
| Syarat lolos fps | **Perubahan dari PRD (dipilih user):** HP fisik tidak dipakai di fase ini. Diukur dengan `pnpm perf`: Playwright Chromium lokal, layar 360×740 DPR 2, CPU throttling 6×, 10 detik arena di tengah pertandingan. Lolos: rata-rata ≥ 30 fps dan tidak ada detik di bawah 25 fps. Uji di HP Android nyata tetap dilakukan di Fase 6 (Rilis). Tidak jalan di CI karena runner GitHub merender WebGL dengan CPU |
| Penghitung fps | `?fps=1` menampilkan angka fps di pojok arena; dipakai `pnpm perf` dan untuk cek manual |

Rules:

1. If any required `[FILL]` is missing, status MUST stay `DRAFT`.
2. Agent MUST NOT write production code while status is `DRAFT` or `REVIEW`.
3. Set status to `REVIEW` when the plan is ready for user review.
4. Set status to `READY` only after the user explicitly approves the plan in the chat.

---

## 2. Objective

Mengubah tampilan sementara Fase 3 menjadi tampilan game sebenarnya: karakter voxel yang sudah disetujui tampil di layar pilih karakter, lobby, arena, dan hasil, dan semua layar memakai gaya visual preview. Aturan main, protokol, dan server tidak berubah. Arena harus tetap lancar (≥ 30 fps) di perangkat lemah.

---

## 3. Non-Negotiable Technical Contract

1. File: `apps/client/src/characters/voxel.ts`, `apps/client/src/characters/{kucing,beruang,rubah,panda,katak}.ts`, `apps/client/src/characters/index.ts`
   - Tipe: ``export type Part = 'head' | 'body' | 'armL' | 'armR' | 'legL' | 'legR' | 'tail'`` dan ``export type PartMaps = Record<Part, Map<string, number>>`` (kunci `"x,y,z"`, nilai warna hex).
   - `voxel.ts`: helper `fill`, `paint`, `fillS`, `paintS`, `setS`, `delS`, `base`, `eyes` dari preview, tanpa Three.js.
   - `index.ts`: ``export const SPECS: Record<Character, () => PartMaps>``. Isi voxel identik dengan preview.
2. File: `apps/client/src/game/arena.ts`
   - Method signature: ``export function arenaLayout(diff: number): { hostHand: number; p2Hand: number; marker: number }`` dalam satuan langkah (zona netral = 0, host negatif).
   - Method signature: ``export function poseFor(seat: SeatIndex, diff: number, result: Result | null): Pose`` dengan ``export type Pose = 'idle' | 'pull' | 'drag' | 'win' | 'lose'``.
3. File: `apps/client/src/three/stage.ts`
   - Method signature: ``export async function loadStage(): Promise<Stage | null>`` (`null` jika WebGL tidak tersedia; renderer dibuat sekali).
   - `Stage`: ``attach(el: HTMLElement, view: View): () => void`` (memindah canvas ke `el`, mengembalikan fungsi lepas), ``avatars: Record<Character, string>``, ``fps: number``.
   - ``export interface View { scene: Scene; camera: Camera; resize(w: number, h: number): void; update(t: number, dt: number): void }``.
4. File: `apps/client/src/three/rig.ts`
   - ``export function buildChar(key: Character): Rig``, ``export function animChar(rig: Rig, t: number, dt: number): void``; `Rig.pose: Pose`. Target sudut tiap pose dan smoothing sama dengan preview.
5. File: `apps/client/src/three/views/{pilih,arena,hasil}.ts`
   - ``createPilihView(character: Character): View & { setCharacter(c: Character): void }``.
   - ``createArenaView(): View & { set(state: { diff: number; characters: [Character, Character]; result: Result | null }): void; labelX(seat: SeatIndex): number }``.
   - ``createHasilView(characters: [Character, Character], result: Result): View``.
6. File: `apps/client/src/components/Stage3D.svelte`, `apps/client/src/components/Arena2D.svelte`
   - `Stage3D`: memasang `View` ke stage saat mount dan melepas saat destroy.
   - `Arena2D`: markup tali 2D yang sekarang di `Permainan.svelte`, dipakai saat `loadStage()` = `null`. Atribut `data-testid="arena"` dan `data-diff` tetap ada di wadah arena (3D maupun 2D) agar tes e2e lama tetap jalan.
7. File: `apps/client/src/styles/theme.css`
   - Token warna dan font, gaya dasar `button`, `input`, `select`, kartu, modal, keypad; di-import sekali di `main.ts`. Screen hanya memakai token, tanpa warna hex baru.
8. File: `apps/client/src/screens/*.svelte`, `apps/client/src/App.svelte`, `apps/client/src/i18n/id.ts`
   - Semua layar memakai gaya baru; teks baru (label fps, pesan tanpa WebGL, label selisih) hanya di `id.ts`.
9. File: `apps/client/package.json`
   - Dependency `three`, `@fontsource/lilita-one`, `@fontsource/rubik`; devDependency `@types/three`, `vitest`; script `test` = `vitest run`.
10. File: `e2e/visual.spec.ts`, `playwright.perf.config.ts`, `perf/arena.perf.ts`, `package.json` (root)
    - Script root ``"perf": "playwright test -c playwright.perf.config.ts"``. `pnpm e2e` tidak menjalankan tes perf.
11. File: `docs/initiate-file/cerdas-amat-prd.md`
    - Fase 4 ditambah gaya UI umum; syarat lolos Fase 4 diganti ke `pnpm perf` (baris "Syarat lolos fps"); bagian Client ditambah gaya UI, font, dan kalibrasi warna. Kalimat lama dihapus.

Rules:

1. No "or relevant file/service" wording.
2. No scope expansion without explicit approval.

---

## 4. Scope of Changes

### A. Karakter dan 3D

1. Port data voxel 5 karakter, rig, dan pose dari preview.
2. Stage bersama, avatar, view pilih karakter, arena, dan hasil; kalibrasi warna terhadap preview.
3. Fallback tanpa WebGL.

### B. Layar

1. Tema global dan font.
2. Menu, modal Play, pilih karakter (preview 3D + avatar), lobby (avatar di slot), permainan (arena 3D, HUD, efek jawaban, keypad), hasil (kanvas pose).

### C. Tes

1. Vitest client: `arenaLayout`, `poseFor`, jumlah voxel per bagian tiap karakter (snapshot).
2. Playwright `e2e/visual.spec.ts`: satu canvas di semua layar, avatar tampil, fallback tanpa WebGL, tidak ada request ke host lain, lebar 320 px.
3. `pnpm perf` lokal.

### D. Docs

1. PRD (kontrak no. 11), `docs/architecture.md`, feature doc `docs/features/visual.md`, `ai-context.md` §4 (perintah `pnpm perf`).

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| Layout seri (unit) | `arenaLayout(0)` | `hostHand = -5`, `p2Hand = 5`, `marker = 0` | `[x]` |
| Layout unggul (unit) | `arenaLayout(3)` | `hostHand = -5`, `p2Hand = 2`, `marker = -3` | `[x]` |
| Batas KO (unit, boundary) | `arenaLayout(5)` dan `arenaLayout(-5)` | Tangan yang tertinggal tepat di 0 (menyentuh zona netral) | `[x]` |
| Pose (unit) | `poseFor` untuk unggul, seri, tertinggal, menang, kalah, seri hasil, `void` | `pull`, `pull`, `drag`, `win`, `lose`, `idle`, `idle` | `[x]` |
| Data voxel (unit) | `SPECS[c]()` untuk 5 karakter | Jumlah voxel per bagian sama dengan hasil menjalankan kode preview (dicek sekali saat port, lalu dikunci snapshot) | `[x]` |
| Satu konteks WebGL (e2e) | Menu → pilih karakter → lobby → permainan → hasil | Paling banyak 1 elemen `canvas` di halaman di setiap layar | `[x]` |
| Avatar (e2e) | Buka pilih karakter dan lobby | 5 `img` avatar dengan `src` data URL; slot lobby menampilkan avatar karakter pemain | `[x]` |
| Tanpa WebGL (e2e, failure) | Chromium `--disable-webgl`, mainkan sampai KO | Pesan tanpa WebGL tampil, tali 2D bergeser, hasil KO tampil, tanpa error di console | `[x]` |
| Tanpa CDN (e2e, failure) | Catat semua request selama satu pertandingan | Semua request ke origin yang sama (font ikut di-bundle) | `[x]` |
| Layar sempit (e2e, boundary) | Viewport 320×640 | Tanpa scroll horizontal; keypad dan tombol Enter terlihat penuh | `[x]` |
| Tes lama (e2e) | `pnpm e2e` | 4 tes TICKET-003 tetap lulus tanpa diubah selain selector | `[x]` |
| fps (perf) | `pnpm perf` (360×740, DPR 2, CPU 6×) | Rata-rata ≥ 30 fps, tidak ada detik < 25 fps | `[x]` |
| Kalibrasi warna (manual) | Screenshot preview vs game, 5 karakter pose Diam | Warna dan terang tidak berbeda secara kasat mata; screenshot dilampirkan di Hasil Verifikasi | `[x]` |
| Gerak dikurangi (manual) | `prefers-reduced-motion: reduce` | Putaran preview melambat, goyang jawaban salah mati | `[x]` |

---

## 6. Verification Commands

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
5. `pnpm e2e`
6. `pnpm perf`

Expected:

1. Semua lulus; `pnpm test` kini juga menjalankan tes client.
2. Ukuran bundle awal (tanpa modul 3D yang di-import dinamis) dicatat di Hasil Verifikasi.

---

## 7. Out of Scope

1. Audio, modal Pengaturan (slider volume), PWA, filter kata kasar, batas penyalahgunaan, pesan kuota habis, tombol Bagikan (Fase 5).
2. Uji di HP Android dan iPhone nyata (Fase 6).
3. Tema gelap.
4. Mengganti dialog `confirm()` bawaan browser saat Keluar di tengah permainan.
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

1. `pnpm lint`, `typecheck`, `test` (shared 23, client 10, worker 39 tes), dan `build` lulus.
2. Ukuran bundle awal: JS 73,9 kB (gzip 27,7 kB) + CSS 27,0 kB (gzip 8,1 kB). Modul 3D di-import dinamis: `engine` 353,6 kB (gzip 85,3 kB), `rig` 188,7 kB (gzip 51,4 kB), view < 2 kB per layar. Font: browser hanya mengunduh subset latin.
3. `pnpm e2e`: 8 tes (4 tes TICKET-003 + 4 tes `visual.spec.ts`) lulus 2× berturut-turut dengan GPU (sekitar 1,4 menit), dan 1× dengan WebGL perangkat lunak seperti runner CI (2 menit; tes terlama 84 detik).
4. `pnpm perf` (Intel HD 620, Chromium headless dengan `--enable-gpu`, 360×740, DPR 2, CPU 6×): 60 fps setiap detik selama 10 detik.
5. Kalibrasi warna: 5 avatar game dibandingkan per piksel dengan avatar preview r128 di browser yang sama; selisih maksimum per kanal 0 untuk kelima karakter. Screenshot berdampingan (kiri preview, kanan game): [TICKET-004-kalibrasi.png](assets/TICKET-004-kalibrasi.png).
6. Data voxel: isi peta tiap bagian (kunci, warna, urutan) identik dengan hasil menjalankan kode preview; jumlah voxel dikunci di snapshot `characters.test.ts`.
7. Gerak dikurangi: dengan `reducedMotion: 'reduce'` media query aktif; putaran preview (0,35 rad/detik) dan amplitudo animasi memakai `reducedMotion()`, goyang jawaban salah dimatikan lewat `@media (prefers-reduced-motion: reduce)`.
8. Penyesuaian dari kontrak:
   - `createArenaView()` juga punya `labelY()` (tinggi label nama bergantung lebar arena) dan `onFrame` (label nama dan angka fps diperbarui tiap frame tanpa state Svelte).
   - `three/engine.ts` (renderer, di-import dinamis) dan `three/common.ts` (lampu, bayangan) ditambahkan agar `stage.ts` tidak membawa Three.js ke bundle awal.
   - `e2e/match.spec.ts` mendapat `afterEach` yang menutup konteks browser; isi tes tidak berubah. Tanpa ini, halaman tes sebelumnya terus merender 3D dan tes putus koneksi gagal (selisih timer > 1 detik).
   - `playwright.config.ts`: batas waktu tes 90 → 120 detik dan Chromium memakai GPU jika tersedia.
9. Review: tes `pnpm perf` sempat gagal acak karena tidak menunggu layar permainan sebelum cek hitung mundur; diperbaiki di PR yang sama (`fa20947`), lalu lulus (rata-rata 59,4 fps, detik terendah 54).
10. PR #5: CI hijau (termasuk `pnpm e2e` dan smoke test preview).
11. Merge ke `main`: workflow Deploy sukses. Terhadap `https://cerdas-amat.radlabs.my.id`, 7 dari 8 tes e2e lulus. Tes "semua request ke origin sendiri" gagal hanya karena Cloudflare Web Analytics menyisipkan `static.cloudflareinsights.com/beacon.min.js` di domain produksi (pengaturan dasbor Cloudflare, bukan kode game; tidak terjadi di lokal dan preview).
