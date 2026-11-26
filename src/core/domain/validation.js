import { GAME_IDS, normalize, text, searchKey } from './schema.js';
const fail = message => { throw new Error(`Dữ liệu không hợp lệ: ${message}`); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const str = (v, max, label, empty = false) => empty && v === '' ? '' : text(v, max, label);
const bool = (v, label) => typeof v === 'boolean' ? v : fail(label);
const list = (v, label) => Array.isArray(v) ? v : fail(label);
const id = v => { const result = str(v, 200, 'ID'); if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(result)) fail('ID chứa ký tự không được hỗ trợ'); return result; };
const date = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v)) ? v : fail('ngày giờ');
function oneOf(value, options, label) { if (!options.includes(value)) fail(label); return value; }

export function validateDocument(input) {
  if (!object(input)) fail('cần một JSON object');
  if (input.schemaVersion > 2) throw new Error('Dữ liệu cần phiên bản Lớp Học Vui mới hơn. Bản hiện tại vẫn được giữ nguyên.');
  if (![1, 2].includes(input.schemaVersion)) fail('schemaVersion');
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) fail('revision');
  const seen = new Set();
  function uniqueId(value) { const result = id(value); if (seen.has(result)) fail('ID bị trùng'); seen.add(result); return result; }
  const classNames = new Set();
  const classes = list(input.classes, 'classes').map(c => {
    if (!object(c)) fail('lớp');
    const classId = uniqueId(c.id);
    const name = str(c.name, 60, 'Tên lớp');
    const schoolYear = str(c.schoolYear, 30, 'Năm học', true);
    const key = `${normalize(name).toLocaleLowerCase('vi')}\0${schoolYear.toLowerCase()}`;
    if (classNames.has(key)) fail('tên lớp trùng trong cùng năm học');
    classNames.add(key);
    return { id: classId, name, schoolYear, archived: bool(c.archived, 'archived'), students: list(c.students, 'students').map(s => {
      if (!object(s)) fail('học sinh');
      return { id: uniqueId(s.id), fullName: str(s.fullName, 80, 'Tên học sinh'), labelSuffix: str(s.labelSuffix, 30, 'Nhãn phân biệt', true), active: bool(s.active, 'active') };
    }) };
  });
  const classMap = new Map(classes.map(c => [c.id, c]));
  const members = new Map(classes.map(c => [c.id, new Set(c.students.map(s => s.id))]));
  const roundClasses = new Set();
  const roundIds = new Set();
  const rounds = list(input.rounds, 'rounds').map(r => {
    if (!object(r) || !classMap.has(r.classId) || roundClasses.has(r.classId)) fail('vòng của lớp');
    roundClasses.add(r.classId);
    const roundId = id(r.roundId);
    if (roundIds.has(roundId)) fail('roundId trùng');
    roundIds.add(roundId);
    const called = list(r.calledStudentIds, 'calledStudentIds');
    if (new Set(called).size !== called.length || called.some(s => !members.get(r.classId).has(s))) fail('tham chiếu học sinh trong vòng');
    return { classId: r.classId, roundId, calledStudentIds: [...called] };
  });
  const playIds = new Set();
  const historyIds = new Set();
  const history = list(input.history, 'history').map(h => {
    if (!object(h) || !classMap.has(h.classId) || !members.get(h.classId).has(h.studentId)) fail('tham chiếu lịch sử');
    if (playIds.has(h.playId) || historyIds.has(h.id)) fail('lượt chơi trùng');
    playIds.add(id(h.playId)); historyIds.add(id(h.id));
    const mode = oneOf(h.mode, ['normal', 'unique'], 'chế độ lịch sử');
    if (mode === 'unique' && !h.roundId) fail('roundId lịch sử');
    return { id: h.id, playId: h.playId, classId: h.classId, studentId: h.studentId, roundId: h.roundId === null ? null : id(h.roundId), gameId: oneOf(h.gameId, GAME_IDS, 'game lịch sử'), mode, revealedAt: date(h.revealedAt) };
  });
  const s = input.settings;
  const attendanceIds = new Set(), attendanceDays = new Set();
  const attendanceRecords = list(input.schemaVersion === 1 ? input.attendanceRecords ?? [] : input.attendanceRecords, 'attendanceRecords').map(r => {
    if (!object(r) || !classMap.has(r.classId)) fail('lớp trong điểm danh');
    const recordId = id(r.id), day = r.date;
    if (attendanceIds.has(recordId)) fail('ID điểm danh trùng'); attendanceIds.add(recordId);
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number(day.slice(0, 4)) < 1 || !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) fail('ngày điểm danh');
    const key = `${r.classId}:${day}`; if (attendanceDays.has(key)) fail('ngày điểm danh trùng trong cùng lớp'); attendanceDays.add(key);
    const entriesSeen = new Set();
    const entries = list(r.entries, 'học sinh điểm danh').map(e => {
      if (!object(e) || !members.get(r.classId).has(e.studentId) || entriesSeen.has(e.studentId)) fail('tham chiếu học sinh điểm danh'); entriesSeen.add(e.studentId);
      return { studentId: e.studentId, status: oneOf(e.status, ['present', 'absent', 'excused', 'late'], 'trạng thái điểm danh') };
    });
    return { id: recordId, classId: r.classId, date: day, entries, updatedAt: date(r.updatedAt) };
  });
  if (!object(s)) fail('settings');
  if (typeof s.volume !== 'number' || !Number.isFinite(s.volume) || s.volume < 0 || s.volume > 1) fail('âm lượng');
  const settings = {
    mode: oneOf(s.mode, ['unique', 'normal'], 'mode'),
    durationPreset: oneOf(s.durationPreset, ['quick', 'normal', 'dramatic'], 'durationPreset'),
    hookMode: oneOf(s.hookMode, ['random', '0', '1', '2'], 'hookMode'),
    soundEnabled: bool(s.soundEnabled, 'soundEnabled'), musicEnabled: bool(s.musicEnabled, 'musicEnabled'), volume: s.volume,
    quality: oneOf(s.quality, ['auto', 'low', 'medium', 'high'], 'quality'), reducedMotion: bool(s.reducedMotion, 'reducedMotion'),
  };
  // Construct whitelisted objects; never merge untrusted JSON, __proto__ or constructor.
  return { schemaVersion: 2, documentId: id(input.documentId), revision: input.revision, updatedAt: date(input.updatedAt), schoolName: str(input.schoolName, 120, 'Tên trường', true), classes, rounds, history, attendanceRecords, settings };
}

export function parseDocument(raw) {
  if (new TextEncoder().encode(raw).byteLength > 20 * 1024 * 1024) throw new Error('File JSON vượt giới hạn 20 MB.');
  let parsed;
  try { parsed = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch { throw new Error('File JSON bị lỗi hoặc rỗng. File gốc được giữ nguyên; hãy mở một bản sao lưu.'); }
  return validateDocument(parsed);
}

export function pastePreview(raw, students = []) {
  const existing = new Set(students.map(s => searchKey(s.fullName)));
  const seen = new Set();
  return raw.split(/\r?\n/).map(normalize).filter(Boolean).map(name => {
    const clean = text(name, 80, 'Tên học sinh');
    const key = searchKey(clean);
    const duplicate = seen.has(key) || existing.has(key);
    seen.add(key);
    return { fullName: clean, duplicate };
  });
}
