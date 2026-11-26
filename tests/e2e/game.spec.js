import { test, expect } from './fixtures.js';
test('M2: cancel, skip, pause/resume and 40 unique results without duplicate commits', async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: 'Chơi thử', exact: true }).click();
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Dùng chế độ tương thích 2D cho phiên này' }).check();
  await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  await expect(page.locator('.game-loading')).toBeHidden();
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tạm dừng một chút' })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Dừng lượt', exact: true }).click();
  await page.getByRole('button', { name: 'Dừng và không ghi kết quả', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  const names = [];
  for (let i = 0; i < 40; i++) {
    await expect(page.locator('.game-loading')).toBeHidden();
    await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click();
    names.push(await page.locator('.result-title').textContent());
    if (i < 39) await page.getByRole('button', { name: 'Chơi tiếp', exact: true }).click();
  }
  expect(new Set(names).size).toBe(40);
  await expect(page.getByRole('button', { name: 'Tạo vòng mới', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Về gọi lên bảng', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu gọi' })).toBeDisabled();
  await page.getByRole('button', { name: 'Lịch sử', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(40); expect(errors).toEqual([]);
});
