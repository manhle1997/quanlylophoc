import { dialog, escapeHtml as esc, notify } from '../dialogs.js';

async function restore(app, backup) {
  if (!app.store.demo && app.store.dirty) { await app.autosave.flush(); }
  dialog({ title: 'Phục hồi lớp học về lần lưu này?', confirm: 'Phục hồi lớp học', body: `<p>Lần lưu: <strong>${esc(new Date(backup.savedAt).toLocaleString('vi-VN'))}</strong>.</p><div class="notice">${backup.classes} lớp · ${backup.students} học sinh · ${backup.plays} lượt gọi tên · ${backup.attendanceDays ?? 0} ngày điểm danh theo lớp</div><p>Danh sách, điểm danh và lịch sử sẽ trở về thời điểm này. Lớp Học Vui tự giữ lại bản hiện tại để có thể phục hồi tiếp nếu cần.</p>`, onConfirm: async () => {
    const doc = await app.storage.restore(backup.id); app.bootError = null; app.loading = false; app.page = 'home'; app.autosave.enabled = true; app.autosave.setState('saved'); app.store.replace(doc); notify('Đã phục hồi lớp học.');
  } });
}
export async function dataAction(app, action) {
  if (action === 'save' || action === 'retry-save') { await Promise.all([app.autosave.flush(), app.profile.flush()]); return true; }
  if (action === 'retry-load' || action === 'my-classes') { await app.loadClasses(); return true; }
  if (action === 'show-backups') {
    if (app.store.demo) { notify('Chế độ chơi thử không thay đổi lớp học của bạn.'); return true; }
    app.backups = await app.storage.listBackups(); app.page = 'backups'; app.render(); return true;
  }
  if (action === 'recover-latest') {
    const backups = await app.storage.listBackups();
    if (!backups.length) { notify('Chưa có lần lưu an toàn để phục hồi. Bản hiện tại vẫn được giữ nguyên.'); return true; }
    await restore(app, backups[0]); return true;
  }
  if (action === 'reload-local') {
    dialog({ title: 'Tải lại danh sách lớp học?', confirm: 'Tải lại danh sách', body: '<p>Ứng dụng sẽ mở danh sách mới nhất đã lưu. Các thay đổi chưa lưu trong cửa sổ này sẽ được bỏ. Hãy giữ cửa sổ hiện tại nếu bạn còn cần những thay đổi đó.</p>', onConfirm: () => app.loadClasses() }); return true;
  }
  return false;
}
export function bindBackups(app) {
  app.root.querySelectorAll('[data-restore-backup]').forEach(el => el.addEventListener('click', () => {
    const backup = app.backups.find(b => b.id === el.dataset.restoreBackup);
    restore(app, backup).catch(e => notify(e.message));
  }));
}
