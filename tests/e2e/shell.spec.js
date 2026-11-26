import { test, expect } from './fixtures.js';

test('M0: shell, synthetic demo, navigation and no external requests', async ({ page }) => {
  const external = [];
  page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:4173/')) external.push(req.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bắt đầu từ lớp học của bạn' })).toBeVisible();
  await page.getByRole('button', { name: 'Chơi thử', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Gọi học sinh/ })).toBeVisible();
  await expect(page.locator('.game-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Quản lý học sinh' }).click();
  await expect(page.getByRole('heading', { name: 'Quản lý học sinh', exact: true })).toBeVisible();
  expect(external).toEqual([]);
});
