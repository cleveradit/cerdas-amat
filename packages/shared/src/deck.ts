export type Question = [number, number];

/** Sama, atau pasangan tukar (3 × 4 lalu 4 × 3): tidak boleh berurutan. */
function clash(p: Question, q: Question): boolean {
  return (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);
}

function isValidDeck(deck: Question[], prev: Question | null): boolean {
  if (prev && clash(prev, deck[0]!)) return false;
  for (let i = 0; i < deck.length - 1; i++) {
    if (clash(deck[i]!, deck[i + 1]!)) return false;
  }
  return true;
}

/**
 * Acak 81 soal a × b (a, b = 1–9). Hasil acak yang melanggar aturan urutan
 * ditolak lalu diacak ulang; peluang lolos sekitar 40% per percobaan.
 * `prev` = soal terakhir deck sebelumnya, supaya sambungan deck juga aman.
 */
export function makeDeck(prev: Question | null, random: () => number = Math.random): Question[] {
  const deck: Question[] = [];
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) deck.push([a, b]);

  for (let attempt = 0; attempt < 1000; attempt++) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    if (isValidDeck(deck, prev)) return deck.map((q) => [q[0], q[1]]);
  }
  throw new Error('makeDeck: gagal membuat deck yang sah');
}
