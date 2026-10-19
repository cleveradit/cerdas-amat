import type { Character } from '@cerdas-amat/shared';
import { BoxGeometry, Color, Group, InstancedMesh, MeshLambertMaterial, Object3D } from 'three';
import { SPECS } from '../characters';
import type { Pose } from '../game/arena';
import { reducedMotion } from './motion';

export interface Rig {
  key: Character;
  root: Group;
  inner: Group;
  torso: Group;
  head: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
  tail: Group;
  pose: Pose;
  phase: number;
  cur: Angles | null;
}

const AK = ['torsoX', 'headX', 'armX', 'armZ', 'legA', 'legB', 'innerY', 'tailY'] as const;
type Angles = Record<(typeof AK)[number], number>;

const geo = new BoxGeometry(1, 1, 1);
const mat = new MeshLambertMaterial({ color: 0xffffff });

/** Variasi terang kecil per voxel agar permukaan tidak datar. */
function jit(x: number, y: number, z: number): number {
  const n = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
  return 0.93 + ((n % 1000) / 1000) * 0.1;
}

function meshFromMap(m: Map<string, number>, pv: [number, number, number]): InstancedMesh {
  const im = new InstancedMesh(geo, mat, m.size);
  const d = new Object3D();
  const c = new Color();
  let i = 0;
  for (const [k, col] of m) {
    const [x, y, z] = k.split(',').map(Number) as [number, number, number];
    d.position.set(x - pv[0], y - pv[1], z - pv[2]);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
    c.setHex(col).multiplyScalar(jit(x, y, z));
    im.setColorAt(i, c);
    i++;
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}

/** Karakter voxel dengan 7 bagian yang masing-masing berputar di leher, bahu, atau pinggul. */
export function buildChar(key: Character): Rig {
  const P = SPECS[key]();
  const root = new Group();
  const inner = new Group();
  root.add(inner);
  inner.position.y = 0.5;
  const grp = (
    pos: [number, number, number],
    map: Map<string, number>,
    pv: [number, number, number],
  ) => {
    const g = new Group();
    g.position.set(...pos);
    if (map.size) g.add(meshFromMap(map, pv));
    return g;
  };
  const legL = grp([-2, 3.5, 0], P.legL, [-2, 3.5, 0]);
  const legR = grp([2, 3.5, 0], P.legR, [2, 3.5, 0]);
  const torso = grp([0, 3.5, 0], P.body, [0, 3.5, 0]);
  const head = grp([0, 6, 0], P.head, [0, 9.5, 0]);
  const armL = grp([-4.5, 5.5, -0.5], P.armL, [-4.5, 9, -0.5]);
  const armR = grp([4.5, 5.5, -0.5], P.armR, [4.5, 9, -0.5]);
  const tail = grp([0, 1.5, -2.5], P.tail, [0, 5, -2.5]);
  torso.add(head, armL, armR, tail);
  inner.add(legL, legR, torso);
  return {
    key,
    root,
    inner,
    torso,
    head,
    armL,
    armR,
    legL,
    legR,
    tail,
    pose: 'pull',
    phase: Math.random() * 10,
    cur: null,
  };
}

/** Membuang mesh karakter (material dan geometri dipakai bersama, jadi tidak di-dispose). */
export function disposeChar(rig: Rig): void {
  rig.root.removeFromParent();
  rig.root.traverse((o) => {
    if (o instanceof InstancedMesh) o.dispose();
  });
}

function target(rig: Rig, t: number): Angles {
  const p = t + rig.phase;
  const R = reducedMotion() ? 0.35 : 1;
  const o: Angles = {
    torsoX: 0,
    headX: 0,
    armX: 0,
    armZ: 0,
    legA: 0,
    legB: 0,
    innerY: 0.5,
    tailY: 0,
  };
  switch (rig.pose) {
    case 'idle':
      o.torsoX = Math.sin(p * 2) * 0.03 * R;
      o.armX = Math.sin(p * 2) * 0.1 * R;
      o.armZ = 0.08;
      o.tailY = Math.sin(p * 3) * 0.5 * R;
      o.headX = Math.sin(p * 1.3) * 0.05 * R;
      break;
    case 'pull': {
      const w = Math.sin(p * 7) * R;
      o.torsoX = -0.42 + w * 0.05;
      o.armX = -1.15 - w * 0.08;
      o.legA = -0.45 + w * 0.12;
      o.legB = -0.2 - w * 0.12;
      o.headX = 0.18;
      o.tailY = w * 0.3;
      break;
    }
    case 'drag': {
      const w = Math.sin(p * 15) * R;
      o.torsoX = 0.42;
      o.armX = -1.75;
      o.legA = -0.5 + w * 0.6;
      o.legB = -0.5 - w * 0.6;
      o.innerY = 0.5 + Math.abs(w) * 0.5;
      o.headX = -0.3;
      o.tailY = w * 0.6;
      break;
    }
    case 'win': {
      const j = Math.abs(Math.sin(p * 4.5)) * R;
      o.innerY = 0.5 + j * 4;
      o.armX = -2.9 + Math.sin(p * 9) * 0.15 * R;
      o.armZ = 0.35;
      o.legA = -j * 0.5;
      o.legB = -j * 0.5;
      o.tailY = Math.sin(p * 10) * 0.6 * R;
      o.headX = -0.1;
      break;
    }
    case 'lose':
      o.innerY = -2.0;
      o.legA = -1.5;
      o.legB = -1.45;
      o.torsoX = 0.12 + Math.sin(p * 1.5) * 0.03 * R;
      o.headX = 0.45;
      o.armX = -0.25;
      o.armZ = 0.15;
      break;
  }
  return o;
}

/** Menggerakkan bagian tubuh menuju target pose dengan smoothing eksponensial. */
export function animChar(rig: Rig, t: number, dt: number): void {
  const tg = target(rig, t);
  if (!rig.cur) rig.cur = { ...tg };
  const k = 1 - Math.exp(-dt * 14);
  const v = rig.cur;
  for (const a of AK) v[a] += (tg[a] - v[a]) * k;
  rig.torso.rotation.x = v.torsoX;
  rig.head.rotation.x = v.headX;
  rig.armL.rotation.x = v.armX;
  rig.armR.rotation.x = v.armX;
  rig.armL.rotation.z = -v.armZ;
  rig.armR.rotation.z = v.armZ;
  rig.legL.rotation.x = v.legA;
  rig.legR.rotation.x = v.legB;
  rig.inner.position.y = v.innerY;
  rig.tail.rotation.y = v.tailY;
}
