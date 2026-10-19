<script lang="ts">
  import {
    CLOSE_ROOM_NOT_FOUND,
    normalizeRoomCode,
    type Duration,
    type RoomSnapshot,
    type SeatIndex,
  } from '@cerdas-amat/shared';
  import { onDestroy } from 'svelte';
  import { id } from './i18n/id';
  import { clearToken, loadProfile, loadToken, saveProfile, saveToken } from './lib/storage';
  import { RoomClient, type ConnectionStatus } from './net/roomClient';
  import Lobby from './screens/Lobby.svelte';
  import MenuUtama from './screens/MenuUtama.svelte';
  import ModalPlay from './screens/ModalPlay.svelte';
  import PilihKarakter from './screens/PilihKarakter.svelte';

  type Screen = 'menu' | 'karakter' | 'lobby';

  let profile = $state(loadProfile());
  let screen = $state<Screen>('menu');
  let characterBack = $state<'menu' | 'lobby'>('menu');
  let playOpen = $state(false);
  let pending = $state(false);
  let error = $state<string | null>(null);
  let room = $state<RoomSnapshot | null>(null);
  let mySeat = $state<SeatIndex>(0);
  let status = $state<ConnectionStatus>('closed');

  const linkCode = normalizeRoomCode(new URLSearchParams(location.search).get('room') ?? '');
  let code = '';

  const client = new RoomClient();
  onDestroy(() => client.destroy());

  client.onOpen = () => {
    client.send({
      type: 'hello',
      token: loadToken(code) ?? undefined,
      name: profile.name,
      character: profile.character,
    });
  };
  client.onStatus = (s, closeCode) => {
    status = s;
    if (s !== 'closed') return;
    if (closeCode === CLOSE_ROOM_NOT_FOUND) clearToken(code);
    pending = false;
    if (screen === 'lobby') exitRoom();
  };
  client.onMessage = (msg) => {
    switch (msg.type) {
      case 'welcome':
        saveToken(code, msg.token);
        room = msg.room;
        mySeat = msg.seat;
        pending = false;
        playOpen = false;
        error = null;
        screen = 'lobby';
        history.replaceState(null, '', `?room=${code}`);
        break;
      case 'room':
        room = msg.room;
        mySeat = msg.seat;
        break;
      case 'error':
        error = id.errors[msg.code];
        if (pending && (msg.code === 'ROOM_FULL' || msg.code === 'ROOM_NOT_FOUND')) {
          clearToken(code);
        }
        break;
    }
  };

  function enterRoom(roomCode: string) {
    code = roomCode;
    pending = true;
    error = null;
    client.connect(roomCode);
  }

  async function createRoom() {
    pending = true;
    error = null;
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { code: string };
      enterRoom(body.code);
    } catch {
      pending = false;
      error = id.errors.createFailed;
    }
  }

  function exitRoom() {
    client.close();
    room = null;
    screen = 'menu';
    history.replaceState(null, '', location.pathname);
  }

  function leave() {
    client.send({ type: 'leave' });
    clearToken(code);
    error = null;
    exitRoom();
  }

  function changeProfile(next: typeof profile) {
    profile = next;
    saveProfile(next);
    if (room) client.send({ type: 'setProfile', name: next.name, character: next.character });
  }

  function openCharacter(from: 'menu' | 'lobby') {
    characterBack = from;
    screen = 'karakter';
  }

  // Link `?room=KODE`: masuk langsung jika kursi di room itu masih tersimpan, jika tidak buka Join.
  if (linkCode) {
    if (loadToken(linkCode)) enterRoom(linkCode);
    else playOpen = true;
  }
</script>

<main>
  {#if screen === 'menu'}
    <MenuUtama
      onPlay={() => {
        error = null;
        playOpen = true;
      }}
      onCharacter={() => openCharacter('menu')}
    />
  {:else if screen === 'karakter'}
    <PilihKarakter
      {profile}
      onChange={changeProfile}
      onBack={() => (screen = characterBack === 'lobby' && room ? 'lobby' : 'menu')}
    />
  {:else if screen === 'lobby' && room}
    <Lobby
      {room}
      {mySeat}
      {status}
      {error}
      onDuration={(sec: Duration) => client.send({ type: 'setDuration', sec })}
      onCharacter={() => openCharacter('lobby')}
      onLeave={leave}
    />
  {/if}

  {#if playOpen && screen === 'menu'}
    <ModalPlay
      initialCode={linkCode ?? ''}
      {pending}
      {error}
      onCreate={createRoom}
      onJoin={enterRoom}
      onClose={() => {
        client.close();
        pending = false;
        playOpen = false;
      }}
    />
  {/if}
</main>

<style>
  main {
    min-height: 100dvh;
    max-width: 420px;
    margin: 0 auto;
    padding: 16px;
    font-family: system-ui, sans-serif;
  }
  :global(.screen) {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  :global(.slots) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  :global(.slot) {
    border: 2px solid #ccd;
    border-radius: 12px;
    padding: 8px;
  }
  :global(.slot.me) {
    border-color: #2f6fd0;
  }
  :global(.slot p) {
    margin: 2px 0;
  }
  :global(.muted) {
    color: #667;
  }
  :global(.error) {
    color: #c22;
  }
  :global(.code) {
    font-size: 1.5em;
    letter-spacing: 0.1em;
  }
  :global(.backdrop) {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.4);
    padding: 16px;
  }
  :global(.modal) {
    background: #fff;
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(100%, 360px);
  }
  :global(.modal form),
  :global(.row) {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  :global(.avatars) {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  :global(button[aria-pressed='true']) {
    outline: 3px solid #2f6fd0;
  }
</style>
