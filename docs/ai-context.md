# AI Context & Development Mandates

All AI agents MUST read and follow these rules before proposing or implementing any changes.

> **Orientation (understand the project without reading code):** read in order — this document (mandates) → [architecture.md](architecture.md) (module map) → [data-model.md](data-model.md) (data structures) → [features/index.md](features/index.md) (per-feature details).

**Documentation language:** Indonesian (technical terms stay in English)

**Sumber kebenaran produk:** [GDD](initiate-file/tarik-tambang-matematika-gdd.md) (aturan main, alur layar) dan [PRD Teknis](initiate-file/tarik-tambang-matematika-prd.md) (arsitektur, protokol, kuota, rencana fase), serta [preview karakter yang disetujui](initiate-file/karakter-tarik-tambang.html) (data voxel 5 karakter, animasi, tata letak arena). Keputusan produk di tabel "Keputusan produk" PRD sudah final; mengubahnya butuh persetujuan eksplisit user, lalu ditulis langsung di PRD/GDD dengan menghapus keputusan lama (bukan lewat decision log). Bila GDD dan PRD bertentangan, PRD yang berlaku (GDD ditulis sebelum keputusan teknis).

---

## 1. Tech Stack (STRICT — no deviations)

| Lapisan | Pilihan wajib |
|---|---|
| Bahasa | TypeScript di semua package (client, worker, shared) |
| UI client | Svelte 5 + Vite |
| 3D | Three.js (`InstancedMesh` untuk voxel, satu `WebGLRenderer` bersama) |
| Server | Cloudflare Workers + Durable Objects berbasis SQLite (`new_sqlite_classes`), plan gratis |
| Realtime | WebSocket Hibernation API |
| Validasi pesan | Valibot (skema dipakai bersama client dan server) |
| PWA | vite-plugin-pwa |
| Tes | Vitest, `@cloudflare/vitest-plugin`, Playwright |
| Monorepo | pnpm workspaces |
| Audio | Web Audio API, file MP3, aset berlisensi CC0 |
| Runtime lokal | Node.js 22, pnpm 12 |

Dilarang: database eksternal, sistem akun, layanan pihak ketiga selain Cloudflare (termasuk font CDN — font di-host sendiri), dan framework UI selain Svelte.

---

## 2. Architecture Mandates

1. **Struktur monorepo tetap:** `apps/client/` (Svelte + Three.js), `apps/worker/` (Worker + Durable Object `Room`), `packages/shared/` (tipe pesan, skema Valibot, `makeDeck`, aturan hasil, filter nama, pembuat kode room). Kode yang dipakai client dan server wajib berada di `packages/shared/`.
2. **Server otoritatif:** skor, posisi tali, fase, dan timer hanya diubah oleh Durable Object `Room`. Client hanya mengirim input dan menggambar state yang diterima; tali digerakkan dari `score` pada pesan `tug`, bukan hitungan lokal.
3. **Satu room = satu Durable Object** yang dinamai `idFromName(code)`; tidak ada tabel pencarian room.
4. **Satu Worker** menyajikan aset statis client, `POST /api/rooms`, dan `GET /ws/:code`. Seluruh logika permainan berjalan di Durable Object, bukan di Worker.
5. **Satu alarm per Durable Object:** alarm selalu dipasang ke tenggat terdekat; handler alarm memproses semua tenggat yang sudah lewat lalu memasang alarm berikutnya.
6. **Hemat kuota plan gratis (wajib):** Hibernation API, jawaban salah tidak dikirim ke server, ping dijawab `setWebSocketAutoResponse`, tulis storage maks 1 kali per detik selama bermain, identitas kursi via `serializeAttachment`.

---

## 3. Rules

**Rule 1 — Protokol di shared:** setiap tipe pesan client↔server didefinisikan sekali di `packages/shared` beserta skema Valibot-nya, dan divalidasi di server. Pesan > 1 KB atau tidak valid ditolak; koneksi ditutup setelah 5 pesan tidak valid.

**Rule 2 — Cek fase dan kursi:** setiap handler pesan di `Room` wajib mengecek fase dan kursi pengirim sesuai tabel "Client ke server" di PRD (misalnya `start`/`setDuration` hanya kursi 0).

**Rule 3 — Token tidak bocor:** token kursi dan deck tidak pernah ikut dalam snapshot `room` yang dikirim ke pemain.

**Rule 4 — Semua teks UI di satu file:** teks antarmuka hanya di `apps/client/src/i18n/id.ts`; tidak ada string UI hardcoded di komponen.

**Rule 5 — Tanpa data permanen:** tidak menyimpan data pribadi di luar storage room; room dihapus (`deleteAll`) setelah kosong 5 menit.

**Rule 6 — Logika murni teruji:** fungsi murni di `packages/shared` (`makeDeck`, aturan hasil, filter nama, kode room) wajib punya unit test Vitest; perilaku room wajib punya tes `@cloudflare/vitest-plugin`.

**Rule 7 — Target performa:** `devicePixelRatio` dibatasi 2; arena minimal 30 fps di HP Android kelas bawah. Jangan membuat konteks WebGL kedua.

---

## 4. Local Development Environment

Prasyarat:
- Node.js 22 (`.nvmrc`).
- pnpm 12.14.0 lewat Corepack: `corepack enable` (versi diambil dari field `packageManager`).
- Wrangler terpasang sebagai devDependency `apps/worker`, bukan global.
- Akun Cloudflare plan gratis; secret repo `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` untuk GitHub Actions.

| Perintah (dari root) | Fungsi |
|---|---|
| `pnpm install` | Pasang dependency semua workspace |
| `pnpm dev` | `wrangler dev` (port 8787) + Vite (port 5173); buka `http://localhost:5173`, `/api` dan `/ws` di-proxy ke 8787 |
| `pnpm test` | Vitest di semua workspace; tes Worker jalan di `workerd` lokal |
| `pnpm typecheck` | `tsc` (shared, worker) dan `svelte-check` (client) |
| `pnpm lint` / `pnpm format` | ESLint + cek Prettier / tulis format Prettier |
| `pnpm build` | Build client ke `apps/client/dist`, lalu `wrangler deploy --dry-run` untuk validasi Worker |
| `pnpm --filter @cerdas-amat/worker types` | Regenerasi `apps/worker/src/env.d.ts` setelah mengubah `wrangler.jsonc` |

Catatan:
- Tes 2 pemain di satu komputer: pemain kedua di jendela incognito atau profil browser lain, karena token kursi di localStorage dipakai bersama semua tab.
- Tes di HP lewat HTTPS (PWA, Web Share, clipboard): `cloudflared tunnel --url http://localhost:5173`.
- Data Durable Object lokal disimpan di `apps/worker/.wrangler/`; hapus folder itu untuk mengosongkan state.

Lingkungan deploy:

| Lingkungan | Alamat | Dideploy saat |
|---|---|---|
| Preview | `cerdas-amat-preview.<akun>.workers.dev` | Setiap pull request (`.github/workflows/ci.yml`) |
| Produksi | `cerdas-amat.radlabs.my.id` | Merge ke `main` (`.github/workflows/deploy.yml`) |

---

## 5. Documentation Workflow

**Rule 0 — All documentation/context MUST live in `docs/` (versioned in git), NOT in the AI's local memory.**
Developers switch between machines, and the AI's local memory is not committed, so it is unavailable on other machines. Therefore: decisions, ticket status, analysis results, and any context that must survive across sessions/machines must be written to the appropriate `docs/` file (planning, feature, decision-log, or backlog) — not stored as local memory. AI agents must not rely on local memory as the source of truth for this project.

All documentation is written in the **Documentation language** set at the top of this file.

Never write code without going through this flow first. Do not create `implementation_plan.md` as a standalone artifact — use the official planning files below.

**Step 1 — Backlog (`docs/backlog.md`)**
New bugs/ideas go here without ticket numbers. Status: `OPEN` (ready to be planned) or `BLOCKED`. Remove the item once it becomes a planning ticket.

**Step 2 — Planning (`docs/planning/TICKET-NUMBER-NAME.md`)**
Create the plan before writing any code. Use `docs/planning/_template-implementation-plan.md`. Register in `docs/planning/index.md`. Get explicit user approval before executing.

Status lifecycle: `DRAFT` → `REVIEW` → `READY` → `DONE`.
- `DRAFT`: decisions not locked, execution blocked.
- `REVIEW`: decisions locked, waiting for user manual approval — do NOT execute.
- `READY`: user gave explicit written approval in chat — execution allowed.
- `DONE`: implementation and verification complete.

Each plan must include: Business Decision Snapshot, Non-Negotiable Technical Contract (target files, method signatures, integration points, return shapes), Acceptance Test Matrix (min. 1 boundary + 1 failure case, or `N/A — <reason>` if not relevant), and Out of Scope section.

When a ticket is DONE: move its file to `docs/planning/Ticket-Implemented/`, remove its entry from `docs/planning/index.md` (do not delete the index file itself). Check both locations when numbering new tickets to avoid duplicates.

`docs/planning/current-session.md` is updated only when the user explicitly asks. Do not create or modify it on your own initiative.

**Step 3 — Feature Docs (`docs/features/`)**
Every shipped feature needs a doc here, registered in [`docs/features/index.md`](features/index.md). Use the lean template: `# Title` → `**Status:** Live` → `## Summary` (2–4 sentences) → relevant sections (Quick Reference / catalogs as tables) → `## Gotchas` (non-obvious things only) → `## Related` (links to related docs).

Style rules (mandatory): no decorative emoji in headers; no commit hash/branch/date in Status; no motivational/marketing prose; method/field/column catalogs are always tables; every claim is verified against the actual code (anything unverified is not written); cross-links use standard Markdown links (`[name](name.md)`). Structural docs (module map, data reference) live one level up: `docs/architecture.md` and `docs/data-model.md`.

**Step 4 — Decision Log (`docs/decision-log.md`)**
Record a decision only if it meets at least one criterion:
- A technical gotcha/trap that cannot be derived from reading the code
- A business trade-off with non-obvious consequences
- A correction of a previously wrong assumption or mandate

Do not record: code cleanup, minor UI changes, or anything already documented in `ai-context.md` itself. SUPERSEDED entries must be deleted, not kept. Use the entry format in [`docs/decision-log.md`](decision-log.md).
