import { test, expect, captureReview } from './fixtures.js';
import { createDemo } from '../../src/core/domain/demo.js';

// Keep the selected ID constant while varying only the presentation seed.
async function fixedSelection(page, varySeed = false) {
  await page.addInitScript(vary => {
    let calls = 0, seed = 0;
    crypto.getRandomValues = values => {
      values[0] = ++calls % 2 ? 17 : vary ? ++seed : 1;
      return values;
    };
  }, varySeed);
}
function classroom(storage) {
  const doc = createDemo(), c = doc.classes[0];
  c.students.forEach((s, i) => { s.fullName = `Nhân vật giả ${String(i).padStart(2, '0')}`; });
  Object.assign(doc.settings, { mode: 'normal', hookMode: '0', durationPreset: 'dramatic', quality: 'low', soundEnabled: false });
  storage.document = doc;
  return c;
}

test('all five 3D games avoid pinning the first roster name and reveal the preselected ID', async ({ page, storage }) => {
  test.setTimeout(90000);
  const c = classroom(storage), before = structuredClone(c.students);
  await fixedSelection(page); await page.goto('/');
  await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click();
  for (const id of ['fishing', 'ufo', 'claw', 'marble', 'treasure']) {
    await page.locator(`[data-game=${id}]`).click(); await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
    await expect(page.locator('.stage canvas')).toBeVisible(); await expect(page.locator('.game-loading')).toBeHidden();
    await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    if (id === 'fishing') await expect(page.locator('.actor-label:not([hidden])')).not.toHaveCount(0);
    await expect(page.locator('.actor-label:not([hidden])').filter({ hasText: c.students[0].fullName })).toHaveCount(0);
    if (id === 'fishing') {
      await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = 'hidden'; });
      await captureReview(page, 'label-order-3d.png');
      await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = ''; });
    }
    await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click();
    await expect(page.locator('.result-title')).toHaveText(c.students[17].fullName);
    await page.getByRole('button', { name: 'Đổi game', exact: true }).click();
  }
  expect(storage.document.history.map(h => h.studentId)).toEqual(Array(5).fill(c.students[17].id));
  expect(storage.document.classes[0].students).toEqual(before);
});

test('2D bubbles vary between rounds and retain the same order after 3D context loss', async ({ page, storage }) => {
  const c = classroom(storage); await fixedSelection(page, true); await page.goto('/');
  await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  await expect(page.locator('.stage canvas')).toBeVisible(); await expect(page.locator('.game-loading')).toBeHidden();
  await page.locator('.stage canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('.fallback-scene')).toBeVisible();
  const first = await page.locator('.fallback-bubbles span').allTextContents();
  expect(first).toHaveLength(12); expect(first[0]).toBe(c.students[21].fullName); expect(first).not.toContain(c.students[0].fullName);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = 'hidden'; });
  await captureReview(page, 'label-order-2d.png');
  await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = ''; });
  await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click();
  await expect(page.locator('.result-title')).toHaveText(c.students[17].fullName);
  await page.getByRole('button', { name: 'Đổi game', exact: true }).click();
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Dùng chế độ tương thích 2D cho phiên này' }).check();
  await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  await expect(page.locator('.fallback-scene')).toBeVisible(); await expect(page.locator('.game-loading')).toBeHidden();
  const second = await page.locator('.fallback-bubbles span').allTextContents();
  expect(second).toHaveLength(12); expect(second).not.toEqual(first); expect(second).not.toContain(c.students[0].fullName);
  await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click();
  await expect(page.locator('.result-title')).toHaveText(c.students[17].fullName);
  expect(storage.document.history.map(h => h.studentId)).toEqual([c.students[17].id, c.students[17].id]);
});
