import { test, expect } from './fixtures.js';
for (const [width, height] of [[1024, 576], [1280, 720], [1920, 1080], [1024, 768], [390, 844]]) {
  test(`M6: launcher CTA and dialog accessibility at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto('/');
    if (width === 1280) await page.screenshot({ path: 'docs/screenshots/dashboard-empty.png' });
    await page.getByRole('button', { name: 'Chơi thử', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Bắt đầu gọi' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Quản lý học sinh', exact: true }).click(); await page.getByRole('button', { name: 'Tạo lớp', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    if (width === 1280 || width === 390) await page.screenshot({ path: `docs/screenshots/dashboard-dialog-${width}.png` });
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tạo lớp', exact: true })).toBeFocused();
    if (width === 1280) {
      await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Cài đặt', exact: true })).toBeVisible();
      await page.screenshot({ path: 'docs/screenshots/dashboard-settings.png' });
    }
  });
}
