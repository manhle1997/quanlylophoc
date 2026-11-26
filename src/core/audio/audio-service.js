export class AudioService {
  constructor() { this.context = null; this.nodes = new Set(); this.settings = { soundEnabled: true, musicEnabled: true, volume: .5 }; this.lastBeat = -1; this.paused = false; }
  unlock(settings) {
    this.settings = settings;
    try {
      if (!this.context) { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; this.context = new Audio(); this.master = this.context.createGain(); this.master.connect(this.context.destination); }
      this.context.resume().catch(() => {}); this.configure(settings);
    } catch { /* Audio is optional; visuals and random are unaffected. */ }
  }
  configure(settings) { this.settings = { ...settings }; if (this.master) this.master.gain.setTargetAtTime(settings.soundEnabled && !this.paused ? settings.volume * .3 : 0, this.context.currentTime, .04); }
  note(frequency, duration = .18, delay = 0, gain = .15, type = 'sine') {
    if (!this.context || !this.settings.soundEnabled || this.paused) return;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain(), at = this.context.currentTime + delay;
    oscillator.type = type; oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + .015); envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(this.master); this.nodes.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.nodes.delete(oscillator); };
    oscillator.start(at); oscillator.stop(at + duration + .02);
  }
  cue(kind) {
    if (kind === 'reveal') [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => this.note(n, .65, i * .105, .2, 'triangle'));
    else if (kind === 'near') { this.note(440, .2); this.note(330, .3, .15); }
    else this.note(650, .08, 0, .08);
  }
  update(elapsedMs, gameId) {
    const beat = Math.floor(elapsedMs / 600);
    if (beat === this.lastBeat || !this.settings.musicEnabled) return;
    this.lastBeat = beat;
    const melodies = { fishing: [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 392], ufo: [220, 329.63, 440, 523.25], claw: [392, 493.88, 587.33, 493.88], marble: [293.66, 349.23, 440, 349.23], treasure: [261.63, 392, 523.25, 493.88] };
    const melody = melodies[gameId] ?? melodies.fishing;
    this.note(melody[beat % melody.length], .45, 0, .05);
  }
  pause() { this.paused = true; this.clearNodes(); this.configure(this.settings); }
  resume() { this.paused = false; this.lastBeat = -1; this.configure(this.settings); }
  clearNodes() { for (const node of this.nodes) { try { node.stop(); } catch {} } }
  stop() { this.clearNodes(); this.lastBeat = -1; this.paused = false; }
}
