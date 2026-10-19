<script lang="ts">
  import { CHARACTERS, cleanName, NAME_MAX, randomName } from '@cerdas-amat/shared';
  import { id } from '../i18n/id';
  import type { Profile } from '../lib/storage';

  let {
    profile,
    onChange,
    onBack,
  }: { profile: Profile; onChange: (p: Profile) => void; onBack: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(profile.name);

  function commitName() {
    const clean = cleanName(name);
    if (clean) onChange({ ...profile, name: clean });
    else name = profile.name;
  }
</script>

<section class="screen">
  <header>
    <button type="button" onclick={onBack}>{id.character.back}</button>
    <h2>{id.character.title}</h2>
  </header>

  <label for="player-name">{id.character.nameLabel}</label>
  <div class="row">
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

  <p class="preview">{id.character.names[profile.character]}</p>

  <div class="avatars" role="group" aria-label={id.character.title}>
    {#each CHARACTERS as c (c)}
      <button
        type="button"
        aria-pressed={profile.character === c}
        onclick={() => onChange({ ...profile, character: c })}>{id.character.names[c]}</button
      >
    {/each}
  </div>
</section>
