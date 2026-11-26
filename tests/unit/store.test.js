import { describe, it, expect, vi } from 'vitest';
import { Store } from '../../src/core/store.js';
import { createDemo } from '../../src/core/domain/demo.js';
describe('working copy', () => {
  it('persists today attendance in the document and restores absences after reopening', () => {
    const store = new Store(); store.replace(createDemo());
    const id = store.selectedClass.students[0].id;
    store.setAttendance(id, false); expect(store.dirty).toBe(true); expect(store.absentIds().has(id)).toBe(true); expect(store.document.attendanceRecords).toHaveLength(1);
    const reopened = new Store(); reopened.replace(store.document); expect(reopened.absentIds().has(id)).toBe(true); expect(reopened.dirty).toBe(false);
    expect(new Set(store.document.classes.flatMap(c => c.students.map(s => s.id))).size).toBe(107);
  });
  it('keeps an archived class selectable on reopen when there are no active classes', () => {
    const doc = createDemo(); doc.classes.forEach(c => { c.archived = true; });
    const store = new Store(); store.replace(doc);
    expect(store.selectedClass.id).toBe(doc.classes[0].id); expect(store.dirty).toBe(false);
  });
  it('stops excluding yesterday absences at midnight in Vietnam without deleting the record', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-25T16:59:59Z'));
      const store = new Store(); store.replace(createDemo()); const id = store.selectedClass.students[0].id;
      store.setAttendance(id, false); expect(store.absentIds().has(id)).toBe(true);
      vi.setSystemTime(new Date('2026-11-25T17:00:00Z'));
      expect(store.absentIds().size).toBe(0); expect(store.document.attendanceRecords[0].date).toBe('2026-11-25');
    } finally { vi.useRealTimers(); }
  });
});
