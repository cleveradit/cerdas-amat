import { BAD_WORDS } from './badWords';

export const NAME_MAX = 12;

const NAMES = [
  'Kilat',
  'Gesit',
  'Bintang',
  'Jago',
  'Lincah',
  'Tangkas',
  'Cerdas',
  'Pintar',
  'Cepat',
  'Juara',
];

/** Nama acak seperti di preview karakter, misalnya "Kilat42". */
export function randomName(random: () => number = Math.random): string {
  return NAMES[Math.floor(random() * NAMES.length)]! + (10 + Math.floor(random() * 90));
}

/** Trim; `null` jika kosong atau lebih dari NAME_MAX karakter. */
export function cleanName(input: string): string | null {
  const name = input.trim();
  if (name.length === 0 || name.length > NAME_MAX) return null;
  return name;
}

const LEET: Record<string, string> = { '4': 'a', '1': 'i', '0': 'o', '3': 'e', '5': 's' };

/** Huruf kecil, angka mirip huruf diganti (`4→a`, `1→i`, `0→o`, `3→e`, `5→s`), selain a–z dibuang. */
export function normalizeForFilter(input: string): string {
  return input
    .toLowerCase()
    .replace(/[01345]/g, (d) => LEET[d]!)
    .replace(/[^a-z]/g, '');
}

/** `true` jika nama memuat kata kasar sebagai potongan, setelah dinormalisasi. */
export function isBadName(name: string): boolean {
  const normalized = normalizeForFilter(name);
  return BAD_WORDS.some((word) => normalized.includes(word));
}
