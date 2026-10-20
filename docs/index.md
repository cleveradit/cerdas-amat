# Cerdas Amat — Documentation Hub

Hub dokumentasi project Cerdas Amat: game web 2 pemain realtime (perkalian 1–9 × 1–9, selisih 5 jawaban benar = KO) di `cerdas-amat.radlabs.my.id`. Ditulis agar mudah dicerna developer maupun AI agent.

**Stack:** TypeScript · Svelte 5 + Vite · Three.js · Cloudflare Workers + Durable Objects (SQLite) · Valibot · pnpm workspaces

## Start here

Reading order to understand the project without reading code:

1. **[AI Context & Mandates](ai-context.md)** — absolute rules, architecture boundaries, dev environment commands. Read first.
2. **[Architecture Map](architecture.md)** — module map, public surface, and how they relate.
3. **[Data Model Reference](data-model.md)** — all tables/collections, columns/fields, relations, and core enums.
4. **[Feature Docs Index](features/index.md)** — per-feature details.

## Dokumen produk

- **[GDD](initiate-file/cerdas-amat-gdd.md)** — aturan main, alur layar, tampilan arena, audio.
- **[PRD Teknis](initiate-file/cerdas-amat-prd.md)** — keputusan produk, arsitektur, protokol pesan, kuota, rencana 6 fase.
- **[Preview karakter](initiate-file/karakter-cerdas-amat.html)** — prototipe HTML yang disetujui: data voxel 5 karakter, 5 animasi, uji arena di layar 360 px.

## Process & Planning

- **[Backlog](backlog.md)** — bugs/ideas not yet ticketed.
- **[Planning](planning/index.md)** — active implementation plans.
- **[Decision Log](decision-log.md)** — technical decisions & non-obvious trade-offs.

---

*Feature docs live in `docs/features/`. Unimplemented items live in `docs/backlog.md`; active plans in `docs/planning/`.*
