<script lang="ts">
  import type { Character, Result, SeatIndex } from '@cerdas-amat/shared';
  import { onMount } from 'svelte';
  import { playSfx } from '../audio/audio';
  import Stage3D from '../components/Stage3D.svelte';
  import { id } from '../i18n/id';
  import { stage } from '../lib/stage.svelte';
  import type { View } from '../three/stage';

  let {
    result,
    score,
    names,
    characters,
    mySeat,
    onBack,
    onLeave,
  }: {
    result: Result;
    score: [number, number];
    names: [string, string];
    characters: [Character, Character];
    mySeat: SeatIndex;
    onBack: () => void;
    onLeave: () => void;
  } = $props();

  const won = $derived(result.winner === mySeat);
  const title = $derived(
    result.reason === 'void'
      ? id.result.void
      : result.winner === null
        ? id.result.draw
        : won
          ? id.result.win
          : id.result.lose,
  );
  const reason = $derived(
    {
      ko: id.result.ko,
      time: id.result.time,
      wo: won ? id.result.woWin : id.result.woLose,
      surrender: won ? id.result.surrenderWin : id.result.surrenderLose,
      void: id.result.voidReason,
      idle: id.result.idle,
    }[result.reason],
  );

  // Jingle hasil sekali saat layar tampil; pertandingan dibatalkan tanpa jingle.
  onMount(() => {
    if (result.reason !== 'void') playSfx(result.winner === null ? 'draw' : won ? 'win' : 'lose');
  });

  let view = $state.raw<View | null>(null);
  $effect(() => {
    if (!stage.current || view) return;
    void import('../three/views/hasil').then((m) => {
      view = m.createHasilView(characters, result);
    });
  });
</script>

<section class="screen" data-testid="result">
  <h2 class="title" data-testid="result-title">{title}</h2>
  <p class="reason" data-testid="result-reason">{reason}</p>

  <div class="podium">
    {#if stage.current && view}
      <Stage3D stage={stage.current} {view} class="fill" />
    {/if}
  </div>

  <p class="score" data-testid="result-score">
    <span class="name host">{names[0]}</span>
    <strong>{score[0]} : {score[1]}</strong>
    <span class="name p2">{names[1]}</span>
  </p>
  <button type="button" class="primary" onclick={onBack}>{id.result.backToRoom}</button>
  <button type="button" class="link" onclick={onLeave}>{id.result.leave}</button>
</section>

<style>
  .title {
    font-size: 40px;
    text-align: center;
    margin-top: 8px;
  }
  .reason {
    text-align: center;
    font-weight: 600;
    color: var(--ink-2);
    margin-top: -8px;
  }
  .podium {
    position: relative;
    height: 220px;
    border: var(--border);
    border-radius: 18px;
    overflow: hidden;
    background: var(--sky-gradient);
  }
  .podium :global(.fill) {
    position: absolute;
    inset: 0;
  }
  .score {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
  }
  .score strong {
    font-family: var(--display);
    font-weight: 400;
    font-size: 32px;
    font-variant-numeric: tabular-nums;
  }
  .name {
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .name.host {
    color: var(--host);
    text-align: right;
  }
  .name.p2 {
    color: var(--p2);
  }
</style>
