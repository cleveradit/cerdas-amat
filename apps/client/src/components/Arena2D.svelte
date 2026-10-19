<script lang="ts">
  import { arenaLayout } from '../game/arena';

  let { diff, names }: { diff: number; names: [string, string] } = $props();

  /** Lebar kamera arena = 13,6 langkah (PRD keputusan no. 16), dalam persen. */
  const STEP_PCT = 100 / 13.6;
  const pct = (steps: number) => 50 + steps * STEP_PCT;

  const layout = $derived(arenaLayout(diff));
</script>

<div class="arena2d">
  <div class="neutral"></div>
  <div
    class="rope"
    style:left="{pct(layout.hostHand)}%"
    style:right="{100 - pct(layout.p2Hand)}%"
  ></div>
  <div class="marker" style:left="{pct(layout.marker)}%"></div>
  <div class="hand host" style:left="{pct(layout.hostHand)}%">{names[0]}</div>
  <div class="hand p2" style:left="{pct(layout.p2Hand)}%">{names[1]}</div>
</div>

<style>
  .arena2d {
    position: absolute;
    inset: 0;
  }
  .arena2d::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 30%;
    background: var(--grass);
    border-top: var(--border);
  }
  .neutral {
    position: absolute;
    left: calc(50% - 6px);
    top: 0;
    bottom: 0;
    width: 12px;
    background: var(--panel);
    opacity: 0.5;
  }
  .rope {
    position: absolute;
    top: 50%;
    height: 6px;
    background: var(--rope);
    border-radius: 3px;
    transition:
      left 0.2s,
      right 0.2s;
  }
  .marker {
    position: absolute;
    top: calc(50% - 15px);
    width: 8px;
    height: 36px;
    margin-left: -4px;
    background: var(--sun);
    border: 2px solid var(--ink);
    transition: left 0.2s;
  }
  .hand {
    position: absolute;
    top: calc(50% - 44px);
    transform: translateX(-50%);
    font: 700 11px var(--body);
    color: var(--on-accent);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 1px 8px;
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: left 0.2s;
  }
  .hand.host {
    background: var(--host);
  }
  .hand.p2 {
    background: var(--p2);
  }
</style>
