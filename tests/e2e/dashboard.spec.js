import { test, expect } from './fixtures.js';
import { createDemo } from '../../src/core/domain/demo.js';
import { setAttendanceStatus, todayKey } from '../../src/core/domain/attendance-service.js';

for (const [width, height] of [[1440, 960], [768, 1024], [390, 844]]) {
  test(`Dashboard design: real summaries, keyboard access and working controls at ${width}px`, async ({ page, storage }) => {
    storage.document = createDemo();
    const c = storage.document.classes[0];
    for (const [i, status] of ['absent', 'excused', 'late'].entries()) setAttendanceStatus(storage.document, c.id, todayKey(), c.students[i].id, status);
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Quản lý học sinh', exact: true })).toBeVisible();
    await expect(page.locator('.overview-metric dd')).toHaveText(['3', '107', '1 / 3']);
    await expect(page.locator('.roster-table tbody tr')).toHaveCount(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Đến nội dung chính' })).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.locator('#main-content')).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width <= 1000) {
      await page.getByRole('combobox', { name: 'Lớp đang làm việc', exact: true }).selectOption(storage.document.classes[1].id);
      await expect(page.locator('.roster-table tbody tr')).toHaveCount(33);
      await page.getByRole('combobox', { name: 'Lớp đang làm việc', exact: true }).selectOption(c.id);
      await expect(page.locator('.roster-table tbody tr')).toHaveCount(40);
    }
    await page.screenshot({ path: `docs/screenshots/dashboard-${width}.png` });
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await nav.getByRole('button', { name: 'Điểm danh', exact: true }).click();
    await expect(page.locator('.attendance-stat.present strong')).toHaveText('37');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/screenshots/attendance-design-${width}.png` });
    await nav.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click();
    await page.locator('[data-game=treasure]').click();
    await expect(page.locator('[data-game=treasure]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Bắt đầu gọi' })).toBeInViewport();
    await expect(page.locator('.launch-summary p strong')).toHaveText('38 học sinh');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `docs/screenshots/calling-design-${width}.png` });
  });
}

test('Dashboard palette: representative text contrast and visible control targets', async ({ page, storage }) => {
  storage.document = createDemo(); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Quản lý học sinh', exact: true })).toBeVisible();
  const checks = await page.evaluate(() => {
    const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return ['.page-heading h1', '.page-heading p', '.button.primary', '.roster-table th:nth-child(2)', '.student-name', '.status-button', '.nav-item.active', '.brand-name small', '.save-status', '.class-list-item small'].map(selector => {
      const el = document.querySelector(selector); let parent = el, background;
      while (parent) { const value = getComputedStyle(parent).backgroundColor; if (value !== 'rgba(0, 0, 0, 0)') { background = value; break; } parent = parent.parentElement; }
      const foreground = getComputedStyle(el).color;
      const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return { selector, ratio: (light + .05) / (dark + .05) };
    });
  });
  for (const check of checks) expect(check.ratio, check.selector).toBeGreaterThanOrEqual(4.5);
  const smallTargets = await page.locator('button, input, select').evaluateAll(nodes => nodes.filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24); }).map(el => el.outerHTML));
  expect(smallTargets).toEqual([]);
  console.log('Dashboard text contrast ratios:', checks.map(c => `${c.selector}=${c.ratio.toFixed(2)}`).join(', '));
});
