import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Tes waktu habis memakai durasi 30 detik penuh.
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    // Lewat proxy Vite ke `wrangler dev`, jadi siap hanya jika keduanya hidup.
    url: 'http://localhost:5173/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
