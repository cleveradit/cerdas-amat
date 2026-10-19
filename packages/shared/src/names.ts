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
