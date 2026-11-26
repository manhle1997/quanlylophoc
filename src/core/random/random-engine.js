import { randomSource, sampleDistinct } from './random-source.js';
export function eligibleStudents(doc, classId, absent = new Set()) {
  const c = doc.classes.find(c => c.id === classId);
  if (!c || c.archived) return [];
  const called = new Set(doc.settings.mode === 'unique' ? doc.rounds.find(r => r.classId === classId)?.calledStudentIds ?? [] : []);
  return c.students.filter(s => s.active && !absent.has(s.id) && !called.has(s.id));
}
export function createSelection(pool, hookMode = 'random', rng = randomSource) {
  if (!Array.isArray(pool) || !pool.length) throw new Error('Không còn học sinh hợp lệ. Hãy kiểm tra điểm danh hoặc tạo vòng mới.');
  if (pool.some(id => typeof id !== 'string' || !id) || new Set(pool).size !== pool.length) throw new Error('Pool phải gồm các ID duy nhất.');
  if (!['random', '0', '1', '2'].includes(hookMode)) throw new Error('Invalid hook mode');
  const winnerId = pool[rng.int(pool.length)];
  const requested = hookMode === 'random' ? 1 + rng.int(2) : Number(hookMode);
  const nearMissIds = sampleDistinct(pool.filter(id => id !== winnerId), Math.min(requested, pool.length - 1), rng);
  return { winnerId, nearMissIds };
}
