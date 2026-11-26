import { dialog, escapeHtml as esc, notify } from '../dialogs.js';

export function bindProfile(app) {
  const service = app.profile, root = app.root;
  root.querySelector('.profile-form')?.addEventListener('submit', e => e.preventDefault());
  root.querySelectorAll('[data-profile-field]').forEach(el => el.addEventListener('input', () => {
    try { service.edit(el.dataset.profileField, el.value); el.setCustomValidity(''); }
    catch (error) { el.setCustomValidity(error.message); el.reportValidity(); }
  }));
  root.querySelectorAll('[data-profile-color]').forEach(el => el.addEventListener('click', () => service.edit('accentColor', el.dataset.profileColor)));
  root.querySelector('#profile-color')?.addEventListener('input', e => service.edit('accentColor', e.target.value));
  root.querySelectorAll('[data-pick-profile-image]').forEach(el => el.addEventListener('click', () => root.querySelector(`#profile-file-${el.dataset.pickProfileImage}`)?.click()));
  root.querySelectorAll('[data-remove-profile-image]').forEach(el => el.addEventListener('click', () => service.edit(el.dataset.removeProfileImage, null)));
  root.querySelectorAll('[data-profile-upload]').forEach(el => el.addEventListener('change', async () => {
    const file = el.files[0], slot = el.dataset.profileUpload, message = root.querySelector(`[data-profile-image-error="${slot}"]`);
    if (!file) return;
    message.textContent = '';
    try { await service.upload(slot, file); }
    catch (error) { message.textContent = error.message; }
    finally { el.value = ''; }
  }));
  root.querySelector('[data-profile-retry]')?.addEventListener('click', async () => {
    if (service.error?.code === 'CONFLICT') {
      dialog({ title: 'Tải lại hồ sơ đã lưu?', body: `<p>${esc('Nội dung chưa lưu ở cửa sổ này sẽ được thay bằng hồ sơ đã lưu gần nhất. Danh sách lớp và học sinh được giữ nguyên.')}</p>`, confirm: 'Tải lại hồ sơ', onConfirm: async () => { await service.load(); app.render(); } });
    } else if (!service.ready) { await service.load(app.store.document?.schoolName); app.render(); }
    else { try { await service.flush(); } catch (error) { notify(error.message); } }
  });
}
