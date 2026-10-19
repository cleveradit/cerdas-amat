# Workflow Documentation Template

**[English](#english) | [Bahasa Indonesia](#bahasa-indonesia)**

---

## English

A template repository for a Claude Code–based documentation workflow. Designed so a new project can simply "Use this template" and get a ready-to-use `docs/` structure + `CLAUDE.md` — no manual setup.

**Good for:** solo projects or small teams that want an AI agent to work with structured context, recorded decisions, and clean implementation plans.

### Contents

- [Language](#language)
- [Usage — new project](#usage--new-project)
- [Usage — existing project](#usage--existing-project)
- [Using an agent other than Claude Code](#using-an-agent-other-than-claude-code)
- [Initialization checklist](#initialization-checklist)
- [Daily workflow](#daily-workflow)
- [Folder structure](#folder-structure)
- [Prerequisites](#prerequisites)

### Language

All template files are written in English. The language of the documents the agent writes (tickets, backlog, decision log, feature docs) is set by the **Documentation language** field at the top of `docs/ai-context.md`. If the field is empty, the agent asks you which language to use when it first writes docs, then fills it in — so the choice is versioned in git and every machine/session uses the same language.

This template assumes you already use an AI agent. Let your agent handle the setup — including asking about the documentation language — when you apply this workflow to a project.

### Usage — new project

**1. Create a repo from the template**

1. Open this template repo on GitHub.
2. Click the green **"Use this template"** button → choose **"Create a new repository"**.
3. Fill in the repo name, description, and visibility (public/private).
4. Click **"Create repository"**.

**2. Clone and start filling in**

```bash
git clone git@github.com:<username>/<project-name>.git
cd <project-name>
```

**3. Fill in the template files**

Follow the [initialization checklist](#initialization-checklist) below.

### Usage — existing project

If you already have a running project and want to add this workflow:

**1. Copy the template files**

```bash
# From the template folder (this repo)
cp -i CLAUDE.md /path/to/your-project/
mkdir -p /path/to/your-project/docs
cp -rn docs/. /path/to/your-project/docs/
```

> **Warning — `CLAUDE.md`:** if your project already has a `CLAUDE.md`, copying will **overwrite** it. `cp -i` asks for confirmation first; answer `n` and merge manually instead — add the `@docs/ai-context.md` line and the `## Active Work` section to your existing `CLAUDE.md`.
>
> **`docs/`:** `cp -rn` copies the folder contents without creating a nested `docs/docs/` and does **not** overwrite files that already exist (e.g. your own `docs/index.md`). Review any skipped files and merge them manually if needed.

**2. Optional: take only part of it**

Planning workflow only:

```bash
mkdir -p /path/to/your-project/docs/planning
cp -rn docs/planning/. /path/to/your-project/docs/planning/
cp -n docs/backlog.md docs/decision-log.md /path/to/your-project/docs/
```

`ai-context.md` only, as a mandate template:

```bash
mkdir -p /path/to/your-project/docs
cp -n docs/ai-context.md /path/to/your-project/docs/
```

**3. Commit and start filling in**

```bash
cd /path/to/your-project
git add CLAUDE.md docs/
git commit -m "docs: add workflow documentation structure"
```

Then follow the [initialization checklist](#initialization-checklist).

### Using an agent other than Claude Code

For other agents (Codex, Cursor, Gemini CLI, etc.):

1. Rename `CLAUDE.md` to `AGENTS.md`.
2. Change line 1 from `# [Project Name] — Claude Code Context` to `# [Project Name] — Agent Context`.

### Initialization checklist

Once the template is in place, fill in the core files below for your project. The last two are optional. Suggested order:

**1. `CLAUDE.md` — set the project name**

```markdown
# Project Name — Claude Code Context
```

Replace `[Project Name]` with your project's name. Leave the links to `docs/` as they are — they are already generic.

**2. `docs/ai-context.md` — documentation language + the first 4 sections**

- **Documentation language** at the top: fill it in yourself, or leave it empty and the agent will ask you.
- Only the top 4 sections are required; section 5 (Documentation Workflow) is already complete and does not need changes:

| Section | What to fill in |
|---|---|
| 1. Tech Stack | Languages, frameworks, database, version constraints |
| 2. Architecture Mandates | Absolute architecture rules (e.g. "all domain logic in `internal/`") |
| 3. Rules | Technical rules for the AI agent (e.g. naming conventions, error handling) |
| 4. Local Dev Environment | How to start, rebuild, clear caches, prerequisites |

Each section has a `<!-- FILL IN -->` placeholder with example sentences as guidance.

> **Tip:** Sections 1–4 can be filled in gradually. Start with Tech Stack (5 minutes), then add Rules as you go.

**3. `docs/index.md` — project identity**

Replace `[Project Name]`, `[project name]`, and the **Stack** line with your project's information. Re-check the hub links after filling in the other docs.

**4. `docs/architecture.md` — architecture map**

Use the provided template to describe components, code locations, dependencies, main flows, and integrations. Remove example rows that do not apply.

**5. `docs/data-model.md` — data model**

Use the provided template to record data storage, entities/tables, key fields, and relations. If the project has no persistent data, state that this section does not apply and why.

**6. `docs/backlog.md` — optional, can stay empty for now**

The backlog item format is already in the file. Not required at the start.

**7. `docs/decision-log.md` — optional, can stay empty for now**

The entry format is already in the file. Fill it in when the first technical decision comes up.

**Files you do NOT need to fill in at the start**

- `docs/planning/` — fills up as you create planning tickets with the AI agent.
- `docs/features/` — fills up as features are completed.

### Daily workflow

Once the template is initialized, this is the daily flow with Claude Code:

**Start a new session**

Open Claude Code in the project folder. Claude reads `CLAUDE.md` → `docs/ai-context.md` automatically. All mandates, architecture, and rules are active right away.

**Add an idea / bug → backlog**

```
"Add to backlog: the logout button doesn't show on mobile.
Status BLOCKED, waiting for the UI/UX design."
```

Claude adds it to `docs/backlog.md`.

**Work on something → planning ticket**

```
"Create a planning ticket for the dark mode feature."
```

Claude creates `docs/planning/TICKET-001-dark-mode.md` from `_template-implementation-plan.md` and registers it in `docs/planning/index.md`. You review and approve it (status becomes `READY`), then ask Claude to execute it.

**Feature done → feature doc**

```
"Dark mode is live. Write its feature doc."
```

Claude writes `docs/features/dark-mode.md` and registers it in `docs/features/index.md`.

**Technical decision → decision log**

```
"Record in the decision log: we use JWT instead of sessions because we have a mobile app."
```

Claude adds an entry to `docs/decision-log.md`.

**Ticket done → archive**

Once a ticket is `DONE`, Claude moves its file to `docs/planning/Ticket-Implemented/` and removes its entry from `docs/planning/index.md`.

**Save session progress**

```
"Update current-session with today's progress."
```

`docs/planning/current-session.md` is only updated when you ask for it explicitly.

### Folder structure

```
.
├── CLAUDE.md                           # Entry point — read by Claude every session
├── README.md                           # This file
└── docs/
    ├── ai-context.md                   # Mandates & absolute rules (MUST be filled in)
    ├── index.md                        # Documentation hub
    ├── backlog.md                      # Ideas/bugs not yet ticketed
    ├── decision-log.md                 # Technical decisions & trade-offs
    ├── architecture.md                 # Module/component map
    ├── data-model.md                   # Data structures
    ├── features/
    │   ├── index.md                    # Feature index
    │   └── *.md                        # One doc per feature (grows over time)
    └── planning/
        ├── index.md                    # Active ticket index
        ├── current-session.md          # Last session progress (updated on request)
        ├── _template-implementation-plan.md   # Template for new tickets
        └── Ticket-Implemented/         # Archive of DONE tickets
```

### Prerequisites

This template assumes you use **Claude Code** as the AI agent (see [Using an agent other than Claude Code](#using-an-agent-other-than-claude-code) for others). It has no dependency on any specific language/framework — sections 1–4 of your `ai-context.md` define the stack.

If you haven't installed Claude Code yet: [official documentation](https://code.claude.com/docs/en/overview).

---

## Bahasa Indonesia

Template repository untuk workflow dokumentasi berbasis Claude Code. Dirancang agar project baru bisa langsung "Use this template" dan mendapat struktur `docs/` + `CLAUDE.md` yang siap pakai — tanpa setup manual.

**Cocok untuk:** project solo maupun tim kecil yang ingin AI agent bekerja dengan konteks terstruktur, keputusan tercatat, dan rencana implementasi yang rapi.

### Daftar isi

- [Bahasa](#bahasa)
- [Cara pakai — project baru](#cara-pakai--project-baru)
- [Cara pakai — project sudah berjalan](#cara-pakai--project-sudah-berjalan)
- [Memakai agent selain Claude Code](#memakai-agent-selain-claude-code)
- [Checklist inisialisasi](#checklist-inisialisasi)
- [Workflow sehari-hari](#workflow-sehari-hari)
- [Struktur folder](#struktur-folder)
- [Prasyarat](#prasyarat)

### Bahasa

Semua file template ditulis dalam bahasa Inggris. Bahasa dokumen yang ditulis agent (ticket, backlog, decision log, feature doc) diatur lewat field **Documentation language** di bagian atas `docs/ai-context.md`. Jika field itu kosong, agent akan menanyakan bahasa yang ingin dipakai saat pertama kali menulis dokumen, lalu mengisinya — sehingga pilihan itu tersimpan di git dan setiap PC/sesi memakai bahasa yang sama.

Template ini mengasumsikan kamu sudah memakai AI agent. Biarkan agent-mu yang menangani setup — termasuk menanyakan bahasa dokumentasi — saat workflow ini diterapkan ke project.

### Cara pakai — project baru

**1. Buat repo dari template**

1. Buka repo template ini di GitHub.
2. Klik tombol hijau **"Use this template"** → pilih **"Create a new repository"**.
3. Isi nama repo, deskripsi, dan visibilitas (public/private).
4. Klik **"Create repository"**.

**2. Clone dan mulai isi**

```bash
git clone git@github.com:<username>/<project-name>.git
cd <project-name>
```

**3. Isi file template**

Ikuti [checklist inisialisasi](#checklist-inisialisasi) di bawah.

### Cara pakai — project sudah berjalan

Kalau kamu sudah punya project yang sedang berjalan dan ingin menambahkan workflow ini:

**1. Salin file template**

```bash
# Dari folder template (repo ini)
cp -i CLAUDE.md /path/ke/project-mu/
mkdir -p /path/ke/project-mu/docs
cp -rn docs/. /path/ke/project-mu/docs/
```

> **Peringatan — `CLAUDE.md`:** kalau project-mu sudah punya `CLAUDE.md`, perintah salin akan **menimpanya**. `cp -i` akan meminta konfirmasi dulu; jawab `n` lalu gabungkan secara manual — tambahkan baris `@docs/ai-context.md` dan section `## Active Work` ke `CLAUDE.md` milikmu.
>
> **`docs/`:** `cp -rn` menyalin isi folder tanpa membuat `docs/docs/` bersarang dan **tidak** menimpa file yang sudah ada (misalnya `docs/index.md` milikmu). Periksa file yang dilewati dan gabungkan manual jika perlu.

**2. Opsional: ambil hanya sebagian**

Hanya workflow planning:

```bash
mkdir -p /path/ke/project-mu/docs/planning
cp -rn docs/planning/. /path/ke/project-mu/docs/planning/
cp -n docs/backlog.md docs/decision-log.md /path/ke/project-mu/docs/
```

Hanya `ai-context.md` sebagai template mandat:

```bash
mkdir -p /path/ke/project-mu/docs
cp -n docs/ai-context.md /path/ke/project-mu/docs/
```

**3. Commit dan mulai isi**

```bash
cd /path/ke/project-mu
git add CLAUDE.md docs/
git commit -m "docs: add workflow documentation structure"
```

Lalu ikuti [checklist inisialisasi](#checklist-inisialisasi).

### Memakai agent selain Claude Code

Untuk agent lain (Codex, Cursor, Gemini CLI, dll.):

1. Ganti nama `CLAUDE.md` menjadi `AGENTS.md`.
2. Ubah baris 1 dari `# [Project Name] — Claude Code Context` menjadi `# [Project Name] — Agent Context`.

### Checklist inisialisasi

Setelah template terpasang, isi file inti berikut sesuai project-mu. Dua file terakhir bersifat opsional. Urutan yang disarankan:

**1. `CLAUDE.md` — ganti nama project**

```markdown
# Nama Project — Claude Code Context
```

Ganti `[Project Name]` dengan nama project-mu. Biarkan link ke `docs/` tetap seperti adanya — itu sudah generik.

**2. `docs/ai-context.md` — bahasa dokumentasi + 4 section pertama**

- **Documentation language** di bagian atas: isi sendiri, atau biarkan kosong dan agent akan menanyakannya.
- Hanya 4 section atas yang wajib diisi; section 5 (Documentation Workflow) sudah lengkap dan tidak perlu diubah:

| Section | Yang harus diisi |
|---|---|
| 1. Tech Stack | Bahasa, framework, database, constraint versi |
| 2. Architecture Mandates | Aturan arsitektur absolut (contoh: "semua logika domain di `internal/`") |
| 3. Rules | Aturan teknis untuk AI agent (contoh: konvensi naming, error handling) |
| 4. Local Dev Environment | Cara start, rebuild, clear cache, prasyarat |

Setiap section sudah punya placeholder `<!-- FILL IN -->` dan contoh kalimat sebagai panduan.

> **Tips:** Section 1–4 bisa diisi bertahap. Mulai dari Tech Stack dulu (5 menit), lalu tambah Rules sambil jalan.

**3. `docs/index.md` — identitas project**

Ganti `[Project Name]`, `[project name]`, dan baris **Stack** dengan informasi project-mu. Periksa kembali tautan di hub ini setelah mengisi dokumen lainnya.

**4. `docs/architecture.md` — peta arsitektur**

Gunakan template yang tersedia untuk menjelaskan komponen, lokasi kode, dependensi, alur utama, dan integrasi. Hapus baris contoh yang tidak berlaku.

**5. `docs/data-model.md` — model data**

Gunakan template yang tersedia untuk mencatat penyimpanan data, entitas/tabel, field penting, dan relasi. Jika project tidak menyimpan data persisten, tulis bahwa bagian ini tidak berlaku beserta alasannya.

**6. `docs/backlog.md` — opsional, bisa dikosongkan dulu**

Format item backlog sudah tersedia di file. Tidak wajib diisi di awal.

**7. `docs/decision-log.md` — opsional, bisa dikosongkan dulu**

Format entry sudah tersedia di file. Isi saat keputusan teknis pertama muncul.

**File yang TIDAK perlu diisi di awal**

- `docs/planning/` — terisi seiring kamu membuat ticket planning dengan AI agent.
- `docs/features/` — terisi seiring fitur selesai dikerjakan.

### Workflow sehari-hari

Setelah template terinisialisasi, ini alur kerja harian dengan Claude Code:

**Mulai sesi baru**

Buka Claude Code di folder project. Claude akan membaca `CLAUDE.md` → `docs/ai-context.md` secara otomatis. Semua mandat, arsitektur, dan rules langsung aktif.

**Tambah ide / bug → backlog**

```
"Tambahin ke backlog: tombol logout gak muncul di mobile.
Status BLOCKED karena nunggu desain dari UI/UX."
```

Claude akan menambahkannya ke `docs/backlog.md`.

**Kerjakan sesuatu → planning ticket**

```
"Bikin planning ticket untuk fitur dark mode."
```

Claude akan membuat `docs/planning/TICKET-001-dark-mode.md` dari `_template-implementation-plan.md`, lalu mendaftarkannya di `docs/planning/index.md`. Kamu review dan approve (status jadi `READY`), lalu minta Claude mengeksekusinya.

**Fitur selesai → feature doc**

```
"Fitur dark mode sudah live. Bikin feature doc-nya."
```

Claude akan menulis `docs/features/dark-mode.md` dan mendaftarkannya di `docs/features/index.md`.

**Keputusan teknis → decision log**

```
"Catat di decision log: kita pakai JWT instead of session karena ada mobile app."
```

Claude akan menambah entry ke `docs/decision-log.md`.

**Ticket selesai → arsip**

Setelah ticket `DONE`, Claude akan memindahkan file-nya ke `docs/planning/Ticket-Implemented/` dan menghapus entrinya dari `docs/planning/index.md`.

**Simpan progress sesi**

```
"Update current-session dengan progress hari ini."
```

`docs/planning/current-session.md` hanya diperbarui saat kamu memintanya secara eksplisit.

### Struktur folder

```
.
├── CLAUDE.md                           # Entry point — dibaca Claude setiap sesi
├── README.md                           # File ini
└── docs/
    ├── ai-context.md                   # Mandat & aturan absolut (WAJIB diisi)
    ├── index.md                        # Hub dokumentasi
    ├── backlog.md                      # Ide/bug yang belum jadi ticket
    ├── decision-log.md                 # Keputusan teknis & trade-off
    ├── architecture.md                 # Peta modul/komponen
    ├── data-model.md                   # Struktur data
    ├── features/
    │   ├── index.md                    # Indeks fitur
    │   └── *.md                        # Doc per fitur (terisi seiring waktu)
    └── planning/
        ├── index.md                    # Indeks ticket aktif
        ├── current-session.md          # Progress sesi terakhir (diperbarui atas permintaan)
        ├── _template-implementation-plan.md   # Template bikin ticket baru
        └── Ticket-Implemented/         # Arsip ticket yang sudah DONE
```

### Prasyarat

Template ini mengasumsikan kamu menggunakan **Claude Code** sebagai AI agent (lihat [Memakai agent selain Claude Code](#memakai-agent-selain-claude-code) untuk agent lain). Tidak ada dependency pada bahasa/framework tertentu — section 1–4 `ai-context.md` milikmu yang menentukan stack.

Kalau belum install Claude Code: [dokumentasi resmi](https://code.claude.com/docs/en/overview).
