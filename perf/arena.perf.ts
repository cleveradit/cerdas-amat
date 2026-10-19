import { expect, test } from '@playwright/test';

const SECONDS = 10;
const MIN_AVG_FPS = 30;
const MIN_FPS = 25;

test('arena di tengah pertandingan: rata-rata ≥ 30 fps, tidak ada detik < 25 fps', async ({
  browser,
}) => {
  const host = await (await browser.newContext()).newPage();
  await host.goto('/?fps=1');
  await host.getByRole('button', { name: 'Play' }).click();
  await host.getByRole('button', { name: 'Buat Room' }).click();
  const code = (await host.locator('strong.code').textContent())!.trim();

  const p2 = await (await browser.newContext()).newPage();
  await p2.goto(`/?room=${code}`);
  await p2.getByRole('button', { name: 'Masuk' }).click();
  await host.getByRole('button', { name: 'Mulai' }).click();
  // Tunggu layar permainan dulu; sebelum itu overlay hitung mundur belum ada dan cek di bawah langsung lolos.
  await expect(host.getByTestId('game')).toBeVisible();
  await expect(host.getByTestId('countdown')).toBeHidden({ timeout: 5000 });

  // Satu jawaban benar agar tali tidak di posisi awal.
  const text = (await host.getByTestId('question').textContent())!;
  const [a, b] = text.split('×').map((s) => Number(s.trim()));
  await host.keyboard.type(String(a! * b!));
  await host.keyboard.press('Enter');
  await expect(host.getByTestId('arena')).toHaveAttribute('data-diff', '1');

  const cdp = await host.context().newCDPSession(host);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await host.waitForTimeout(2000); // fps detik pertama setelah throttling belum stabil

  const fps = host.getByTestId('fps');
  const samples: number[] = [];
  for (let i = 0; i < SECONDS; i++) {
    await host.waitForTimeout(1000);
    samples.push(parseInt((await fps.textContent())!, 10));
  }
  const avg = samples.reduce((s, x) => s + x, 0) / samples.length;
  console.log(`fps per detik: ${samples.join(', ')} · rata-rata ${avg.toFixed(1)}`);
  expect(avg).toBeGreaterThanOrEqual(MIN_AVG_FPS);
  expect(Math.min(...samples)).toBeGreaterThanOrEqual(MIN_FPS);
});
