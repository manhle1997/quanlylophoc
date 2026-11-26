import { displayName } from '../domain/schema.js';

export class CharacterSpeech {
  constructor(mount, { inline = false } = {}) {
    this.root = document.createElement('div'); this.root.className = `character-speech${inline ? ' inline-speech' : ''}`; this.root.hidden = true;
    this.root.setAttribute('role', 'status'); this.root.setAttribute('aria-live', 'polite'); this.root.setAttribute('aria-atomic', 'true');
    this.name = document.createElement('span'); this.name.className = 'speech-name';
    this.line = document.createElement('p'); this.line.className = 'speech-line';
    this.root.append(this.name, this.line); mount.append(this.root);
  }
  update(dialogue, student) {
    if (!dialogue || !student) { this.root.hidden = true; this.key = null; return; }
    if (this.key !== dialogue.key) {
      this.key = dialogue.key; this.name.textContent = displayName(student); this.line.textContent = dialogue.text;
      this.height = null;
      this.root.dataset.studentId = dialogue.studentId; this.root.dataset.hookIndex = String(dialogue.index);
      this.root.classList.remove('speech-enter');
      // Restart only on a new event, never on every animation frame.
      this.root.style.animationName = 'none';
      this.root.hidden = false;
      this.root.classList.add('speech-enter'); this.root.style.removeProperty('animation-name');
    }
    this.root.hidden = false;
  }
  place(x, y, width, height) {
    const bubbleWidth = Math.min(310, Math.max(0, width - 32));
    if (this.measuredWidth !== width || this.height === null) { this.height = this.root.offsetHeight; this.measuredWidth = width; }
    const bubbleHeight = this.height;
    const preferred = x + (x < width / 2 ? -135 : 135);
    const left = Math.max(bubbleWidth / 2 + 16, Math.min(width - bubbleWidth / 2 - 16, preferred));
    const top = Math.max(98 + bubbleHeight, Math.min(height - (width < 760 ? 158 : 108), y - 18));
    this.root.style.left = `${left}px`; this.root.style.top = `${top}px`;
    this.root.style.setProperty('--speech-tail', `${Math.max(20, Math.min(bubbleWidth - 20, x - left + bubbleWidth / 2))}px`);
    return { left: left - bubbleWidth / 2, top: top - bubbleHeight, right: left + bubbleWidth / 2, bottom: top + 18 };
  }
  dispose() { this.root.remove(); }
}
