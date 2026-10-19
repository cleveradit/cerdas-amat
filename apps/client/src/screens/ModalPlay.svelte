<script lang="ts">
  import { normalizeRoomCode, ROOM_CODE_LENGTH } from '@cerdas-amat/shared';
  import { id } from '../i18n/id';

  let {
    initialCode = '',
    joinLockedUntil,
    pending,
    error,
    onCreate,
    onJoin,
    onClose,
  }: {
    initialCode?: string;
    joinLockedUntil: number;
    pending: boolean;
    error: string | null;
    onCreate: () => void;
    onJoin: (code: string) => void;
    onClose: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let mode = $state<'choose' | 'join'>(initialCode ? 'join' : 'choose');
  // svelte-ignore state_referenced_locally
  let code = $state(initialCode);
  let localError = $state<string | null>(null);

  // Setelah terlalu banyak kode salah, input kode dikunci sampai joinLockedUntil.
  let now = $state(Date.now());
  const lockSec = $derived(Math.max(0, Math.ceil((joinLockedUntil - now) / 1000)));
  $effect(() => {
    if (joinLockedUntil <= Date.now()) return;
    now = Date.now();
    const timer = setInterval(() => {
      now = Date.now();
      if (now >= joinLockedUntil) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!normalized) {
      localError = id.errors.invalidCode;
      return;
    }
    localError = null;
    onJoin(normalized);
  }
</script>

<div class="backdrop">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="play-title">
    <h2 id="play-title">{id.play.title}</h2>
    {#if mode === 'choose'}
      <button type="button" class="primary" disabled={pending} onclick={onCreate}>
        {id.play.create}
      </button>
      <button type="button" disabled={pending} onclick={() => (mode = 'join')}>
        {id.play.join}
      </button>
    {:else}
      <form class="stack" onsubmit={submit}>
        <label class="field-label" for="room-code">{id.play.codeLabel}</label>
        <input
          id="room-code"
          class="code-input"
          bind:value={code}
          maxlength={ROOM_CODE_LENGTH}
          placeholder={id.play.codePlaceholder}
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          disabled={lockSec > 0}
        />
        <button type="submit" class="primary" disabled={pending || lockSec > 0}
          >{id.play.submitJoin}</button
        >
        {#if lockSec > 0}<p class="muted" role="status">{id.play.locked(lockSec)}</p>{/if}
      </form>
      <button type="button" disabled={pending} onclick={() => (mode = 'choose')}>
        {id.play.back}
      </button>
    {/if}
    {#if pending}<p class="muted" role="status">{id.play.connecting}</p>{/if}
    {#if localError ?? error}<p class="error" role="alert">{localError ?? error}</p>{/if}
    <button type="button" class="link" onclick={onClose}>{id.play.close}</button>
  </div>
</div>

<style>
  .code-input {
    font-family: var(--display);
    font-weight: 400;
    font-size: 28px;
    letter-spacing: 0.2em;
    text-align: center;
    text-transform: uppercase;
  }
  p {
    text-align: center;
  }
</style>
