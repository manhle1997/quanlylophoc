import { dialog, escapeHtml as esc, notify } from '../dialogs.js';
import { displayName, searchKey } from '../../core/domain/schema.js';
import { upsertClass, addStudents, editStudent, deleteStudent, deleteClass, resetRound } from '../../core/domain/roster-service.js';
import { pastePreview } from '../../core/domain/validation.js';

export function bindRoster(app) {
  const root = app.root, store = app.store;
  root.querySelector('#roster-class-select')?.addEventListener('change', e => { store.selectedClassId = e.target.value; app.render(); });
  root.querySelectorAll('[data-select-class]').forEach(el => el.addEventListener('click', () => { store.selectedClassId = el.dataset.selectClass; app.render(); }));
  root.querySelectorAll('[data-attendance]').forEach(el => el.addEventListener('change', () => store.setAttendance(el.dataset.attendance, el.checked)));
  root.querySelectorAll('[data-toggle-student]').forEach(el => el.addEventListener('click', () => store.mutate(() => { const s = store.selectedClass.students.find(s => s.id === el.dataset.toggleStudent); s.active = !s.active; })));
  root.querySelectorAll('[data-edit-student]').forEach(el => el.addEventListener('click', () => studentDialog(app, el.dataset.editStudent)));
  root.querySelectorAll('[data-delete-student]').forEach(el => el.addEventListener('click', () => {
    const s = store.selectedClass.students.find(s => s.id === el.dataset.deleteStudent);
    dialog({ title: 'Xóa vĩnh viễn học sinh?', danger: true, confirm: 'Xóa học sinh', body: `<p>${esc(displayName(s))} cùng lịch sử liên quan sẽ bị xóa. Nên chọn “Ngừng học” để giữ lịch sử. Lớp Học Vui tự giữ một bản lưu an toàn trước khi cập nhật.</p>`, onConfirm: () => store.mutate(doc => deleteStudent(doc, store.selectedClassId, s.id)) });
  }));
  for (const [selector, items, key] of [['#class-search', '[data-class-key]', 'classKey'], ['#student-search', '[data-student-key]', 'studentKey']]) root.querySelector(selector)?.addEventListener('input', e => root.querySelectorAll(items).forEach(el => { el.hidden = !searchKey(el.dataset[key]).includes(searchKey(e.target.value)); }));
}
function classDialog(app, existing) {
  dialog({ title: existing ? 'Sửa thông tin lớp' : 'Tạo một lớp học mới', confirm: existing ? 'Cập nhật lớp' : 'Tạo lớp', body: `<label class="field">Tên lớp<input name="name" required maxlength="60" value="${esc(existing?.name)}" placeholder="Ví dụ: 7A1" autofocus></label><label class="field">Năm học (tùy chọn)<input name="year" maxlength="30" value="${esc(existing?.schoolYear)}" placeholder="2026–2027"></label><p>Lớp Học Vui sẽ tự lưu lớp học của bạn.</p>`, onConfirm: form => {
    let selected;
    app.store.mutate(doc => { selected = upsertClass(doc, { id: existing?.id, name: form.get('name'), schoolYear: form.get('year') }); });
    app.store.selectedClassId = selected;
    app.render();
  } });
}
function studentDialog(app, studentId) {
  const student = app.store.selectedClass?.students.find(s => s.id === studentId);
  dialog({ title: student ? 'Sửa học sinh' : 'Thêm học sinh', confirm: student ? 'Cập nhật' : 'Thêm vào lớp', body: `<label class="field">Họ và tên<input name="fullName" maxlength="80" required value="${esc(student?.fullName)}" autofocus></label><label class="field">Nhãn phân biệt (tùy chọn)<input name="suffix" maxlength="30" value="${esc(student?.labelSuffix)}" placeholder="Ví dụ: 01"><small>Hai bạn trùng tên vẫn là hai học sinh độc lập.</small></label>`, onConfirm: form => app.store.mutate(doc => {
    if (student) editStudent(doc, app.store.selectedClassId, student.id, { fullName: form.get('fullName'), labelSuffix: form.get('suffix') });
    else { const [s] = addStudents(doc, app.store.selectedClassId, [form.get('fullName')]); if (form.get('suffix').trim()) s.labelSuffix = form.get('suffix').trim().normalize('NFC'); }
  }) });
}
function pasteDialog(app) {
  let preview = null, previousRaw = '';
  const modal = dialog({ title: 'Nhập danh sách học sinh', confirm: 'Xem trước danh sách', wide: true, body: '<label class="field">Mỗi dòng một họ và tên<textarea name="names" required placeholder="Mây An Nhiên\nNắng Ban Mai\nSao Bình Minh" autofocus></textarea></label><div id="paste-preview"></div>', onConfirm: (form, modal) => {
    const raw = form.get('names');
    if (!preview || raw !== previousRaw) {
      preview = pastePreview(raw, app.store.selectedClass.students); previousRaw = raw;
      if (!preview.length) throw new Error('Hãy nhập ít nhất một tên.');
      const duplicates = preview.filter(p => p.duplicate).length;
      modal.querySelector('#paste-preview').innerHTML = `<div class="notice">${preview.length} học sinh · ${duplicates} dòng trùng tên. Tên trùng vẫn được giữ vì có thể là hai bạn khác nhau.</div><ol class="paste-preview-list">${preview.slice(0, 50).map(p => `<li>${esc(p.fullName)} ${p.duplicate ? '<span class="pill">Trùng tên</span>' : ''}</li>`).join('')}</ol>${preview.length > 50 ? '<p>Chỉ hiển thị 50 dòng đầu. Toàn bộ danh sách sẽ được nhập.</p>' : ''}<label class="checkbox-label"><input type="checkbox" name="skipDuplicates">Bỏ những dòng trùng (chỉ khi bạn xác nhận đây là bản sao)</label>`;
      modal.querySelector('[type=submit]').textContent = 'Xác nhận nhập danh sách';
      return false;
    }
    const accepted = form.has('skipDuplicates') ? preview.filter(p => !p.duplicate) : preview;
    app.store.mutate(doc => addStudents(doc, app.store.selectedClassId, accepted));
    notify(`Đã thêm ${accepted.length} học sinh vào lớp.`);
  } });
  modal?.querySelector('textarea').addEventListener('input', () => { preview = null; modal.querySelector('[type=submit]').textContent = 'Xem trước danh sách'; modal.querySelector('#paste-preview').replaceChildren(); });
}
export function rosterAction(app, action) {
  const store = app.store;
  if (action === 'add-class') classDialog(app);
  else if (action === 'edit-class' && store.selectedClass) classDialog(app, store.selectedClass);
  else if (action === 'add-student' && store.selectedClass) studentDialog(app);
  else if (action === 'paste' && store.selectedClass) pasteDialog(app);
  else if (action === 'archive-class') store.mutate(() => { store.selectedClass.archived = !store.selectedClass.archived; });
  else if (action === 'delete-class') dialog({ title: 'Xóa vĩnh viễn lớp?', danger: true, confirm: 'Xóa lớp và lịch sử liên quan', body: `<p>Lớp ${esc(store.selectedClass.name)}, toàn bộ học sinh, vòng và lịch sử của lớp sẽ bị xóa khỏi bản làm việc. Lớp Học Vui sẽ tự giữ một bản lưu an toàn trước khi cập nhật.</p>`, onConfirm: () => {
    const id = store.selectedClassId;
    store.mutate(doc => deleteClass(doc, id)); store.selectedClassId = store.document.classes[0]?.id ?? null; app.render();
  } });
  else if (action === 'reset-round') dialog({ title: 'Bắt đầu vòng gọi tên mới?', confirm: 'Tạo vòng mới', body: '<p>Các bạn đã được gọi sẽ có cơ hội lại. Lịch sử cũ được giữ và vòng mới sẽ tự lưu.</p>', onConfirm: () => store.mutate(doc => resetRound(doc, store.selectedClassId)) });
  else return false;
  return true;
}
