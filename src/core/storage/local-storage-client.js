import { validateDocument } from '../domain/validation.js';

export class LocalStorageClient {
  constructor(fetcher = globalThis.fetch.bind(globalThis)) { this.fetcher = fetcher; this.token = null; this.etag = 'missing'; }
  async openSession() {
    let response;
    try { response = await this.fetcher('/api/session', { cache: 'no-store', signal: AbortSignal.timeout(10000) }); }
    catch { throw Object.assign(new Error('Chưa mở được lớp học. Hãy kiểm tra ứng dụng còn đang chạy rồi thử lại.'), { code: 'UNAVAILABLE' }); }
    let session; try { session = await response.json(); } catch { /* A dev server without the launcher is not a data store. */ }
    if (!response.ok || !session?.token) throw Object.assign(new Error('Hãy mở Lớp Học Vui bằng biểu tượng ứng dụng để danh sách được lưu tự động.'), { code: 'UNAVAILABLE' });
    this.token = session.token;
  }
  async request(path, options = {}, renewed = false) {
    if (!this.token) await this.openSession();
    const { binary = false, ...requestOptions } = options;
    let response;
    try { response = await this.fetcher(path, { ...requestOptions, cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { 'X-ClassQuest-Token': this.token, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } }); }
    catch { throw Object.assign(new Error('Chưa lưu được thay đổi. Giữ ứng dụng mở và thử lại khi thiết bị sẵn sàng.'), { code: 'UNAVAILABLE' }); }
    if (binary && response.ok) return response.blob();
    let result; try { result = await response.json(); } catch { throw Object.assign(new Error('Ứng dụng chưa sẵn sàng. Hãy thử lại.'), { code: 'UNAVAILABLE' }); }
    if (!response.ok) {
      if (result.code === 'SESSION_EXPIRED' && !renewed) { await this.openSession(); return this.request(path, options, true); }
      throw Object.assign(new Error(result.message ?? 'Chưa thực hiện được thao tác. Hãy thử lại.'), { code: result.code ?? 'UNAVAILABLE', etag: result.etag });
    }
    return result;
  }
  accept(result) {
    const document = result.document === null ? null : validateDocument(result.document);
    if (typeof result.etag !== 'string') throw new Error('Chưa xác nhận được lần lưu. Hãy giữ ứng dụng mở và thử lại.');
    this.etag = result.etag;
    return document;
  }
  async load() { try { return this.accept(await this.request('/api/storage')); } catch (e) { if (e.etag) this.etag = e.etag; throw e; } }
  async save(document) {
    const body = JSON.stringify({ document: validateDocument(document), expectedEtag: this.etag });
    return this.accept(await this.request('/api/storage', { method: 'POST', body, keepalive: new TextEncoder().encode(body).length <= 60 * 1024 }));
  }
  async listBackups() { return (await this.request('/api/storage/backups')).backups; }
  async restore(backupId) { return this.accept(await this.request('/api/storage/restore', { method: 'POST', body: JSON.stringify({ backupId, expectedEtag: this.etag }) })); }
}
