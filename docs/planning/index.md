# Implementation Plan Index

Use this file to orchestrate active ticket plans with clear order and dependency.

Status meanings (`DRAFT` / `REVIEW` / `READY` / `DONE`): see [ai-context.md §5 Step 2](../ai-context.md#5-documentation-workflow).

## Execution Order

| No | Ticket | Status | Depends On |
|---|---|---|---|
| 1 | [TICKET-001 — Fondasi monorepo, Worker, dan CI/CD](TICKET-001-fondasi.md) | `READY` | — |

Completed tickets are moved to `Ticket-Implemented/`.

## Global Agent Rules

1. Only execute a ticket the user explicitly asks for, and only if its status is `READY`.
2. Read each ticket's `Business Decision Snapshot` before any code change.
3. Follow each ticket's `Non-Negotiable Technical Contract` exactly.
4. Stop and report if a dependency ticket is incomplete or inconsistent.
