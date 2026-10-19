# Backlog

This document lists all **unimplemented ideas, features, enhancements, and blocked items** for the project.

Before starting any item here, it **MUST** be converted into a detailed implementation plan in `docs/planning/` first!

---

## Format

Each backlog item follows this format:

```markdown
## [Feature/Idea Title]

**Status:** `OPEN` | `BLOCKED` *(blocker reason)*

**Summary:** 2-4 sentences describing what is wanted.

**Open questions (resolve during planning):**
1. [Question 1]
2. [Question 2]
3. [Question 3]
```

---

<!-- ADD BACKLOG ITEMS BELOW -->

## Fase 5 — Pelengkap

**Status:** `OPEN`

**Summary:** Audio (2 musik, 8 efek suara), PWA, filter nama, batas penyalahgunaan, pesan kuota habis, dan tombol Bagikan. Syarat lolos: semua kriteria penerimaan PRD tercentang.

**Open questions (resolve during planning):**
1. Daftar aset audio CC0 yang dipakai.
2. Sumber daftar kata kasar Indonesia dan Inggris.
3. Font preview (Lilita One, Rubik) dimuat dari Google Fonts; untuk game harus di-host sendiri (lisensi OFL).

## Fase 6 — Rilis

**Status:** `OPEN`

**Summary:** Uji di perangkat nyata (Android Chrome, iPhone Safari, pasang PWA), rilis publik, dan pantau pemakaian kuota setiap hari di minggu pertama.

**Open questions (resolve during planning):**
1. Kriteria kapan perlu upgrade ke Workers Paid.
2. Angka kuota Durable Objects plan gratis di dasbor masih sesuai tabel kuota PRD? (dicek user di dasbor Cloudflare)
