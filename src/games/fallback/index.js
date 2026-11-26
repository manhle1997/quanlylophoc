import { displayName } from '../../core/domain/schema.js';
import { getGame } from '../../core/game/game-registry.js';
import { gameArt } from '../../ui/art.js';
import { escapeHtml as esc } from '../../ui/dialogs.js';
import { characterDialogue } from '../../core/game/character-dialogue.js';
import { CharacterSpeech } from '../../core/game/character-speech.js';
export function createFallback(context) {
  let scenario, students, container, focus, status, speech, lastFocus, revealed = false;
  return {
    prepare(data) {
      ({ scenario, students } = data); const game = getGame(scenario.gameId);
      container = document.createElement('div'); container.className = `fallback-scene ${game.theme}`;
      container.innerHTML = `<div class="fallback-stars"></div><div class="fallback-art">${gameArt(game.id)}</div><div class="fallback-focus" aria-live="polite"></div><div class="fallback-caption">Đang tìm một điều bất ngờ…</div><div class="fallback-bubbles">${students.slice(0, 12).map(s => `<span>${esc(displayName(s))}</span>`).join('')}</div><span class="fallback-badge">CHẾ ĐỘ TƯƠNG THÍCH 2D</span>`;
      const slot = document.createElement('div'); slot.className = 'speech-slot'; container.querySelector('.fallback-focus').before(slot); speech = new CharacterSpeech(slot, { inline: true });
      context.mount.replaceChildren(container); focus = container.querySelector('.fallback-focus'); status = container.querySelector('.fallback-caption'); lastFocus = null;
    },
    start() {},
    update({ elapsedMs }) {
      if (revealed) return;
      const hook = scenario.hooks.find(h => elapsedMs >= h.startMs && elapsedMs <= h.endMs);
      const id = hook?.studentId ?? null;
      const dialogue = characterDialogue(scenario, elapsedMs);
      speech.update(dialogue, dialogue ? students.find(s => s.id === dialogue.studentId) : null);
      if (id !== lastFocus) { focus.textContent = ''; status.textContent = id ? 'Suýt nữa! Bất ngờ vẫn còn phía trước…' : 'Đang tìm một điều bất ngờ…'; lastFocus = id; }
      container.style.setProperty('--progress', Math.min(1, elapsedMs / scenario.revealAtMs));
      context.progress?.(elapsedMs / scenario.revealAtMs);
    },
    reveal(winnerId) { revealed = true; speech.update(null); context.progress?.(1); focus.textContent = displayName(students.find(s => s.id === winnerId)); status.textContent = 'Đã tìm thấy người bạn đặc biệt!'; container.classList.add('revealed'); },
    dispose() { speech?.dispose(); container?.remove(); },
  };
}
