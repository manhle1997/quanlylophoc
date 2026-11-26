import { icon } from '../icons.js';
import { escapeHtml as esc } from '../dialogs.js';
export function dataView(app) {
  const backups = app.backups ?? [];
  return `<section class="page-heading"><div><h1>Bản lưu an toàn</h1><p>Mỗi thay đổi được lưu tự động. Khi cần, bạn có thể trở về một lần lưu trước.</p></div><button class="button secondary" data-page="settings">Về cài đặt</button></section>
    <section class="panel"><div class="notice">${icon('shield')} Lớp Học Vui giữ 20 bản lưu gần nhất và giữ nguyên các bản sao cũ từ phiên bản trước. Bạn không cần chọn tệp hoặc nơi lưu.</div>
    ${backups.length ? `<div class="backup-list">${backups.map(b => `<article class="backup-item"><div><h2>${esc(new Date(b.savedAt).toLocaleString('vi-VN'))}</h2><p>${b.classes} lớp · ${b.students} học sinh · ${b.plays} lượt gọi tên · ${b.attendanceDays ?? 0} ngày điểm danh theo lớp</p></div><button class="button secondary" data-restore-backup="${esc(b.id)}">Phục hồi lần lưu này</button></article>`).join('')}</div>` : '<div class="empty-state">Chưa có bản lưu trước đó. Lớp Học Vui sẽ tự tạo khi bạn tiếp tục thêm hoặc sửa lớp học.</div>'}</section>`;
}

