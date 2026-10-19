import {
  chromium,
  devices,
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';

// Konteks dari `browser.newContext()` tidak ditutup otomatis; tanpa ini halaman tes sebelumnya
// tetap merender arena 3D dan memperlambat tes berikutnya.
test.afterEach(async ({ browser }) => {
  for (const context of browser.contexts()) await context.close();
});

/** Dua pemain di konteks browser terpisah, sudah di lobby yang sama. */
async function twoPlayers(browser: Browser, options?: BrowserContextOptions) {
  const host = await (await browser.newContext(options)).newPage();
  await host.goto('/');
  await host.getByRole('button', { name: 'Play' }).click();
  await host.getByRole('button', { name: 'Buat Room' }).click();
  const code = (await host.locator('strong.code').textContent())!.trim();
  const p2 = await (await browser.newContext(options)).newPage();
  await p2.goto(`/?room=${code}`);
  await p2.getByRole('button', { name: 'Masuk' }).click();
  await expect(host.getByText('Menunggu pemain...')).toBeHidden();
  return { host, p2 };
}

async function start(host: Page, ...players: Page[]) {
  await host.getByRole('button', { name: 'Mulai' }).click();
  for (const p of players) {
    await expect(p.getByTestId('game')).toBeVisible();
    await expect(p.getByTestId('countdown')).toBeHidden({ timeout: 10_000 });
  }
}

async function answer(page: Page) {
  const text = (await page.getByTestId('question').textContent())!;
  const [a, b] = text.split('×').map((s) => Number(s.trim()));
  await page.keyboard.type(String(a! * b!));
  await page.keyboard.press('Enter');
}

async function ko(host: Page) {
  for (let i = 0; i < 5; i++) await answer(host);
  await expect(host.getByTestId('result-title')).toHaveText('Kamu Menang');
}

const canvasCount = (page: Page) => page.locator('canvas').count();

test('satu canvas WebGL di semua layar, avatar tampil', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  expect(await canvasCount(page)).toBe(0);

  await page.getByRole('button', { name: 'Pilih Karakter' }).click();
  const avatars = page.locator('.avatars img');
  await expect(avatars).toHaveCount(5);
  for (const img of await avatars.all()) {
    expect(await img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  }
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Beruang' }).click();
  await page.getByRole('button', { name: '‹ Kembali' }).click();
  expect(await canvasCount(page)).toBe(0);
  await page.close();

  const { host, p2 } = await twoPlayers(browser);
  for (const p of [host, p2]) {
    expect(await canvasCount(p)).toBe(0);
    await expect(p.getByTestId('slot-avatar')).toHaveCount(2);
    expect(await p.getByTestId('slot-avatar').first().getAttribute('src')).toMatch(/^data:/);
  }

  await start(host, host, p2);
  for (const p of [host, p2]) await expect(p.locator('canvas')).toHaveCount(1);
  await ko(host);
  for (const p of [host, p2]) await expect(p.locator('canvas')).toHaveCount(1);
});

test('semua request ke origin sendiri (font ikut di-bundle)', async ({ browser, baseURL }) => {
  const origin = new URL(baseURL!).host;
  const { host, p2 } = await twoPlayers(browser);
  const foreign: string[] = [];
  for (const p of [host, p2]) {
    p.on('request', (r) => {
      const url = new URL(r.url());
      if (url.protocol !== 'data:' && url.host !== origin) foreign.push(r.url());
    });
    p.on('websocket', (ws) => {
      if (new URL(ws.url()).host !== origin) foreign.push(ws.url());
    });
    await p.reload();
  }
  await expect(host.getByRole('button', { name: 'Mulai' })).toBeEnabled();
  await start(host, host, p2);
  await ko(host);
  expect(foreign).toEqual([]);
});

test('layar 320 px: tanpa scroll horizontal, keypad terlihat penuh', async ({ browser }) => {
  const { host, p2 } = await twoPlayers(browser);
  await host.setViewportSize({ width: 320, height: 640 });
  await start(host, host, p2);

  const overflow = await host.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  for (const key of [
    host.getByRole('group', { name: 'Keypad jawaban' }),
    host.getByRole('button', { name: 'Enter' }),
  ]) {
    const box = (await key.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.y + box.height).toBeLessThanOrEqual(640);
  }
});

test('tanpa WebGL: tali 2D tetap jalan sampai KO, tanpa error di console', async ({ baseURL }) => {
  const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2'] });
  try {
    const { host, p2 } = await twoPlayers(browser, { ...devices['Pixel 7'], baseURL });
    const errors: string[] = [];
    for (const p of [host, p2]) {
      p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      p.on('pageerror', (e) => errors.push(e.message));
    }
    await start(host, host, p2);
    await expect(host.getByText('Browser ini tidak bisa menampilkan 3D')).toBeVisible();
    expect(await canvasCount(host)).toBe(0);

    const rope = p2.locator('.rope');
    const before = await rope.evaluate((el) => el.style.right);
    await answer(host);
    await expect(p2.getByTestId('arena')).toHaveAttribute('data-diff', '1');
    expect(await rope.evaluate((el) => el.style.right)).not.toBe(before);

    for (let i = 0; i < 4; i++) await answer(host);
    await expect(host.getByTestId('result-reason')).toHaveText('KO');
    await expect(p2.getByTestId('result-title')).toHaveText('Kamu Kalah');
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
