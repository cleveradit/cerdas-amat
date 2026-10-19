<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Stage, View } from '../three/stage';

  let {
    stage,
    view,
    class: className = '',
    children,
    ...rest
  }: {
    stage: Stage;
    view: View;
    class?: string;
    children?: Snippet;
    [attr: `data-${string}`]: unknown;
  } = $props();

  let el: HTMLDivElement;

  // Canvas bersama dipindah ke sini setelah layar sempat digambar (render 3D pertama bisa
  // lama karena kompilasi shader), dan dilepas saat komponen hilang.
  $effect(() => {
    let detach: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => (detach = stage.attach(el, view)));
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      detach?.();
    };
  });
</script>

<div bind:this={el} class="stage3d {className}" {...rest}>
  {@render children?.()}
</div>

<style>
  .stage3d {
    position: relative;
    overflow: hidden;
  }
  .stage3d :global(canvas) {
    display: block;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
