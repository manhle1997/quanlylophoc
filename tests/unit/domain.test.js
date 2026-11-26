import { describe, it, expect } from 'vitest';
import { createDocument, uid, searchKey } from '../../src/core/domain/schema.js';
import { validateDocument, parseDocument, pastePreview } from '../../src/core/domain/validation.js';
import { upsertClass, addStudents, editStudent, deleteStudent, deleteClass, resetRound } from '../../src/core/domain/roster-service.js';
import { createDemo } from '../../src/core/domain/demo.js';
describe('roster and schema', () => {
  it('supports NFC, duplicate names with IDs, suffixes, and separate school years', () => {
    const doc = createDocument();
    const id = upsertClass(doc, { name: ' 7A1 ', schoolYear: '2026' });
    expect(() => upsertClass(doc, { name: '7a1', schoolYear: '2026' })).toThrow();
    upsertClass(doc, { name: '7a1', schoolYear: '2027' });
    const [a, b] = addStudents(doc, id, ['Mây An Nhiên', 'Mây An Nhiên']);
    expect(a.fullName).toBe(b.fullName); expect(a.id).not.toBe(b.id); expect(a.labelSuffix).not.toBe(b.labelSuffix);
    editStudent(doc, id, a.id, { fullName: '<script>giả lập</script>', labelSuffix: 'A' });
    expect(validateDocument(doc)).toEqual(doc);
    expect(searchKey('Đỗ Mây')).toBe('do may');
    expect(() => addStudents(doc, id, ['a'.repeat(81)])).toThrow();
  });
  it('hard deletes prune history and round references; reset preserves old history', () => {
    const doc = createDemo(), c = doc.classes[0], studentId = c.students[0].id;
    const oldRound = doc.rounds[0].roundId;
    doc.rounds[0].calledStudentIds.push(studentId);
    doc.history.push({ id: uid(), playId: uid(), classId: c.id, studentId, roundId: oldRound, mode: 'unique', gameId: 'fishing', revealedAt: new Date().toISOString() });
    resetRound(doc, c.id); expect(doc.history).toHaveLength(1); expect(doc.rounds.find(r => r.classId === c.id).roundId).not.toBe(oldRound);
    expect(validateDocument(doc)).toEqual(doc);
    deleteStudent(doc, c.id, studentId); expect(doc.history).toHaveLength(0);
    deleteClass(doc, c.id); expect(doc.rounds.some(r => r.classId === c.id)).toBe(false);
    expect(validateDocument(doc)).toEqual(doc);
  });
  it.each(['', '{bad', 'null', '[]'])('rejects corrupt input %s', raw => expect(() => parseDocument(raw)).toThrow());
  it('rejects future schemas, duplicate IDs and orphan references; removes unknown fields', () => {
    const doc = createDemo();
    expect(() => validateDocument({ ...doc, schemaVersion: 99 })).toThrow(/mới hơn/);
    const invalid = structuredClone(doc); invalid.classes[1].students[0].id = invalid.classes[0].students[0].id;
    expect(() => validateDocument(invalid)).toThrow(/ID/);
    doc.rounds[0].calledStudentIds.push('missing'); expect(() => validateDocument(doc)).toThrow(/tham chiếu/);
    const clean = createDocument(); clean.constructor = { dangerous: true };
    expect(Object.hasOwn(validateDocument(clean), 'constructor')).toBe(false);
    const unsafe = createDemo(); unsafe.classes[0].id = 'x" onmouseover="alert(1)';
    expect(() => validateDocument(unsafe)).toThrow(/ID/);
  });
  it('paste previews preserve duplicates until explicit user choice', () => {
    const result = pastePreview(' Mây An Nhiên \r\n\nMây An Nhiên\nSao Ban Mai', []);
    expect(result).toHaveLength(3); expect(result[1].duplicate).toBe(true); expect(result[2].duplicate).toBe(false);
  });
  it('validates a synthetic 10,000 student document', () => {
    const doc = createDocument();
    for (let i = 0; i < 100; i++) { const id = upsertClass(doc, { name: `Lớp giả ${i}` }); addStudents(doc, id, Array.from({ length: 100 }, (_, n) => `Nhân vật giả ${i} ${n}`)); }
    const start = performance.now();
    expect(validateDocument(doc).classes.reduce((n, c) => n + c.students.length, 0)).toBe(10000);
    console.info(`10,000 synthetic student validation: ${(performance.now() - start).toFixed(1)} ms (development host)`);
  });
});
