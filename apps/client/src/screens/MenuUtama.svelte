<script lang="ts">
  import { id } from '../i18n/id';

  let {
    notice,
    onPlay,
    onCharacter,
  }: { notice: string | null; onPlay: () => void; onCharacter: () => void } = $props();
</script>

<section class="screen menu">
  <div class="hero">
    <h1>{id.title}</h1>
  </div>
  {#if notice}<p class="error" role="alert">{notice}</p>{/if}
  <button type="button" class="primary" onclick={onPlay}>{id.menu.play}</button>
  <button type="button" onclick={onCharacter}>{id.menu.character}</button>
</section>

<style>
  .menu {
    gap: 14px;
    padding-top: 8vh;
  }
  .hero {
    display: grid;
    place-items: center;
    min-height: 200px;
    padding: 24px 16px;
    border: var(--border);
    border-radius: 22px;
    box-shadow: 0 6px 0 var(--ink);
    background: var(--sky-gradient);
    margin-bottom: 10px;
  }
  .error {
    text-align: center;
  }
  h1 {
    font-size: clamp(36px, 11vw, 48px);
    text-align: center;
    text-wrap: balance;
    text-shadow: 0 3px 0 var(--panel);
  }
</style>
