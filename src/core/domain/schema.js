export const GAME_IDS = ['fishing', 'ufo', 'claw', 'marble', 'treasure'];
export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'unique', durationPreset: 'normal', hookMode: 'random', soundEnabled: true,
  musicEnabled: true, volume: 0.5, quality: 'auto', reducedMotion: false,
});
export const uid = () => crypto.randomUUID();
export const normalize = value => String(value).normalize('NFC').trim();
export const searchKey = value => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
export function text(value, max, label) {
  if (typeof value !== 'string') throw new Error(`${label} phải là chuỗi.`);
  const result = normalize(value);
  if (!result || [...result].length > max) throw new Error(`${label} cần từ 1 đến ${max} ký tự.`);
  return result;
}
export function createDocument() {
  return { schemaVersion: 2, documentId: uid(), revision: 0, updatedAt: new Date().toISOString(), schoolName: '', classes: [], rounds: [], history: [], attendanceRecords: [], settings: { ...DEFAULT_SETTINGS } };
}
export const displayName = student => student ? `${student.fullName}${student.labelSuffix ? ` (${student.labelSuffix})` : ''}` : 'Học sinh đã xóa';
