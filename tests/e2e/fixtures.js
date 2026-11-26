import { test as base, expect } from '@playwright/test';
import { validateDocument } from '../../src/core/domain/validation.js';
import { createHash } from 'node:crypto';

export const test = base.extend({
  storage: async ({}, use) => { await use({ document: null, etag: 'missing', writes: 0, attempts: 0, backups: [], fail: null, loadError: null, profile: null, profileEtag: 'missing', profileWrites: 0, images: new Map(), profileFail: null }); },
  page: async ({ page, storage }, use) => {
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), method = route.request().method();
      const reply = (json, status = 200) => route.fulfill({ status, json });
      if (url.pathname === '/api/session') return reply({ token: 'fixture-token', version: '0.5.1' });
      if (route.request().headers()['x-classquest-token'] !== 'fixture-token') return reply({ code: 'SESSION_EXPIRED', message: 'Phiên đã đổi.' }, 403);
      if (url.pathname === '/api/profile' && method === 'GET') return reply({ profile: storage.profile, etag: storage.profileEtag });
      if (url.pathname === '/api/profile' && method === 'POST') {
        if (storage.profileFail) return reply({ code: storage.profileFail, message: 'Chưa lưu được hồ sơ. Nội dung đang sửa được giữ lại.' }, storage.profileFail === 'CONFLICT' ? 409 : 503);
        const body = route.request().postDataJSON();
        if (body.expectedEtag !== storage.profileEtag) return reply({ code: 'CONFLICT', message: 'Hồ sơ đã thay đổi ở cửa sổ khác.' }, 409);
        storage.profile = body.profile; storage.profileEtag = `profile-${++storage.profileWrites}`;
        return reply({ profile: storage.profile, etag: storage.profileEtag });
      }
      if (url.pathname === '/api/profile/images' && method === 'POST') {
        const body = route.request().postDataBuffer(), mime = route.request().headers()['content-type'];
        const id = createHash('sha256').update(body).digest('hex') + '.' + ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }[mime]);
        storage.images.set(id, { body, mime }); return reply({ imageId: id });
      }
      if (url.pathname.startsWith('/api/profile/images/')) {
        const image = storage.images.get(url.pathname.split('/').pop());
        return image ? route.fulfill({ status: 200, contentType: image.mime, body: image.body }) : reply({ code: 'IMAGE_MISSING' }, 404);
      }
      if (url.pathname === '/api/storage' && method === 'GET') return storage.loadError ? reply({ code: storage.loadError, message: 'Chưa mở được lớp học.', etag: storage.etag }, 422) : reply({ document: storage.document, etag: storage.etag });
      if (url.pathname === '/api/storage/backups') return reply({ backups: storage.backups.map(b => ({ ...b, document: undefined })) });
      if (url.pathname === '/api/storage' && method === 'POST') {
        storage.attempts++;
        if (storage.fail) return reply({ code: storage.fail, message: 'Chưa lưu được thay đổi. Giữ ứng dụng mở và thử lại.' }, storage.fail === 'CONFLICT' ? 409 : 503);
        const body = route.request().postDataJSON();
        if (body.expectedEtag !== storage.etag) return reply({ code: 'CONFLICT', message: 'Danh sách đã thay đổi ở cửa sổ khác.' }, 409);
        const doc = validateDocument(body.document);
        if (storage.document) storage.backups.unshift({ id: `backup-${storage.writes}`, savedAt: new Date().toISOString(), classes: storage.document.classes.length, students: storage.document.classes.reduce((n, c) => n + c.students.length, 0), plays: storage.document.history.length, attendanceDays: storage.document.attendanceRecords.length, document: structuredClone(storage.document) });
        doc.revision = (storage.document?.revision ?? 0) + 1; doc.updatedAt = new Date().toISOString(); storage.document = doc; storage.writes++; storage.etag = `stored-${storage.writes}`;
        return reply({ document: doc, etag: storage.etag });
      }
      if (url.pathname === '/api/storage/restore') {
        const body = route.request().postDataJSON(), backup = storage.backups.find(b => b.id === body.backupId);
        if (!backup) return reply({ code: 'BACKUP_MISSING', message: 'Bản lưu không còn khả dụng.' }, 404);
        storage.document = structuredClone(backup.document); storage.etag = `restored-${++storage.writes}`; storage.loadError = null;
        return reply({ document: storage.document, etag: storage.etag });
      }
      return reply({ code: 'NOT_FOUND' }, 404);
    });
    await use(page);
  },
});
export { expect };

