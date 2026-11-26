import { test, expect } from './fixtures.js';
test('M6: 30 scene switches do not grow live geometry counters or add outbound requests', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [], external = [], counters = {}, textures = {};
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => { if (new URL(route.request().url()).origin === 'http://127.0.0.1:4173') route.fallback(); else { external.push(route.request().url()); route.abort(); } });
  await page.goto('/'); await page.getByRole('button', { name: 'Chơi thử', exact: true }).click();
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page.locator('[data-setting=quality]').selectOption('low'); await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click();
  const ids = ['fishing', 'ufo', 'claw', 'marble', 'treasure'];
  for (let i = 0; i < 30; i++) {
    const id = ids[i % 5]; await page.locator(`[data-game=${id}]`).click(); await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
    await expect(page.locator('.stage canvas')).toBeVisible(); await expect(page.locator('.game-loading')).toBeHidden();
    const count = Number(await page.locator('.stage canvas').getAttribute('data-geometries'));
    (counters[id] ??= []).push(count);
    (textures[id] ??= []).push(Number(await page.locator('.stage canvas').getAttribute('data-textures')));
    await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click(); await page.getByRole('button', { name: 'Đổi game', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('.character-speech')).toHaveCount(0);
  }
  for (const counts of Object.values(counters)) expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  for (const counts of Object.values(textures)) expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  console.info('30-loop live geometry counters:', JSON.stringify(counters));
  console.info('30-loop live texture counters:', JSON.stringify(textures));
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
