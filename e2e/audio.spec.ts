import { expect, test, type Page } from '@playwright/test';

test.afterEach(async ({ browser }) => {
  for (const context of browser.contexts()) await context.close();
});

/** Pesan console dan error halaman yang menyebut audio. */
function audioProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type()) && /audio/i.test(msg.text())) {
      problems.push(msg.text());
    }
  });
  page.on('pageerror', (err) => problems.push(err.message));
  return problems;
}

/** URL setiap request file audio. */
function audioRequests(page: Page) {
  const urls: string[] = [];
  page.on('request', (req) => {
    if (/\.mp3$/.test(new URL(req.url()).pathname)) urls.push(req.url());
  });
  return urls;
}

test('Pengaturan: volume tersimpan setelah reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pengaturan' }).click();
  await page.getByLabel('Musik latar').fill('0');
  await page.getByLabel('Efek suara').fill('40');
  await expect(page.getByRole('dialog')).toContainText('40%');
  await page.getByRole('button', { name: 'Tutup' }).click();

  await page.reload();
  await page.getByRole('button', { name: 'Pengaturan' }).click();
  await expect(page.getByLabel('Musik latar')).toHaveValue('0');
  await expect(page.getByLabel('Efek suara')).toHaveValue('40');
});

test('offline: pesan tampil dan Play nonaktif, kembali online pesan hilang', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const text = 'Butuh koneksi internet untuk bermain';
  await context.setOffline(true);
  await expect(page.getByRole('alert')).toHaveText(text);
  await expect(page.getByRole('button', { name: 'Play' })).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByText(text)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled();
});

test('audio dibuka setelah gestur pertama, bukan saat halaman dimuat', async ({
  page,
  browser,
}) => {
  const host = await (await browser.newContext()).newPage();
  await host.goto('/');
  await host.getByRole('button', { name: 'Play' }).click();
  await host.getByRole('button', { name: 'Buat Room' }).click();
  const code = (await host.locator('strong.code').textContent())!.trim();

  const problems = audioProblems(page);
  const requests = audioRequests(page);
  await page.goto(`/?room=${code}`);
  await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(requests).toEqual([]);

  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect.poll(() => requests.length).toBe(10);
  expect(problems).toEqual([]);

  // audio.ts diam saat file gagal di-decode, jadi dicek langsung: semua file bisa diputar.
  const durations = await page.evaluate((urls) => {
    const ctx = new OfflineAudioContext(1, 1, 44100);
    return Promise.all(
      urls.map(
        async (u) => (await ctx.decodeAudioData(await (await fetch(u)).arrayBuffer())).duration,
      ),
    );
  }, requests);
  for (const d of durations) expect(d).toBeGreaterThan(0.05);
});

test('satu pertandingan sampai KO tanpa error audio, semua audio dari origin sendiri', async ({
  browser,
  baseURL,
}) => {
  const host = await (await browser.newContext()).newPage();
  const p2 = await (await browser.newContext()).newPage();
  const problems = [host, p2].map(audioProblems);
  const requests = audioRequests(host);

  await host.goto('/');
  await host.getByRole('button', { name: 'Play' }).click();
  await host.getByRole('button', { name: 'Buat Room' }).click();
  const code = (await host.locator('strong.code').textContent())!.trim();
  await p2.goto(`/?room=${code}`);
  await p2.getByRole('button', { name: 'Masuk' }).click();
  await expect(host.getByText('Menunggu pemain...')).toBeHidden();

  await host.getByRole('button', { name: 'Mulai' }).click();
  await expect(host.getByTestId('game')).toBeVisible();
  await expect(host.getByTestId('countdown')).toBeHidden({ timeout: 5000 });
  for (let i = 1; i <= 5; i++) {
    const [a, b] = (await host.getByTestId('question').textContent())!
      .split('×')
      .map((s) => Number(s.trim()));
    await host.keyboard.type(String(a! * b!));
    await host.keyboard.press('Enter');
    if (i < 5) await expect(host.getByTestId('arena')).toHaveAttribute('data-diff', String(i));
  }
  await expect(host.getByTestId('result-title')).toHaveText('Kamu Menang');
  await expect(p2.getByTestId('result-title')).toHaveText('Kamu Kalah');

  expect(requests.length).toBe(10);
  const origin = new URL(baseURL!).origin;
  for (const url of requests) expect(new URL(url).origin).toBe(origin);
  expect(problems.flat()).toEqual([]);
});
