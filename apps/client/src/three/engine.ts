import { CHARACTERS, type Character } from '@cerdas-amat/shared';
import {
  ColorManagement,
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Mesh,
} from 'three';
import { addLights } from './common';
import { animChar, buildChar, disposeChar } from './rig';
import type { Stage, View } from './stage';

const AVATAR_PX = 160;

/** Melepas buffer GPU milik scene; view tidak dipakai lagi setelah dilepas. */
function disposeScene(scene: Scene): void {
  scene.traverse((o) => {
    const m = o as Partial<Mesh>;
    m.geometry?.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/** Memberi giliran ke tugas lain (pesan WebSocket, render Svelte) di sela pekerjaan berat. */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r));

/** Membuat renderer bersama dan merender avatar sekali. */
export async function createStage(gl: WebGL2RenderingContext): Promise<Stage> {
  // Kalibrasi warna ke preview r128: tanpa konversi sRGB.
  ColorManagement.enabled = false;
  const renderer = new WebGLRenderer({ canvas: gl.canvas as HTMLCanvasElement, context: gl });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;

  // Avatar dirender sekali dengan renderer yang sama.
  renderer.setPixelRatio(1);
  renderer.setSize(AVATAR_PX, AVATAR_PX, false);
  const scene = new Scene();
  addLights(scene);
  const cam = new PerspectiveCamera(30, 1, 1, 400);
  cam.position.set(12, 17, 46);
  cam.lookAt(0, 11, 0);
  const avatars = {} as Record<Character, string>;
  // Satu avatar per tugas agar layar yang sedang dibuka (misalnya kembali ke permainan) tidak tertahan.
  for (const key of CHARACTERS) {
    await yieldToMain();
    const rig = buildChar(key);
    rig.pose = 'idle';
    rig.phase = 0;
    rig.root.rotation.y = 0.45;
    animChar(rig, 0, 1);
    scene.add(rig.root);
    renderer.render(scene, cam);
    avatars[key] = canvas.toDataURL('image/png');
    disposeChar(rig);
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  let current: { el: HTMLElement; view: View; ro: ResizeObserver } | null = null;
  let frame = 0;
  let last = 0;
  let frames = 0;
  let fpsStart = 0;

  const fit = () => {
    if (!current) return;
    const w = current.el.clientWidth;
    const h = current.el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    current.view.resize(w, h);
  };

  const loop = (now: number) => {
    if (!current) return;
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    current.view.update(now / 1000, dt);
    renderer.render(current.view.scene, current.view.camera);
    frames++;
    if (now - fpsStart >= 1000) {
      stage.fps = Math.round((frames * 1000) / (now - fpsStart));
      frames = 0;
      fpsStart = now;
    }
  };

  const detach = () => {
    if (!current) return;
    current.ro.disconnect();
    cancelAnimationFrame(frame);
    canvas.remove();
    disposeScene(current.view.scene);
    current = null;
  };

  const stage: Stage = {
    avatars,
    fps: 0,
    attach(el, view) {
      detach();
      el.prepend(canvas);
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      const mine = { el, view, ro };
      current = mine;
      fit();
      last = fpsStart = performance.now();
      frames = 0;
      frame = requestAnimationFrame(loop);
      return () => {
        if (current === mine) detach();
      };
    },
  };
  return stage;
}
