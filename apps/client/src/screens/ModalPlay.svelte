<script lang="ts">
  import { normalizeRoomCode, ROOM_CODE_LENGTH } from '@cerdas-amat/shared';
  import { id } from '../i18n/id';

  let {
    initialCode = '',
    pending,
    error,
    onCreate,
    onJoin,
    onClose,
  }: {
    initialCode?: string;
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
  <div class="modal" role="dialog" aria-modal="true">
    {#if mode === 'choose'}
      <button type="button" disabled={pending} onclick={onCreate}>{id.play.create}</button>
      <button type="button" disabled={pending} onclick={() => (mode = 'join')}>
        {id.play.join}
      </button>
    {:else}
      <form onsubmit={submit}>
        <label for="room-code">{id.play.codeLabel}</label>
        <input
          id="room-code"
          bind:value={code}
          maxlength={ROOM_CODE_LENGTH}
          placeholder={id.play.codePlaceholder}
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
        />
        <button type="submit" disabled={pending}>{id.play.submitJoin}</button>
      </form>
      <button type="button" disabled={pending} onclick={() => (mode = 'choose')}>
        {id.play.back}
      </button>
    {/if}
    {#if pending}<p>{id.play.connecting}</p>{/if}
    {#if localError ?? error}<p class="error" role="alert">{localError ?? error}</p>{/if}
    <button type="button" onclick={onClose}>{id.play.close}</button>
  </div>
</div>
