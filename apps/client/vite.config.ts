import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Saat dev, /api dan /ws diteruskan ke `wrangler dev` di port 8787.
const worker = 'http://localhost:8787';
// Sama dengan --sky di theme.css.
const sky = '#CFEBF7';

export default defineConfig({
  plugins: [
    svelte(),
    // Service worker hanya menyimpan aset; game tetap butuh internet (tanpa mode offline).
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      // Ikon sudah ikut lewat globPatterns (png); tanpa ini tercatat dua kali di precache.
      includeManifestIcons: false,
      manifest: {
        name: 'Tarik Tambang Matematika',
        short_name: 'Tarik Tambang',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: sky,
        theme_color: sky,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,mp3}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
      },
    }),
  ],
  server: {
    // Izinkan tunnel `cloudflared` untuk tes di HP lewat HTTPS.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': worker,
      '/ws': { target: worker, ws: true },
    },
  },
});
