import { describe, it, expect } from 'vitest';
import { randomInt } from '../../src/core/random/random-source.js';
import { createSelection, eligibleStudents } from '../../src/core/random/random-engine.js';
import { createScenario } from '../../src/core/random/scenario.js';
import { commitResult } from '../../src/core/domain/session-service.js';
import { createDemo } from '../../src/core/domain/demo.js';
import { validateDocument } from '../../src/core/domain/validation.js';
const zero = { int: () => 0 };
describe('random and scenarios', () => {
  it('rejects biased boundary values and invalid bounds', () => {
    const draws = [4294967295, 8]; let i = 0;
    expect(randomInt(3, { getRandomValues: b => { b[0] = draws[i++]; } })).toBe(2); expect(i).toBe(2);
    for (const max of [0, -1, 1.5, NaN, 2 ** 32 + 1]) expect(() => randomInt(max)).toThrow(RangeError);
    expect(randomInt(1)).toBe(0); expect(randomInt(2 ** 32, { getRandomValues: b => { b[0] = 4294967295; } })).toBe(4294967295);
  });
  it.each([1, 2, 40, 80])('clamps hooks to pool %i, distinct and separate from winner', size => {
    for (const mode of ['0', '1', '2', 'random']) {
      const pool = Array.from({ length: size }, (_, i) => `student-${i}`);
      const result = createSelection(pool, mode, zero);
      expect(result.nearMissIds).toHaveLength(Math.min(mode === 'random' ? 1 : Number(mode), size - 1));
      expect(new Set(result.nearMissIds).size).toBe(result.nearMissIds.length); expect(result.nearMissIds).not.toContain(result.winnerId);
    }
  });
  it('can select every ID, rejects empty/duplicate pools and invalid hook settings', () => {
    const pool = ['a', 'b', 'c'];
    expect(new Set(pool.map((_, index) => createSelection(pool, '0', { int: () => index }).winnerId)).size).toBe(3);
    expect(() => createSelection([], '0')).toThrow(); expect(() => createSelection(['a', 'a'])).toThrow(); expect(() => createSelection(pool, '9')).toThrow();
  });
  it('filters inactive, absent, archived and called IDs; normal mode preserves unique rounds', () => {
    const doc = createDemo(), c = doc.classes[0];
    c.students[0].active = false; const absent = new Set([c.students[1].id]); doc.rounds[0].calledStudentIds.push(c.students[2].id);
    expect(eligibleStudents(doc, c.id, absent)).toHaveLength(37);
    doc.settings.mode = 'normal'; expect(eligibleStudents(doc, c.id, absent)).toHaveLength(38);
    const scenario = createScenario({ document: doc, classId: c.id, pool: [c.students[3].id], gameId: 'fishing', rng: zero });
    commitResult(doc, scenario); expect(doc.rounds[0].calledStudentIds).toEqual([c.students[2].id]);
    c.archived = true; expect(eligibleStudents(doc, c.id)).toHaveLength(0);
  });
  it('40 unique reveals are idempotent and persist the full round', () => {
    let doc = createDemo(); const classId = doc.classes[0].id, winners = [];
    for (let i = 0; i < 40; i++) {
      const scenario = createScenario({ document: doc, classId, pool: eligibleStudents(doc, classId).map(s => s.id), gameId: 'fishing', rng: zero });
      winners.push(scenario.winnerId); expect(commitResult(doc, scenario)).toBe(true); expect(commitResult(doc, scenario)).toBe(false);
      doc = validateDocument(JSON.parse(JSON.stringify(doc)));
    }
    expect(new Set(winners).size).toBe(40); expect(doc.history).toHaveLength(40); expect(eligibleStudents(doc, classId)).toHaveLength(0);
  });
  it.each(['quick', 'normal', 'dramatic'])('monotonic immutable timeline and visual independence for %s', preset => {
    const doc = createDemo(); doc.settings.durationPreset = preset; doc.settings.hookMode = '2';
    const args = { document: doc, classId: doc.classes[0].id, pool: doc.classes[0].students.map(s => s.id), gameId: 'fishing', rng: zero };
    const a = createScenario({ ...args, visualSeed: 1 }), b = createScenario({ ...args, visualSeed: 123 });
    expect(a.winnerId).toBe(b.winnerId); expect(a.hooks[0].endMs).toBeLessThan(a.hooks[1].startMs); expect(a.hooks[1].endMs).toBeLessThan(a.revealAtMs);
    expect(Object.isFrozen(a)).toBe(true); expect(Object.isFrozen(a.hooks)).toBe(true); expect(a.revealAtMs).toBeLessThan(a.durationMs);
  });
});
