import { uid } from './schema.js';
import { findClass } from './roster-service.js';

export const ATTENDANCE_STATUSES = Object.freeze({ present: 'Có mặt', late: 'Đi muộn', excused: 'Vắng có phép', absent: 'Vắng không phép' });
export function todayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export function validateAttendanceDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1 || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('Ngày điểm danh không hợp lệ.');
  return value;
}
export const attendanceRecord = (doc, classId, date = todayKey()) => (doc.attendanceRecords ?? []).find(r => r.classId === classId && r.date === date) ?? null;
export function attendanceSummary(doc, classId, date = todayKey()) {
  const c = doc.classes.find(c => c.id === classId), record = attendanceRecord(doc, classId, date);
  const statuses = new Map((record?.entries ?? []).map(e => [e.studentId, e.status]));
  const summary = { present: 0, absent: 0, late: 0, excused: 0, total: 0, recorded: !!record };
  for (const s of c?.students ?? []) if (statuses.has(s.id) || s.active && (!record || date === todayKey())) { summary[statuses.get(s.id) ?? 'present']++; summary.total++; }
  return summary;
}
export function absenceIds(doc, classId, date = todayKey()) {
  return new Set((attendanceRecord(doc, classId, date)?.entries ?? []).filter(e => ['absent', 'excused'].includes(e.status)).map(e => e.studentId));
}
function updateRecord(doc, classId, date, edit) {
  validateAttendanceDate(date);
  const c = findClass(doc, classId);
  const previous = attendanceRecord(doc, classId, date);
  if (c.archived) throw new Error('Hãy khôi phục lớp trước khi điểm danh.');
  if (!c.students.some(s => s.active) && !previous?.entries.length) throw new Error('Hãy thêm học sinh đang học trước khi điểm danh.');
  doc.attendanceRecords ??= [];
  const entries = new Map((previous?.entries ?? []).map(e => [e.studentId, { ...e }]));
  for (const s of c.students) if (s.active && !entries.has(s.id) && (!previous || date === todayKey())) entries.set(s.id, { studentId: s.id, status: 'present' });
  edit(entries, c);
  const record = { id: previous?.id ?? uid(), classId, date, entries: [...entries.values()], updatedAt: new Date().toISOString() };
  if (previous) doc.attendanceRecords[doc.attendanceRecords.indexOf(previous)] = record; else doc.attendanceRecords.push(record);
  return record;
}
export function setAttendanceStatus(doc, classId, date, studentId, status) {
  if (!Object.hasOwn(ATTENDANCE_STATUSES, status)) throw new Error('Trạng thái điểm danh không hợp lệ.');
  const record = attendanceRecord(doc, classId, date);
  if (!findClass(doc, classId).students.some(s => s.id === studentId && (s.active || record?.entries.some(e => e.studentId === studentId)))) throw new Error('Học sinh không thuộc danh sách điểm danh của lớp.');
  return updateRecord(doc, classId, date, entries => { entries.set(studentId, { studentId, status }); });
}
export function markClassPresent(doc, classId, date) {
  return updateRecord(doc, classId, date, entries => { for (const [id, entry] of entries) entries.set(id, { ...entry, status: 'present' }); });
}
