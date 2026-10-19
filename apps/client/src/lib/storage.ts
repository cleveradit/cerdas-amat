import { CHARACTERS, cleanName, randomName, type Character } from '@cerdas-amat/shared';

export interface Profile {
  name: string;
  character: Character;
}

const PROFILE_KEY = 'cerdas-amat:profile';
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
    if (name && character) return { name, character };
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
