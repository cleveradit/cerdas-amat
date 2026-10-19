<script lang="ts">
  import { DURATIONS, type Duration, type RoomSnapshot, type SeatIndex } from '@cerdas-amat/shared';
  import { id } from '../i18n/id';
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
  <p>{id.lobby.code}: <strong class="code">{room.code}</strong></p>
  {#if status !== 'open'}<p role="status">{id.lobby.reconnecting}</p>{/if}

  <div class="slots">
    {#each [0, 1] as const as i (i)}
      {@const seat = room.seats[i]}
      <div class="slot" class:me={i === mySeat}>
        <p class="role">{i === 0 ? id.lobby.host : id.lobby.player2}</p>
        {#if seat}
          <p>
            <strong>{seat.name}</strong>
            {#if i === mySeat}{id.lobby.you}{/if}
          </p>
          <p>{id.character.names[seat.character]}</p>
          {#if !seat.inLobby}
            <p class="muted">{id.lobby.viewingResult}</p>
          {:else if !seat.connected}
            <p class="muted">{id.lobby.disconnected}</p>
          {/if}
        {:else}
          <p class="muted">{id.lobby.waiting}</p>
        {/if}
      </div>
    {/each}
  </div>

  <label for="duration">{id.lobby.duration}</label>
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
    <p id="duration">{id.lobby.seconds(room.durationSec)}</p>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if isHost}
    <button type="button" disabled={!canStart} onclick={onStart}>{id.lobby.start}</button>
  {:else}
    <p class="muted">{id.lobby.waitingHost}</p>
  {/if}

  <button type="button" onclick={onCharacter}>{id.lobby.changeCharacter}</button>
  <button type="button" onclick={onLeave}>{id.lobby.leave}</button>
</section>
