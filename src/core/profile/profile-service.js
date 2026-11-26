export const DEFAULT_PROFILE = Object.freeze({ schemaVersion: 1, teacherName: '', schoolName: '', subject: '', email: '', phone: '', accentColor: '#275f4d', avatar: null, schoolLogo: null });
export const PROFILE_FIELDS = { teacherName: 120, schoolName: 200, subject: 120, email: 160, phone: 40 };
export const IMAGE_ID = /^[a-f0-9]{64}\.(png|jpg|webp|gif)$/;

export function validateProfile(input) {
  if (!input || input.schemaVersion !== 1) throw new Error('Phiên bản hồ sơ chưa được hỗ trợ. Bản đã lưu được giữ nguyên.');
  const profile = { schemaVersion: 1 };
  for (const [key, max] of Object.entries(PROFILE_FIELDS)) {
    if (typeof input[key] !== 'string' || input[key].length > max || /[\u0000-\u001f\u007f]/u.test(input[key])) throw new Error('Thông tin cá nhân chưa hợp lệ.');
    profile[key] = input[key];
  }
  if (!/^#[a-f0-9]{6}$/i.test(input.accentColor)) throw new Error('Màu ứng dụng chưa hợp lệ.');
  profile.accentColor = input.accentColor.toLowerCase();
  for (const key of ['avatar', 'schoolLogo']) {
    if (input[key] !== null && (typeof input[key] !== 'string' || !IMAGE_ID.test(input[key]))) throw new Error('Ảnh trong hồ sơ chưa hợp lệ.');
    profile[key] = input[key];
  }
  return profile;
}

export class ProfileService {
  constructor(client, onChange = () => {}) {
    this.client = client; this.onChange = onChange; this.data = { ...DEFAULT_PROFILE }; this.etag = 'missing';
    this.ready = false; this.state = 'loading'; this.generation = 0; this.savedGeneration = 0; this.images = new Map(); this.uploading = false;
  }
  get dirty() { return this.generation !== this.savedGeneration; }
  status() {
    if (this.state === 'error') return this.error?.message ?? 'Chưa lưu được hồ sơ.';
    if (this.uploading) return 'Đang sao chép ảnh…';
    if (this.state === 'loading') return 'Đang mở hồ sơ…';
    return this.dirty || this.state === 'saving' ? 'Đang lưu hồ sơ…' : 'Hồ sơ được lưu tự động';
  }
  async load(schoolName = '') {
    this.state = 'loading'; this.onChange();
    try {
      const result = await this.client.request('/api/profile');
      if (typeof result.etag !== 'string') throw new Error('Chưa xác nhận được hồ sơ đã lưu.');
      this.data = result.profile === null ? { ...DEFAULT_PROFILE, schoolName } : validateProfile(result.profile);
      this.etag = result.etag; this.ready = true; this.generation = this.savedGeneration = 0; this.state = 'saved'; this.error = null;
      for (const image of this.images.values()) if (image.url) URL.revokeObjectURL(image.url);
      this.images.clear();
      await Promise.allSettled(['avatar', 'schoolLogo'].map(slot => this.loadImage(this.data[slot])));
    } catch (error) { this.ready = false; this.state = 'error'; this.error = error; }
    this.onChange();
  }
  edit(key, value) {
    if (!this.ready || this.data[key] === value) return;
    const next = validateProfile({ ...this.data, [key]: value });
    this.data = next; this.generation++; clearTimeout(this.timer);
    if (['avatar', 'schoolLogo'].includes(key)) this.pruneImages();
    // A conflict needs an explicit reload; subsequent keystrokes must not hide it.
    if (this.state !== 'error') this.state = 'saving';
    if (this.error?.code !== 'CONFLICT') this.timer = setTimeout(() => this.flush().catch(() => {}), 350);
    this.onChange();
  }
  flush() {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (!this.ready || !this.dirty || this.error?.code === 'CONFLICT') return Promise.resolve();
    this.running = this.drain().finally(() => { this.running = null; if (this.dirty && this.state !== 'error') this.flush().catch(() => {}); });
    return this.running;
  }
  async drain() {
    this.state = 'saving'; this.error = null; this.onChange();
    try {
      while (this.dirty) {
        const profile = structuredClone(this.data), generation = this.generation;
        let result;
        for (let attempt = 0; ; attempt++) {
          try { result = await this.client.request('/api/profile', { method: 'POST', body: JSON.stringify({ profile, expectedEtag: this.etag }), keepalive: true }); break; }
          catch (error) {
            if (attempt >= 2 || !['UNAVAILABLE', 'STORAGE_UNAVAILABLE', 'VERIFY_FAILED', 'BACKUP_FAILED'].includes(error.code)) throw error;
            await new Promise(resolve => setTimeout(resolve, [400, 1200][attempt]));
          }
        }
        validateProfile(result.profile);
        if (typeof result.etag !== 'string') throw new Error('Chưa xác nhận được lần lưu hồ sơ.');
        this.etag = result.etag; this.savedGeneration = generation;
      }
      this.state = 'saved';
    } catch (error) { this.state = 'error'; this.error = error; throw error; }
    finally { this.onChange(); }
  }
  async loadImage(id) {
    if (!id || this.images.has(id)) return;
    this.images.set(id, {});
    try { this.images.set(id, { url: URL.createObjectURL(await this.client.request(`/api/profile/images/${id}`, { binary: true })) }); }
    catch { this.images.set(id, { error: 'Chưa mở được ảnh. Bạn có thể chọn lại ảnh.' }); }
    this.onChange();
  }
  pruneImages() {
    for (const [id, image] of this.images) {
      if (![this.data.avatar, this.data.schoolLogo].includes(id)) { if (image.url) URL.revokeObjectURL(image.url); this.images.delete(id); }
    }
  }
  async upload(slot, file) {
    if (!this.ready || this.uploading) return;
    if (!['avatar', 'schoolLogo'].includes(slot)) throw new Error('Ảnh chưa hợp lệ.');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Hãy chọn ảnh PNG, JPG, WebP hoặc GIF.');
    if (!file.size || file.size > 8 * 1024 * 1024) throw new Error('Hãy chọn ảnh có dung lượng tối đa 8 MB.');
    this.uploading = true; this.onChange();
    try {
      const { imageId } = await this.client.request('/api/profile/images', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      if (!IMAGE_ID.test(imageId)) throw new Error('Chưa xác nhận được bản sao ảnh.');
      const old = this.images.get(imageId); if (old?.url) URL.revokeObjectURL(old.url);
      this.images.set(imageId, { url: URL.createObjectURL(file) });
      this.edit(slot, imageId); await this.flush();
    } finally { this.uploading = false; this.onChange(); }
  }
}
