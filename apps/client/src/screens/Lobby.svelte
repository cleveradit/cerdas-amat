<script lang="ts">
  import { DURATIONS, type Duration, type RoomSnapshot, type SeatIndex } from '@cerdas-amat/shared';
  import { id } from '../i18n/id';
  import { stage } from '../lib/stage.svelte';
  import type { ConnectionStatus } from '../net/roomClient';

  let {
    room,
    mySeat,
    status,
    error,
    onDuration,
    onStart,
    onCharacter,
    onLeave,
  }: {
    room: RoomSnapshot;
    mySeat: SeatIndex;
    status: ConnectionStatus;
    error: string | null;
    onDuration: (sec: Duration) => void;
    onStart: () => void;
    onCharacter: () => void;
    onLeave: () => void;
  } = $props();

  const isHost = $derived(mySeat === 0);
  const canStart = $derived(room.seats.every((s) => s !== null && s.connected && s.inLobby));
</script>

<section class="screen">
  <div class="card code-card">
    <p class="field-label">{id.lobby.code}</p>
    <strong class="code">{room.code}</strong>
  </div>
  {#if status !== 'open'}<p class="muted" role="status">{id.lobby.reconnecting}</p>{/if}

  <div class="slots">
    {#each [0, 1] as const as i (i)}
      {@const seat = room.seats[i]}
      <div class="slot" class:me={i === mySeat} class:host={i === 0} class:p2={i === 1}>
        <p class="role">{i === 0 ? id.lobby.host : id.lobby.player2}</p>
        {#if seat}
          <div class="avatar">
            {#if stage.current}
              <img src={stage.current.avatars[seat.character]} alt="" data-testid="slot-avatar" />
            {/if}
          </div>
          <p class="name">
            <strong>{seat.name}</strong>
            {#if i === mySeat}<span class="muted">{id.lobby.you}</span>{/if}
          </p>
          <p class="muted">{id.character.names[seat.character]}</p>
          {#if !seat.inLobby}
            <p class="muted">{id.lobby.viewingResult}</p>
          {:else if !seat.connected}
            <p class="muted">{id.lobby.disconnected}</p>
          {/if}
        {:else}
          <div class="avatar empty"></div>
          <p class="muted">{id.lobby.waiting}</p>
        {/if}
      </div>
    {/each}
  </div>

  <div class="row duration">
    <label class="field-label" for="duration">{id.lobby.duration}</label>
    {#if isHost}
      <select
        id="duration"
        value={room.durationSec}
        onchange={(e) => onDuration(Number(e.currentTarget.value) as Duration)}
      >
        {#each DURATIONS as d (d)}
          <option value={d}>{id.lobby.seconds(d)}</option>
        {/each}
      </select>
    {:else}
      <p id="duration"><strong>{id.lobby.seconds(room.durationSec)}</strong></p>
    {/if}
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if isHost}
    <button type="button" class="primary" disabled={!canStart} onclick={onStart}
      >{id.lobby.start}</button
    >
  {:else}
    <p class="muted waiting">{id.lobby.waitingHost}</p>
  {/if}

  <button type="button" onclick={onCharacter}>{id.lobby.changeCharacter}</button>
  <button type="button" class="link" onclick={onLeave}>{id.lobby.leave}</button>
</section>

<style>
  .code-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--sun-soft);
  }
  .code {
    font-family: var(--display);
    font-weight: 400;
    font-size: 40px;
    line-height: 1.1;
    letter-spacing: 0.15em;
    padding-left: 0.15em;
  }
  .slots {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: 0 8px 10px;
    border: var(--border);
    border-radius: 16px;
    background: var(--panel);
    text-align: center;
    overflow: hidden;
  }
  .slot.me {
    box-shadow: var(--shadow);
  }
  .role {
    align-self: stretch;
    margin: 0 -8px 4px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--on-accent);
    border-bottom: var(--border);
  }
  .host .role {
    background: var(--host);
  }
  .p2 .role {
    background: var(--p2);
  }
  .avatar {
    width: 96px;
    height: 96px;
    border-radius: 14px;
    background: var(--sky-2);
  }
  .avatar img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .avatar.empty {
    border: 3px dashed var(--line);
  }
  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .slot p {
    font-size: 14px;
  }
  .duration {
    align-items: center;
    justify-content: space-between;
  }
  .duration select {
    flex: 0 1 auto;
  }
  .waiting {
    text-align: center;
  }
</style>
