<script lang="ts">
  import { KO_DIFF, type Question, type RoomSnapshot, type SeatIndex } from '@cerdas-amat/shared';
  import { onDestroy } from 'svelte';
  import { serverNow } from '../game/clock';
  import { id } from '../i18n/id';
  import type { ConnectionStatus } from '../net/roomClient';

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

  /** Lebar kamera arena = 13,6 langkah (PRD keputusan no. 16). */
  const STEP_PCT = 100 / 13.6;

  let input = $state('');
  let wrong = $state(false);
  let now = $state(serverNow());
  const timer = setInterval(() => (now = serverNow()), 100);
  onDestroy(() => clearInterval(timer));

  const diff = $derived(room.score[0] - room.score[1]);
  const canAnswer = $derived(room.phase === 'playing' && question !== undefined);
  const remainingMs = $derived(
    room.phase === 'playing'
      ? Math.max(0, room.endsAt! - now)
      : room.phase === 'paused'
        ? room.remainingMs!
        : room.durationSec * 1000,
  );
  const countdown = $derived(
    room.phase === 'countdown' ? Math.max(1, Math.ceil((room.startsAt! - now) / 1000)) : null,
  );
  const pauseSec = $derived(
    room.pause ? Math.max(0, Math.ceil((room.pause.until - now) / 1000)) : 0,
  );
  // Tangan karakter mulai 5 langkah dari zona netral; yang tertinggal terseret ke tengah.
  const hostHand = $derived(50 + (-KO_DIFF + Math.max(0, -diff)) * STEP_PCT);
  const p2Hand = $derived(50 + (KO_DIFF - Math.max(0, diff)) * STEP_PCT);
  const marker = $derived(50 - diff * STEP_PCT);

  // Soal baru (benar, atau dikembalikan server lewat `reject`) mengosongkan kolom.
  $effect(() => {
    void question;
    input = '';
  });

  function press(key: string) {
    if (!canAnswer) return;
    wrong = false;
    if (/^\d$/.test(key)) {
      if (input.length < 2) input += key;
    } else if (key === 'del') {
      input = input.slice(0, -1);
    } else if (key === 'ac') {
      input = '';
    } else if (key === 'enter' && input) {
      const value = Number(input);
      input = '';
      if (value === question![0] * question![1]) onCorrect(value);
      else wrong = true;
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

  const KEYS = [
    ['7', '8', '9', 'del'],
    ['4', '5', '6', 'ac'],
    ['1', '2', '3', 'enter'],
    ['0'],
  ] as const;
  const label = (k: string) =>
    k === 'del' ? id.game.del : k === 'ac' ? id.game.ac : k === 'enter' ? id.game.enter : k;
</script>

<svelte:window onkeydown={onKeydown} />

<section class="screen game" data-testid="game">
  <header class="hud">
    <span class="tag host" class:me={mySeat === 0}>
      <strong data-testid="score-0">{room.score[0]}</strong>
      {room.seats[0]?.name}
    </span>
    <span class="timer" data-testid="timer">{Math.ceil(remainingMs / 1000)}</span>
    <span class="tag p2" class:me={mySeat === 1}>
      {room.seats[1]?.name}
      <strong data-testid="score-1">{room.score[1]}</strong>
    </span>
  </header>

  <div class="arena" data-testid="arena" data-diff={diff}>
    <div class="neutral"></div>
    <div class="rope" style:left="{hostHand}%" style:right="{100 - p2Hand}%"></div>
    <div class="marker" style:left="{marker}%"></div>
    <div class="hand host" style:left="{hostHand}%">{room.seats[0]?.name}</div>
    <div class="hand p2" style:left="{p2Hand}%">{room.seats[1]?.name}</div>
    <p class="diff">{id.game.diff(Math.abs(diff))}</p>

    {#if countdown !== null}
      <div class="overlay" data-testid="countdown">{countdown}</div>
    {:else if room.phase === 'paused' && room.pause}
      <div class="overlay small" data-testid="paused">
        {id.game.waitingFor(room.seats[room.pause.seat]?.name ?? '', pauseSec)}
      </div>
    {/if}
  </div>

  {#if status !== 'open'}<p role="status">{id.game.reconnecting}</p>{/if}

  <div class="question" class:wrong>
    <span data-testid="question">{question ? `${question[0]} × ${question[1]}` : '…'}</span>
    <span>=</span>
    <span class="answer" data-testid="answer">{input || ' '}</span>
  </div>
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
          disabled={!canAnswer}
          onclick={() => press(k)}>{label(k)}</button
        >
      {/each}
    {/each}
  </div>

  <button type="button" onclick={leave}>{id.game.leave}</button>
</section>

<style>
  .hud {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
  }
  .tag.p2 {
    text-align: right;
  }
  .tag.me {
    text-decoration: underline;
  }
  .timer {
    font-size: 1.8em;
    font-variant-numeric: tabular-nums;
  }
  .arena {
    position: relative;
    height: 140px;
    border: 2px solid #ccd;
    border-radius: 12px;
    overflow: hidden;
    background: #eef7fb;
  }
  .neutral {
    position: absolute;
    left: calc(50% - 3px);
    top: 0;
    bottom: 0;
    width: 6px;
    background: rgb(0 0 0 / 0.15);
  }
  .rope {
    position: absolute;
    top: 70px;
    height: 4px;
    background: #b5854b;
    transition:
      left 0.2s,
      right 0.2s;
  }
  .marker {
    position: absolute;
    top: 56px;
    width: 4px;
    height: 32px;
    margin-left: -2px;
    background: #ffc83d;
    transition: left 0.2s;
  }
  .hand {
    position: absolute;
    top: 30px;
    transform: translateX(-50%);
    font-size: 12px;
    white-space: nowrap;
    transition: left 0.2s;
  }
  .hand.host {
    color: #2f6fd0;
  }
  .hand.p2 {
    color: #dd4449;
  }
  .diff {
    position: absolute;
    bottom: 4px;
    width: 100%;
    margin: 0;
    text-align: center;
    font-size: 12px;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.5);
    color: #fff;
    font-size: 3em;
    text-align: center;
    padding: 8px;
  }
  .overlay.small {
    font-size: 1em;
  }
  .question {
    display: flex;
    justify-content: center;
    gap: 12px;
    font-size: 2.2em;
    font-variant-numeric: tabular-nums;
  }
  .question.wrong .answer {
    color: #c22;
  }
  .answer {
    min-width: 2.5ch;
    border-bottom: 3px solid currentColor;
    text-align: center;
  }
  .hint {
    text-align: center;
    margin: 0;
    min-height: 1.2em;
  }
  .keypad {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: 50px;
    gap: 8px;
  }
  .key {
    font-size: 1.3em;
  }
  .key.enter {
    grid-row: span 2;
  }
  .key.zero {
    grid-column: span 3;
  }
</style>
