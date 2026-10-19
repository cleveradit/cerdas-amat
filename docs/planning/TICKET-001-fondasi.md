# Implementation Plan: TICKET-001 (Fondasi monorepo, Worker, dan CI/CD)

**Ticket:** `TICKET-001`  
**Status:** `READY`  
**Target Audience:** AI Developer Agents  
**Depends On:** `None`

---

## 1. Business Decision Snapshot (Approved)

| Item | Approved Value |
|---|---|
| Lingkup | Fase 1 PRD: monorepo, Worker + stub Durable Object, client kosong, CI/CD preview dan produksi |
| Syarat lolos | Merge ke `main` otomatis mendeploy halaman kosong ke `https://cerdas-amat.radlabs.my.id` |
| Runtime & package manager | Node.js 22 (`.nvmrc`), pnpm `12.14.0` lewat field `packageManager` (Corepack) |
| Kunci versi utama | `wrangler ^4.151.1`, `vite ^8.3.4`, `svelte ^5.57.2`, `@sveltejs/vite-plugin-svelte ^7.3.1`, `valibot ^1.5.0`, `three ^0.186.1` (dipasang di Fase 4, bukan sekarang) |
| Tes Worker | `@cloudflare/vitest-plugin ^1.4.4` + `vitest ^5.0.5` (`@cloudflare/vitest-pool-workers` deprecated sejak Agustus 2026 dan diganti paket ini) |
| Batas versi karena peer dependency | `typescript ^6.0.3` (`svelte-check 4.7.7` belum mendukung TypeScript 7) |
| Cara dev lokal | Dua proses: `wrangler dev` (port 8787) + Vite dev server (port 5173) dengan proxy `/api` dan `/ws` (termasuk WebSocket) ke 8787. Tidak memakai `@cloudflare/vite-plugin`, supaya `wrangler.jsonc` tetap di `apps/worker` sesuai PRD |
| Durable Object di Fase 1 | Class `Room` stub diekspor dan didaftarkan dengan migration `v1` (`new_sqlite_classes`) sekarang, untuk membuktikan Durable Object SQLite bisa dideploy di plan gratis |
| Rate Limiting | Binding `CREATE_ROOM_LIMIT` (20/60 s) dan `JOIN_LIMIT` (30/60 s) didaftarkan sekarang tanpa dipakai; deploy berhasil = binding tersedia di plan gratis. Gagal = bindingnya dilepas dan PRD dicatat memakai Durable Object pembatas |
| Endpoint cek | `GET /api/health` → `{ "ok": true }`, dipakai smoke test CI setelah deploy |
| Lint & format | ESLint 10 (flat config) + `typescript-eslint` + `eslint-plugin-svelte`, Prettier + `prettier-plugin-svelte` |
| Preview | Worker terpisah `cerdas-amat-preview` (env `preview` di wrangler) di `workers.dev`, satu untuk semua PR (deploy PR terakhir menimpa sebelumnya) |
| Worker yang sudah dibuat manual di dasbor | Jika bernama `cerdas-amat`, isinya akan ditimpa oleh deploy pertama; tidak perlu dihapus |

Rules:

1. If any required `[FILL]` is missing, status MUST stay `DRAFT`.
2. Agent MUST NOT write production code while status is `DRAFT` or `REVIEW`.
3. Set status to `REVIEW` when the plan is ready for user review.
4. Set status to `READY` only after the user explicitly approves the plan in the chat.

---

## 2. Objective

Membangun kerangka monorepo yang bisa dikembangkan, dites, dan dideploy otomatis, sebelum ada logika permainan. Setelah ticket ini, setiap PR punya preview yang bisa dibuka, dan setiap merge ke `main` langsung tayang di domain produksi. Ticket ini juga menjawab dua pertanyaan plan gratis: apakah Durable Object SQLite dan binding Rate Limiting bisa dideploy.

---

## 3. Non-Negotiable Technical Contract

1. File: `package.json` (root)
   - Change: `"private": true`, `"packageManager": "pnpm@12.14.0"`, `"engines": { "node": ">=22.12" }`; scripts `dev`, `build`, `test`, `lint`, `format`, `typecheck` yang menjalankan script yang sama di semua workspace (`pnpm -r`).
2. File: `pnpm-workspace.yaml`
   - Change: `packages: ["apps/*", "packages/*"]`.
3. File: `.nvmrc`, `.gitignore`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`
   - Change: Node `22`; abaikan `node_modules`, `dist`, `.wrangler`, `.dev.vars`; konfigurasi TypeScript strict bersama.
4. File: `packages/shared/src/index.ts`, `packages/shared/src/roomCode.ts`
   - Change: paket `@cerdas-amat/shared` (ESM, `workspace:*`, diimpor sebagai source TypeScript tanpa build step).
   - Ekspor: ``export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'`` dan ``export const ROOM_CODE_LENGTH = 5``.
5. File: `apps/worker/wrangler.jsonc`
   - Change: sesuai blok konfigurasi PRD (`name: "cerdas-amat"`, `main: "src/index.ts"`, `compatibility_date: "2026-10-01"`, `assets` ke `../client/dist` dengan `not_found_handling: "single-page-application"` dan `run_worker_first: ["/api/*", "/ws/*"]`, binding `ROOM` → `Room`, migration `v1` `new_sqlite_classes: ["Room"]`, route Custom Domain `cerdas-amat.radlabs.my.id`), ditambah `ratelimits` `CREATE_ROOM_LIMIT` dan `JOIN_LIMIT`, serta `observability.enabled: true`.
   - `env.preview`: `workers_dev: true`, tanpa `routes`; binding `durable_objects` dan `ratelimits` diulang di dalam env karena tidak diwariskan.
6. File: `apps/worker/src/index.ts`
   - Method signature: ``export default { fetch(request: Request, env: Env): Promise<Response> }`` dan ``export class Room extends DurableObject<Env>``.
   - Return shape: `GET /api/health` → `200 { "ok": true }`; path lain di `/api/*` dan `/ws/*` → `404 { "error": "NOT_FOUND" }`. `Room` belum punya logika.
7. File: `apps/worker/src/env.d.ts`
   - Change: tipe `Env` dibuat dengan `wrangler types` (berisi `ROOM`, `CREATE_ROOM_LIMIT`, `JOIN_LIMIT`; tanpa binding `ASSETS` karena Worker tidak memanggil aset secara langsung).
8. File: `apps/client/` (`index.html`, `vite.config.ts`, `src/main.ts`, `src/App.svelte`, `src/i18n/id.ts`)
   - Change: Svelte 5 + Vite SPA; `App.svelte` hanya menampilkan judul game dari `id.ts` (Rule 4). `vite.config.ts` mem-proxy `/api` dan `/ws` (`ws: true`) ke `http://localhost:8787`.
9. File: `.github/workflows/ci.yml`
   - Integration point: trigger `pull_request` ke `main`; langkah: checkout → setup pnpm + Node 22 (cache pnpm) → `pnpm install --frozen-lockfile` → `lint` → `typecheck` → `test` → `build` → `cloudflare/wrangler-action` `deploy --env preview` (working directory `apps/worker`) → `curl` ke `/api/health` preview. `concurrency` per workflow agar deploy preview tidak tumpang tindih.
10. File: `.github/workflows/deploy.yml`
    - Integration point: trigger `push` ke `main`; langkah sama dengan CI, lalu `deploy` tanpa env ke produksi dan smoke test `https://cerdas-amat.radlabs.my.id/api/health`. Secret: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
11. File: `docs/ai-context.md` §4
    - Change: setelah ticket `DONE`, isi perintah dev/build/test yang sebenarnya, cara tes 2 pemain (jendela incognito), dan tunnel HTTPS untuk tes di HP.

Rules:

1. No "or relevant file/service" wording.
2. No scope expansion without explicit approval.

---

## 4. Scope of Changes

### A. Monorepo dan tooling

1. Root `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.gitignore`, TypeScript, ESLint, Prettier.
2. `pnpm install` menghasilkan `pnpm-lock.yaml` yang di-commit.

### B. Shared

1. Paket `@cerdas-amat/shared` dengan konstanta kode room dan unit test-nya.

### C. Worker

1. `wrangler.jsonc` (produksi + env `preview`), `src/index.ts` dengan `GET /api/health` dan stub `Room`.
2. Tes `@cloudflare/vitest-plugin` untuk `/api/health` dan 404.
3. Script `build` = `wrangler deploy --dry-run --env=""` untuk memvalidasi konfigurasi dan bundel; deploy produksi memakai `--env=""` secara eksplisit.

### D. Client

1. Halaman kosong Svelte dengan judul game; proxy dev ke Worker.

### E. CI/CD

1. `ci.yml` (PR → preview) dan `deploy.yml` (`main` → produksi), masing-masing dengan smoke test.

### F. Verifikasi plan gratis

1. Deploy pertama memastikan Durable Object SQLite dan binding Rate Limiting diterima.
2. Catat angka kuota Durable Objects dari dasbor; perbarui tabel kuota di PRD jika berbeda.

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| Health check | `GET /api/health` | `200`, body `{ "ok": true }` | `[x]` |
| Path API tidak dikenal (failure) | `GET /api/tidak-ada` | `404`, body `{ "error": "NOT_FOUND" }` | `[x]` |
| SPA fallback (boundary) | `GET /lobby/apa-saja` | `200`, isi `index.html` client, bukan 404 Worker | `[x]` |
| Alfabet kode room | `ROOM_CODE_ALPHABET` | 31 karakter unik, tanpa `0`, `O`, `1`, `I`, `L` | `[x]` |
| Dev lokal | `pnpm dev`, buka `http://localhost:5173`, lalu `/api/health` lewat proxy | Halaman judul tampil; health `200` | `[x]` |
| PR preview | Buka PR ke `main` | CI hijau; `https://cerdas-amat-preview.<akun>.workers.dev/api/health` → `200` | `[ ]` |
| CI gagal (failure) | PR dengan error lint atau tes gagal | Workflow merah, langkah deploy tidak berjalan | `[ ]` |
| Produksi | Merge ke `main` | `https://cerdas-amat.radlabs.my.id` menampilkan halaman judul dengan HTTPS valid | `[ ]` |

---

## 6. Verification Commands

1. `pnpm install --frozen-lockfile`
2. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
3. `pnpm dev` lalu `curl -s http://localhost:5173/api/health`
4. `curl -s https://cerdas-amat.radlabs.my.id/api/health`

Expected:

1. Semua perintah exit 0.
2. Kedua `curl` mengembalikan `{"ok":true}`.

---

## 7. Out of Scope

1. Logika room, protokol WebSocket, dan semua isi Durable Object `Room` (Fase 2).
2. Pemakaian binding Rate Limiting di kode dan cek Origin WebSocket (Fase 2/5).
3. Three.js, PWA, audio, dan font (Fase 4/5).
4. Playwright (dipasang di Fase 3, saat ada alur yang bisa dites end-to-end).
5. Branch protection GitHub dan pengaturan DNS (dikerjakan user di dasbor).

---

## 8. Completion Checklist

- [ ] Section 1 fully filled and status set correctly.
- [ ] All Non-Negotiable Technical Contract items implemented.
- [ ] Acceptance Test Matrix completed.
- [ ] Verification commands executed successfully.
- [ ] No out-of-scope changes introduced.
