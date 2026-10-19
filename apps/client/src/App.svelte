<script lang="ts">
  import {
    CLOSE_ROOM_NOT_FOUND,
    type Character,
    normalizeRoomCode,
    type Duration,
    type Question,
    type Result,
    type RoomSnapshot,
    type SeatIndex,
  } from '@cerdas-amat/shared';
  import { onDestroy, onMount } from 'svelte';
  import {
    playSfx,
    setMusic,
    setVolumes,
    unlockAudio,
    type Music,
    type Volumes,
  } from './audio/audio';
  import { id } from './i18n/id';
  import { initStage } from './lib/stage.svelte';
  import {
    clearToken,
    loadProfile,
    loadToken,
    loadVolumes,
    saveProfile,
    saveToken,
    saveVolumes,
  } from './lib/storage';
  import { RoomClient, type ConnectionStatus } from './net/roomClient';
  import Hasil from './screens/Hasil.svelte';
  import Lobby from './screens/Lobby.svelte';
  import MenuUtama from './screens/MenuUtama.svelte';
  import ModalPengaturan from './screens/ModalPengaturan.svelte';
  import ModalPlay from './screens/ModalPlay.svelte';
  import Permainan from './screens/Permainan.svelte';
  import PilihKarakter from './screens/PilihKarakter.svelte';

  type Screen = 'menu' | 'karakter' | 'lobby';
  interface ShownResult {
    result: Result;
    score: [number, number];
    names: [string, string];
    characters: [Character, Character];
    seat: SeatIndex;
  }

  let profile = $state(loadProfile());
  let screen = $state<Screen>('menu');
  let characterBack = $state<'menu' | 'lobby'>('menu');
  let playOpen = $state(false);
  let settingsOpen = $state(false);
  const savedVolumes = loadVolumes();
  setVolumes(savedVolumes);
  let volumes = $state(savedVolumes);
  let online = $state(navigator.onLine);
  let pending = $state(false);
  let error = $state<string | null>(null);
  // Pesan kuota habis di Menu Utama; bertahan sampai berhasil masuk room.
  let notice = $state<string | null>(null);
  let joinLockedUntil = $state(0);
  let room = $state<RoomSnapshot | null>(null);
  let mySeat = $state<SeatIndex>(0);
  let status = $state<ConnectionStatus>('closed');
  // Deck milik pemain ini (indeks = nomor soal) dan nomor soal yang sedang dijawab.
  let deck = $state<Question[]>([]);
  let myQ = $state(0);
  // Hasil disalin saat pesan `result` tiba, karena nomor kursi bisa bergeser setelahnya.
  let shownResult = $state<ShownResult | null>(null);

  const me = $derived(room?.seats[mySeat] ?? null);
  const inGame = $derived(room !== null && ['countdown', 'playing', 'paused'].includes(room.phase));
  const onResult = $derived(
    room !== null && shownResult !== null && (room.phase === 'result' || me?.inLobby === false),
  );

  // Musik menu di menu, pilih karakter, dan lobby; musik game dari hitung mundur; hening di hasil.
  const music = $derived<Music | null>(
    screen === 'lobby' && room && inGame ? 'game' : screen === 'lobby' && onResult ? null : 'menu',
  );
  $effect(() => setMusic(music));

  const linkCode = normalizeRoomCode(new URLSearchParams(location.search).get('room') ?? '');
  let code = '';

  const client = new RoomClient();
  onDestroy(() => client.destroy());
  onMount(initStage);
  // Aturan autoplay: AudioContext hanya boleh dibuat setelah gestur pertama di halaman.
  onMount(() => {
    const unlock = () => {
      unlockAudio();
      removeEventListener('pointerdown', unlock, true);
      removeEventListener('keydown', unlock, true);
    };
    addEventListener('pointerdown', unlock, true);
    addEventListener('keydown', unlock, true);
    return unlock;
  });

  client.onOpen = () => {
    client.send({
      type: 'hello',
      token: loadToken(code) ?? undefined,
      name: profile.name,
      character: profile.character,
    });
  };
  // Socket gagal terbuka sejak awal: jika Worker sendiri tidak menjawab /api/health,
  // kuota request Worker habis (Cloudflare membalas halaman error, bukan Worker kita).
  client.onFirstOpenFailed = async () => {
    let res: Response;
    try {
      res = await fetch('/api/health');
    } catch {
      return; // jaringan putus, bukan kuota; percobaan ulang tetap berjalan
    }
    if (!res.ok) showQuota();
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
        myQ = msg.room.qIndex[msg.seat];
        syncName(msg.room, msg.seat);
        if (msg.room.result && !shownResult) shownResult = captureResult(msg.room, msg.seat);
        // Kembali setelah hasil sudah tidak tersedia: langsung masuk lobby.
        if (msg.room.phase === 'lobby' && !msg.room.seats[msg.seat]?.inLobby) {
          client.send({ type: 'backToRoom' });
        }
        pending = false;
        playOpen = false;
        error = null;
        notice = null;
        screen = 'lobby';
        history.replaceState(null, '', `?room=${code}`);
        break;
      case 'room':
        room = msg.room;
        mySeat = msg.seat;
        syncName(msg.room, msg.seat);
        break;
      case 'countdown':
        screen = 'lobby'; // tutup layar pilih karakter jika sedang terbuka
        deck = [];
        myQ = 0;
        shownResult = null;
        break;
      case 'deck': {
        const next = deck.slice();
        msg.questions.forEach((q, i) => (next[msg.from + i] = q));
        deck = next;
        break;
      }
      case 'tug':
        if (room) room.score = msg.score;
        playSfx('tug');
        break;
      case 'reject':
        myQ = msg.expected;
        break;
      case 'pause':
        if (room) {
          room.phase = 'paused';
          room.pause = { seat: msg.seat, until: msg.until };
          room.remainingMs = msg.remainingMs;
        }
        break;
      case 'resume':
        if (room) {
          room.phase = 'playing';
          room.endsAt = msg.endsAt;
          room.pause = undefined;
        }
        break;
      case 'result':
        if (room) {
          room.score = msg.score;
          shownResult = captureResult(
            { ...room, result: { winner: msg.winner, reason: msg.reason } },
            mySeat,
          );
        }
        break;
      case 'error':
        error = id.errors[msg.code];
        if (msg.code === 'QUOTA') notice = error;
        if (msg.code === 'RATE_LIMITED') joinLockedUntil = Date.now() + 60_000;
        if (pending && (msg.code === 'ROOM_FULL' || msg.code === 'ROOM_NOT_FOUND')) {
          clearToken(code);
        }
        break;
    }
  };

  /** Server bisa mengganti nama (filter kata kasar); profil lokal disamakan. */
  function syncName(r: RoomSnapshot, seat: SeatIndex) {
    const name = r.seats[seat]?.name;
    if (r.phase !== 'lobby' || !name || name === profile.name) return;
    profile = { ...profile, name };
    saveProfile(profile);
  }

  function showQuota() {
    client.close();
    pending = false;
    error = id.errors.QUOTA;
    notice = id.errors.QUOTA;
    if (screen === 'lobby') exitRoom();
  }

  function captureResult(r: RoomSnapshot, seat: SeatIndex): ShownResult {
    return {
      result: r.result!,
      score: [r.score[0], r.score[1]],
      names: [r.seats[0]?.name ?? '', r.seats[1]?.name ?? ''],
      characters: [r.seats[0]?.character ?? 'kucing', r.seats[1]?.character ?? 'kucing'],
      seat,
    };
  }

  function answer(value: number) {
    client.send({ type: 'answer', q: myQ, value });
    myQ++;
  }

  function backToRoom() {
    client.send({ type: 'backToRoom' });
    if (room && me) me.inLobby = true;
    shownResult = null;
  }

  function enterRoom(roomCode: string) {
    code = roomCode;
    pending = true;
    error = null;
    client.connect(roomCode);
  }

  async function createRoom() {
    pending = true;
    error = null;
    let res: Response;
    try {
      res = await fetch('/api/rooms', { method: 'POST' });
    } catch {
      pending = false;
      error = id.errors.createFailed;
      return;
    }
    // Bukan JSON = halaman error Cloudflare, artinya Worker tidak jalan (kuota habis).
    const body = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
    if (res.ok && body?.code) return enterRoom(body.code);
    pending = false;
    if (body?.error === 'RATE_LIMITED') error = id.errors.createLimited;
    else if (body === null || body.error === 'QUOTA') showQuota();
    else error = id.errors.createFailed;
  }

  function exitRoom() {
    client.close();
    room = null;
    shownResult = null;
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

  function changeVolumes(next: Volumes) {
    const sfxChanged = next.sfx !== volumes.sfx;
    volumes = next;
    setVolumes(next);
    saveVolumes(next);
    if (sfxChanged) playSfx('key'); // contoh volume efek suara
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

<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />

<main>
  {#if screen === 'menu'}
    <MenuUtama
      notice={online ? notice : id.menu.offline}
      offline={!online}
      onPlay={() => {
        error = null;
        playOpen = true;
      }}
      onSettings={() => (settingsOpen = true)}
      onCharacter={() => openCharacter('menu')}
    />
  {:else if screen === 'karakter'}
    <PilihKarakter
      {profile}
      onChange={changeProfile}
      onBack={() => (screen = characterBack === 'lobby' && room ? 'lobby' : 'menu')}
    />
  {:else if screen === 'lobby' && room && inGame}
    <Permainan {room} {mySeat} {status} question={deck[myQ]} onCorrect={answer} onLeave={leave} />
  {:else if screen === 'lobby' && room && onResult && shownResult}
    <Hasil
      result={shownResult.result}
      score={shownResult.score}
      names={shownResult.names}
      characters={shownResult.characters}
      mySeat={shownResult.seat}
      onBack={backToRoom}
      onLeave={leave}
    />
  {:else if screen === 'lobby' && room}
    <Lobby
      {room}
      {mySeat}
      {status}
      {error}
      onDuration={(sec: Duration) => client.send({ type: 'setDuration', sec })}
      onStart={() => client.send({ type: 'start' })}
      onCharacter={() => openCharacter('lobby')}
      onLeave={leave}
    />
  {/if}

  {#if playOpen && screen === 'menu'}
    <ModalPlay
      initialCode={linkCode ?? ''}
      {joinLockedUntil}
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

  {#if settingsOpen && screen === 'menu'}
    <ModalPengaturan {volumes} onChange={changeVolumes} onClose={() => (settingsOpen = false)} />
  {/if}
</main>

<style>
  main {
    min-height: 100dvh;
    max-width: 420px;
    margin: 0 auto;
    padding-block: 16px 24px;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
  }
</style>
