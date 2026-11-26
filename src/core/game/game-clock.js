export class GameClock {
  constructor() { this.elapsed = 0; this.last = null; this.paused = true; }
  start(now = performance.now()) { this.elapsed = 0; this.last = now; this.paused = false; }
  tick(now) { if (this.paused || this.last === null) return { elapsedMs: this.elapsed, deltaMs: 0 }; const dt = Math.max(0, now - this.last); this.last = now; this.elapsed += dt; return { elapsedMs: this.elapsed, deltaMs: Math.min(dt, 50) }; }
  pause() { this.paused = true; }
  resume(now = performance.now()) { this.last = now; this.paused = false; }
}
