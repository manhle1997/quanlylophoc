import { dialog, notify } from '../dialogs.js';
import { updatesView } from '../views/updates.js';

export function renderUpdates(app) {
  const panel = app.root.querySelector('[data-updates]');
  if (!panel) return;
  const focused = panel.contains(document.activeElement) ? document.activeElement.dataset.update : null;
  panel.innerHTML = updatesView(app.updates);
  panel.querySelectorAll('[data-update]').forEach(button => button.addEventListener('click', () => {
    if (app.manager.busy) { notify('Hãy hoàn tất lượt chơi trước khi cập nhật.'); return; }
    if (button.dataset.update !== 'apply') { app.updates.run(button.dataset.update); return; }
    dialog({ title: 'Cài đặt bản cập nhật?', confirm: 'Cài đặt và mở lại', body: '<p>Ứng dụng sẽ lưu các thay đổi, cài bản mới rồi tự mở lại. Lớp học, hồ sơ, ảnh và các bản sao lưu được giữ nguyên.</p>', onConfirm: async (_form, modal) => {
      modal.querySelector('.modal-body p').textContent = 'Đang hoàn tất lưu lớp học và hồ sơ…';
      await app.updates.install({
        flush: () => Promise.all([app.autosave.flush(), app.profile.flush()]),
        ready: () => !app.manager.busy && (app.store.demo || !app.store.dirty) && !app.profile.dirty && !app.profile.uploading && app.profile.ready,
        restart: version => { modal.querySelector('.modal-body p').textContent = 'Đang cài đặt và mở lại. Hãy giữ cửa sổ này mở; dữ liệu được giữ nguyên.'; return reconnect(app, version); },
      });
    } });
  }));
  if (focused) panel.querySelector(`[data-update="${focused}"]`)?.focus();
}

async function reconnect(app, version) {
  for (let attempt = 0; attempt < 90; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const response = await globalThis.fetch('/api/session', { cache: 'no-store', signal: AbortSignal.timeout(1000) });
      if (!response.ok) continue;
      const session = await response.json();
      if (session.token === app.storage.token) continue;
      if (session.version === version) { window.location.reload(); return; }
      app.storage.token = session.token;
      const status = await app.storage.request('/api/updates');
      app.updates.accept({ ...status, message: status.message || 'Ứng dụng đã mở lại bản trước. Dữ liệu vẫn được giữ nguyên.' });
      return;
    } catch { /* Wait for the local launcher to restart. */ }
  }
  app.updates.accept({ ...app.updates.status, state: 'error', message: 'Chưa kết nối lại được. Hãy mở lại Start.exe; dữ liệu và bản dự phòng vẫn được giữ nguyên.' });
}
