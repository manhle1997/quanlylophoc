import { icon } from '../icons.js';
import { gameArt } from '../art.js';
import { games, getGame } from '../../core/game/game-registry.js';
import { escapeHtml as esc } from '../dialogs.js';

export function homeView(app, current) {
  const active = current?.students.filter(s => s.active) ?? [];
  const absent = app.store.absentIds();
  const present = active.filter(s => !absent.has(s.id)).length;
  const called = app.store.document.rounds.find(r => r.classId === current?.id)?.calledStudentIds.length ?? 0;
  return `<section class="page-heading"><div><h1>Gọi học sinh lên bảng</h1><p>Chọn lớp, trò chơi và bắt đầu một lượt gọi.</p></div></section>
    <section class="class-bar" aria-label="Thiết lập lượt gọi"><div class="class-select-block"><span class="class-badge">${icon('ledger')}</span><div><label for="class-select">Lớp đang chọn</label><select id="class-select" aria-label="Lớp đang chọn">${app.store.document.classes.filter(c => !c.archived).map(c => `<option value="${c.id}" ${c.id === current?.id ? 'selected' : ''}>${esc(c.name)}${c.schoolYear ? ` · ${esc(c.schoolYear)}` : ''}</option>`).join('')}</select></div></div>
      <div class="class-metric"><strong>${present}<span> / ${active.length}</span></strong><span>Có thể gọi hôm nay</span></div><div class="class-metric"><strong>${called}</strong><span>Đã gọi trong vòng</span></div><button class="button secondary compact" data-action="attendance" aria-label="Điểm danh hôm nay">${icon('check')}Điểm danh</button><div class="class-bar-divider"></div><label class="switch-label"><span class="switch"><input id="unique-mode" type="checkbox" ${app.store.document.settings.mode === 'unique' ? 'checked' : ''}><span></span></span><div><strong>Không gọi trùng</strong><small>Mỗi học sinh một lượt trong vòng</small></div></label></section>
    <div class="section-heading"><h2>Chọn trò chơi</h2><span>5 trò chơi</span></div>
    <section class="game-grid" aria-label="Danh sách trò chơi">${games.map((g, i) => `<button class="game-card ${app.gameId === g.id ? 'selected' : ''} ${g.theme}" data-game="${g.id}" aria-pressed="${app.gameId === g.id}"><div class="game-visual"><span class="game-number">0${i + 1}</span>${gameArt(g.id)}<span class="selection-tick">${icon('check')}</span></div><div class="game-copy"><h3>${g.name}</h3><p>${g.description}</p></div></button>`).join('')}</section>
    <section class="launch-bar" aria-label="Bắt đầu lượt gọi"><div class="launch-summary"><span class="launch-icon">${icon('play')}</span><div><span>Trò chơi đang chọn</span><h3>${getGame(app.gameId).name}</h3><p><strong>${app.pool().length} học sinh</strong> đang chờ được gọi tên</p></div></div><div class="launch-options"><label>Thời lượng<select id="duration" aria-label="Thời lượng"><option value="quick" ${app.store.document.settings.durationPreset === 'quick' ? 'selected' : ''}>Nhanh · 6 giây</option><option value="normal" ${app.store.document.settings.durationPreset === 'normal' ? 'selected' : ''}>Vừa đủ · 12 giây</option><option value="dramatic" ${app.store.document.settings.durationPreset === 'dramatic' ? 'selected' : ''}>Kịch tính · 18 giây</option></select></label><button class="button primary start-button" data-action="start" ${!present ? 'disabled' : ''}>${icon('play')}Bắt đầu gọi <kbd>Space</kbd></button></div></section>
    <div class="home-tip">${icon('help')}<p>Bật toàn màn hình khi trình chiếu kết quả cho cả lớp.</p><button class="text-button" data-action="fullscreen">${icon('expand')}Toàn màn hình</button></div>`;
}
