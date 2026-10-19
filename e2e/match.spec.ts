import { expect, test, type Browser, type Page } from '@playwright/test';

/** Dua pemain di konteks browser terpisah (seperti dua HP), sudah di lobby yang sama. */
async function twoPlayers(browser: Browser, duration?: 30 | 60) {
  const host = await (await browser.newContext()).newPage();
  await host.goto('/');
  await host.getByRole('button', { name: 'Play' }).click();
  await host.getByRole('button', { name: 'Buat Room' }).click();
  const code = (await host.locator('strong.code').textContent())!.trim();

  const p2Context = await browser.newContext();
  const p2 = await p2Context.newPage();
  await p2.goto(`/?room=${code}`);
  await p2.getByRole('button', { name: 'Masuk' }).click();
  await expect(host.getByText('Menunggu pemain...')).toBeHidden();

  if (duration) await host.locator('select#duration').selectOption(String(duration));
  return { host, p2, p2Context, code };
}

async function start(host: Page, ...players: Page[]) {
  await host.getByRole('button', { name: 'Mulai' }).click();
  for (const p of players) {
    await expect(p.getByTestId('game')).toBeVisible();
    await expect(p.getByTestId('countdown')).toBeHidden({ timeout: 5000 });
  }
}

/** Jawab soal yang tampil dengan keyboard fisik. */
async function answer(page: Page) {
  const text = (await page.getByTestId('question').textContent())!;
  const [a, b] = text.split('×').map((s) => Number(s.trim()));
  await page.keyboard.type(String(a! * b!));
  await page.keyboard.press('Enter');
}

const diffOf = (page: Page) => page.getByTestId('arena').getAttribute('data-diff');

test('pertandingan sampai KO, tali sama di kedua layar', async ({ browser }) => {
  const { host, p2 } = await twoPlayers(browser);
  await start(host, host, p2);

  for (let i = 1; i <= 5; i++) {
    await answer(host);
    if (i < 5) {
      await expect(host.getByTestId('arena')).toHaveAttribute('data-diff', String(i));
      await expect(p2.getByTestId('arena')).toHaveAttribute('data-diff', String(i));
    }
  }

  await expect(host.getByTestId('result-title')).toHaveText('Kamu Menang');
  await expect(host.getByTestId('result-reason')).toHaveText('KO');
  await expect(p2.getByTestId('result-title')).toHaveText('Kamu Kalah');
  await expect(p2.getByTestId('result-reason')).toHaveText('KO');
});

test('jawaban salah mengosongkan kolom tanpa menggeser tali', async ({ browser }) => {
  const { host, p2 } = await twoPlayers(browser);
  await start(host, host, p2);
  const before = await host.getByTestId('question').textContent();
  await host.keyboard.type('0');
  await host.keyboard.press('Enter');
  await expect(host.getByText('Belum tepat, coba lagi')).toBeVisible();
  await expect(host.getByTestId('question')).toHaveText(before!);
  expect(await diffOf(p2)).toBe('0');
});

test('waktu habis: menang 2:1, kembali ke room, lalu seri', async ({ browser }) => {
  const { host, p2 } = await twoPlayers(browser, 30);
  await start(host, host, p2);
  await answer(host);
  await answer(host);
  await answer(p2);
  await expect(host.getByTestId('arena')).toHaveAttribute('data-diff', '1');

  await expect(host.getByTestId('result-title')).toHaveText('Kamu Menang', { timeout: 40_000 });
  await expect(host.getByTestId('result-reason')).toHaveText('Waktu habis');
  await expect(p2.getByTestId('result-title')).toHaveText('Kamu Kalah');
  for (const p of [host, p2]) await expect(p.getByTestId('result-score')).toContainText('2 : 1');

  await host.getByRole('button', { name: 'Kembali ke room' }).click();
  await expect(host.getByText('Melihat hasil...')).toBeVisible();
  await expect(host.getByRole('button', { name: 'Mulai' })).toBeDisabled();
  await p2.getByRole('button', { name: 'Kembali ke room' }).click();
  await expect(host.getByRole('button', { name: 'Mulai' })).toBeEnabled();

  await start(host, host, p2);
  for (const p of [host, p2]) {
    await expect(p.getByTestId('result-title')).toHaveText('Seri', { timeout: 40_000 });
  }
});

test('putus sebentar dilanjutkan; putus lebih dari 10 detik = WO', async ({ browser }) => {
  const { host, p2, p2Context, code } = await twoPlayers(browser);
  await start(host, host, p2);

  // Tab Player 2 ditutup lalu dibuka lagi dalam 10 detik.
  await p2.close();
  await expect(host.getByTestId('paused')).toBeVisible();
  const frozen = Number(await host.getByTestId('timer').textContent());
  const back = await p2Context.newPage();
  await back.goto(`/?room=${code}`);
  await expect(back.getByTestId('game')).toBeVisible();
  await expect(host.getByTestId('paused')).toBeHidden();
  const resumed = Number(await host.getByTestId('timer').textContent());
  expect(Math.abs(resumed - frozen)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(Number(await back.getByTestId('timer').textContent()) - resumed),
  ).toBeLessThanOrEqual(1);

  // Tab ditutup lagi dan tidak kembali.
  await back.close();
  await expect(host.getByTestId('paused')).toBeVisible();
  await expect(host.getByTestId('result-reason')).toHaveText('Menang WO', { timeout: 15_000 });
  await expect(host.getByTestId('result-title')).toHaveText('Kamu Menang');
});
