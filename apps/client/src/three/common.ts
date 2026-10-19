import {
  CircleGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  type Scene,
} from 'three';

/**
 * Lampu preview (Three.js r128). r155 menghapus mode lampu lama, jadi intensitas dikali π
 * agar terang voxel sama dengan preview.
 */
export function addLights(s: Scene): void {
  s.add(new HemisphereLight(0xffffff, 0x6f9a5a, 0.85 * Math.PI));
  const d = new DirectionalLight(0xffffff, 0.72 * Math.PI);
  d.position.set(25, 45, 35);
  s.add(d);
  const d2 = new DirectionalLight(0xcfe4ff, 0.28 * Math.PI);
  d2.position.set(-30, 12, -20);
  s.add(d2);
}

export function shadowBlob(r: number): Mesh {
  const m = new Mesh(
    new CircleGeometry(r, 28),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  return m;
}
