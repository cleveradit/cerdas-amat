import { loadStage, type Stage } from '../three/stage';

class StageStore {
  /**
   * `undefined` = masih dimuat, `null` = WebGL tidak tersedia. `$state.raw` karena Stage
   * mengubah dirinya sendiri (`fps`) dan tidak boleh dibungkus proxy Svelte.
   */
  current = $state.raw<Stage | null | undefined>(undefined);
}

/** Stage bersama untuk semua layar. */
export const stage = new StageStore();

/** Dipanggil setelah menu tampil agar Three.js tidak memperlambat layar pertama. */
export function initStage(): void {
  void loadStage().then((s) => (stage.current = s));
}

/** `?fps=1` menampilkan penghitung fps di arena. */
export const showFps = /[?&]fps=1(&|$)/.test(location.search);
