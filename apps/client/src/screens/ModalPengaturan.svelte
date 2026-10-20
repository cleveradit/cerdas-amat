<script lang="ts">
  import type { Volumes } from '../audio/audio';
  import { id } from '../i18n/id';

  let {
    volumes,
    onChange,
    onClose,
  }: { volumes: Volumes; onChange: (v: Volumes) => void; onClose: () => void } = $props();

  const SLIDERS = [
    ['music', id.settings.music],
    ['sfx', id.settings.sfx],
  ] as const;
</script>

<div class="backdrop">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <h2 id="settings-title">{id.settings.title}</h2>
    {#each SLIDERS as [key, label] (key)}
      <div class="slider">
        <label class="field-label" for="vol-{key}">{label}</label>
        <output for="vol-{key}">{id.settings.percent(volumes[key])}</output>
        <input
          id="vol-{key}"
          type="range"
          min="0"
          max="100"
          step="5"
          value={volumes[key]}
          oninput={(e) => onChange({ ...volumes, [key]: e.currentTarget.valueAsNumber })}
        />
      </div>
    {/each}
    <button type="button" class="link" onclick={onClose}>{id.settings.close}</button>
  </div>
</div>

<style>
  .slider {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 4px 8px;
  }
  output {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  input {
    grid-column: 1 / -1;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    accent-color: var(--host);
  }
</style>
