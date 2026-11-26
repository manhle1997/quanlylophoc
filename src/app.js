import { Store } from './core/store.js';
import { createDemo } from './core/domain/demo.js';
import { displayName, createDocument } from './core/domain/schema.js';
import { getGame, loadGameModule } from './core/game/game-registry.js';
import { eligibleStudents } from './core/random/random-engine.js';
import { createScenario } from './core/random/scenario.js';
import { randomInt } from './core/random/random-source.js';
import { GAME_IDS } from './core/domain/schema.js';
import { commitResult } from './core/domain/session-service.js';
import { GameManager } from './core/game/game-manager.js';
import { AudioService } from './core/audio/audio-service.js';
import { icon } from './ui/icons.js';
import { escapeHtml as esc, notify, dialog } from './ui/dialogs.js';
import { LocalStorageClient } from './core/storage/local-storage-client.js';
import { AutosaveService } from './core/storage/autosave-service.js';
import { rosterView } from './ui/views/roster.js';
import { attendanceView } from './ui/views/attendance.js';
import { attendanceAction, bindAttendance } from './ui/controllers/attendance.js';
import { todayKey, attendanceRecord } from './core/domain/attendance-service.js';
import { dataView } from './ui/views/data.js';
import { historyView } from './ui/views/history.js';
import { settingsView } from './ui/views/settings.js';
import { homeView } from './ui/views/launcher.js';
import { rosterAction, bindRoster } from './ui/controllers/roster.js';
import { dataAction, bindBackups } from './ui/controllers/data.js';
import { ProfileService } from './core/profile/profile-service.js';
import { applyTheme } from './core/profile/theme.js';
import { profileView, profileImage } from './ui/views/profile.js';
import { bindProfile } from './ui/controllers/profile.js';

export class App {
  constructor(root) {
    this.root = root; this.store = new Store(); this.storage = new LocalStorageClient(); this.audio = new AudioService(); this.loading = true;
    this.profile = new ProfileService(this.storage, () => this.updateProfile());
    this.autosave = new AutosaveService(this.store, this.storage, { onStatus: () => this.updateSaveStatus() });
    this.page = 'classes'; this.gameId = 'fishing'; this.force2d = false;
    this.manager = new GameManager({
      audio: this.audio,
      loadGame: (id, context, signal) => this.loadGame(id, context, signal),
      loadFallback: async context => (await import('./games/fallback/index.js')).createFallback(context),
      commit: scenario => this.store.mutate(doc => commitResult(doc, scenario)),
      onState: () => this.render(),
    });
    this.store.subscribe(() => { if (this.store.document) this.audio.configure(this.store.document.settings); this.autosave.changed(); this.render(); });
    window.addEventListener('beforeunload', e => { if ((!this.store.demo && this.store.dirty) || this.profile.dirty || this.profile.uploading) { this.profile.flush().catch(() => {}); e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('keydown', e => this.keydown(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.manager.state === 'RUNNING') { this.autoPaused = true; this.manager.pause(); }
      else if (!document.hidden && this.autoPaused) { this.autoPaused = false; this.manager.resume(); }
    });
    document.addEventListener('fullscreenchange', () => this.root.querySelectorAll('[data-action=fullscreen]').forEach(el => { el.setAttribute('aria-pressed', String(!!document.fullscreenElement)); el.setAttribute('title', document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình'); }));
    this.render();
    this.loadClasses();
  }
  async loadClasses() {
    this.loading = true; this.bootError = null; this.autosave.enabled = false; this.render();
    try {
      const doc = await this.storage.load();
      // A damaged profile must not prevent access to class data or silently overwrite it.
      if (!this.profile.ready) await this.profile.load(doc?.schoolName ?? '');
      this.loading = false; this.autosave.enabled = true; this.autosave.setState('ready'); this.page = 'classes'; this.store.replace(doc ?? createDocument());
    } catch (error) { this.loading = false; this.bootError = error; this.render(); }
  }
  async loadGame(id, context) {
    if (this.force2d) return (await import('./games/fallback/index.js')).createFallback(context);
    const [{ SceneHost }, module] = await Promise.all([import('./core/game/scene-host.js'), loadGameModule(id)]);
    if (this.sceneHost?.invalid) { this.sceneHost.dispose(); this.sceneHost = null; }
    this.sceneHost ??= new SceneHost();
    return module.createGame(context, this.sceneHost);
  }
  pool() { return this.store.document ? eligibleStudents(this.store.document, this.store.selectedClassId, this.store.absentIds()) : []; }
  statusText() {
    if (this.profile?.state === 'error') return 'Hồ sơ cần kiểm tra';
    if (this.profile?.dirty || this.profile?.uploading) return 'Đang lưu tự động…';
    if (this.store.demo) return 'Đang chơi thử';
    if (this.autosave.state === 'error') return 'Chưa lưu được · Cần thử lại';
    if (this.autosave.state === 'saving' || this.store.dirty) return 'Đang lưu tự động…';
    return 'Đã lưu tự động';
  }
  updateProfile() {
    const service = this.profile;
    applyTheme(service.data.accentColor);
    this.root.querySelectorAll('[data-profile-name]').forEach(el => { el.textContent = service.data.teacherName.trim() || 'Không gian giáo viên'; });
    this.root.querySelectorAll('[data-profile-school]').forEach(el => { el.textContent = service.data.schoolName.trim() || 'Sổ lớp của giáo viên'; });
    this.root.querySelectorAll('[data-profile-school-detail]').forEach(el => { el.textContent = this.store.demo ? 'Chơi thử · Dữ liệu minh họa' : service.data.schoolName.trim() || 'Dữ liệu riêng trên thiết bị'; });
    this.root.querySelectorAll('[data-profile-image]').forEach(el => {
      const markup = profileImage(service, el.dataset.profileImage);
      if (el.dataset.imageMarkup !== markup) { el.innerHTML = markup; el.dataset.imageMarkup = markup; }
    });
    this.root.querySelectorAll('[data-profile-status]').forEach(el => { el.textContent = service.status(); });
    this.root.querySelector('.profile-save-line')?.classList.toggle('has-error', service.state === 'error');
    const retry = this.root.querySelector('[data-profile-retry]');
    if (retry) { retry.hidden = service.state !== 'error'; retry.textContent = service.error?.code === 'CONFLICT' ? 'Tải lại hồ sơ' : service.ready ? 'Thử lưu lại hồ sơ' : 'Thử mở lại hồ sơ'; }
    this.root.querySelectorAll('[data-profile-color]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.profileColor === service.data.accentColor)));
    const picker = this.root.querySelector('#profile-color'); if (picker) picker.value = service.data.accentColor;
    const colorLabel = this.root.querySelector('[data-profile-color-value]'); if (colorLabel) colorLabel.textContent = service.data.accentColor.toUpperCase();
    this.root.querySelectorAll('[data-remove-profile-image]').forEach(el => { el.hidden = !service.data[el.dataset.removeProfileImage]; el.disabled = service.uploading; });
    this.root.querySelectorAll('[data-pick-profile-image]').forEach(el => { el.disabled = service.uploading; el.innerHTML = `${icon('upload')}${service.data[el.dataset.pickProfileImage] ? 'Thay ảnh' : 'Chọn ảnh'}`; });
    for (const slot of ['avatar', 'schoolLogo']) {
      const message = this.root.querySelector(`[data-profile-image-error="${slot}"]`), error = service.images.get(service.data[slot])?.error;
      if (message && error) message.textContent = error;
    }
    this.updateSaveStatus();
  }
  updateSaveStatus() {
    this.root.querySelectorAll('.save-status').forEach(el => { el.textContent = this.statusText(); el.classList.toggle('dirty', this.autosave.state === 'error' || this.profile.state === 'error'); });
    document.querySelector('#autosave-warning')?.remove();
    if (!this.store.demo && this.autosave.state === 'error') {
      const warning = document.createElement('div'); warning.id = 'autosave-warning'; warning.className = 'autosave-warning'; warning.setAttribute('role', 'alert');
      const message = document.createElement('span'); message.textContent = this.autosave.error.message; warning.append(message);
      const button = document.createElement('button'); button.className = 'button secondary compact'; button.textContent = this.autosave.error.code === 'CONFLICT' ? 'Tải lại danh sách' : 'Thử lưu lại'; button.addEventListener('click', () => this.action(this.autosave.error.code === 'CONFLICT' ? 'reload-local' : 'retry-save')); warning.append(button); document.body.append(warning);
    }
  }
  render() {
    if (this.loading) { this.root.innerHTML = '<main class="app-opening"><span class="spinner"></span><h1>Đang mở lớp học của bạn…</h1></main>'; return; }
    if (this.bootError) {
      this.root.innerHTML = `<main class="app-opening"><span class="brand-mark">${icon('shield')}</span><h1>Chưa mở được lớp học</h1><p>${esc(this.bootError.message)}</p><div class="row-actions"><button class="button primary" data-action="retry-load">Thử lại</button>${this.bootError.code !== 'FUTURE_SCHEMA' && this.bootError.code !== 'UNAVAILABLE' ? '<button class="button secondary" data-action="recover-latest">Phục hồi lần lưu gần nhất</button>' : ''}</div></main>`; this.bind(); return;
    }
    if (this.manager.state !== 'IDLE') { this.renderGame(); return; }
    if (!this.store.document) return;
    if (this.page === 'home' && this.store.selectedClass?.archived) this.store.selectedClassId = this.store.document.classes.find(c => !c.archived)?.id ?? null;
    if (['classes', 'attendance'].includes(this.page) && !this.store.selectedClass) this.store.selectedClassId = (this.store.document.classes.find(c => !c.archived) ?? this.store.document.classes[0])?.id ?? null;
    const nav = [['classes', 'users', 'Quản lý học sinh'], ['attendance', 'check', 'Điểm danh'], ['home', 'play', 'Gọi lên bảng']];
    const pageTitle = nav.find(n => n[0] === this.page)?.[2] ?? ({ history: 'Lịch sử gọi tên', settings: 'Cài đặt', backups: 'Bản lưu an toàn', profile: 'Thông tin cá nhân' }[this.page]);
    const currentDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    document.title = `Lớp Học Vui · ${pageTitle}`;
    this.root.innerHTML = `<a class="skip-link" href="#main-content">Đến nội dung chính</a><div class="app-shell" data-view="${this.page}">
      <aside class="sidebar"><a href="#" class="brand" data-page="classes"><span class="brand-mark" data-profile-image="schoolLogo">${profileImage(this.profile, 'schoolLogo')}</span><span class="brand-name">Lớp Học Vui<small data-profile-school>Sổ lớp của giáo viên</small></span></a>
        <div class="nav-caption">Không gian lớp học</div><nav aria-label="Điều hướng chính">${nav.map(([page, symbol, title], i) => `<button class="nav-item ${this.page === page ? 'active' : ''}" data-page="${page}" aria-label="${title}" ${this.page === page ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${title}</span><small class="nav-index" aria-hidden="true">0${i + 1}</small></button>`).join('')}</nav>
        <div class="sidebar-utilities"><div class="nav-caption utilities-caption">Tiện ích</div><button class="nav-item ${this.page === 'profile' ? 'active' : ''}" data-page="profile" aria-label="Thông tin cá nhân">${icon('user')}<span>Thông tin cá nhân</span></button><button class="nav-item ${this.page === 'history' ? 'active' : ''}" data-page="history" aria-label="Lịch sử">${icon('clock')}<span>Lịch sử gọi tên</span></button><button class="nav-item ${this.page === 'settings' ? 'active' : ''}" data-page="settings" aria-label="Cài đặt">${icon('settings')}<span>Cài đặt</span></button></div>
        <div class="sidebar-bottom"><div class="offline-card">${icon('shield')}<div><strong>Làm việc ngoại tuyến</strong><p>Lớp học được lưu tự động.</p></div></div><button class="nav-item" data-action="help">${icon('help')}<span>Hướng dẫn sử dụng</span></button><button class="profile" data-page="profile" aria-label="Mở hồ sơ giáo viên"><span class="avatar" data-profile-image="avatar">${profileImage(this.profile, 'avatar')}</span><div><strong data-profile-name>Không gian giáo viên</strong><small data-profile-school-detail>Dữ liệu riêng trên thiết bị</small></div></button></div>
      </aside><div class="workspace"><header class="topbar"><div class="breadcrumb"><span data-profile-name>Không gian giáo viên</span><span class="breadcrumb-divider">/</span><strong>${pageTitle}</strong></div><div class="header-actions"><span class="save-status" aria-live="polite">${this.statusText()}</span>${this.store.demo ? '<button class="button compact secondary" data-action="my-classes">Về lớp của tôi</button>' : ''}<button class="icon-button compact-utility" data-page="settings" aria-label="Cài đặt">${icon('settings')}</button><button class="icon-button header-profile" data-page="profile" aria-label="Mở thông tin cá nhân" title="Thông tin cá nhân" data-profile-image="avatar">${profileImage(this.profile, 'avatar')}</button><button class="icon-button" data-action="mute" aria-label="Bật/tắt âm thanh" title="Bật/tắt âm thanh">${icon(this.store.document.settings.soundEnabled ? 'volume' : 'mute')}</button></div></header>
        <div class="workspace-date">${esc(currentDate)}</div><main id="main-content" tabindex="-1">${this.pageContent()}</main><footer class="app-footer"><span>Lớp Học Vui <span class="footer-divider">/</span> Sổ lớp số</span><span>${icon('shield')} Hoạt động trên thiết bị · Không cần Internet</span></footer>
      </div></div>`;
    if (this.page === 'home') {
      this.root.querySelector('.page-heading .pill')?.remove();
      this.root.querySelector('.page-heading').insertAdjacentHTML('beforeend', '<button class="button secondary compact" data-page="attendance">Xem điểm danh</button>');
      const caption = this.root.querySelector('.section-heading>span');
      if (caption) caption.outerHTML = `<div class="row-actions">${this.pool().length ? '<button class="text-button" data-action="reset-round">Tạo vòng mới</button>' : ''}<button class="text-button" data-action="surprise">${icon('shuffle')}Chọn game bất ngờ</button></div>`;
      const start = this.root.querySelector('[data-action=start]');
      if (start) { start.disabled = !this.pool().length; start.title = start.disabled ? 'Không còn học sinh hợp lệ. Kiểm tra điểm danh hoặc tạo vòng mới.' : 'Bắt đầu cuộc phiêu lưu'; }
      if (this.store.selectedClass && !attendanceRecord(this.store.document, this.store.selectedClassId, todayKey())) this.root.querySelector('.class-bar').insertAdjacentHTML('afterend', '<p class="call-attendance-note">Chưa ghi nhận điểm danh hôm nay. Hiện dùng tất cả học sinh đang học của lớp.</p>');
      if (!this.store.selectedClass) {
        this.root.querySelector('#main-content').insertAdjacentHTML('afterbegin', '<div class="round-message">Chưa có lớp học. Tạo lớp và thêm danh sách để bắt đầu.<button class="button primary compact" data-create-first>Tạo lớp đầu tiên</button></div>');
        this.root.querySelector('[data-create-first]').addEventListener('click', () => { this.page = 'classes'; this.render(); rosterAction(this, 'add-class'); });
      } else if (!this.pool().length) {
        this.root.querySelector('.launch-bar').insertAdjacentHTML('beforebegin', '<div class="round-message">Không còn học sinh hợp lệ trong vòng hiện tại. Kiểm tra điểm danh hoặc tạo vòng mới.<button class="button secondary compact" data-action="reset-round">Tạo vòng mới</button></div>');
      }
    }
    if (this.page === 'settings') this.root.querySelector('#main-content').insertAdjacentHTML('beforeend', '<section class="panel automatic-storage-panel"><h2>Lớp học luôn được lưu tự động</h2><p>Lớp Học Vui tự nhớ danh sách lớp, học sinh, điểm danh và lịch sử. Nếu cần trở về một thời điểm trước đó, hãy xem các bản lưu an toàn.</p><div class="row-actions"><button class="button secondary" data-action="show-backups">Xem các lần lưu trước</button><button class="button secondary" data-page="history">Lịch sử gọi tên</button><button class="button secondary" data-page="profile">Thông tin cá nhân</button></div></section>');
    this.bind();
    this.updateProfile();
    if (this.renderedPage !== this.page) { window.scrollTo(0, 0); this.renderedPage = this.page; }
  }
  pageContent() {
    if (this.page === 'classes') return rosterView(this);
    if (this.page === 'attendance') return attendanceView(this);
    if (this.page === 'backups') return dataView(this);
    if (this.page === 'history') return historyView(this);
    if (this.page === 'settings') return settingsView(this);
    if (this.page === 'profile') return profileView(this);
    return homeView(this, this.store.selectedClass);
  }
  bind() {
    bindRoster(this);
    bindAttendance(this);
    bindBackups(this);
    bindProfile(this);
    this.root.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); this.page = el.dataset.page; this.render(); }));
    this.root.querySelectorAll('[data-game]').forEach(el => el.addEventListener('click', () => { this.gameId = el.dataset.game; this.render(); }));
    this.root.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', () => this.action(el.dataset.action)));
    this.root.querySelector('#class-select')?.addEventListener('change', e => { this.store.selectedClassId = e.target.value; this.render(); });
    this.root.querySelector('#unique-mode')?.addEventListener('change', e => {
      this.store.mutate(doc => { doc.settings.mode = e.target.checked ? 'unique' : 'normal'; });
      notify(this.store.document.settings.mode === 'unique' ? 'Tiếp tục vòng không trùng hiện tại.' : 'Ngẫu nhiên: có thể gọi lại một bạn. Vòng không trùng được giữ.');
    });
    this.root.querySelector('#duration')?.addEventListener('change', e => this.store.mutate(doc => { doc.settings.durationPreset = e.target.value; }));
    this.root.querySelector('#history-class')?.addEventListener('change', e => { this.historyClass = e.target.value; this.render(); });
    this.root.querySelectorAll('[data-setting]').forEach(el => el.addEventListener('change', () => this.store.mutate(doc => { doc.settings[el.dataset.setting] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value; })));
    this.root.querySelector('#force-2d')?.addEventListener('change', e => { this.force2d = e.target.checked; });
  }
  async start() {
    if (this.page !== 'home' && this.manager.state === 'IDLE' || this.manager.busy || !this.pool().length) return;
    const students = this.pool();
    this.audio.unlock(this.store.document.settings);
    const scenario = createScenario({ document: this.store.document, classId: this.store.selectedClassId, pool: students.map(s => s.id), gameId: this.gameId });
    const app = this;
    await this.manager.start({ scenario, students, context: { get mount() { return app.root.querySelector('[data-stage]'); }, settings: { ...this.store.document.settings, reducedMotion: this.store.document.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches }, status: message => { const el = app.root.querySelector('.game-phase-text'); if (el && el.textContent !== message) el.textContent = message; }, progress: value => app.updateJourney(value), onContextLost: () => app.manager.recover(new Error('WebGL đã gián đoạn. Giữ nguyên lượt.')) } });
  }
  updateJourney(value) {
    const journey = this.root.querySelector('.game-journey');
    if (!journey) return;
    const progress = Math.max(0, Math.min(1, value)), percent = Math.round(progress * 100);
    journey.style.setProperty('--journey-progress', progress.toFixed(3));
    if (journey.getAttribute('aria-valuenow') !== String(percent)) journey.setAttribute('aria-valuenow', String(percent));
    journey.querySelectorAll('[data-hook-at]').forEach(marker => marker.classList.toggle('passed', progress >= Number(marker.dataset.hookAt)));
  }
  renderGame() {
    const m = this.manager, g = getGame(m.scenario?.gameId);
    if (!g) return;
    if (!this.root.querySelector('.game-screen')) {
      this.root.innerHTML = `<main class="game-screen" data-scene-id="${g.id}"><header class="game-hud"><div class="game-hud-title"><span class="brand-mark">${icon(g.id)}</span><div><strong>${g.name}</strong><small>Lớp ${esc(this.store.selectedClass?.name)} · ${m.scenario.eligibleIds.length} học sinh hợp lệ</small></div></div><div class="game-hud-actions"><button class="icon-button" data-action="mute" aria-label="Bật/tắt âm thanh">${icon('volume')}</button><button class="icon-button" data-action="fullscreen" aria-label="Toàn màn hình">${icon('expand')}</button></div></header><div class="stage" data-stage></div><div class="game-journey" role="progressbar" aria-label="Tiến trình lượt gọi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="game-journey-fill"></span>${m.scenario.hooks.map(h => `<span class="game-journey-marker" aria-hidden="true" data-hook-at="${h.startMs / m.scenario.revealAtMs}" style="left:${h.startMs / m.scenario.revealAtMs * 100}%"></span>`).join('')}<span class="game-journey-marker game-journey-end" aria-hidden="true"></span></div><div class="game-loading"><span class="spinner"></span><p>Đang chuẩn bị cuộc phiêu lưu…</p></div><div class="paused-overlay"><div class="paused-card"><h2>Tạm dừng một chút</h2><p>Cuộc phiêu lưu sẽ tiếp tục từ đúng thời điểm này.</p><button class="button primary" data-action="resume">${icon('play')}Tiếp tục</button></div></div><footer class="game-controls"><div class="game-phase">${icon('spark')}<span class="game-phase-text">Điều bất ngờ đang đến…</span></div><div class="row-actions"><button class="button secondary" data-action="pause">${icon('pause')}Tạm dừng</button><button class="button secondary" data-action="skip">${icon('skip')}Bỏ qua hiệu ứng</button><button class="button secondary" data-action="cancel-play">${icon('stop')}Dừng lượt</button></div></footer></main>`;
      this.bind();
    }
    const loading = this.root.querySelector('.game-loading');
    this.root.querySelector('.game-screen').classList.toggle('reduced-motion', this.store.document.settings.reducedMotion);
    loading.hidden = !['LOADING', 'READY'].includes(m.state);
    this.root.querySelector('.paused-overlay').classList.toggle('visible', m.state === 'PAUSED');
    this.root.querySelector('[data-action=mute]').innerHTML = icon(this.store.document.settings.soundEnabled ? 'volume' : 'mute');
    this.root.querySelector('.game-controls').hidden = m.state === 'RESULT';
    this.root.querySelector('.game-journey').hidden = m.state === 'RESULT';
    if (m.state !== 'RESULT') this.root.querySelector('.result-overlay')?.remove();
    if (m.fallbackReason && !this.root.querySelector('.game-compatibility')) this.root.querySelector('.game-screen').insertAdjacentHTML('beforeend', '<div class="game-compatibility">Đang dùng 2D tương thích. Kết quả lượt chơi được giữ nguyên.</div>');
    if (m.state === 'ERROR') {
      loading.hidden = false;
      loading.innerHTML = `<p>${esc(m.error?.message ?? 'Không thể hoàn tất lượt chơi.')}</p><button class="button secondary" data-error-home>Về gọi lên bảng</button>`;
      loading.querySelector('[data-error-home]').onclick = () => m.cancel();
    }
    const resultNode = this.root.querySelector('.result-overlay');
    if (m.state === 'RESULT' && resultNode && resultNode.dataset.remaining !== String(this.pool().length)) resultNode.remove();
    if (m.state === 'RESULT' && !this.root.querySelector('.result-overlay')) {
      const student = m.students.find(s => s.id === m.scenario.winnerId), remaining = this.pool().length;
      const confetti = this.store.document.settings.reducedMotion ? '' : `<div class="result-confetti">${Array.from({ length: 20 }, (_, i) => `<span style="--x:${(i * 37) % 100}%;--delay:${i % 5 * .08}s;--color:${['#b49af6', '#82d6ba', '#edc488', '#efaabd'][i % 4]}"></span>`).join('')}</div>`;
      this.root.querySelector('.game-screen').insertAdjacentHTML('beforeend', `<section class="result-overlay" role="region" aria-label="Kết quả lượt chơi"><div class="result-card">${confetti}<div class="result-spark">✧</div><p class="result-eyebrow">HỌC SINH ĐƯỢC CHỌN</p><h1 class="result-title" aria-live="assertive"></h1><p class="result-wish">Chúc bạn tự tin, cả lớp đang cổ vũ bạn!</p><p class="result-remaining">${remaining ? `Còn ${remaining} học sinh đủ điều kiện trong vòng hiện tại` : 'Vòng gọi tên đã hoàn thành. Mỗi bạn một cơ hội!'}</p><div class="row-actions">${remaining ? `<button class="button primary" data-result-action="start">${icon('play')}Chơi tiếp</button>` : '<button class="button primary" data-result-action="reset-round">Tạo vòng mới</button>'}<button class="button secondary" data-result-action="change-game">Đổi game</button><button class="text-button" data-result-action="home">Về gọi lên bảng</button></div></div></section>`);
      this.root.querySelector('.result-title').textContent = displayName(student);
      this.root.querySelector('.result-overlay').dataset.remaining = String(remaining);
      this.root.querySelectorAll('[data-result-action]').forEach(el => el.addEventListener('click', () => this.action(el.dataset.resultAction)));
      this.root.querySelector('[data-result-action]').focus();
    }
  }
  keydown(e) {
    if (e.repeat) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!document.querySelector('dialog[open]')) this.action('save'); return; }
    if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.altKey || e.metaKey) return;
    if ((e.code === 'Space' || e.code === 'Enter') && !/BUTTON|A/.test(e.target.tagName)) { e.preventDefault(); this.action('start'); }
    else if (e.key.toLowerCase() === 'm') this.action('mute');
    else if (e.key.toLowerCase() === 'f') this.action('fullscreen');
  }
  async action(action) {
    try {
      if (action === 'start') { await this.start(); return; }
      if (action === 'create-first-class') { this.page = 'classes'; this.render(); rosterAction(this, 'add-class'); return; }
      if (action === 'surprise') { this.gameId = GAME_IDS[randomInt(GAME_IDS.length)]; this.render(); notify(`Đã chọn ${getGame(this.gameId).name}. Bấm Bắt đầu khi lớp đã sẵn sàng.`); return; }
      if (action === 'skip') { this.manager.skip(); return; }
      if (action === 'pause') { this.manager.pause(); return; }
      if (action === 'resume') { this.autoPaused = false; this.manager.resume(); return; }
      if (action === 'cancel-play') { dialog({ title: 'Dừng lượt chơi?', confirm: 'Dừng và không ghi kết quả', body: '<p>Lượt chưa công bố sẽ được hủy. Không thêm lịch sử và không đánh dấu học sinh đã được gọi.</p>', onConfirm: () => this.manager.cancel() }); return; }
      if (action === 'home' || action === 'change-game') { this.manager.cancel(); this.page = 'home'; this.render(); return; }
      if (this.manager.busy && !['mute', 'fullscreen'].includes(action)) { notify('Hãy hoàn tất hoặc dừng lượt trước khi thay đổi dữ liệu.'); return; }
      if (attendanceAction(this, action)) return;
      if (rosterAction(this, action)) return;
      if (await dataAction(this, action)) return;
      if (action === 'demo') { this.autosave.enabled = false; this.page = 'home'; this.updateSaveStatus(); this.store.replace(createDemo(), { demo: true }); }
      else if (action === 'mute') { if (this.store.document) this.store.mutate(doc => { doc.settings.soundEnabled = !doc.settings.soundEnabled; }); }
      else if (action === 'fullscreen') { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { notify('Trình duyệt chưa cho phép toàn màn hình.'); } }
      else if (action === 'clear-history') dialog({ title: 'Xóa lịch sử gọi tên?', danger: true, confirm: 'Xóa lịch sử', body: '<p>Xóa toàn bộ lịch sử. Các vòng không trùng hiện tại vẫn được giữ, không ảnh hưởng cơ hội của học sinh. Lớp Học Vui tự lưu thay đổi và giữ một bản an toàn trước đó.</p>', onConfirm: () => this.store.mutate(doc => { doc.history = []; }) });
      else if (action === 'help') dialog({ title: 'Một chút hướng dẫn', confirm: 'Sẵn sàng rồi!', cancel: 'Đóng', body: '<p>1. Tạo lớp và thêm học sinh; có thể dán nhiều tên cùng lúc.<br>2. Kiểm tra điểm danh, chọn game rồi bấm Bắt đầu.<br>3. Trong Điểm danh, chọn ngày và ghi nhận có mặt, đi muộn hoặc vắng. Vòng mới cho cả lớp cơ hội được gọi lại.<br>4. Lớp học và lịch sử được lưu tự động. Lần sau mở lại là tiếp tục dùng.</p><div class="notice">Bạn không cần bấm Lưu. Chế độ Chơi thử chỉ dùng danh sách minh họa và không thay đổi lớp học của bạn.</div>' });
    } catch (error) { notify(error.message); }
  }
}
