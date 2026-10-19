<script lang="ts">
  import { id } from '../i18n/id';

  let { onPlay, onCharacter }: { onPlay: () => void; onCharacter: () => void } = $props();
</script>

<section class="screen">
  <h1>{id.title}</h1>
  <button type="button" onclick={onPlay}>{id.menu.play}</button>
  <button type="button" onclick={onCharacter}>{id.menu.character}</button>
</section>
