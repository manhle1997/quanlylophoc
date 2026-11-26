import * as THREE from 'three';
import { displayName } from '../domain/schema.js';
import { CharacterSpeech } from './character-speech.js';
export class LabelManager {
  constructor(mount) { this.root = document.createElement('div'); this.root.className = 'stage-labels'; mount.append(this.root); this.nodes = []; this.projected = new THREE.Vector3(); this.speech = new CharacterSpeech(this.root); }
  update(actors, camera, students, focusId, dialogue = null) {
    const selected = actors.filter(a => a.id === focusId);
    const passive = actors.filter((a, i) => i % Math.max(1, Math.floor(actors.length / 6)) === 0 && a.id !== focusId).slice(0, 6);
    const visible = [...selected, ...passive];
    while (this.nodes.length < visible.length) { const node = document.createElement('div'); node.className = 'actor-label'; this.root.append(node); this.nodes.push(node); }
    const width = this.root.clientWidth, height = this.root.clientHeight;
    const speaking = dialogue && actors.find(a => a.id === dialogue.studentId);
    this.speech.update(speaking ? dialogue : null, speaking ? students.get(speaking.id) : null);
    let speechRect;
    if (speaking) {
      this.projected.copy(speaking.position); this.projected.y += speaking.labelHeight ?? .9; this.projected.project(camera);
      speechRect = this.speech.place((this.projected.x * .5 + .5) * width, (-this.projected.y * .5 + .5) * height, width, height);
    }
    const occupied = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i], actor = visible[i];
      if (!actor) { node.hidden = true; continue; }
      if (speaking && actor.id === speaking.id) { node.hidden = true; continue; }
      this.projected.copy(actor.position); this.projected.y += actor.labelHeight ?? .9; this.projected.project(camera);
      const x = (this.projected.x * .5 + .5) * width, y = (-this.projected.y * .5 + .5) * height;
      node.hidden = this.projected.z < -1 || this.projected.z > 1 || x < 80 || x > width - 80 || y < 115 || y > height - 100;
      if (node.hidden) continue;
      if (speechRect && x > speechRect.left - 90 && x < speechRect.right + 90 && y > speechRect.top - 10 && y < speechRect.bottom + 40) { node.hidden = true; continue; }
      if (actor.id !== focusId && occupied.some(p => Math.abs(p.x - x) < 165 && Math.abs(p.y - y) < 46)) { node.hidden = true; continue; }
      occupied.push({ x, y });
      const name = displayName(students.get(actor.id)); if (node.textContent !== name) node.textContent = name;
      node.classList.toggle('focus', actor.id === focusId); node.style.left = `${x}px`; node.style.top = `${y}px`;
    }
  }
  dispose() { this.speech.dispose(); this.root.remove(); }
}
