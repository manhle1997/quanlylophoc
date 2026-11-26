import { test, expect } from './fixtures.js';
import { createDocument } from '../../src/core/domain/schema.js';
import { upsertClass, addStudents } from '../../src/core/domain/roster-service.js';
test('E20: imported HTML remains text and long result fits a projector viewport', async ({ page, storage }) => {
  await page.setViewportSize({ width: 1024, height: 576 });
  const doc = createDocument(), id = upsertClass(doc, { name: 'Lớp giả <b>an toàn</b>' });
  addStudents(doc, id, ['<img src=x onerror=window.__xss=1> Nhân vật giả lập tiếng Việt']);
  storage.document = doc; await page.goto('/');
  await page.getByRole('button', { name: 'Quản lý học sinh' }).click();
  await expect(page.locator('.student-name')).toHaveText(doc.classes[0].students[0].fullName);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined(); await expect(page.locator('#app img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click(); await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  await expect(page.locator('.game-loading')).toBeHidden(); await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click();
  await expect(page.locator('.result-title')).toHaveText(doc.classes[0].students[0].fullName);
  await expect(page.getByRole('button', { name: 'Về gọi lên bảng', exact: true })).toBeInViewport(); expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});
