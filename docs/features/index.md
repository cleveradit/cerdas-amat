# Feature Docs — Index

Table of contents for all feature docs. Template and writing conventions: see [ai-context.md §5 Step 3](../ai-context.md#5-documentation-workflow).

For a full understanding, start with [architecture.md](../architecture.md) and [data-model.md](../data-model.md) first.

<!-- ADD ONE ROW PER FEATURE to the table below. Format:
| [file-name](file-name.md) | Short description (1 sentence) | `path/to/file` |
-->

| Doc | Description | Key files |
|---|---|---|
| [room-lobby](room-lobby.md) | Buat/join room, lobby, token kursi, reconnect, pergantian host | `apps/worker/src/room.ts`, `packages/shared/src/protocol.ts`, `apps/client/src/net/roomClient.ts` |
| [gameplay](gameplay.md) | Mulai, soal, tali, timer, jeda, WO, hasil, kembali ke room | `apps/worker/src/room.ts`, `packages/shared/src/deck.ts`, `apps/client/src/screens/Permainan.svelte` |
| [visual](visual.md) | Karakter voxel, renderer bersama, arena 3D, pose hasil, tema UI | `apps/client/src/three/stage.ts`, `apps/client/src/characters/index.ts`, `apps/client/src/styles/theme.css` |
