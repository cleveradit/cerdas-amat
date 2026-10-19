import { defineConfig } from '@playwright/test';

/**
 * `pnpm perf`: fps arena di Chromium lokal (360×740, DPR 2, CPU 6× lebih lambat).
 * Tidak dijalankan di CI karena runner GitHub merender WebGL dengan CPU.
 */
export default defineConfig({
  testDir: 'perf',
  testMatch: '*.perf.ts',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    // Pakai GPU jika ada, seperti HP sungguhan.
    launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173/api/health',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
