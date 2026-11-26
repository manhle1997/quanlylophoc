import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileService, DEFAULT_PROFILE, validateProfile } from '../../src/core/profile/profile-service.js';
import { themeTokens, luminance } from '../../src/core/profile/theme.js';

const timers = [];
afterEach(() => { for (const service of timers) clearTimeout(service.timer); });
async function setup(save) {
  let etag = 'missing';
  const client = { request: vi.fn(async (_url, options) => {
    if (!options) return { profile: null, etag };
    if (save) return save(options);
    const body = JSON.parse(options.body); expect(body.expectedEtag).toBe(etag);
    etag += 'x'; return { profile: body.profile, etag };
  }) };
  const service = new ProfileService(client); timers.push(service); await service.load(); return { service, client };
}
describe('teacher profile', () => {
  it('uses the legacy school name without writing until the teacher edits', async () => {
    const { service, client } = await setup(); await service.load('Trường minh họa');
    expect(service.data.schoolName).toBe('Trường minh họa'); expect(service.dirty).toBe(false);
    expect(client.request.mock.calls.every(([, options]) => !options)).toBe(true);
    service.edit('teacherName', 'Giáo viên minh họa'); await service.flush();
    expect(service.dirty).toBe(false); expect(service.state).toBe('saved');
    expect(JSON.parse(client.request.mock.calls.at(-1)[1].body).profile.schoolName).toBe('Trường minh họa');
  });
  it('serializes rapid edits while a save is in flight without losing the latest value', async () => {
    const finish = [], { service, client } = await setup(options => new Promise(resolve => finish.push(() => resolve({ profile: JSON.parse(options.body).profile, etag: String(finish.length) })))) ;
    service.edit('teacherName', 'Một'); const saving = service.flush(); service.edit('teacherName', 'Hai');
    finish.shift()(); await vi.waitFor(() => expect(client.request).toHaveBeenCalledTimes(3));
    expect(service.dirty).toBe(true); expect(JSON.parse(client.request.mock.calls.at(-1)[1].body).profile.teacherName).toBe('Hai');
    finish.shift()(); await saving; expect(service.dirty).toBe(false); expect(service.data.teacherName).toBe('Hai');
  });
  it('retains unsaved edits on conflict and does not overwrite with subsequent keystrokes', async () => {
    const { service, client } = await setup(async () => { throw Object.assign(new Error('Cửa sổ khác'), { code: 'CONFLICT' }); });
    service.edit('schoolName', 'Giữ nội dung'); await expect(service.flush()).rejects.toThrow('Cửa sổ khác');
    service.edit('teacherName', 'Sửa tiếp'); await service.flush();
    expect(client.request).toHaveBeenCalledTimes(2); expect(service.dirty).toBe(true); expect(service.state).toBe('error'); expect(service.data.schoolName).toBe('Giữ nội dung');
  });
  it('keeps unreadable/future profile data read-only instead of writing a default', async () => {
    const client = { request: vi.fn(async () => ({ profile: { ...DEFAULT_PROFILE, schemaVersion: 2 }, etag: 'future' })) };
    const service = new ProfileService(client); timers.push(service); await service.load();
    service.edit('teacherName', 'Không lưu'); await service.flush();
    expect(service.ready).toBe(false); expect(service.state).toBe('error'); expect(client.request).toHaveBeenCalledTimes(1);
  });
  it('rejects paths, remote image references, invalid colors and oversized fields', () => {
    for (const patch of [{ avatar: '../school-data.json' }, { schoolLogo: 'https://example.test/logo.png' }, { accentColor: 'red' }, { teacherName: 'a'.repeat(121) }, { phone: 'a\u0000b' }]) expect(() => validateProfile({ ...DEFAULT_PROFILE, ...patch })).toThrow();
    expect(validateProfile({ ...DEFAULT_PROFILE, avatar: 'a'.repeat(64) + '.png' }).avatar).toMatch(/\.png$/);
  });
  it('rejects invalid file uploads before sending any bytes', async () => {
    const { service, client } = await setup();
    await expect(service.upload('avatar', { type: 'image/svg+xml', size: 12 })).rejects.toThrow('PNG');
    await expect(service.upload('schoolLogo', { type: 'image/png', size: 8 * 1024 * 1024 + 1 })).rejects.toThrow('8 MB');
    expect(client.request).toHaveBeenCalledTimes(1);
  });
  it('loads shared avatar/logo bytes once and releases old browser URLs when an image is no longer used', async () => {
    const imageId = 'a'.repeat(64) + '.png';
    const client = { request: vi.fn(async url => url === '/api/profile' ? { profile: { ...DEFAULT_PROFILE, avatar: imageId, schoolLogo: imageId }, etag: 'images' } : new Blob(['synthetic image'])) };
    const service = new ProfileService(client); timers.push(service); await service.load();
    expect(client.request).toHaveBeenCalledTimes(2); expect(service.images.get(imageId).url).toMatch(/^blob:/);
    service.edit('avatar', null); expect(service.images.has(imageId)).toBe(true);
    service.edit('schoolLogo', null); expect(service.images.size).toBe(0);
  });
  it('keeps white button text readable for dark, pale and highly saturated custom colors', () => {
    for (const color of ['#ffffff', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#000000', '#275f4d', '#ff0000']) {
      const tokens = themeTokens(color), values = tokens['--action-bg'].slice(1).match(/../g).map(v => parseInt(v, 16));
      expect(1.05 / (luminance(values) + .05)).toBeGreaterThanOrEqual(4.5);
      const wash = tokens['--accent-wash'].slice(1).match(/../g).map(v => parseInt(v, 16));
      expect((luminance(wash) + .05) / (luminance(values) + .05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
