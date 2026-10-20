<script lang="ts">
  import { UNLIMITED, type Question, type RoomSnapshot, type SeatIndex } from '@cerdas-amat/shared';
  import { onDestroy } from 'svelte';
  import { playSfx } from '../audio/audio';
  import Arena2D from '../components/Arena2D.svelte';
  import Stage3D from '../components/Stage3D.svelte';
  import { serverNow } from '../game/clock';
  import { id } from '../i18n/id';
  import { showFps, stage } from '../lib/stage.svelte';
  import type { ConnectionStatus } from '../net/roomClient';
  import type { createArenaView } from '../three/views/arena';

  let {
    room,
    mySeat,
    question,
    status,
    onCorrect,
    onLeave,
  }: {
    room: RoomSnapshot;
    mySeat: SeatIndex;
    question: Question | undefined;
    status: ConnectionStatus;
    onCorrect: (value: number) => void;
    onLeave: () => void;
  } = $props();

  /** Lama kotak soal berkedip hijau setelah jawaban benar. */
  const OK_FLASH_MS = 220;
  /** Timer berlatar merah saat sisa waktu sebanyak ini atau kurang. */
  const LOW_TIME_MS = 10_000;

  let input = $state('');
  let wrong = $state(false);
  let now = $state(serverNow());
  const timer = setInterval(() => (now = serverNow()), 100);
  onDestroy(() => {
    clearInterval(timer);
    clearTimeout(okTimer);
  });

  const diff = $derived(room.score[0] - room.score[1]);
  const canAnswer = $derived(room.phase === 'playing' && question !== undefined);
  const remainingMs = $derived(
    room.phase === 'playing'
      ? Math.max(0, room.endsAt! - now)
      : room.phase === 'paused'
        ? room.remainingMs!
        : room.durationSec * 1000,
  );
  const unlimited = $derived(room.durationSec === UNLIMITED);
  const countdown = $derived(
    room.phase === 'countdown' ? Math.max(1, Math.ceil((room.startsAt! - now) / 1000)) : null,
  );
  const pauseSec = $derived(
    room.pause ? Math.max(0, Math.ceil((room.pause.until - now) / 1000)) : 0,
  );
  const names = $derived<[string, string]>([room.seats[0]?.name ?? '', room.seats[1]?.name ?? '']);

  let view = $state.raw<ReturnType<typeof createArenaView> | null>(null);
  let ok = $state(false);
  // Tiap jawaban salah membuat ulang kotak soal (blok `#key`) agar animasi goyang diputar lagi.
  let shakes = $state(0);
  let okTimer: ReturnType<typeof setTimeout> | undefined;
  let lblHost = $state<HTMLSpanElement>();
  let lblP2 = $state<HTMLSpanElement>();
  let fps = $state(0);

  $effect(() => {
    if (!stage.current || view) return;
    void import('../three/views/arena').then((m) => {
      view = m.createArenaView();
    });
  });
  $effect(() => {
    view?.set({
      diff,
      characters: [room.seats[0]?.character ?? 'kucing', room.seats[1]?.character ?? 'kucing'],
      result: null,
    });
  });
  // Label nama mengikuti karakter tiap frame, langsung lewat DOM tanpa state Svelte.
  $effect(() => {
    if (!view) return;
    const v = view;
    v.onFrame = () => {
      const y = v.labelY();
      if (lblHost) lblHost.style.transform = `translate(${v.labelX(0)}px, ${y}px)`;
      if (lblP2) lblP2.style.transform = `translate(${v.labelX(1)}px, ${y}px)`;
      if (showFps && stage.current) fps = stage.current.fps; // berubah sekali per detik
    };
    return () => (v.onFrame = null);
  });

  function flashOk() {
    ok = true;
    clearTimeout(okTimer);
    okTimer = setTimeout(() => (ok = false), OK_FLASH_MS);
  }

  function shake() {
    shakes++;
  }

  // Bunyi tiap angka hitung mundur 3-2-1.
  $effect(() => {
    if (countdown !== null) playSfx('countdown');
  });

  // Soal baru (benar, atau dikembalikan server lewat `reject`) mengosongkan kolom.
  $effect(() => {
    void question;
    input = '';
  });

  function press(key: string) {
    if (!canAnswer) return;
    wrong = false;
    if (key !== 'enter') playSfx('key'); // Enter berbunyi benar/salah
    if (/^\d$/.test(key)) {
      if (input.length < 2) input += key;
    } else if (key === 'del') {
      input = input.slice(0, -1);
    } else if (key === 'ac') {
      input = '';
    } else if (key === 'enter' && input) {
      const value = Number(input);
      input = '';
      if (value === question![0] * question![1]) {
        playSfx('correct');
        onCorrect(value);
        flashOk();
      } else {
        playSfx('wrong');
        wrong = true;
        shake();
      }
    }
  }

  function onKeydown(e: KeyboardEvent) {
    const key = /^\d$/.test(e.key)
      ? e.key
      : ({ Backspace: 'del', Escape: 'ac', Enter: 'enter' } as Record<string, string>)[e.key];
    if (!key) return;
    e.preventDefault();
    press(key);
  }

  function leave() {
    if (confirm(id.game.confirmLeave)) onLeave();
  }

  // Susunan ala keypad HP; Enter setinggi 2 baris mengisi kolom kanan baris terakhir.
  const KEYS = [
    ['1', '2', '3', 'ac'],
    ['4', '5', '6', 'del'],
    ['7', '8', '9', 'enter'],
    ['0'],
  ] as const;
  const label = (k: string) =>
    k === 'del' ? id.game.del : k === 'ac' ? id.game.ac : k === 'enter' ? id.game.enter : k;
</script>

<svelte:window onkeydown={onKeydown} />

<section class="screen game" data-testid="game">
  <header class="hud">
    <span class="tag host" class:me={mySeat === 0}>
      <strong class="score" data-testid="score-0">{room.score[0]}</strong>
      <span class="tag-name">{names[0]}</span>
    </span>
    <span
      class="timer"
      class:low={!unlimited && room.phase === 'playing' && remainingMs <= LOW_TIME_MS}
      data-testid="timer">{unlimited ? id.game.unlimited : Math.ceil(remainingMs / 1000)}</span
    >
    <span class="tag p2" class:me={mySeat === 1}>
      <strong class="score" data-testid="score-1">{room.score[1]}</strong>
      <span class="tag-name">{names[1]}</span>
    </span>
  </header>

  {#if stage.current === null}<p class="notice" role="status">{id.game.noWebgl}</p>{/if}

  <div class="arena" data-testid="arena" data-diff={diff}>
    {#if stage.current && view}
      <Stage3D stage={stage.current} {view} class="fill">
        <span class="name-lbl host" bind:this={lblHost}><span>{names[0]}</span></span>
        <span class="name-lbl p2" bind:this={lblP2}><span>{names[1]}</span></span>
        {#if showFps}<span class="fps" data-testid="fps">{id.game.fps(fps)}</span>{/if}
      </Stage3D>
    {:else if stage.current === null}
      <Arena2D {diff} {names} />
    {/if}
    <p class="diff">{id.game.diff(Math.abs(diff))}</p>

    {#if countdown !== null}
      <div class="overlay" data-testid="countdown">{countdown}</div>
    {:else if room.phase === 'paused' && room.pause}
      <div class="overlay small" data-testid="paused">
        {id.game.waitingFor(room.seats[room.pause.seat]?.name ?? '', pauseSec)}
      </div>
    {/if}
  </div>

  {#if status !== 'open'}<p class="muted center" role="status">{id.game.reconnecting}</p>{/if}

  {#key shakes}
    <div class="qbox" class:wrong class:ok class:shake={shakes > 0}>
      <span class="q" data-testid="question"
        >{question ? `${question[0]} × ${question[1]}` : '…'}</span
      >
      <span class="eq">=</span>
      <span class="ans" data-testid="answer">{input || ' '}</span>
    </div>
  {/key}
  <p class="hint" role="status">{wrong ? id.game.wrong : ' '}</p>

  <div class="keypad" role="group" aria-label={id.game.keypad}>
    {#each KEYS as row, r (r)}
      {#each row as k (k)}
        <button
          type="button"
          class="key"
          class:fn={k === 'del' || k === 'ac'}
          class:enter={k === 'enter'}
          class:zero={k === '0'}
          aria-label={k === 'del' || k === 'enter' ? label(k) : undefined}
          disabled={!canAnswer}
          onclick={() => press(k)}
        >
          {#if k === 'del'}
            <svg viewBox="0 0 24 24" aria-hidden="true"
              ><path d="M9 5h11v14H9l-6-7z" /><path d="m12 9 5 6m0-6-5 6" /></svg
            >
          {:else if k === 'enter'}
            <svg viewBox="0 0 24 24" aria-hidden="true"
              ><path d="M20 5v7H5" /><path d="m9 8-4 4 4 4" /></svg
            >
          {:else}
            {label(k)}
          {/if}
        </button>
      {/each}
    {/each}
  </div>

  <button type="button" class="link" onclick={leave}>{id.game.leave}</button>
</section>

<style>
  .game {
    gap: 8px;
  }
  .hud {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
  }
  .tag {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .tag.p2 {
    flex-direction: row-reverse;
  }
  .tag-name {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .tag.me .tag-name {
    font-weight: 700;
    text-decoration: underline;
    text-decoration-thickness: 2px;
  }
  .score {
    font-family: var(--display);
    font-weight: 400;
    font-size: 20px;
    line-height: 1;
    color: var(--on-accent);
    border: 2px solid var(--ink);
    border-radius: 10px;
    padding: 4px 8px;
    font-variant-numeric: tabular-nums;
    min-width: 38px;
    text-align: center;
  }
  .host .score {
    background: var(--host);
  }
  .p2 .score {
    background: var(--p2);
  }
  .timer {
    font-family: var(--display);
    font-size: 28px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    background: var(--sun);
    border: var(--border);
    border-radius: 12px;
    padding: 4px 10px;
    min-width: 58px;
    text-align: center;
  }
  .timer.low {
    background: var(--p2);
    color: var(--on-accent);
  }
  .notice {
    background: var(--sun-soft);
    border: 2px solid var(--ink);
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 500;
  }
  .arena {
    position: relative;
    height: 214px;
    margin-inline: -16px;
    border-block: var(--border);
    overflow: hidden;
    background: var(--sky-gradient);
  }
  .arena :global(.fill) {
    position: absolute;
    inset: 0;
  }
  .name-lbl {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 2;
    pointer-events: none;
  }
  .name-lbl > span {
    display: block;
    transform: translate(-50%, -100%);
    font: 700 11px var(--body);
    color: var(--on-accent);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 1px 8px;
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name-lbl.host > span {
    background: var(--host);
  }
  .name-lbl.p2 > span {
    background: var(--p2);
  }
  .fps {
    position: absolute;
    right: 6px;
    top: 4px;
    z-index: 2;
    font: 600 11px var(--body);
    font-variant-numeric: tabular-nums;
  }
  .diff {
    position: absolute;
    left: 50%;
    bottom: 8px;
    transform: translateX(-50%);
    z-index: 2;
    font-size: 11px;
    font-weight: 600;
    background: var(--panel);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 1px 9px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    background: var(--scrim);
    color: var(--on-accent);
    font-family: var(--display);
    font-size: 64px;
    text-shadow: 0 3px 0 var(--ink);
    text-align: center;
    padding: 12px;
  }
  .overlay.small {
    font-family: var(--body);
    font-weight: 600;
    font-size: 15px;
    text-shadow: none;
  }
  .center {
    text-align: center;
  }
  .qbox {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    align-self: center;
    margin-top: 4px;
    padding: 4px 14px;
    border-radius: 14px;
    transition: background-color 0.2s;
  }
  .qbox.ok {
    background: var(--good-tint);
  }
  .qbox.shake {
    animation: shake 0.32s;
  }
  @keyframes shake {
    20% {
      transform: translateX(-7px);
    }
    40% {
      transform: translateX(6px);
    }
    60% {
      transform: translateX(-4px);
    }
    80% {
      transform: translateX(3px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .qbox.shake {
      animation: none;
    }
  }
  .q,
  .eq,
  .ans {
    font-family: var(--display);
    font-size: 40px;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .eq {
    color: var(--ink-2);
  }
  .ans {
    min-width: 72px;
    text-align: center;
    border-bottom: 4px solid var(--ink);
    white-space: pre;
  }
  .wrong .ans {
    border-color: var(--p2);
  }
  .hint {
    font-size: 13px;
    color: var(--ink-2);
    min-height: 20px;
    text-align: center;
    white-space: pre;
  }
</style>
