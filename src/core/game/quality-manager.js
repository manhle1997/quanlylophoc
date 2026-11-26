export const qualityProfile = quality => ({ pixelRatio: quality === 'low' ? 1 : quality === 'high' ? 2 : 1.5, shadows: quality !== 'low', segments: quality === 'low' ? 12 : 20, particles: quality === 'low' ? 40 : 120 });
export class AdaptiveQuality {
  constructor(renderer, quality) { this.renderer = renderer; this.auto = quality === 'auto'; this.samples = []; this.lastReduction = 0; }
  sample(delta, elapsed) {
    if (!this.auto || delta <= 0 || elapsed < 2000) return;
    this.samples.push(delta); if (this.samples.length > 90) this.samples.shift();
    if (this.samples.length >= 60 && elapsed - this.lastReduction > 3000 && this.samples.reduce((a, b) => a + b, 0) / this.samples.length > 42) {
      this.renderer.setPixelRatio(Math.max(.75, this.renderer.getPixelRatio() - .25)); this.lastReduction = elapsed; this.samples.length = 0;
    }
  }
}
