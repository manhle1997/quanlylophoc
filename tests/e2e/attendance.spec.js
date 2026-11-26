import { test, expect, captureReview } from './fixtures.js';
import { createDemo } from '../../src/core/domain/demo.js';
import { todayKey, setAttendanceStatus } from '../../src/core/domain/attendance-service.js';

test('three main modules, Vietnamese identity and daily attendance survive reload and control calling', async ({ page, storage }) => {
  storage.document = createDemo(); const c = storage.document.classes[0], day = todayKey();
  await page.goto('/'); await expect(page).toHaveTitle('Lớp Học Vui · Quản lý học sinh');
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' }); await expect(nav.getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Quản lý học sinh', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Điểm danh', exact: true }).click();
  await expect(page.getByLabel('Ngày điểm danh')).toHaveValue(day); await expect(page.getByText('Chưa ghi nhận ngày này', { exact: true })).toBeVisible(); expect(storage.writes).toBe(0);
  await page.getByRole('button', { name: 'Ghi nhận cả lớp có mặt', exact: true }).click();
  await page.getByRole('combobox', { name: `Điểm danh: ${c.students[0].fullName}`, exact: true }).selectOption('absent');
  await page.getByRole('combobox', { name: `Điểm danh: ${c.students[1].fullName}`, exact: true }).selectOption('excused');
  await page.getByRole('combobox', { name: `Điểm danh: ${c.students[2].fullName}`, exact: true }).selectOption('late');
  await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động'); expect(storage.document.attendanceRecords[0].entries).toHaveLength(40);
  await page.reload(); await nav.getByRole('button', { name: 'Điểm danh', exact: true }).click();
  await expect(page.getByRole('combobox', { name: `Điểm danh: ${c.students[0].fullName}`, exact: true })).toHaveValue('absent');
  await expect(page.locator('.attendance-stat.absent strong')).toHaveText('1'); await expect(page.locator('.attendance-stat.late strong')).toHaveText('1');
  await page.getByLabel('Ngày điểm danh').fill('2025-01-20'); await page.getByLabel('Ngày điểm danh').press('Tab');
  await page.getByRole('button', { name: 'Ghi nhận cả lớp có mặt', exact: true }).click(); await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động');
  await nav.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click(); await expect(page.locator('.launch-summary p strong')).toHaveText('38 học sinh');
  await expect(page.locator('.game-card')).toHaveCount(5); expect(storage.document.attendanceRecords).toHaveLength(2);
  await captureReview(page, 'goi-len-bang.png');
  await nav.getByRole('button', { name: 'Điểm danh', exact: true }).click(); await page.getByRole('button', { name: 'Hôm nay', exact: true }).click();
  await captureReview(page, 'diem-danh.png');
});

test('an empty installation exposes three modules and needs no file or folder actions', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Quản lý học sinh', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo lớp đầu tiên', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Điểm danh', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có lớp để điểm danh' })).toBeVisible(); await expect(page.locator('input[type=file]')).toHaveCount(0);
});

test('archived attendance remains readable after reopening and returning from calling, without allowing edits', async ({ page, storage }) => {
  storage.document = createDemo(); const doc = storage.document, c = doc.classes[0];
  setAttendanceStatus(doc, c.id, todayKey(), c.students[0].id, 'absent');
  doc.classes.forEach(item => { item.archived = true; });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await nav.getByRole('button', { name: 'Điểm danh', exact: true }).click();
  await expect(page.getByLabel('Lớp điểm danh')).toHaveValue(c.id);
  const status = page.getByRole('combobox', { name: `Điểm danh: ${c.students[0].fullName}`, exact: true });
  await expect(status).toHaveValue('absent'); await expect(status).toBeDisabled();
  await nav.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu gọi' })).toBeDisabled();
  await nav.getByRole('button', { name: 'Điểm danh', exact: true }).click();
  await expect(page.getByLabel('Lớp điểm danh')).toHaveValue(c.id); await expect(status).toHaveValue('absent');
  expect(storage.writes).toBe(0);
});

test('attendance search survives edits and bulk replacement requires confirmation', async ({ page, storage }) => {
  storage.document = createDemo(); const c = storage.document.classes[0], student = c.students[0];
  await page.goto('/'); await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Điểm danh', exact: true }).click();
  await page.getByLabel('Tìm học sinh', { exact: true }).fill(student.fullName);
  const status = page.getByRole('combobox', { name: `Điểm danh: ${student.fullName}`, exact: true });
  await status.selectOption('absent');
  await expect(page.getByLabel('Tìm học sinh', { exact: true })).toHaveValue(student.fullName);
  await expect(page.locator('[data-attendance-name]:visible')).toHaveCount(c.students.filter(s => s.fullName.includes(student.fullName)).length);
  await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động');
  await page.getByRole('button', { name: 'Đánh dấu tất cả có mặt', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(status).toHaveValue('absent');
  await page.getByRole('button', { name: 'Đánh dấu tất cả có mặt', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tất cả có mặt', exact: true }).click();
  await expect(status).toHaveValue('present'); await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động');
  expect(storage.document.attendanceRecords[0].entries.every(e => e.status === 'present')).toBe(true);
});

test('utilities remain accessible on a phone without adding a fourth main module', async ({ page, storage }) => {
  storage.document = createDemo(); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Lịch sử gọi tên', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lịch sử gọi tên', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
