import { test, expect } from './fixtures.js';

test('automatic save: open, add a class and students, reload without file pickers or save buttons', async ({ page, storage }) => {
  await page.addInitScript(() => { window.showDirectoryPicker = window.showOpenFilePicker = window.showSaveFilePicker = () => { throw new Error('Teacher must never select a file'); }; });
  await page.goto('/'); await page.getByRole('button', { name: 'Tạo lớp đầu tiên' }).click();
  await page.getByLabel('Tên lớp', { exact: true }).fill('Lớp tự động giả');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo lớp', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động'); expect(storage.document.classes[0].name).toBe('Lớp tự động giả');
  await page.getByRole('button', { name: 'Nhập hàng loạt', exact: true }).click();
  await page.getByRole('textbox', { name: 'Mỗi dòng một họ và tên' }).fill(Array.from({ length: 40 }, (_, i) => `Học sinh giả ${i}`).join('\n'));
  await page.getByRole('button', { name: 'Xem trước danh sách' }).click(); await page.getByRole('button', { name: 'Xác nhận nhập danh sách' }).click();
  await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động'); expect(storage.document.classes[0].students).toHaveLength(40); expect(storage.backups.length).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Lưu dữ liệu', exact: true })).toHaveCount(0); await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page.reload(); await page.getByRole('button', { name: 'Quản lý học sinh', exact: true }).click(); await expect(page.locator('.roster-table tbody tr')).toHaveCount(40);
});

test('failed autosave remains visible, retries safely and does not clear pending changes', async ({ page, storage }) => {
  storage.fail = 'STORAGE_UNAVAILABLE'; await page.goto('/'); await page.getByRole('button', { name: 'Tạo lớp đầu tiên' }).click();
  await page.getByLabel('Tên lớp', { exact: true }).fill('Lớp giữ thay đổi'); await page.getByRole('dialog').getByRole('button', { name: 'Tạo lớp', exact: true }).click();
  await expect(page.locator('#autosave-warning')).toBeVisible(); expect(storage.writes).toBe(0); expect(storage.attempts).toBe(3);
  storage.fail = null; await page.getByRole('button', { name: 'Thử lưu lại', exact: true }).click(); await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động'); expect(storage.document.classes[0].name).toBe('Lớp giữ thay đổi');
  await expect(page.locator('#autosave-warning')).toHaveCount(0);
});

test('damaged stored data never becomes a new empty classroom', async ({ page, storage }) => {
  storage.loadError = 'CORRUPT_DATA'; await page.goto('/'); await expect(page.getByRole('heading', { name: 'Chưa mở được lớp học' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo lớp đầu tiên' })).toHaveCount(0); expect(storage.writes).toBe(0);
  await expect(page.locator('input[type=file]')).toHaveCount(0);
});
