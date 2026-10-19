import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Tes waktu habis memakai durasi 30 detik penuh, dua kali. Arena 3D dirender WebGL
  // perangkat lunak di semua halaman paralel, jadi diberi ruang lebih.
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
    // Pakai GPU jika ada; tanpa GPU (runner CI) Chromium kembali ke WebGL perangkat lunak.
    launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'pnpm dev',
    // Lewat proxy Vite ke `wrangler dev`, jadi siap hanya jika keduanya hidup.
    url: 'http://localhost:5173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
