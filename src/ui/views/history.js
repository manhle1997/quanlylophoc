import { displayName } from '../../core/domain/schema.js';
import { getGame } from '../../core/game/game-registry.js';
import { escapeHtml as esc } from '../dialogs.js';
export function historyView(app) {
  const doc = app.store.document, selected = app.historyClass ?? 'all';
  const rows = doc.history.filter(h => selected === 'all' || h.classId === selected).toReversed();
  const classMap = new Map(doc.classes.map(c => [c.id, c]));
  const studentMap = new Map(doc.classes.flatMap(c => c.students.map(s => [s.id, s])));
  return `<section class="page-heading"><div><h1>Lịch sử gọi tên</h1><p>Các lượt gọi đã ghi nhận, sắp xếp theo thời gian.</p></div><button class="button secondary" data-action="clear-history">Xóa lịch sử</button></section><section class="panel"><div class="history-toolbar"><label>Lọc theo lớp <select id="history-class"><option value="all">Tất cả lớp</option>${doc.classes.map(c => `<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><span>${rows.length} lượt gọi tên</span></div>${doc.history.length > 10000 ? '<div class="notice warning">Lịch sử vượt 10.000 lượt. Bạn có thể chủ động xóa lịch sử khi không còn cần. Lớp Học Vui tự giữ bản lưu trước đó.</div>' : ''}${rows.length ? `<div class="table-scroll"><table class="roster-table"><thead><tr><th>Thời gian</th><th>Học sinh được chọn</th><th>Lớp</th><th>Trò chơi</th><th>Chế độ</th></tr></thead><tbody>${rows.slice(0, 500).map(h => `<tr><td>${esc(new Date(h.revealedAt).toLocaleString('vi-VN'))}</td><td class="student-name">${esc(displayName(studentMap.get(h.studentId)))}</td><td>${esc(classMap.get(h.classId)?.name)}</td><td>${getGame(h.gameId)?.name}</td><td>${h.mode === 'unique' ? 'Không trùng' : 'Ngẫu nhiên'}</td></tr>`).join('')}</tbody></table></div>${rows.length > 500 ? '<p>Hiển thị 500 lượt gần nhất. Lớp Học Vui vẫn giữ đầy đủ các lượt gọi tên đã lưu.</p>' : ''}` : '<div class="empty-state">Chưa có lượt gọi tên nào.<br>Kết quả sẽ xuất hiện sau khi bạn hoàn tất lượt gọi đầu tiên.</div>'}</section>`;
}

