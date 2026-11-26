import { test, expect, captureReview } from './fixtures.js';
import { createDemo } from '../../src/core/domain/demo.js';

for (const gameId of ['fishing', 'ufo', 'claw', 'marble', 'treasure']) test(`${gameId}: two character lines, safe positions, pause and unchanged result`, async ({ page, storage }) => {
  test.setTimeout(45000);
  const doc = createDemo(); Object.assign(doc.settings, { hookMode: '2', durationPreset: 'dramatic', quality: 'low', soundEnabled: false }); storage.document = doc;
  await page.setViewportSize({ width: 1280, height: 720 }); await page.goto('/');
  await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click(); await page.locator(`[data-game="${gameId}"]`).click(); await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  await expect(page.locator('.game-loading')).toBeHidden();
  const speech = page.locator('.character-speech');
  await expect(speech).toBeVisible({ timeout: 10000 }); await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  const firstId = await speech.getAttribute('data-student-id'), firstLine = await speech.locator('.speech-line').textContent();
  expect(doc.classes[0].students.some(s => s.id === firstId)).toBe(true);
  await expect(speech.locator('.speech-name')).toHaveText(doc.classes[0].students.find(s => s.id === firstId).fullName);
  const box = await speech.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(1268); expect(box.y).toBeGreaterThanOrEqual(90); expect(box.y + box.height).toBeLessThan(610);
  await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = 'hidden'; }); await captureReview(page, `${gameId}-dialogue.png`); await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = ''; });
  await expect(speech.locator('.speech-line')).toHaveText(firstLine); expect(storage.document.history).toHaveLength(0);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(speech).toHaveAttribute('data-hook-index', '1', { timeout: 10000 }); await expect(speech).toBeVisible();
  expect(await speech.getAttribute('data-student-id')).not.toBe(firstId);
  await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click(); await expect(speech).toBeHidden(); await expect(page.locator('.result-title')).not.toBeEmpty();
  expect(storage.document.history).toHaveLength(1); expect([firstId, await speech.getAttribute('data-student-id')]).not.toContain(storage.document.history[0].studentId);
});

for (const gameId of ['fishing', 'ufo', 'claw', 'marble', 'treasure']) test(`${gameId}: phone 2D dialogue and reduced motion stay readable`, async ({ page, storage }) => {
  const doc = createDemo(); Object.assign(doc.settings, { hookMode: '2', durationPreset: 'dramatic', soundEnabled: false, reducedMotion: true }); storage.document = doc;
  for (const [i, s] of doc.classes[0].students.entries()) s.fullName = `Nhân vật giả ${i} có tên tiếng Việt dài để kiểm tra lời thoại`;
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click(); await page.getByRole('checkbox', { name: 'Dùng chế độ tương thích 2D cho phiên này' }).check();
  await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click(); await page.locator(`[data-game="${gameId}"]`).click(); await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  const speech = page.locator('.character-speech'); await expect(speech).toBeVisible({ timeout: 10000 }); await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  const box = await speech.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(378); expect(box.y).toBeGreaterThanOrEqual(78); expect(box.y + box.height).toBeLessThan(700);
  const caption = await page.locator('.fallback-caption').boundingBox(), names = await page.locator('.fallback-bubbles').boundingBox(), controls = await page.locator('.game-controls').boundingBox();
  expect(caption.y).toBeGreaterThanOrEqual(box.y + box.height + 10); expect(names.y + names.height).toBeLessThan(controls.y - 8);
  await expect(speech).toHaveAttribute('aria-live', 'polite');
  expect(await speech.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true })).toBeInViewport();
  await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = 'hidden'; }); await captureReview(page, `${gameId}-dialogue-390.png`); await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = ''; });
  await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click(); await expect(speech).toBeHidden();
  expect(storage.document.history).toHaveLength(1);
});

for (const [width, height] of [[390, 844], [768, 1024]]) test(`3D speech and controls fit at ${width}px`, async ({ page, storage }) => {
  const doc = createDemo(); Object.assign(doc.settings, { hookMode: '2', durationPreset: 'dramatic', quality: 'low', soundEnabled: false }); storage.document = doc;
  await page.setViewportSize({ width, height }); await page.goto('/');
  await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click(); await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  const speech = page.locator('.character-speech'); await expect(speech).toBeVisible({ timeout: 10000 }); await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  const box = await speech.boundingBox(), controls = await page.locator('.game-controls').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(width - 12); expect(box.y).toBeGreaterThanOrEqual(90); expect(box.y + box.height).toBeLessThan(controls.y - 8);
  await page.locator('.paused-overlay').evaluate(el => { el.style.visibility = 'hidden'; }); await captureReview(page, `fishing-3d-dialogue-${width}.png`);
});
