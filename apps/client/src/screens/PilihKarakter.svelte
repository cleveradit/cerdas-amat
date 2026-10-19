<script lang="ts">
  import { CHARACTERS, cleanName, NAME_MAX, randomName } from '@cerdas-amat/shared';
  import Stage3D from '../components/Stage3D.svelte';
  import { id } from '../i18n/id';
  import { stage } from '../lib/stage.svelte';
  import type { Profile } from '../lib/storage';
  import type { createPilihView } from '../three/views/pilih';

  let {
    profile,
    onChange,
    onBack,
  }: { profile: Profile; onChange: (p: Profile) => void; onBack: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(profile.name);
  let view = $state.raw<ReturnType<typeof createPilihView> | null>(null);

  $effect(() => {
    if (!stage.current || view) return;
    void import('../three/views/pilih').then((m) => {
      view = m.createPilihView(profile.character);
    });
  });
  $effect(() => view?.setCharacter(profile.character));

  function commitName() {
    const clean = cleanName(name);
    if (clean) onChange({ ...profile, name: clean });
    else name = profile.name;
  }
</script>

<section class="screen">
  <header class="bar">
    <button type="button" class="link back" onclick={onBack}>{id.character.back}</button>
    <h2>{id.character.title}</h2>
  </header>

  <label class="field-label" for="player-name">{id.character.nameLabel}</label>
  <div class="row name">
    <input
      id="player-name"
      bind:value={name}
      maxlength={NAME_MAX}
      autocomplete="off"
      spellcheck="false"
      onchange={commitName}
    />
    <button
      type="button"
      onclick={() => {
        name = randomName();
        commitName();
      }}>{id.character.random}</button
    >
  </div>

  <div class="preview" aria-label={id.character.preview}>
    {#if stage.current && view}
      <Stage3D stage={stage.current} {view} class="fill" />
    {/if}
    <p class="preview-name">{id.character.names[profile.character]}</p>
  </div>

  <div class="avatars" role="group" aria-label={id.character.title}>
    {#each CHARACTERS as c (c)}
      <button
        type="button"
        class="av"
        aria-pressed={profile.character === c}
        onclick={() => onChange({ ...profile, character: c })}
      >
        {#if stage.current}
          <img src={stage.current.avatars[c]} alt="" />
        {/if}
        <span>{id.character.names[c]}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .back {
    justify-self: start;
  }
  .name {
    margin-top: -6px;
  }
  .preview {
    position: relative;
    height: 290px;
    border: var(--border);
    border-radius: 18px;
    overflow: hidden;
    background: linear-gradient(180deg, var(--sky-deep), var(--sky) 60%, var(--sky-2));
  }
  .preview :global(.fill) {
    position: absolute;
    inset: 0;
  }
  .preview-name {
    position: absolute;
    left: 12px;
    top: 10px;
    z-index: 1;
    font-family: var(--display);
    font-size: 20px;
  }
</style>
