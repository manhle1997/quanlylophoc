import { describe, it, expect, vi } from 'vitest';
import { Store } from '../../src/core/store.js';
import { createDemo } from '../../src/core/domain/demo.js';
import { AutosaveService } from '../../src/core/storage/autosave-service.js';
import { LocalStorageClient } from '../../src/core/storage/local-storage-client.js';

function setup(client) {
  const store = new Store(); store.replace(createDemo());
  const service = new AutosaveService(store, client, { sleep: async () => {} }); service.enabled = true;
  store.subscribe(() => service.changed());
  return { store, service };
}
const saving = () => ({ save: vi.fn(async doc => ({ ...structuredClone(doc), revision: doc.revision + 1, updatedAt: new Date().toISOString() })) });
describe('automatic persistence', () => {
  it('persists roster and attendance edits without a save confirmation', async () => {
    const client = saving(), { store, service } = setup(client);
    store.setAttendance(store.selectedClass.students[0].id, false); await service.flush(); expect(client.save).toHaveBeenCalledTimes(1);
    store.mutate(doc => { doc.schoolName = 'Trường giả'; }); await service.flush();
    expect(client.save).toHaveBeenCalledTimes(2); expect(store.dirty).toBe(false); expect(service.state).toBe('saved'); expect(store.document.revision).toBe(2);
  });
  it('queues changes made during an in-flight save and keeps the newest generation dirty until saved', async () => {
    const completions = [], client = { save: vi.fn(doc => new Promise(resolve => completions.push(() => resolve({ ...doc, revision: 1, updatedAt: new Date().toISOString() })))) };
    const { store, service } = setup(client);
    store.mutate(doc => { doc.schoolName = 'Một'; }); const pending = service.flush();
    store.mutate(doc => { doc.schoolName = 'Hai'; }); completions.shift()();
    await vi.waitFor(() => expect(client.save).toHaveBeenCalledTimes(2)); expect(store.dirty).toBe(true);
    expect(client.save.mock.calls[1][0].schoolName).toBe('Hai'); completions.shift()(); await pending;
    expect(store.document.schoolName).toBe('Hai'); expect(store.dirty).toBe(false);
  });
  it('retries transient failures with the same snapshot, and surfaces persistent failures without clearing dirty', async () => {
    const client = saving(), { store, service } = setup(client);
    client.save.mockRejectedValue(Object.assign(new Error('thiết bị chưa sẵn sàng'), { code: 'STORAGE_UNAVAILABLE' }));
    store.mutate(doc => { doc.schoolName = 'Giữ bản đang làm'; }); await expect(service.flush()).rejects.toThrow();
    expect(client.save).toHaveBeenCalledTimes(3); expect(store.dirty).toBe(true); expect(service.state).toBe('error');
    client.save.mockImplementation(async doc => ({ ...doc, revision: 1, updatedAt: new Date().toISOString() })); await service.flush(); expect(store.dirty).toBe(false);
  });
  it('a stale save cannot mark a newly loaded document as saved, even when its document ID is unchanged', async () => {
    const finish = [], client = { save: vi.fn(doc => new Promise(resolve => finish.push(() => resolve({ ...doc, revision: 1, updatedAt: new Date().toISOString() })))) };
    const { store, service } = setup(client);
    store.mutate(doc => { doc.schoolName = 'Bản trước'; }); const previous = service.flush();
    const loaded = structuredClone(store.document); loaded.schoolName = 'Bản vừa mở'; store.replace(loaded);
    store.mutate(doc => { doc.schoolName = 'Thay đổi mới'; }); finish.shift()(); await previous;
    await vi.waitFor(() => expect(client.save).toHaveBeenCalledTimes(2)); expect(store.dirty).toBe(true); expect(store.document.schoolName).toBe('Thay đổi mới'); finish.shift()(); await service.flush(); expect(store.dirty).toBe(false);
  });
  it('does not overwrite after a conflict and never saves demo edits', async () => {
    const client = saving(), { store, service } = setup(client);
    client.save.mockRejectedValue(Object.assign(new Error('cửa sổ khác'), { code: 'CONFLICT' }));
    store.mutate(doc => { doc.schoolName = 'Giữ lại'; }); await expect(service.flush()).rejects.toThrow(); expect(client.save).toHaveBeenCalledTimes(1); expect(store.dirty).toBe(true);
    store.replace(createDemo(), { demo: true }); store.mutate(doc => { doc.schoolName = 'Demo'; }); await service.flush(); expect(client.save).toHaveBeenCalledTimes(1);
  });
  it('client uses process session token + expected ETag and validates persisted responses', async () => {
    const doc = createDemo(), fetcher = vi.fn(async (url, options) => {
      if (url === '/api/session') return Response.json({ token: 'process-token' });
      expect(options.headers['X-ClassQuest-Token']).toBe('process-token');
      if (options.method === 'POST') { expect(JSON.parse(options.body).expectedEtag).toBe('read-hash'); return Response.json({ document: { ...doc, revision: 1 }, etag: 'write-hash' }); }
      return Response.json({ document: doc, etag: 'read-hash' });
    });
    const client = new LocalStorageClient(fetcher); expect(await client.load()).toEqual(doc); expect((await client.save(doc)).revision).toBe(1); expect(client.etag).toBe('write-hash');
  });
  it('corrupt load preserves recovery fingerprint and never initializes or writes an empty replacement', async () => {
    const fetcher = vi.fn(async url => url === '/api/session' ? Response.json({ token: 't' }) : Response.json({ code: 'CORRUPT_DATA', message: 'không đọc được', etag: 'original-bytes' }, { status: 422 }));
    const client = new LocalStorageClient(fetcher); await expect(client.load()).rejects.toMatchObject({ code: 'CORRUPT_DATA' }); expect(client.etag).toBe('original-bytes'); expect(fetcher.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
  });
});
