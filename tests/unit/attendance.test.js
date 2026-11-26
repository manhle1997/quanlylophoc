import { describe, it, expect } from 'vitest';
import { createDemo } from '../../src/core/domain/demo.js';
import { validateDocument } from '../../src/core/domain/validation.js';
import { addStudents, deleteClass, deleteStudent } from '../../src/core/domain/roster-service.js';
import { todayKey, attendanceRecord, attendanceSummary, absenceIds, setAttendanceStatus, markClassPresent, validateAttendanceDate } from '../../src/core/domain/attendance-service.js';

describe('daily attendance and migration', () => {
  it('reading a day has no side effects; first teacher edit records the whole class and all four statuses', () => {
    const doc = createDemo(), c = doc.classes[0], day = todayKey(), original = JSON.stringify(doc);
    expect(attendanceSummary(doc, c.id, day)).toMatchObject({ present: 40, total: 40, recorded: false }); expect(JSON.stringify(doc)).toBe(original);
    setAttendanceStatus(doc, c.id, day, c.students[0].id, 'absent'); setAttendanceStatus(doc, c.id, day, c.students[1].id, 'excused'); setAttendanceStatus(doc, c.id, day, c.students[2].id, 'late');
    expect(attendanceSummary(doc, c.id, day)).toMatchObject({ present: 37, late: 1, absent: 1, excused: 1, recorded: true }); expect(absenceIds(doc, c.id, day)).toEqual(new Set([c.students[0].id, c.students[1].id]));
    expect(validateDocument(doc)).toEqual(doc);
    markClassPresent(doc, c.id, day); expect(attendanceSummary(doc, c.id, day).present).toBe(40); expect(doc.attendanceRecords).toHaveLength(1);
  });
  it('dates/classes are independent and historical totals stay stable when the roster changes', () => {
    const doc = createDemo(), c = doc.classes[0]; markClassPresent(doc, c.id, '2025-01-20');
    c.students[0].active = false; addStudents(doc, c.id, ['Nhân vật mới giả']);
    expect(attendanceSummary(doc, c.id, '2025-01-20').total).toBe(40); expect(attendanceSummary(doc, c.id, todayKey()).total).toBe(40);
    setAttendanceStatus(doc, c.id, '2025-01-20', c.students[0].id, 'absent'); expect(absenceIds(doc, c.id, todayKey()).size).toBe(0); expect(attendanceRecord(doc, doc.classes[1].id, '2025-01-20')).toBeNull();
    expect(attendanceRecord(doc, c.id, '2025-01-20').entries).toHaveLength(40);
  });
  it('prunes hard-delete references but preserves archived students and historical identities', () => {
    const doc = createDemo(), c = doc.classes[0]; markClassPresent(doc, c.id, todayKey());
    deleteStudent(doc, c.id, c.students[0].id); expect(doc.attendanceRecords[0].entries).toHaveLength(39); expect(validateDocument(doc)).toEqual(doc);
    deleteClass(doc, c.id); expect(doc.attendanceRecords).toHaveLength(0); expect(validateDocument(doc)).toEqual(doc);
  });
  it('migrates schema 1 without losing IDs, settings or unique rounds and requires records in schema 2', () => {
    const legacy = createDemo(); legacy.schemaVersion = 1; delete legacy.attendanceRecords;
    const migrated = validateDocument(legacy); expect(migrated.schemaVersion).toBe(2); expect(migrated.attendanceRecords).toEqual([]); expect(migrated.classes).toEqual(legacy.classes); expect(migrated.rounds).toEqual(legacy.rounds);
    delete migrated.attendanceRecords; expect(() => validateDocument(migrated)).toThrow();
  });
  it('rejects invalid dates, statuses, orphan/duplicate entries and duplicate day records', () => {
    for (const day of ['2026-02-30', '2026-13-01', 'x', '0000-01-01']) expect(() => validateAttendanceDate(day)).toThrow();
    const doc = createDemo(), c = doc.classes[0]; expect(() => setAttendanceStatus(doc, c.id, todayKey(), c.students[0].id, 'invented')).toThrow();
    markClassPresent(doc, c.id, todayKey());
    const duplicate = structuredClone(doc); duplicate.attendanceRecords.push(structuredClone(duplicate.attendanceRecords[0])); expect(() => validateDocument(duplicate)).toThrow();
    const orphan = structuredClone(doc); orphan.attendanceRecords[0].entries[0].studentId = 'missing'; expect(() => validateDocument(orphan)).toThrow();
    doc.attendanceRecords[0].entries.push({ ...doc.attendanceRecords[0].entries[0] }); expect(() => validateDocument(doc)).toThrow();
  });
  it('uses Vietnam calendar dates across a UTC day boundary', () => {
    expect(todayKey(new Date('2026-11-24T18:00:00Z'))).toBe('2026-11-25');
  });
});
