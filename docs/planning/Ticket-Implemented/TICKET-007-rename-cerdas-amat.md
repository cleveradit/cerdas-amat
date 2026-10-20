# Implementation Plan: TICKET-007 (Ganti Nama Produk ke Cerdas Amat)

**Ticket:** `TICKET-007`  
**Status:** `DONE`  
**Target Audience:** AI Developer Agents  
**Depends On:** `None`

---

## 1. Business Decision Snapshot (Approved)

| Item | Approved Value |
|---|---|
| Nama produk | `Cerdas Amat` (menggantikan "Tarik Tambang Matematika") |
| `short_name` PWA | `Cerdas Amat` |
| Cakupan | Hanya nama/branding. Mekanik tarik tali (arena tali, pesan `tug`, animasi menarik) tetap, istilah "tali"/`tug` tidak diubah |
| Identitas teknis | Tetap `cerdas-amat` (package `@cerdas-amat/*`, nama Worker, domain `cerdas-amat.radlabs.my.id`, key localStorage, repo GitHub) — tidak ada perubahan |
| Frasa "tarik tambang" | Dihapus dari seluruh repo (kode, tes, docs aktif, tiket arsip, nama file docs) |

Rules:

1. If any required `[FILL]` is missing, status MUST stay `DRAFT`.
2. Agent MUST NOT write production code while status is `DRAFT` or `REVIEW`.
3. Set status to `REVIEW` when the plan is ready for user review.
4. Set status to `READY` only after the user explicitly approves the plan in the chat.

---

## 2. Objective

Produk tampil dengan nama "Cerdas Amat" di judul halaman, layar menu, manifest PWA, dan teks Bagikan. Frasa "tarik tambang" tidak lagi muncul di repo, termasuk nama file dokumen sumber kebenaran produk. Gameplay dan infrastruktur tidak berubah.

---

## 3. Non-Negotiable Technical Contract

1. File: `apps/client/src/i18n/id.ts`
   - Change: `title: 'Cerdas Amat'`; teks Bagikan menjadi `` `Ayo adu perkalian di Cerdas Amat! Kode room: ${code}` ``.
2. File: `apps/client/index.html`
   - Change: `<title>Cerdas Amat</title>`.
3. File: `apps/client/vite.config.ts`
   - Change: manifest `name: 'Cerdas Amat'`, `short_name: 'Cerdas Amat'`.
4. File: `e2e/pwa.spec.ts`
   - Change: ekspektasi manifest dan heading mengikuti nilai di atas.
5. Rename file (via `git mv`):
   - `docs/initiate-file/tarik-tambang-matematika-gdd.md` → `docs/initiate-file/cerdas-amat-gdd.md`
   - `docs/initiate-file/tarik-tambang-matematika-prd.md` → `docs/initiate-file/cerdas-amat-prd.md`
   - `docs/initiate-file/karakter-tarik-tambang.html` → `docs/initiate-file/karakter-cerdas-amat.html`
6. Semua tautan/rujukan ke tiga file di atas diperbarui: `apps/client/src/characters/voxel.ts`, `docs/ai-context.md`, `docs/architecture.md`, `docs/index.md`, `docs/features/{audio-pwa,gameplay,keamanan,room-lobby,visual}.md`, `docs/planning/Ticket-Implemented/TICKET-00{2,3,4,5}-*.md`.
7. Judul/isi dokumen:
   - GDD H1 → `# Cerdas Amat — Game Design Document`; PRD H1 → `# Cerdas Amat — PRD Teknis`; kalimat pembuka PRD → "Cerdas Amat adalah game web …".
   - Preview karakter: `<title>` dan `<h1>` → "Karakter Cerdas Amat"; eyebrow → "Cerdas Amat · cerdas-amat.radlabs.my.id".
   - `CLAUDE.md` H1 → `# Cerdas Amat — Claude Code Context`.
   - `docs/index.md` baris pembuka: hapus frasa `"Tarik Tambang Matematika"`.
   - `docs/features/audio-pwa.md` dan `TICKET-006-audio-pwa.md`: nilai manifest mengikuti poin 3.

Rules:

1. No "or relevant file/service" wording.
2. No scope expansion without explicit approval.

---

## 4. Scope of Changes

### A. Client

1. Ubah `id.ts`, `index.html`, `vite.config.ts` sesuai kontrak.

### B. Tes

1. Ubah `e2e/pwa.spec.ts`.

### C. Docs

1. `git mv` tiga file sumber kebenaran, perbarui semua tautan.
2. Ganti frasa nama di judul/isi dokumen sesuai kontrak poin 7.

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| Judul tab | Buka `/` | Title "Cerdas Amat", heading menu "Cerdas Amat" | `[x]` |
| Manifest | `GET /manifest.webmanifest` | `name` dan `short_name` "Cerdas Amat" | `[x]` |
| Teks Bagikan | Tekan Bagikan di lobby | Teks berisi "Cerdas Amat", kode room tetap ada | `[x]` |
| Boundary: sisa frasa | `grep -rniI "tarik.tambang"` di repo (tanpa `node_modules`, `.git`, `dist`) | Tidak ada hasil, termasuk nama file | `[x]` |
| Failure: tautan rusak | Cari rujukan ke nama file lama | Tidak ada tautan ke `tarik-tambang-*` / `karakter-tarik-tambang.html` | `[x]` |

---

## 6. Verification Commands

1. `grep -rniI "tarik.tambang" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.wrangler .` dan `find . -iname "*tarik*" -not -path "*/node_modules/*"`
2. `pnpm typecheck && pnpm lint && pnpm test`
3. `pnpm build`
4. `pnpm e2e`

Expected:

1. Perintah 1 tanpa output.
2. Perintah 2–4 lolos.

---

## 7. Out of Scope

1. Mengganti identitas teknis `cerdas-amat` (package, Worker, domain, localStorage, repo).
2. Mengganti istilah mekanik tali/`tug` di kode, protokol, atau dokumen.
3. Mengubah aturan main, aset, ikon PWA, atau `docs/planning/current-session.md`.

---

## 8. Completion Checklist

- [x] Section 1 fully filled and status set correctly.
- [x] All Non-Negotiable Technical Contract items implemented.
- [x] Acceptance Test Matrix completed.
- [x] Verification commands executed successfully.
- [x] No out-of-scope changes introduced.
