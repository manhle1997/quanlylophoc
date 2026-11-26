import { icon } from './icons.js';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function notify(message) {
  const target = document.querySelector('#toast');
  target.textContent = message;
  target.classList.add('visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => target.classList.remove('visible'), 4500);
}
export function dialog({ title, body, confirm = 'Xác nhận', danger = false, wide = false, onConfirm, cancel = 'Hủy' }) {
  const root = document.querySelector('#dialog-root');
  if (root.firstChild) return;
  const previous = document.activeElement;
  let busy = false;
  root.innerHTML = `<dialog class="modal ${wide ? 'wide' : ''}" aria-labelledby="dialog-title"><form><div class="modal-heading"><h2 id="dialog-title">${escapeHtml(title)}</h2><button type="button" class="icon-button" data-close aria-label="Đóng">${icon('close')}</button></div><div class="modal-body">${body}</div><div class="modal-actions"><button type="button" class="button secondary" data-close>${escapeHtml(cancel)}</button><button type="submit" class="button ${danger ? 'danger' : 'primary'}">${escapeHtml(confirm)}</button></div><p class="form-error" role="alert"></p></form></dialog>`;
  const modal = root.firstChild;
  const close = (force = false) => {
    if (busy && !force) return;
    modal.close(); root.replaceChildren();
    const replacement = previous?.isConnected ? previous : [...document.querySelectorAll('button,a,input,select')].find(el => previous?.dataset.action && el.dataset.action === previous.dataset.action || previous?.id && el.id === previous.id);
    replacement?.focus();
  };
  modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close()));
  modal.addEventListener('cancel', e => { e.preventDefault(); close(); });
  modal.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const button = modal.querySelector('[type=submit]');
    busy = true; button.disabled = true; modal.setAttribute('aria-busy', 'true');
    modal.querySelectorAll('[data-close]').forEach(el => { el.disabled = true; });
    try { if (await onConfirm?.(new FormData(e.target), modal) !== false) close(true); }
    catch (error) { modal.querySelector('.form-error').textContent = error.message; }
    finally { busy = false; button.disabled = false; modal.removeAttribute('aria-busy'); modal.querySelectorAll('[data-close]').forEach(el => { el.disabled = false; }); }
  });
  modal.showModal();
  return modal;
}
