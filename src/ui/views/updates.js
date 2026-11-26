import { escapeHtml as esc } from '../dialogs.js';

export function updatesView(client) {
  const s = client.status;
  const busy = ['checking', 'downloading', 'applying'].includes(s.state);
  const messages = {
    idle: 'Kiểm tra khi có Internet. Bạn vẫn dùng lớp học bình thường khi ngoại tuyến.',
    checking: 'Đang kiểm tra phiên bản đã công bố…',
    latest: 'Chưa có bản cập nhật mới hơn được công bố.',
    available: `Có phiên bản ${s.version ?? ''}${s.prerelease ? ' · Bản thử nghiệm' : ''}.`,
    downloading: 'Đang tải và kiểm tra gói cập nhật…',
    ready: `Phiên bản ${s.version ?? ''} đã sẵn sàng${s.prerelease ? ' · Bản thử nghiệm' : ''}.`,
    applying: 'Đang cài đặt. Ứng dụng sẽ tự mở lại, hãy giữ cửa sổ này mở.',
  };
  const button = (action, label, primary = false) => `<button id="update-${action}" class="button ${primary ? 'primary' : 'secondary'}" data-update="${action}">${label}</button>`;
  const percent = s.total ? Math.min(100, Math.round(s.received / s.total * 100)) : 0;
  return `<div class="update-heading"><div><h2 id="updates-title">Phiên bản ứng dụng</h2><p>Lớp Học Vui <span class="app-version">${esc(s.currentVersion || '…')}</span></p></div><div class="row-actions">${busy ? s.state === 'applying' ? '' : button('cancel', 'Hủy') : s.state === 'ready' ? button('apply', 'Cài đặt và mở lại', true) + button('check', 'Kiểm tra lại') : s.state === 'available' ? button('download', 'Tải bản mới', true) : button('check', 'Kiểm tra cập nhật')}</div></div><div class="update-status" role="status" aria-live="polite" aria-atomic="true">${esc(s.message || messages[s.state] || 'Chưa kiểm tra được phiên bản. Hãy thử lại.')}</div>${s.state === 'downloading' ? `<div class="update-download"><progress max="100" value="${percent}" aria-label="Tiến độ tải bản cập nhật"></progress><span>${percent}%</span></div>` : ''}<p class="update-note">Lớp học, điểm danh, lịch sử, hồ sơ và ảnh được giữ nguyên khi cập nhật.</p>`;
}
