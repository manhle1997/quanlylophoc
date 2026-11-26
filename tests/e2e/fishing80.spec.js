import { test, expect } from './fixtures.js';
import { createDemo } from '../../src/core/domain/demo.js';
test('M3: 80 actors, long Vietnamese name, hook label and measured render counters', async ({ page, storage }) => {
  test.setTimeout(60000);
  const doc = createDemo(), c = doc.classes[0];
  c.students = Array.from({ length: 80 }, (_, i) => ({ id: crypto.randomUUID(), fullName: i === 0 ? 'Nhân vật giả lập mang một cái tên tiếng Việt rất dài để kiểm tra trên máy chiếu' : `Nhân vật giả ${i}`, labelSuffix: '', active: true }));
  doc.settings.quality = 'low'; doc.settings.hookMode = '2'; doc.settings.durationPreset = 'dramatic';
  storage.document = doc; await page.setViewportSize({ width: 1280, height: 720 }); await page.goto('/'); await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bắt đầu gọi' })).toBeInViewport();
  await page.getByRole('button', { name: 'Bắt đầu gọi' }).click();
  await expect(page.locator('.stage canvas')).toBeVisible(); await expect(page.locator('.game-loading')).toBeHidden();
  const metrics = await page.evaluate(() => new Promise(resolve => {
    const samples = []; let previous;
    function frame(t) { if (previous) samples.push(t - previous); previous = t; if (samples.length < 60) requestAnimationFrame(frame); else { const canvas = document.querySelector('.stage canvas'); resolve({ drawCalls: Number(canvas.dataset.drawCalls), geometries: Number(canvas.dataset.geometries), sampleMs: samples.reduce((a, b) => a + b) / samples.length, userAgent: navigator.userAgent }); } }
    requestAnimationFrame(frame);
  }));
  console.info('Fishing 80 low measured on dev Chromium:', JSON.stringify(metrics));
  expect(metrics.drawCalls).toBeLessThan(150);
  await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click(); await expect(page.locator('.result-title')).not.toBeEmpty();
  await page.screenshot({ path: 'docs/screenshots/fishing80-result.png' });
});
