import * as THREE from 'three';
import { gsap } from 'gsap';
import { ResourceTracker } from '../../core/game/resource-tracker.js';
import { LabelManager } from '../../core/game/label-manager.js';
import { AdaptiveQuality } from '../../core/game/quality-manager.js';
import { characterDialogue } from '../../core/game/character-dialogue.js';
import { createSceneDetails } from './scene-details.js';
export const smooth = gsap.parseEase('sine.inOut');
gsap.ticker.sleep();
export const clamp01 = n => Math.max(0, Math.min(1, n));
export class BaseGame {
  constructor(context, host) {
    this.context = context; this.host = host; this.resources = new ResourceTracker(); this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#182734'); this.scene.fog = new THREE.Fog('#182734', 38, 85);
    this.camera = new THREE.OrthographicCamera(-18, 18, 12, -12, .1, 150); this.camera.position.set(18, 23, 28); this.camera.lookAt(0, 0, 0);
    this.ambient = new THREE.HemisphereLight('#d5eef0', '#51646c', 2.6); this.scene.add(this.ambient);
    const sun = new THREE.DirectionalLight('#fff1d5', 4.0); sun.position.set(-12, 24, 14); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, far: 65 }); sun.shadow.bias = -.001; sun.shadow.normalBias = .04; this.scene.add(sun);
    this.actors = []; this.materials = new Map(); this.geometries = new Map(); this.focusId = null;
    this.resources.track(sun.shadow);
    this.sun = sun;
    this.adaptive = new AdaptiveQuality(host.renderer, context.settings.quality);
  }
  material(color, options = {}) {
    const key = `${color}:${JSON.stringify(options)}`;
    if (!this.materials.has(key)) this.materials.set(key, this.resources.track(new THREE.MeshStandardMaterial({ color, roughness: .85, ...options })));
    return this.materials.get(key);
  }
  geometry(type = 'sphere') {
    if (!this.geometries.has(type)) {
      const geometry = type === 'sphere' ? new THREE.SphereGeometry(1, 16, 10) : type === 'box' ? new THREE.BoxGeometry(1, 1, 1) : type === 'cylinder' ? new THREE.CylinderGeometry(1, 1, 1, 24) : type === 'cone' ? new THREE.ConeGeometry(1, 1, 10) : type === 'rock' ? new THREE.DodecahedronGeometry(1) : new THREE.TorusGeometry(1, .06, 6, 40);
      this.geometries.set(type, this.resources.track(geometry));
    }
    return this.geometries.get(type);
  }
  mesh(type, color, position = [0, 0, 0], scale = [1, 1, 1], parent = this.scene, options = {}) {
    const mesh = new THREE.Mesh(this.geometry(type), this.material(color, options)); mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  ground(color = '#1d3140') { const ground = this.mesh('cylinder', color, [0, -2.8, 0], [200, .1, 200]); ground.castShadow = false; return ground; }
  tree(x, z, scale = 1, color = '#72af94') {
    const group = new THREE.Group(); group.position.set(x, -.15, z); group.scale.setScalar(scale); this.scene.add(group);
    this.mesh('cylinder', '#aa8769', [0, 1.2, 0], [.2, 2.8, .2], group);
    this.mesh('sphere', color, [0, 3.1, 0], [1.4, 1.7, 1.25], group);
    this.mesh('sphere', color, [-.75, 2.65, .35], [.95, 1.15, .9], group); return group;
  }
  mount() { this.details = createSceneDetails(this, this.scenario.gameId); this.details.update(0); this.host.attach(this); this.labels = new LabelManager(this.context.mount); }
  bind({ scenario, students }) { this.scenario = scenario; this.students = new Map(students.map(s => [s.id, s])); }
  resize() {
    const mount = this.context.mount; if (!mount || !mount.clientWidth || !mount.clientHeight) return;
    const aspect = mount.clientWidth / mount.clientHeight, height = aspect < 1.4 ? 31 / aspect : 23;
    this.camera.left = -height * aspect / 2; this.camera.right = height * aspect / 2; this.camera.top = height / 2; this.camera.bottom = -height / 2; this.camera.updateProjectionMatrix();
    this.host.renderer.setSize(mount.clientWidth, mount.clientHeight); this.render();
  }
  render() {
    if (this.disposed || this.host.invalid) return;
    this.camera.updateMatrixWorld(); this.host.renderer.render(this.scene, this.camera);
    this.labels?.update(this.actors, this.camera, this.students, this.focusId, characterDialogue(this.scenario, this.elapsed ?? 0, this.revealed));
    this.context.progress?.(this.revealed ? 1 : (this.elapsed ?? 0) / this.scenario.revealAtMs);
    const canvas = this.host.renderer.domElement, info = this.host.renderer.info;
    canvas.dataset.drawCalls = String(info.render.calls); canvas.dataset.geometries = String(info.memory.geometries); canvas.dataset.textures = String(info.memory.textures);
  }
  update({ elapsedMs, deltaMs }) { this.elapsed = elapsedMs; this.adaptive.sample(deltaMs, elapsedMs); this.animate(elapsedMs / 1000, elapsedMs / this.scenario.durationMs); if (!this.context.settings.reducedMotion) this.details?.update(elapsedMs / 1000); this.render(); }
  reveal(winnerId) { this.revealed = true; this.focusId = winnerId; this.animate(this.scenario.revealAtMs / 1000, .85); this.render(); }
  dispose() { if (this.disposed) return; this.disposed = true; this.labels?.dispose(); this.resources.dispose(); this.host.detach(this); this.scene.clear(); this.actors.length = 0; }
}
