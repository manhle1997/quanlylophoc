export class UpdateClient {
  constructor(storage, onChange = () => {}) {
    Object.assign(this, { storage, onChange });
    this.status = { state: 'idle', currentVersion: '' }; this.loaded = false; this.pending = false;
  }
  accept(status) { this.status = status; this.onChange(); }
  async load() {
    if (this.loaded) return;
    this.loaded = true;
    try { this.accept(await this.storage.request('/api/updates')); this.poll(); }
    catch { this.accept({ ...this.status, state: 'error', message: 'Chưa mở được chức năng cập nhật. Hãy mở ứng dụng bằng Start.exe và thử lại.' }); }
  }
  async run(action) {
    if (this.pending) return;
    this.pending = true;
    try { this.accept(await this.storage.request(`/api/updates/${action}`, { method: 'POST' })); this.poll(); }
    catch (error) { this.accept({ ...this.status, state: 'error', message: error.message }); }
    finally { this.pending = false; }
  }
  poll() {
    clearTimeout(this.timer);
    if (!['checking', 'downloading'].includes(this.status.state)) return;
    this.timer = setTimeout(async () => {
      try { this.accept(await this.storage.request('/api/updates')); this.poll(); }
      catch { this.accept({ ...this.status, state: 'error', message: 'Mất kết nối với ứng dụng. Hãy thử kiểm tra lại.' }); }
    }, 700);
  }
  async install({ flush, ready, restart }) {
    if (this.pending || this.status.state !== 'ready') return;
    this.pending = true;
    try {
      await flush();
      if (!ready()) throw new Error('Hãy đợi lớp học, hồ sơ và ảnh được lưu xong rồi thử lại.');
      const result = await this.storage.request('/api/updates/apply', { method: 'POST' });
      this.accept(result);
      await restart(result.version);
    } finally { this.pending = false; }
  }
}
