import { expect, test } from '@playwright/test';

// Dijalankan terhadap hasil build (`vite preview`, proyek `pwa` di playwright.config.ts),
// karena manifest dan service worker hanya dibuat saat build.

test('manifest: standalone, portrait, ikon 192 dan 512 tersaji', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    name: 'Tarik Tambang Matematika',
    short_name: 'Tarik Tambang',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'id',
  });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) {
    const img = await request.get(icon.src);
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toBe('image/png');
  }
  expect((await request.get('/icons/apple-touch-icon-180.png')).status()).toBe(200);
});

test('service worker aktif; reload saat offline tetap menampilkan menu', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // Halaman pertama belum dikendalikan service worker sampai reload.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tarik Tambang Matematika' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Butuh koneksi internet untuk bermain');
  await expect(page.getByRole('button', { name: 'Play' })).toBeDisabled();
});
