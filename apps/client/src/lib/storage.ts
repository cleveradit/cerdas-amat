import { CHARACTERS, cleanName, isBadName, randomName, type Character } from '@cerdas-amat/shared';
import type { Volumes } from '../audio/audio';

export interface Profile {
  name: string;
  character: Character;
}

const PROFILE_KEY = 'cerdas-amat:profile';
const VOLUME_KEY = 'cerdas-amat:volume';
const DEFAULT_VOLUMES: Volumes = { music: 50, sfx: 80 };
const tokenKey = (code: string) => `cerdas-amat:token:${code}`;

// localStorage bisa melempar error (mode privat, situs diblokir); game tetap jalan tanpanya.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Abaikan.
  }
}

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(read(PROFILE_KEY) ?? 'null') as Partial<Profile> | null;
    const name = p?.name ? cleanName(p.name) : null;
    const character = CHARACTERS.find((c) => c === p?.character);
    if (name && character) return { name: isBadName(name) ? randomName() : name, character };
  } catch {
    // Data rusak: buat profil baru.
  }
  return { name: randomName(), character: 'kucing' };
}

export function saveProfile(profile: Profile): void {
  write(PROFILE_KEY, JSON.stringify(profile));
}

export const loadToken = (code: string) => read(tokenKey(code));
export const saveToken = (code: string, token: string) => write(tokenKey(code), token);
export const clearToken = (code: string) => write(tokenKey(code), null);

const isVolume = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;

/** Nilai yang rusak atau di luar 0–100 diganti default. */
export function loadVolumes(): Volumes {
  let v: Partial<Volumes> | null = null;
  try {
    v = JSON.parse(read(VOLUME_KEY) ?? 'null') as Partial<Volumes> | null;
  } catch {
    // Data rusak: pakai default.
  }
  const music = v?.music;
  const sfx = v?.sfx;
  return {
    music: isVolume(music) ? music : DEFAULT_VOLUMES.music,
    sfx: isVolume(sfx) ? sfx : DEFAULT_VOLUMES.sfx,
  };
}

export function saveVolumes(v: Volumes): void {
  write(VOLUME_KEY, JSON.stringify(v));
}
