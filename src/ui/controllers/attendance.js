import { todayKey, validateAttendanceDate, setAttendanceStatus, markClassPresent, attendanceRecord } from '../../core/domain/attendance-service.js';
import { searchKey } from '../../core/domain/schema.js';
import { dialog, notify } from '../dialogs.js';

export function bindAttendance(app) {
  app.root.querySelector('#attendance-class')?.addEventListener('change', e => { app.store.selectedClassId = e.target.value; app.render(); });
  app.root.querySelector('#attendance-date')?.addEventListener('change', e => {
    try { validateAttendanceDate(e.target.value); if (e.target.value > todayKey()) throw new Error('Chỉ điểm danh hôm nay hoặc các ngày đã qua.'); app.attendanceDate = e.target.value; app.render(); } catch (error) { notify(error.message); e.target.value = app.attendanceDate ?? todayKey(); }
  });
  app.root.querySelectorAll('[data-attendance-day]').forEach(el => el.addEventListener('click', () => { app.attendanceDate = el.dataset.attendanceDay; app.render(); }));
  app.root.querySelectorAll('[data-attendance-status]').forEach(el => el.addEventListener('change', () => {
    const id = el.dataset.attendanceStatus;
    app.store.mutate(doc => setAttendanceStatus(doc, app.store.selectedClassId, app.attendanceDate ?? todayKey(), id, el.value));
    app.root.querySelector(`[data-attendance-status="${id}"]`)?.focus();
  }));
  const search = app.root.querySelector('#attendance-search');
  if (search) {
    search.value = app.attendanceSearch ?? '';
    const filter = () => {
      app.attendanceSearch = search.value;
      app.root.querySelectorAll('[data-attendance-name]').forEach(row => { row.hidden = !searchKey(row.dataset.attendanceName).includes(searchKey(app.attendanceSearch)); });
    };
    filter(); search.addEventListener('input', filter);
  }
}
export function attendanceAction(app, action) {
  if (action === 'attendance' || action === 'attendance-today') { app.page = 'attendance'; app.attendanceDate = todayKey(); app.render(); return true; }
  if (action !== 'mark-all-present') return false;
  const day = app.attendanceDate ?? todayKey(), record = attendanceRecord(app.store.document, app.store.selectedClassId, day);
  const commit = () => app.store.mutate(doc => markClassPresent(doc, app.store.selectedClassId, day));
  if (record?.entries.some(e => e.status !== 'present')) dialog({ title: 'Đánh dấu cả lớp có mặt?', confirm: 'Tất cả có mặt', body: '<p>Các trạng thái vắng và đi muộn của ngày đang chọn sẽ chuyển thành có mặt. Những ngày khác vẫn được giữ.</p>', onConfirm: commit });
  else commit();
  return true;
}
