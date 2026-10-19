import type { Character } from '@cerdas-amat/shared';
import type { Camera, Scene } from 'three';

/** Satu layar 3D: scene dan kamera sendiri, digambar oleh renderer bersama. */
export interface View {
  scene: Scene;
  camera: Camera;
  resize(w: number, h: number): void;
  update(t: number, dt: number): void;
}

export interface Stage {
  /**
   * Memindah canvas ke `el` dan mulai menggambar `view`; mengembalikan fungsi lepas.
   * Hanya satu view yang tampil; view sebelumnya dilepas.
   */
  attach(el: HTMLElement, view: View): () => void;
  /** Gambar avatar 160×160 (pose Diam) sebagai data URL. */
  avatars: Record<Character, string>;
  /** Frame per detik terakhir yang diukur loop render. */
  fps: number;
}

/**
 * Konteks dibuat sendiri karena Three.js menulis error ke console saat gagal membuatnya.
 * Konteks yang berhasil dipakai renderer, jadi hanya ada satu konteks WebGL.
 */
function createContext(): WebGL2RenderingContext | null {
  try {
    return document
      .createElement('canvas')
      .getContext('webgl2', { alpha: true, antialias: true, depth: true, stencil: false });
  } catch {
    return null;
  }
}

let loading: Promise<Stage | null> | null = null;

/**
 * Renderer bersama seluruh aplikasi (satu konteks WebGL). Three.js di-import dinamis agar
 * layar pertama tetap ringan. `null` jika WebGL tidak tersedia.
 */
export function loadStage(): Promise<Stage | null> {
  loading ??= (async () => {
    const gl = createContext();
    if (!gl) return null;
    const { createStage } = await import('./engine');
    return createStage(gl);
  })().catch(() => null);
  return loading;
}
