import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../../src/core/game/game-manager.js';
import { GameClock } from '../../src/core/game/game-clock.js';
const scenario = { playId: 'play-a', winnerId: 'winner', revealAtMs: 100, durationMs: 120, hooks: [] };
const game = () => ({ prepare: vi.fn(), start: vi.fn(), update: vi.fn(), reveal: vi.fn(), dispose: vi.fn() });
function manager(options = {}) { return new GameManager({ loadGame: async () => game(), loadFallback: async () => game(), commit: vi.fn(), autoLoop: false, ...options }); }
const args = { scenario, students: [], context: {} };
describe('game state machine', () => {
  it('skip and later animation callbacks commit once, double start is guarded', async () => {
    const m = manager(); const first = m.start(args); expect(await m.start(args)).toBe(false); await first;
    expect(m.skip()).toBe(true); expect(m.skip()).toBe(false); m.tick(performance.now() + 999);
    expect(m.commit).toHaveBeenCalledTimes(1); expect(m.state).toBe('RESULT');
  });
  it('cancel before reveal commits nothing and stale load is disposed', async () => {
    let resolve; const stale = game();
    const m = manager({ loadGame: () => new Promise(r => { resolve = r; }) });
    const loading = m.start(args); m.cancel(); resolve(stale); await loading;
    expect(stale.dispose).toHaveBeenCalled(); expect(m.commit).not.toHaveBeenCalled(); expect(m.skip()).toBe(false);
  });
  it('pause freezes clock, resume does not jump, cancel keeps history untouched', async () => {
    const m = manager(); await m.start(args); m.clock.last = 1000;
    m.tick(1020); m.pause(); m.tick(6000); expect(m.clock.elapsed).toBe(20);
    m.clock.resume(7000); m.state = 'RUNNING'; m.tick(7030); expect(m.clock.elapsed).toBe(50);
    m.cancel(); expect(m.commit).not.toHaveBeenCalled();
  });
  it('render failure switches fallback with same scenario and elapsed time', async () => {
    const broken = game(); broken.update.mockImplementation(() => { throw new Error('lost context'); });
    const fallback = game(), m = manager({ loadGame: async () => broken, loadFallback: async () => fallback }); await m.start(args);
    m.clock.elapsed = 45; await m.recover(new Error('context lost'));
    expect(m.game).toBe(fallback); expect(m.scenario).toBe(scenario); expect(m.clock.elapsed).toBe(45); expect(m.state).toBe('RUNNING');
    m.skip(); expect(m.commit).toHaveBeenCalledWith(scenario); expect(m.commit).toHaveBeenCalledTimes(1);
  });
  it('does not apply a stale fallback after cancellation', async () => {
    let resolve; const fallback = game(), m = manager({ loadFallback: () => new Promise(r => { resolve = r; }) }); await m.start(args);
    const recovering = m.recover(new Error('lost')); m.cancel(); resolve(fallback); await recovering;
    expect(m.state).toBe('IDLE'); expect(fallback.dispose).toHaveBeenCalled(); expect(m.commit).not.toHaveBeenCalled();
  });
  it('passes the same shuffled students to 3D and recovery while retaining the preselected winner', async () => {
    const students = Array.from({ length: 40 }, (_, i) => ({ id: `fake-${i}` }));
    const selected = { ...scenario, visualSeed: 42, winnerId: students[17].id };
    const scene = game(), fallback = game(), m = manager({ loadGame: async () => scene, loadFallback: async () => fallback });
    await m.start({ ...args, scenario: selected, students });
    const initial = scene.prepare.mock.calls[0][0];
    expect(initial.students).not.toEqual(students); expect(new Set(initial.students)).toEqual(new Set(students));
    await m.recover(new Error('synthetic context loss'));
    expect(fallback.prepare.mock.calls[0][0].students).toBe(initial.students);
    expect(fallback.prepare.mock.calls[0][0].scenario).toBe(selected);
    m.skip(); expect(fallback.reveal).toHaveBeenCalledWith(students[17].id); expect(m.commit).toHaveBeenCalledExactlyOnceWith(selected);
  });
  it('uses the shuffled order when 3D preparation fails before the first frame', async () => {
    const students = Array.from({ length: 40 }, (_, i) => ({ id: `fake-${i}` }));
    const scene = game(), fallback = game(); scene.prepare.mockImplementation(() => { throw new Error('synthetic prepare failure'); });
    const m = manager({ loadGame: async () => scene, loadFallback: async () => fallback });
    await m.start({ ...args, scenario: { ...scenario, visualSeed: 42 }, students });
    expect(fallback.prepare.mock.calls[0][0].students).toBe(scene.prepare.mock.calls[0][0].students);
    expect(fallback.prepare.mock.calls[0][0].students).not.toEqual(students);
  });
  it('clock uses elapsed time rather than frame count', () => {
    const c = new GameClock(); c.start(0); const time = c.tick(200); expect(time).toEqual({ elapsedMs: 200, deltaMs: 50 });
    c.pause(); c.tick(6000); c.resume(7000); expect(c.tick(7010).elapsedMs).toBe(210);
  });
  it('load failure including fallback surfaces ERROR without committing', async () => {
    const m = manager({ loadGame: async () => { throw new Error('broken chunk'); }, loadFallback: async () => { throw new Error('fallback unavailable'); } });
    expect(await m.start(args)).toBe(false); expect(m.state).toBe('ERROR'); expect(m.commit).not.toHaveBeenCalled();
  });
});
