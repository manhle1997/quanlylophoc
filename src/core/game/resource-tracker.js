export class ResourceTracker {
  constructor() { this.resources = new Set(); this.disposed = false; }
  track(resource) { this.resources.add(resource); return resource; }
  dispose() { if (this.disposed) return; this.disposed = true; for (const resource of this.resources) resource.dispose?.(); this.resources.clear(); }
}
