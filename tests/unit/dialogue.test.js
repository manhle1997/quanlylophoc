import { describe, expect, it } from 'vitest';
import { characterDialogue } from '../../src/core/game/character-dialogue.js';
import { games } from '../../src/core/game/game-registry.js';

describe('near-miss character dialogue', () => {
  it('gives every game/hook a Vietnamese line for the actual near-miss student', () => {
    for (const game of games) for (const kind of game.hooks) {
      const scenario = Object.freeze({ playId: 'synthetic-play', gameId: game.id, visualSeed: 7, winnerId: 'other-student', hooks: Object.freeze([{ kind, studentId: 'speaking-student', startMs: 100, endMs: 200 }]) });
      const original = JSON.stringify(scenario);
      const line = characterDialogue(scenario, 150);
      expect(line.studentId).toBe('speaking-student'); expect(line.text.length).toBeGreaterThan(20);
      expect(line.key).toBe('synthetic-play:0'); expect(JSON.stringify(scenario)).toBe(original);
    }
  });
  it('only speaks during the corresponding hook, and clears on result/skip', () => {
    const scenario = { playId: 'play', gameId: 'fishing', visualSeed: 0, hooks: [{ kind: 'baitSlip', studentId: 'a', startMs: 100, endMs: 200 }, { kind: 'baitSlip', studentId: 'b', startMs: 300, endMs: 400 }] };
    expect(characterDialogue(scenario, 99)).toBeNull(); expect(characterDialogue(scenario, 201)).toBeNull();
    expect(characterDialogue(scenario, 100).studentId).toBe('a'); expect(characterDialogue(scenario, 350).studentId).toBe('b');
    expect(characterDialogue(scenario, 350, true)).toBeNull();
    expect(characterDialogue(scenario, 150).text).not.toBe(characterDialogue(scenario, 350).text);
  });
  it('is stable while paused, across frames and through 3D→2D recovery', () => {
    const scenario = { playId: 'play', gameId: 'treasure', visualSeed: 42, hooks: [{ kind: 'lockedChest', studentId: 'a', startMs: 100, endMs: 200 }] };
    expect(characterDialogue(scenario, 120)).toEqual(characterDialogue(scenario, 180));
    expect(characterDialogue(structuredClone(scenario), 120)).toEqual(characterDialogue(scenario, 120));
    expect(characterDialogue({ ...scenario, hooks: [] }, 120)).toBeNull();
  });
});
