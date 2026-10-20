/**
 * Musik dan efek suara lewat Web Audio API: satu AudioContext, satu GainNode untuk musik
 * dan satu untuk efek suara. File baru dimuat setelah gestur pertama (aturan autoplay).
 */

export type Sfx = 'key' | 'correct' | 'wrong' | 'tug' | 'countdown' | 'win' | 'lose' | 'draw';
export type Music = 'menu' | 'game';

/** Volume 0–100. */
export interface Volumes {
  music: number;
  sfx: number;
}

const SFX: readonly Sfx[] = ['key', 'correct', 'wrong', 'tug', 'countdown', 'win', 'lose', 'draw'];
const MUSIC: readonly Music[] = ['menu', 'game'];

let ctx: AudioContext | null = null;
let musicGain: GainNode;
let sfxGain: GainNode;
const buffers = new Map<string, AudioBuffer>();
let volumes: Volumes = { music: 50, sfx: 80 };
let wanted: Music | null = null;
let playing: { track: Music; source: AudioBufferSourceNode } | null = null;

// Kuadrat agar slider terasa rata di telinga (volume linear terlalu keras di setengah bawah).
const gain = (v: number) => (v / 100) ** 2;

function applyVolumes() {
  if (!ctx) return;
  musicGain.gain.value = gain(volumes.music);
  sfxGain.gain.value = gain(volumes.sfx);
}

async function load(key: string) {
  try {
    const res = await fetch(`/audio/${key}.mp3`);
    if (!res.ok) return;
    buffers.set(key, await ctx!.decodeAudioData(await res.arrayBuffer()));
    if (key === `music-${wanted}`) startMusic();
  } catch {
    // File gagal dimuat: game tetap jalan tanpa suara itu.
  }
}

function startMusic() {
  if (!ctx || !wanted || playing?.track === wanted) return;
  const buffer = buffers.get(`music-${wanted}`);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(musicGain);
  source.start();
  playing = { track: wanted, source };
}

function stopMusic() {
  playing?.source.stop();
  playing = null;
}

export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
  } catch {
    return; // browser tanpa Web Audio: tanpa suara
  }
  musicGain = ctx.createGain();
  sfxGain = ctx.createGain();
  musicGain.connect(ctx.destination);
  sfxGain.connect(ctx.destination);
  applyVolumes();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void ctx!.suspend();
    else void ctx!.resume();
  });
  // Efek suara kecil dimuat dulu, lalu musik.
  for (const name of SFX) void load(`sfx-${name}`);
  for (const name of MUSIC) void load(`music-${name}`);
}

export function playSfx(name: Sfx): void {
  const buffer = buffers.get(`sfx-${name}`);
  if (!ctx || ctx.state !== 'running' || !buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(sfxGain);
  source.start();
}

export function setMusic(track: Music | null): void {
  if (track === wanted) return;
  wanted = track;
  stopMusic();
  startMusic();
}

export function setVolumes(v: Volumes): void {
  volumes = v;
  applyVolumes();
}
