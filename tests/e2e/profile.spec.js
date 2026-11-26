import { test, expect } from './fixtures.js';
import { createDemo } from '../../src/core/domain/demo.js';
import { DEFAULT_PROFILE } from '../../src/core/profile/profile-service.js';

for (const [width, height] of [[1440, 960], [768, 1024], [390, 844]]) {
  test(`Personal profile: autosave, copied images, theme and responsive layout at ${width}px`, async ({ page, storage }) => {
    storage.document = createDemo(); const classData = structuredClone(storage.document);
    await page.setViewportSize({ width, height }); await page.goto('/');
    await page.getByRole('button', { name: 'Mở thông tin cá nhân', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Thông tin cá nhân', exact: true })).toBeVisible();
    await page.getByLabel('Họ và tên', { exact: true }).fill('Giáo viên minh họa');
    await page.getByLabel('Tên trường', { exact: true }).fill('Trường học minh họa');
    await page.getByLabel('Môn dạy / Chức vụ', { exact: true }).fill('Giáo viên chủ nhiệm');
    await page.getByLabel('Email', { exact: true }).fill('minhhoa@example.test');
    await page.getByLabel('Số điện thoại', { exact: true }).fill('000 000 0000');
    await page.getByRole('button', { name: 'Xanh biển', exact: true }).click();
    const png = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eaf1e9'; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#285d85'; ctx.font = '600 46px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GV', 64, 66);
      return canvas.toDataURL('image/png').split(',')[1];
    }), 'base64');
    await page.getByLabel('Chọn ảnh đại diện', { exact: true }).setInputFiles({ name: 'anh-minh-hoa.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('[data-profile-status]')).toHaveText('Hồ sơ được lưu tự động');
    await page.getByLabel('Chọn logo trường', { exact: true }).setInputFiles({ name: 'logo-minh-hoa.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('[data-profile-status]')).toHaveText('Hồ sơ được lưu tự động');
    expect(storage.profile.teacherName).toBe('Giáo viên minh họa'); expect(storage.profile.accentColor).toBe('#285d85'); expect(storage.images.size).toBe(1);
    expect(storage.document).toEqual(classData); expect(storage.writes).toBe(0);
    await page.reload(); await page.getByRole('button', { name: 'Mở thông tin cá nhân', exact: true }).click();
    await expect(page.getByLabel('Tên trường', { exact: true })).toHaveValue('Trường học minh họa');
    await expect(page.getByRole('button', { name: 'Xanh biển', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.profile-image-preview img').evaluateAll(images => images.length === 2 && images.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/profile-${width}.png`, fullPage: true });
    await page.locator('[data-remove-profile-image="avatar"]').click();
    await expect(page.locator('.profile-image-preview[data-profile-image="avatar"] img')).toHaveCount(0);
    await expect(page.locator('[data-profile-status]')).toHaveText('Hồ sơ được lưu tự động');
    expect(storage.profile.avatar).toBeNull(); expect(storage.images.size).toBe(1);
    await page.getByLabel('Chọn ảnh đại diện', { exact: true }).setInputFiles({ name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    await expect(page.locator('[data-profile-image-error="avatar"]')).toContainText('PNG');
  });
}

test('Profile conflict preserves edits; confirmed reload adopts the other window without touching classes', async ({ page, storage }) => {
  storage.profile = { ...DEFAULT_PROFILE, teacherName: 'Tên đã lưu' };
  await page.goto('/'); await page.getByRole('button', { name: 'Mở thông tin cá nhân', exact: true }).click();
  storage.profileFail = 'CONFLICT';
  await page.getByLabel('Họ và tên', { exact: true }).fill('Tên chưa lưu');
  await expect(page.getByRole('button', { name: 'Tải lại hồ sơ', exact: true })).toBeVisible();
  await page.getByLabel('Tên trường', { exact: true }).fill('Nội dung giữ lại');
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Tên chưa lưu');
  expect(storage.profileWrites).toBe(0);
  storage.profileFail = null;
  await page.getByRole('button', { name: 'Tải lại hồ sơ', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Tải lại hồ sơ', exact: true }).click();
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Tên đã lưu');
  expect(storage.writes).toBe(0);
});
