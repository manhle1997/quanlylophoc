import { describe, it, expect, vi } from 'vitest';
import { UpdateClient } from '../../src/core/updates/update-client.js';

describe('user initiated updates', () => {
  it('does no network work at construction; settings only reads local status once', async () => {
    const storage = { request: vi.fn().mockResolvedValue({ state: 'idle', currentVersion: '0.5.1' }) };
    const client = new UpdateClient(storage);
    expect(storage.request).not.toHaveBeenCalled();
    await client.load(); await client.load();
    expect(storage.request.mock.calls).toEqual([['/api/updates']]);
  });
  it('does not restart or apply when either store cannot save', async () => {
    const storage = { request: vi.fn() }, client = new UpdateClient(storage), restart = vi.fn();
    client.status = { state: 'ready' };
    await expect(client.install({ flush: async () => { throw new Error('conflict'); }, ready: () => true, restart })).rejects.toThrow('conflict');
    expect(storage.request).not.toHaveBeenCalled(); expect(restart).not.toHaveBeenCalled();
    expect(client.pending).toBe(false);
  });
  it('keeps the current app running while an image is still uploading', async () => {
    const storage = { request: vi.fn() }, client = new UpdateClient(storage);
    client.status = { state: 'ready' };
    await expect(client.install({ flush: async () => {}, ready: () => false, restart: vi.fn() })).rejects.toThrow('lưu xong');
    expect(storage.request).not.toHaveBeenCalled();
  });
  it('flushes both stores before the single apply request and reconnects after acknowledgement', async () => {
    const events = [], storage = { request: vi.fn(async path => { events.push(path); return { state: 'applying', version: '0.5.2' }; }) };
    const client = new UpdateClient(storage); client.status = { state: 'ready' };
    await client.install({ flush: async () => { events.push('saved'); }, ready: () => true, restart: async version => { events.push(version); } });
    expect(events).toEqual(['saved', '/api/updates/apply', '0.5.2']);
  });
  it('does not send a duplicate apply request while a restart is pending', async () => {
    let finish; const wait = new Promise(resolve => { finish = resolve; });
    const storage = { request: vi.fn().mockResolvedValue({ state: 'applying', version: '0.5.2' }) }, client = new UpdateClient(storage);
    client.status = { state: 'ready' };
    const options = { flush: () => wait, ready: () => true, restart: vi.fn() };
    const first = client.install(options); await client.install(options); finish(); await first;
    expect(storage.request).toHaveBeenCalledTimes(1);
  });
});
