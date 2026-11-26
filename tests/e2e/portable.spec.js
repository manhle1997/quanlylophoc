import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

test('M7: daily attendance, restart, five offline games, backup restore and lossless schema v1 upgrade on real JSON', async ({ page }) => {
  test.skip(process.platform !== 'win32' || !syncFs.existsSync(path.resolve('build/launcher/Start.exe')), 'Publish Windows launcher before this gate.');
  test.setTimeout(120000);
  const root = path.resolve('build', `portable-e2e-${crypto.randomUUID()}`), port = 17844, origin = `http://127.0.0.1:${port}`;
  const occupied = await new Promise(resolve => { const socket = net.connect(port, '127.0.0.1'); socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false)); });
  expect(occupied, 'Never test persistence against an existing user app').toBe(false);
  await fs.mkdir(root, { recursive: true }); await fs.cp(path.resolve('dist'), path.join(root, 'app'), { recursive: true }); await fs.copyFile(path.resolve('build/launcher/Start.exe'), path.join(root, 'Start.exe'));
  const start = async () => {
    const child = spawn(path.join(root, 'Start.exe'), ['--no-browser', `--port=${port}`], { cwd: path.resolve('.'), windowsHide: true, stdio: 'ignore' });
    await expect.poll(async () => { try { return (await (await fetch(origin + '/classquest-version.json')).json()).version; } catch { return ''; } }).toBe('0.5.1');
    return child;
  };
  const stop = async child => { if (child.exitCode === null) { const ended = new Promise(resolve => child.once('exit', resolve)); child.kill(); await ended; } };
  const disk = async () => JSON.parse(await fs.readFile(path.join(root, 'data/school-data.json'), 'utf8'));
  let child = await start(); const external = [], errors = [];
  try {
    await page.addInitScript(() => { window.showDirectoryPicker = window.showOpenFilePicker = window.showSaveFilePicker = () => { throw new Error('No file chooser is allowed in teacher workflow'); }; });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => { if (new URL(route.request().url()).origin === origin) route.continue(); else { external.push(route.request().url()); route.abort(); } });
    const response = await page.goto(origin); expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
    await expect(page.getByRole('button', { name: 'Tạo lớp đầu tiên' })).toBeVisible();
    await page.getByRole('button', { name: 'Tạo lớp đầu tiên' }).click(); await page.getByLabel('Tên lớp', { exact: true }).fill('Lớp giáo viên giả');
    await page.getByRole('dialog').getByRole('button', { name: 'Tạo lớp', exact: true }).click(); await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động');
    await page.getByRole('button', { name: 'Nhập hàng loạt', exact: true }).click(); await page.getByRole('textbox', { name: 'Mỗi dòng một họ và tên' }).fill(Array.from({ length: 40 }, (_, i) => `Nhân vật giả ${i}`).join('\n'));
    await page.getByRole('button', { name: 'Xem trước danh sách' }).click(); await page.getByRole('button', { name: 'Xác nhận nhập danh sách' }).click(); await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động'); expect((await disk()).classes[0].students).toHaveLength(40);
    const c = (await disk()).classes[0];
    const profilePath = path.join(root, 'data/user-profile.json'), sourceImage = path.join(root, 'synthetic-avatar.png');
    const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    await fs.writeFile(sourceImage, imageBytes);
    await page.getByRole('button', { name: 'Mở thông tin cá nhân', exact: true }).click();
    await page.getByLabel('Họ và tên', { exact: true }).fill('Giáo viên minh họa');
    await page.getByLabel('Tên trường', { exact: true }).fill('Trường minh họa');
    await page.getByRole('button', { name: 'Nâu đất', exact: true }).click();
    await page.getByLabel('Chọn ảnh đại diện', { exact: true }).setInputFiles(sourceImage);
    await expect(page.locator('[data-profile-status]')).toHaveText('Hồ sơ được lưu tự động');
    const savedProfile = JSON.parse(await fs.readFile(profilePath, 'utf8'));
    expect(await fs.readFile(path.join(root, 'data/profile-images', savedProfile.avatar))).toEqual(imageBytes);
    await fs.unlink(sourceImage);
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Điểm danh', exact: true }).click();
    await page.getByRole('button', { name: 'Ghi nhận cả lớp có mặt', exact: true }).click();
    await page.getByRole('combobox', { name: 'Điểm danh: Nhân vật giả 0', exact: true }).selectOption('absent');
    await page.getByRole('combobox', { name: 'Điểm danh: Nhân vật giả 1', exact: true }).selectOption('excused');
    await page.getByRole('combobox', { name: 'Điểm danh: Nhân vật giả 2', exact: true }).selectOption('late');
    await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động'); expect((await disk()).attendanceRecords[0].entries).toHaveLength(40);
    await page.getByRole('button', { name: 'Quản lý học sinh', exact: true }).click();
    await page.screenshot({ path: 'docs/screenshots/teacher-autosave.png', fullPage: true });
    await stop(child); child = await start(); await page.reload();
    await page.getByRole('button', { name: 'Mở thông tin cá nhân', exact: true }).click();
    await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Giáo viên minh họa');
    expect(await page.locator('.profile-image-preview img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(JSON.parse(await fs.readFile(profilePath, 'utf8'))).toEqual(savedProfile);
    await page.getByRole('button', { name: 'Quản lý học sinh', exact: true }).click(); await expect(page.locator('.roster-table tbody tr')).toHaveCount(40);
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Điểm danh', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Điểm danh: Nhân vật giả 0', exact: true })).toHaveValue('absent');
    await expect(page.getByRole('combobox', { name: 'Điểm danh: Nhân vật giả 2', exact: true })).toHaveValue('late');
    await expect(page.locator('input[type=file]')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Lưu dữ liệu', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Gọi lên bảng', exact: true }).click();
    await expect(page.locator('.launch-summary p strong')).toHaveText('38 học sinh');
    for (const [i, id] of ['fishing', 'ufo', 'claw', 'marble', 'treasure'].entries()) {
      await page.locator(`[data-game=${id}]`).click(); await page.getByRole('button', { name: 'Bắt đầu gọi' }).click(); await expect(page.locator('.stage canvas')).toBeVisible(); await expect(page.locator('.game-loading')).toBeHidden();
      await page.getByRole('button', { name: 'Bỏ qua hiệu ứng', exact: true }).click(); await expect(page.locator('.result-title')).not.toBeEmpty(); await expect.poll(async () => (await disk()).history.length).toBe(i + 1);
      await page.getByRole('button', { name: 'Đổi game', exact: true }).click();
    }
    expect((await disk()).history.every(h => ![c.students[0].id, c.students[1].id].includes(h.studentId))).toBe(true);
    await page.getByRole('button', { name: 'Cài đặt', exact: true }).click(); await page.getByRole('button', { name: 'Xem các lần lưu trước', exact: true }).click(); await expect(page.locator('.backup-item')).not.toHaveCount(0);
    await page.locator('.backup-item').first().getByRole('button', { name: 'Phục hồi lần lưu này', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Phục hồi lớp học', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#toast')).toHaveText('Đã phục hồi lớp học.');
    await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động'); expect((await disk()).classes[0].students).toHaveLength(40);
    expect(JSON.parse(await fs.readFile(profilePath, 'utf8'))).toEqual(savedProfile);
    expect((await disk()).attendanceRecords[0].entries.find(e => e.studentId === c.students[0].id).status).toBe('absent');
    // Simulate an existing 0.2 file in this isolated test package, never a user's data.
    const legacy = await disk(); legacy.schemaVersion = 1; delete legacy.attendanceRecords;
    await stop(child); await fs.writeFile(path.join(root, 'data/school-data.json'), JSON.stringify(legacy)); child = await start(); await page.reload();
    await expect(page.locator('.roster-table tbody tr')).toHaveCount(40);
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Điểm danh', exact: true }).click();
    await expect(page.getByText('Chưa ghi nhận ngày này', { exact: true })).toBeVisible();
    expect((await disk()).schemaVersion).toBe(1);
    await page.getByRole('combobox', { name: 'Điểm danh: Nhân vật giả 0', exact: true }).selectOption('absent');
    await expect(page.locator('.save-status')).toHaveText('Đã lưu tự động');
    const upgraded = await disk(); expect(upgraded.schemaVersion).toBe(2);
    for (const key of ['documentId', 'classes', 'history', 'rounds', 'settings']) expect(upgraded[key]).toEqual(legacy[key]);
    expect(upgraded.attendanceRecords[0].entries).toHaveLength(40);
    expect(external).toEqual([]); expect(errors).toEqual([]);
  } finally { await stop(child); }
});

