<script lang="ts">
  import type { Result, SeatIndex } from '@cerdas-amat/shared';
  import { id } from '../i18n/id';

  let {
    result,
    score,
    names,
    mySeat,
    onBack,
    onLeave,
  }: {
    result: Result;
    score: [number, number];
    names: [string, string];
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
    }[result.reason],
  );
</script>

<section class="screen" data-testid="result">
  <h2 data-testid="result-title">{title}</h2>
  <p data-testid="result-reason">{reason}</p>
  <p class="score" data-testid="result-score">
    {names[0]} <strong>{score[0]} : {score[1]}</strong>
    {names[1]}
  </p>
  <button type="button" onclick={onBack}>{id.result.backToRoom}</button>
  <button type="button" onclick={onLeave}>{id.result.leave}</button>
</section>
