import { describe, expect, it } from 'vitest';
import { visualOrder } from '../../src/core/game/visual-order.js';
import { createDemo } from '../../src/core/domain/demo.js';
import { createScenario } from '../../src/core/random/scenario.js';

describe('scene presentation order', () => {
  it('retains all eligible IDs and original student objects without changing roster order', () => {
    const roster = Object.freeze(Array.from({ length: 80 }, (_, i) => Object.freeze({ id: `fake-${i}`, fullName: `Nhân vật giả ${i}` })));
    const arranged = visualOrder(roster, 0);
    expect(arranged).not.toBe(roster); expect(new Set(arranged)).toEqual(new Set(roster));
    expect(roster.map(s => s.id)).toEqual(Array.from({ length: 80 }, (_, i) => `fake-${i}`));
    expect(arranged.map(s => s.id)).not.toEqual(roster.map(s => s.id));
  });
  it('is stable within a round, including 3D→2D recovery, and changes between visual seeds', () => {
    const roster = Array.from({ length: 40 }, (_, i) => ({ id: `fake-${i}` }));
    expect(visualOrder(roster, 123)).toEqual(visualOrder(roster, 123));
    expect(visualOrder(roster, 123)).not.toEqual(visualOrder(roster, 124));
  });
  it('does not pin the first roster student to the first actor, passive labels or 2D name bubbles', () => {
    const roster = Array.from({ length: 40 }, (_, i) => ({ id: `fake-${i}` }));
    const firstActors = new Set(), firstStudentInLabels = new Set(), firstStudentInBubbles = new Set();
    for (let seed = 0; seed < 2048; seed++) {
      const actors = visualOrder(roster, seed);
      firstActors.add(actors[0].id);
      firstStudentInLabels.add(actors.filter((_actor, i) => i % Math.floor(actors.length / 6) === 0).slice(0, 6).includes(roster[0]));
      firstStudentInBubbles.add(actors.slice(0, 12).includes(roster[0]));
    }
    expect(firstActors).toEqual(new Set(roster.map(s => s.id)));
    expect(firstStudentInLabels).toEqual(new Set([true, false]));
    expect(firstStudentInBubbles).toEqual(new Set([true, false]));
  });
  it('changing presentation seeds cannot change the winner, hooks, eligible pool or class data', () => {
    const doc = createDemo(), c = doc.classes[0], original = structuredClone(doc);
    const args = { document: doc, classId: c.id, pool: c.students.map(s => s.id), gameId: 'fishing', rng: { int: max => max - 1 } };
    const a = createScenario({ ...args, visualSeed: 1 }), b = createScenario({ ...args, visualSeed: 99 });
    const first = visualOrder(c.students, a.visualSeed), second = visualOrder(c.students, b.visualSeed);
    expect(first).not.toEqual(second); expect(a.winnerId).toBe(c.students.at(-1).id);
    expect(b.winnerId).toBe(a.winnerId); expect(b.hooks).toEqual(a.hooks); expect(b.eligibleIds).toEqual(a.eligibleIds);
    expect(doc).toEqual(original);
  });
  it('handles empty and single-student pools', () => {
    expect(visualOrder([], 0)).toEqual([]);
    const roster = [{ id: 'only-synthetic-student' }]; expect(visualOrder(roster, 0)).toEqual(roster);
  });
});
