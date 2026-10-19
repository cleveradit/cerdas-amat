// Render ikon PWA dari apps/client/pwa/icon.svg ke PNG di apps/client/public/icons/.
// Dijalankan manual saat ikon diubah (`pnpm pwa-icons`), memakai Chromium milik Playwright.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../apps/client/pwa/icon.svg', import.meta.url), 'utf8');
const out = (name) => new URL(`../apps/client/public/icons/${name}`, import.meta.url).pathname;

// `rounded`: sudut membulat dan transparan (purpose "any"). Maskable dan Apple penuh sampai tepi,
// karena sistem memotong bentuknya sendiri (iOS mengisi bagian transparan dengan hitam).
const ICONS = [
  { name: 'icon-192.png', size: 192, rounded: true },
  { name: 'icon-512.png', size: 512, rounded: true },
  { name: 'icon-512-maskable.png', size: 512, rounded: false },
  { name: 'apple-touch-icon-180.png', size: 180, rounded: false },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { name, size, rounded } of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.evaluate(
    ({ size, rounded }) => {
      const el = document.querySelector('svg');
      el.setAttribute('width', String(size));
      el.setAttribute('height', String(size));
      if (rounded) document.getElementById('bg').setAttribute('rx', '112');
    },
    { size, rounded },
  );
  await page.locator('svg').screenshot({ path: out(name), omitBackground: true });
  console.log(name);
}
await browser.close();
