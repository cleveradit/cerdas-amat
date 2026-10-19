import { expect, test } from '@playwright/test';

test.afterEach(async ({ browser }) => {
  for (const context of browser.contexts()) await context.close();
});

test('kuota habis saat buat room: pesan jelas di menu', async ({ page }) => {
  await page.route('**/api/rooms', (route) =>
    route.fulfill({ status: 503, json: { error: 'QUOTA' } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Buat Room' }).click();
  const text = 'Server sedang penuh, coba lagi setelah pukul 07.00 WIB';
  await expect(page.getByRole('alert').filter({ hasText: text }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Tutup' }).click();
  await expect(page.getByRole('alert')).toHaveText(text);
});

test('Bagikan tanpa Web Share: link disalin ke clipboard', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  // Chromium desktop di Linux tidak punya Web Share; dipastikan supaya jalur fallback yang diuji.
  await context.addInitScript(() => {
    delete (Navigator.prototype as { share?: unknown }).share;
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Buat Room' }).click();
  const code = (await page.locator('strong.code').textContent())!.trim();

  await page.getByRole('button', { name: 'Bagikan' }).click();
  await expect(page.getByText('Link disalin')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${new URL(baseURL!).origin}/?room=${code}`);
});

test('nama kasar di Pilih Karakter diganti nama acak', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pilih Karakter' }).click();
  const input = page.getByLabel('Nama');
  await input.fill('Bangsat');
  await input.press('Enter');
  await input.blur();
  await expect(page.getByText('Nama itu tidak boleh dipakai, diganti nama acak')).toBeVisible();
  await expect(input).not.toHaveValue('Bangsat');
  await expect(input).not.toHaveValue('');
});
