import { describe, it, expect } from 'vitest';
import { raceProgress } from '../../src/games/marble/race-progress.js';
describe('scripted race has the preselected first finish at every frame rate', () => {
  for (const fps of [15, 30, 60]) for (const count of [2, 40, 80]) it(`${count} actors at ${fps} FPS`, () => {
    const scenario = { winnerId: `s${count - 1}`, durationMs: 12000, revealAtMs: 10200, hooks: [{ studentId: 's0', startMs: 3000, endMs: 4800 }] };
    for (let ms = 0; ms < 10200; ms += 1000 / fps) for (let i = 0; i < count; i++) expect(raceProgress(scenario, `s${i}`, i, ms)).toBeLessThan(1);
    expect(raceProgress(scenario, scenario.winnerId, count - 1, 10200)).toBe(1);
    for (let i = 0; i < count - 1; i++) expect(raceProgress(scenario, `s${i}`, i, 10200)).toBeLessThan(1);
  });
});
