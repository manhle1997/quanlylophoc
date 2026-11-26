import { test, expect, captureReview, APP_VERSION } from './fixtures.js';

for (const width of [390, 768, 1440]) {
  test(`update settings and exact copyright at ${width}px`, async ({ page, storage }) => {
    await page.setViewportSize({ width, height: 900 });
    const external = [];
    page.on('request', req => { if (!new URL(req.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) external.push(req.url()); });
    await page.goto('/');
    await expect(page.locator('.app-copyright')).toHaveText("Sản phẩm của July Tech's Team. Mọi quyền được bảo lưu");
    await expect(page.locator('.app-copyright strong')).toHaveText("July Tech's Team");
    await page.locator('[data-page="settings"]:visible').first().click();
    await expect(page.locator('.app-version')).toHaveText(APP_VERSION);
    expect(storage.updateRequests).toEqual([{ path: '/api/updates', method: 'GET' }]);
    await page.getByRole('button', { name: 'Kiểm tra cập nhật', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Bản thử nghiệm' })).toBeVisible();
    await page.getByRole('button', { name: 'Tải bản mới', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'đã sẵn sàng' })).toBeVisible();
    await page.getByRole('button', { name: 'Cài đặt và mở lại', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Lớp học, hồ sơ, ảnh');
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(page.locator('#update-apply')).toBeFocused();
    expect(storage.updateRequests.some(r => r.path.endsWith('/apply'))).toBe(false);
    expect(external).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.app-copyright').scrollIntoViewIfNeeded();
    await expect(page.locator('.app-copyright')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await captureReview(page, `update-settings-${width}.png`, { fullPage: true });
  });
}

test('offline check gives a retry and leaves classroom available', async ({ page, storage }) => {
  storage.updateError = true;
  await page.goto('/'); await page.locator('[data-page="settings"]:visible').first().click();
  await page.getByRole('button', { name: 'Kiểm tra cập nhật', exact: true }).click();
  await expect(page.locator('[data-updates]')).toContainText('Kiểm tra kết nối Internet');
  await page.locator('[data-page="classes"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'Quản lý học sinh', exact: true })).toBeVisible();
});
