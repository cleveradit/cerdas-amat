import type { Character, Result, SeatIndex } from '@cerdas-amat/shared';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three';
import { arenaLayout, poseFor } from '../../game/arena';
import { addLights, shadowBlob } from '../common';
import { animChar, buildChar, disposeChar, type Rig } from '../rig';
import type { View } from '../stage';

/** Lebar satu langkah tali (satuan voxel); kamera menampilkan 13,6 langkah. */
const STEP = 6;
const VIEW_W = 13.6 * STEP;
/** Jarak tangan ke pusat badan karakter. */
const HAND = 2.5;
const FACE = Math.PI / 2 - 0.45;
/** Tinggi titik label nama (di atas kepala). */
const LABEL_Y = 24;
/** Label tidak keluar dari tepi arena. */
const LABEL_MARGIN = 44;

export interface ArenaState {
  diff: number;
  characters: [Character, Character];
  result: Result | null;
}

/** Arena 3D: port langsung dari preview, kamera ortografis dari samping. */
export function createArenaView(): View & {
  set(state: ArenaState): void;
  labelX(seat: SeatIndex): number;
  labelY(): number;
  /** Dipanggil setiap frame setelah posisi diperbarui (label nama, penghitung fps). */
  onFrame: (() => void) | null;
} {
  const scene = new Scene();
  addLights(scene);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 1000);
  camera.position.set(0, 26, 120);
  camera.lookAt(0, 11, 0);

  const ground = new Mesh(
    new BoxGeometry(400, 80, 100),
    new MeshLambertMaterial({ color: 0x7cc35a }),
  );
  ground.position.set(0, -40, 0);
  const lane = new Mesh(
    new PlaneGeometry(VIEW_W + 40, 12),
    new MeshLambertMaterial({ color: 0x95d175 }),
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.y = 0.02;
  const mid = new Mesh(
    new PlaneGeometry(1.4, 12),
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
  );
  mid.rotation.x = -Math.PI / 2;
  mid.position.y = 0.03;
  const neutral = new Mesh(
    new PlaneGeometry(2.8, 40),
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  neutral.position.set(0, 17, -1.2);
  const rope = new Mesh(
    new BoxGeometry(1, 0.75, 0.75),
    new MeshLambertMaterial({ color: 0xb5854b }),
  );
  const marker = new Mesh(new BoxGeometry(1, 6, 1), new MeshLambertMaterial({ color: 0xffc83d }));
  const shadows = [shadowBlob(5.5), shadowBlob(5.5)] as const;
  // Player 2 dicerminkan agar menghadap host.
  const p2Wrap = new Group();
  p2Wrap.scale.x = -1;
  scene.add(ground, lane, mid, neutral, rope, marker, ...shadows, p2Wrap);

  const rigs: [Rig | null, Rig | null] = [null, null];
  let state: ArenaState = { diff: 0, characters: ['kucing', 'kucing'], result: null };
  const start = arenaLayout(0);
  // Posisi yang ditampilkan (dihaluskan menuju target), satuan voxel.
  const A = { hx: start.hostHand * STEP, px: start.p2Hand * STEP, mx: 0 };
  const body: [number, number] = [A.hx - HAND, A.px + HAND];
  let w = 1;
  let h = 1;
  const tmp = new Vector3();

  const setRig = (seat: SeatIndex, c: Character) => {
    const old = rigs[seat];
    if (old?.key === c) return;
    if (old) disposeChar(old);
    const rig = buildChar(c);
    rig.root.rotation.y = FACE;
    (seat === 0 ? scene : p2Wrap).add(rig.root);
    rigs[seat] = rig;
  };

  const view = {
    scene,
    camera,
    onFrame: null as (() => void) | null,
    set(next: ArenaState) {
      state = next;
      setRig(0, next.characters[0]);
      setRig(1, next.characters[1]);
    },
    resize(nw: number, nh: number) {
      w = nw;
      h = nh;
      const vh = (VIEW_W * h) / w;
      camera.left = -VIEW_W / 2;
      camera.right = VIEW_W / 2;
      camera.top = vh / 2;
      camera.bottom = -vh / 2;
      camera.updateProjectionMatrix();
    },
    update(t: number, dt: number) {
      const L = arenaLayout(state.diff);
      const k = 1 - Math.exp(-dt * 7);
      A.hx += (L.hostHand * STEP - A.hx) * k;
      A.px += (L.p2Hand * STEP - A.px) * k;
      A.mx += (L.marker * STEP - A.mx) * k;
      body[0] = A.hx - HAND;
      body[1] = A.px + HAND;
      rigs[0]?.root.position.setX(body[0]);
      p2Wrap.position.x = body[1];
      shadows[0].position.x = body[0];
      shadows[1].position.x = body[1];
      for (const seat of [0, 1] as const) {
        const rig = rigs[seat];
        if (!rig) continue;
        rig.pose = poseFor(seat, state.diff, state.result);
        animChar(rig, t, dt);
      }
      const showRope = state.result === null;
      rope.visible = showRope;
      marker.visible = showRope;
      rope.scale.x = Math.max(0.1, A.px - A.hx);
      rope.position.set((A.hx + A.px) / 2, 8.6, 0.4);
      marker.position.set(A.mx, 8.6, 0.6);
      view.onFrame?.();
    },
    /** Posisi x label nama kursi `seat` dalam piksel dari kiri arena. */
    labelX(seat: SeatIndex) {
      tmp.set(body[seat], LABEL_Y, 0).project(camera);
      return Math.max(LABEL_MARGIN, Math.min(w - LABEL_MARGIN, ((tmp.x + 1) / 2) * w));
    },
    /** Posisi y (bawah) label nama dalam piksel dari atas arena; sama untuk kedua kursi. */
    labelY() {
      tmp.set(0, LABEL_Y, 0).project(camera);
      return ((1 - tmp.y) / 2) * h;
    },
  };
  return view;
}
