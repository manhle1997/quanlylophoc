export class Store {
  constructor(document = null) {
    this.document = document;
    this.generation = 0;
    this.savedGeneration = 0;
    this.selectedClassId = (document?.classes.find(c => !c.archived) ?? document?.classes[0])?.id ?? null;
    this.listeners = new Set();
    this.demo = false;
    this.documentEpoch = 0;
  }
  get dirty() { return this.generation !== this.savedGeneration; }
  get selectedClass() { return this.document?.classes.find(c => c.id === this.selectedClassId); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }
  replace(document, { dirty = false, demo = false } = {}) {
    this.documentEpoch++;
    this.document = structuredClone(document);
    this.generation++;
    this.savedGeneration = dirty ? this.generation - 1 : this.generation;
    this.selectedClassId = (this.document.classes.find(c => !c.archived) ?? this.document.classes[0])?.id ?? null;
    this.demo = demo;
    this.emit();
  }
  mutate(fn) { fn(this.document); this.generation++; this.emit(); }
  absentIds(classId = this.selectedClassId) { return this.document ? absenceIds(this.document, classId, todayKey()) : new Set(); }
  setAttendance(studentId, present) {
    this.mutate(doc => setAttendanceStatus(doc, this.selectedClassId, todayKey(), studentId, present ? 'present' : 'absent'));
  }
}
import { absenceIds, setAttendanceStatus, todayKey } from './domain/attendance-service.js';
