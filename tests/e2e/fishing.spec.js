import { test, expect } from './fixtures.js';
test('M3: Fishing visual review, ten rounds and context loss keep a single result', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:4173/')) external.push(req.url()); });
  await page.goto('/'); await page.getByRole('button', { name: 'Chơi thử', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/launcher.png', fullPage: true });
  await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  await expect(page.locator('.stage canvas')).toBeVisible();
  await expect(page.locator('.game-loading')).toBeHidden();
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  // Pause freezes simulation for a stable image. Hide only pause dialog for the review screenshot.
  await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = 'hidden'; });
  await page.screenshot({ path: 'docs/screenshots/fishing.png' });
  await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = ''; });
  const geometryCounts = [];
  for (let i = 0; i < 10; i++) {
    await expect(page.locator('.game-loading')).toBeHidden();
    geometryCounts.push(Number(await page.locator('.stage canvas').getAttribute('data-geometries')));
    await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click();
    await expect(page.locator('.result-title')).not.toBeEmpty();
    if (i < 9) await page.getByRole('button', { name: 'Chơi tiếp', exact: true }).click();
  }
  expect(Math.max(...geometryCounts) - Math.min(...geometryCounts)).toBeLessThanOrEqual(1);
  console.info('Fishing geometry counts:', geometryCounts.join(', '));
  await page.getByRole('button', { name: 'Chơi tiếp', exact: true }).click();
  await expect(page.locator('.game-loading')).toBeHidden();
  await page.locator('.stage canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('.fallback-scene')).toBeVisible();
  await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click();
  await expect(page.locator('.result-title')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Về gọi lên bảng', exact: true }).click();
  await page.getByRole('button', { name: 'Lịch sử', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(11);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
