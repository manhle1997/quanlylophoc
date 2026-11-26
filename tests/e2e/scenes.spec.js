import { test, expect, captureReview } from './fixtures.js';
test('M5: five distinct scenes, local assets, replay and cleanup', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:4173/')) external.push(req.url()); });
  await page.goto('/'); await page.getByRole('button', { name: 'Chơi thử', exact: true }).click();
  for (const id of ['fishing', 'ufo', 'claw', 'marble', 'treasure', 'fishing', 'treasure']) {
    await page.locator(`[data-game=${id}]`).click(); await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
    await expect(page.locator('.stage canvas')).toBeVisible(); await expect(page.locator('.game-loading')).toBeHidden();
    await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = 'hidden'; });
    await captureReview(page, `${id}.png`);
    await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = ''; });
    console.info(`${id} drawCalls`, await page.locator('.stage canvas').getAttribute('data-draw-calls'));
    await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click();
    await expect(page.locator('.result-title')).not.toBeEmpty(); await page.getByRole('button', { name: 'Đổi game', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Lịch sử', exact: true }).click(); await expect(page.locator('tbody tr')).toHaveCount(7);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
