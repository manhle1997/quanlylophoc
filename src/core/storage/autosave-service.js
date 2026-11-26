export class AutosaveService {
  constructor(store, client, { onStatus = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    Object.assign(this, { store, client, onStatus, sleep }); this.state = 'ready'; this.error = null; this.running = null; this.enabled = false;
  }
  setState(state, error = null) { this.state = state; this.error = error; this.onStatus(); }
  changed() { if (this.enabled && !this.store.demo && this.store.dirty) this.flush().catch(() => {}); }
  flush() {
    if (this.running) return this.running;
    if (!this.enabled || this.store.demo || !this.store.dirty) return Promise.resolve();
    this.running = this.drain().finally(() => { this.running = null; if (this.enabled && !this.store.demo && this.store.dirty && this.state !== 'error') this.changed(); });
    return this.running;
  }
  async drain() {
    this.setState('saving');
    while (this.enabled && !this.store.demo && this.store.dirty) {
      const snapshot = structuredClone(this.store.document), generation = this.store.generation, epoch = this.store.documentEpoch;
      let saved, error;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { saved = await this.client.save(snapshot); error = null; break; }
        catch (e) {
          error = e;
          if (!['UNAVAILABLE', 'STORAGE_UNAVAILABLE', 'VERIFY_FAILED', 'BACKUP_FAILED'].includes(e.code) || attempt === 2) break;
          await this.sleep([400, 1200][attempt]);
        }
      }
      if (this.store.demo || this.store.documentEpoch !== epoch) return;
      if (error) { this.setState('error', error); throw error; }
      // Changes made while a write was in flight remain dirty and are saved next.
      this.store.document.revision = saved.revision; this.store.document.updatedAt = saved.updatedAt;
      this.store.savedGeneration = generation;
    }
    this.setState('saved');
  }
}
