import { GameClock } from './game-clock.js';
import { visualOrder } from './visual-order.js';
export class GameManager {
  constructor({ loadGame, loadFallback, commit, onState = () => {}, audio, autoLoop = true }) {
    Object.assign(this, { loadGame, loadFallback, commit, onState, audio, autoLoop });
    this.state = 'IDLE'; this.generation = 0; this.committed = new Set(); this.clock = new GameClock(); this.frame = null; this.game = null; this.scenario = null;
  }
  get busy() { return ['LOADING', 'READY', 'RUNNING', 'PAUSED', 'REVEALING'].includes(this.state); }
  transition(state) { this.state = state; this.onState(state); }
  async start({ scenario, students, context }) {
    if (this.state !== 'IDLE' && this.state !== 'RESULT') return false;
    this.clearFrame(); this.game?.dispose(); this.audio?.stop(); this.clock = new GameClock();
    const generation = ++this.generation; this.scenario = scenario; this.students = visualOrder(students, scenario.visualSeed); this.context = context; this.playedHooks = new Set(); this.controller?.abort(); this.controller = new AbortController();
    this.transition('LOADING');
    let game;
    try { game = await this.loadGame(scenario.gameId, context, this.controller.signal); }
    catch (error) {
      if (generation !== this.generation) return false;
      this.fallbackReason = error.message;
      try { game = await this.loadFallback(context); } catch (fallbackError) { if (generation === this.generation) { this.error = fallbackError; this.transition('ERROR'); } return false; }
    }
    if (generation !== this.generation) { game?.dispose(); return false; }
    try { game.prepare({ scenario, students: this.students }); }
    catch (error) {
      game.dispose(); this.fallbackReason = error.message;
      try { game = await this.loadFallback(context); if (generation !== this.generation) { game?.dispose(); return false; } game.prepare({ scenario, students: this.students }); }
      catch (fallbackError) { if (generation === this.generation) { this.error = fallbackError; this.transition('ERROR'); } return false; }
    }
    this.game = game; this.transition('READY'); game.start?.(); this.clock.start(); this.audio?.resume(); this.transition('RUNNING');
    if (globalThis.document?.hidden) this.pause(); else this.schedule();
    return true;
  }
  schedule() { if (this.autoLoop && this.frame === null && (this.state === 'RUNNING' || this.state === 'RESULT' && this.clock.elapsed < this.scenario.durationMs)) this.frame = requestAnimationFrame(now => { this.frame = null; this.tick(now); this.schedule(); }); }
  tick(now) {
    if (this.state === 'RESULT') {
      const time = this.clock.tick(now);
      try { this.game?.update({ ...time, elapsedMs: Math.min(time.elapsedMs, this.scenario.durationMs) }); } catch { this.clearFrame(); this.clock.pause(); }
      if (time.elapsedMs >= this.scenario.durationMs) { this.clock.pause(); this.audio?.stop(); }
      return;
    }
    if (this.state !== 'RUNNING') return;
    const time = this.clock.tick(now);
    try { this.game?.update(time); } catch (error) { this.recover(error); return; }
    this.audio?.update(time.elapsedMs, this.scenario.gameId);
    for (const [i, hook] of this.scenario.hooks.entries()) if (time.elapsedMs >= hook.startMs && !this.playedHooks.has(i)) { this.playedHooks.add(i); this.audio?.cue('near'); }
    if (time.elapsedMs >= this.scenario.revealAtMs) this.finish(this.scenario.playId);
  }
  finish(playId) {
    if (!['RUNNING', 'PAUSED'].includes(this.state) || playId !== this.scenario?.playId || this.committed.has(playId)) return false;
    this.clearFrame(); this.clock.pause(); this.transition('REVEALING');
    try { this.commit(this.scenario); this.committed.add(playId); }
    catch (error) { this.error = error; this.transition('ERROR'); return false; }
    try { this.game?.reveal(this.scenario.winnerId); } catch { /* HTML result remains authoritative. */ }
    this.clock.elapsed = this.scenario.revealAtMs; this.clock.resume();
    this.audio?.resume(); this.audio?.cue('reveal'); this.transition('RESULT'); this.schedule(); return true;
  }
  skip() { return this.finish(this.scenario?.playId); }
  pause() { if (this.state !== 'RUNNING') return; this.clock.pause(); this.clearFrame(); this.game?.pause?.(); this.audio?.pause(); this.transition('PAUSED'); }
  resume() { if (this.state !== 'PAUSED') return; this.clock.resume(); this.game?.resume?.(); this.audio?.resume(); this.transition('RUNNING'); this.schedule(); }
  async recover(error) {
    if (this.recovering || !['RUNNING', 'PAUSED'].includes(this.state)) return;
    this.recovering = true; const resume = this.state === 'RUNNING', generation = this.generation;
    this.pause(); this.game?.dispose();
    try {
      const game = await this.loadFallback(this.context);
      if (generation !== this.generation) { game.dispose(); return; }
      this.fallbackReason = error?.message ?? 'WebGL context lost'; this.game = game; game.prepare({ scenario: this.scenario, students: this.students }); game.update({ elapsedMs: this.clock.elapsed, deltaMs: 0 });
      this.onState(this.state); if (resume) this.resume();
    } catch (fallbackError) { if (generation === this.generation) { this.error = fallbackError; this.transition('ERROR'); } }
    finally { this.recovering = false; }
  }
  clearFrame() { if (this.frame !== null) cancelAnimationFrame(this.frame); this.frame = null; }
  cancel() {
    ++this.generation; this.controller?.abort(); this.clearFrame(); this.clock.pause(); this.audio?.stop(); this.game?.dispose(); this.game = null; this.scenario = null; this.fallbackReason = null; this.recovering = false; this.transition('IDLE');
  }
  dispose() { this.cancel(); }
}
