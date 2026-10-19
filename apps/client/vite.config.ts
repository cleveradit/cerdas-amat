import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// Saat dev, /api dan /ws diteruskan ke `wrangler dev` di port 8787.
const worker = 'http://localhost:8787';

export default defineConfig({
  plugins: [svelte()],
  server: {
    // Izinkan tunnel `cloudflared` untuk tes di HP lewat HTTPS.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': worker,
      '/ws': { target: worker, ws: true },
    },
  },
});
