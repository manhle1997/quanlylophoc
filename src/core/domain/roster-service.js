import { uid, text, normalize } from './schema.js';
export function findClass(doc, classId) {
  const c = doc.classes.find(c => c.id === classId);
  if (!c) throw new Error('Không tìm thấy lớp.');
  return c;
}
export function upsertClass(doc, { id, name, schoolYear = '' }) {
  name = text(name, 60, 'Tên lớp'); schoolYear = normalize(schoolYear);
  if (schoolYear.length > 30) throw new Error('Năm học tối đa 30 ký tự.');
  if (doc.classes.some(c => c.id !== id && c.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi') && c.schoolYear.toLowerCase() === schoolYear.toLowerCase())) throw new Error('Tên lớp đã có trong năm học này.');
  if (id) { Object.assign(findClass(doc, id), { name, schoolYear }); return id; }
  const classId = uid();
  doc.classes.push({ id: classId, name, schoolYear, archived: false, students: [] });
  doc.rounds.push({ classId, roundId: uid(), calledStudentIds: [] });
  return classId;
}
export function addStudents(doc, classId, names) {
  const c = findClass(doc, classId);
  const students = names.map(n => ({ id: uid(), fullName: text(typeof n === 'string' ? n : n.fullName, 80, 'Tên học sinh'), labelSuffix: '', active: true }));
  c.students.push(...students);
  // Keep duplicates as separate IDs and assign stable distinguishable suffixes.
  const groups = new Map();
  for (const s of c.students) {
    const key = s.fullName.toLocaleLowerCase('vi');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const group of groups.values()) if (group.length > 1) group.forEach((s, i) => { if (!s.labelSuffix) s.labelSuffix = String(i + 1).padStart(2, '0'); });
  return students;
}
export function editStudent(doc, classId, studentId, data) {
  const student = findClass(doc, classId).students.find(s => s.id === studentId);
  if (!student) throw new Error('Không tìm thấy học sinh.');
  const name = text(data.fullName, 80, 'Tên học sinh');
  const suffix = normalize(data.labelSuffix ?? '');
  if (suffix.length > 30) throw new Error('Nhãn phân biệt tối đa 30 ký tự.');
  Object.assign(student, { fullName: name, labelSuffix: suffix });
}
export function deleteStudent(doc, classId, studentId) {
  const c = findClass(doc, classId);
  c.students = c.students.filter(s => s.id !== studentId);
  doc.history = doc.history.filter(h => h.studentId !== studentId);
  for (const r of doc.rounds) r.calledStudentIds = r.calledStudentIds.filter(id => id !== studentId);
  for (const record of doc.attendanceRecords ?? []) record.entries = record.entries.filter(e => e.studentId !== studentId);
}
export function deleteClass(doc, classId) {
  doc.classes = doc.classes.filter(c => c.id !== classId);
  doc.history = doc.history.filter(h => h.classId !== classId);
  doc.rounds = doc.rounds.filter(r => r.classId !== classId);
  doc.attendanceRecords = (doc.attendanceRecords ?? []).filter(r => r.classId !== classId);
}
export function resetRound(doc, classId) {
  findClass(doc, classId);
  doc.rounds = doc.rounds.filter(r => r.classId !== classId);
  doc.rounds.push({ classId, roundId: uid(), calledStudentIds: [] });
}
