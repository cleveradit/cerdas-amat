/**
 * Selisih jam client dengan server, dari pertukaran `sync`. Hanya sampel dengan
 * round-trip terpendek yang dipakai, karena paling sedikit dipengaruhi antrean jaringan.
 */
let offsetMs = 0;
let bestRttMs = Infinity;

export function applySync(t: number, serverNow: number, receivedAt: number): void {
  const rtt = receivedAt - t;
  if (rtt < 0 || rtt > bestRttMs * 2) return;
  bestRttMs = Math.min(bestRttMs, rtt);
  offsetMs = serverNow - (t + rtt / 2);
}

/** Perkiraan jam server saat ini (epoch ms). */
export function serverNow(): number {
  return Date.now() + offsetMs;
}
