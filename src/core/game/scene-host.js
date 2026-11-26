import * as THREE from 'three';
import { qualityProfile } from './quality-manager.js';
export class SceneHost {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Khung cảnh trò chơi 3D');
    this.lost = e => { e.preventDefault(); this.invalid = true; this.active?.context.onContextLost?.(); };
    this.renderer.domElement.addEventListener('webglcontextlost', this.lost);
  }
  attach(game) {
    this.active = game;
    const mount = game.context.mount;
    mount.replaceChildren(this.renderer.domElement);
    const profile = qualityProfile(game.context.settings.quality);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, profile.pixelRatio)); this.renderer.shadowMap.enabled = profile.shadows;
    this.observer?.disconnect(); this.observer = new ResizeObserver(() => { if (this.active === game) game.resize(); }); this.observer.observe(mount);
    game.resize();
  }
  detach(game) { if (this.active !== game) return; this.observer?.disconnect(); this.active = null; this.renderer.domElement.remove(); this.renderer.renderLists.dispose(); }
  dispose() { this.observer?.disconnect(); this.renderer.domElement.removeEventListener('webglcontextlost', this.lost); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
