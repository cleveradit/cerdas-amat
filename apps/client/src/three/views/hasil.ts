import type { Character, Result } from '@cerdas-amat/shared';
import { CylinderGeometry, Mesh, MeshLambertMaterial, PerspectiveCamera, Scene } from 'three';
import { poseFor } from '../../game/arena';
import { addLights, shadowBlob } from '../common';
import { animChar, buildChar } from '../rig';
import type { View } from '../stage';

/** Jarak pusat karakter dari tengah. */
const SPREAD = 10;

/** Layar hasil: kedua karakter berdampingan dengan pose Menang/Kalah, atau Diam saat seri/batal. */
export function createHasilView(characters: [Character, Character], result: Result): View {
  const scene = new Scene();
  addLights(scene);
  const camera = new PerspectiveCamera(30, 1, 1, 500);
  camera.position.set(0, 16, 72);
  camera.lookAt(0, 10.5, 0);
  const ped = new Mesh(
    new CylinderGeometry(22, 22.5, 1.4, 48),
    new MeshLambertMaterial({ color: 0x7cc35a }),
  );
  ped.position.y = -0.7;
  scene.add(ped);

  const rigs = ([0, 1] as const).map((seat) => {
    const rig = buildChar(characters[seat]);
    const x = seat === 0 ? -SPREAD : SPREAD;
    rig.pose = poseFor(seat, 0, result);
    rig.root.position.x = x;
    // Sedikit saling menghadap.
    rig.root.rotation.y = seat === 0 ? 0.35 : -0.35;
    const shadow = shadowBlob(5.5);
    shadow.position.x = x;
    scene.add(rig.root, shadow);
    return rig;
  });

  return {
    scene,
    camera,
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(t, dt) {
      for (const rig of rigs) animChar(rig, t, dt);
    },
  };
}
