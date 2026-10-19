import type { Character } from '@cerdas-amat/shared';
import { CylinderGeometry, Mesh, MeshLambertMaterial, PerspectiveCamera, Scene } from 'three';
import { addLights, shadowBlob } from '../common';
import { reducedMotion } from '../motion';
import { animChar, buildChar, disposeChar, type Rig } from '../rig';
import type { View } from '../stage';

/** Preview layar pilih karakter: pose Diam berputar 360° di atas alas hijau. */
export function createPilihView(character: Character): View & {
  setCharacter(c: Character): void;
} {
  const scene = new Scene();
  addLights(scene);
  const camera = new PerspectiveCamera(28, 1, 1, 500);
  camera.position.set(0, 15, 62);
  camera.lookAt(0, 10.5, 0);
  const ped = new Mesh(
    new CylinderGeometry(13, 13.5, 1.4, 40),
    new MeshLambertMaterial({ color: 0x7cc35a }),
  );
  ped.position.y = -0.7;
  scene.add(ped, shadowBlob(7));

  let rig: Rig | null = null;
  const setCharacter = (c: Character) => {
    if (rig?.key === c) return;
    if (rig) disposeChar(rig);
    rig = buildChar(c);
    rig.pose = 'idle';
    rig.root.rotation.y = 0.5;
    scene.add(rig.root);
  };
  setCharacter(character);

  return {
    scene,
    camera,
    setCharacter,
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(t, dt) {
      if (!rig) return;
      rig.root.rotation.y += dt * (reducedMotion() ? 0.35 : 0.9);
      animChar(rig, t, dt);
    },
  };
}
