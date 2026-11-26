import * as THREE from 'three';
import { BaseGame, smooth, clamp01 } from '../shared/base-game.js';
import { createActors } from '../shared/instanced-actors.js';
export class ClawGame extends BaseGame {
  prepare(data) {
    this.bind(data); this.scene.background.set('#32283d'); this.scene.fog.color.set('#32283d'); this.ground('#362d43');
    this.mesh('box', '#a373a0', [0, -1.2, 0], [18, 1.7, 14]); this.mesh('box', '#d6a1bb', [0, -.28, 0], [18.2, .35, 14.2]); this.mesh('box', '#b8add2', [0, -.05, 0], [16.5, .1, 12.4]);
    for (const x of [-8.6, 8.6]) for (const z of [-6.6, 6.6]) this.mesh('cylinder', '#efaec6', [x, 3.8, z], [.22, 8, .22]);
    for (const z of [-6.6, 6.6]) this.mesh('box', '#ebb4cc', [0, 7.8, z], [17.6, .4, .4]);
    for (const x of [-8.6, 8.6]) { this.mesh('box', '#cdb0d7', [x, 7.8, 0], [.4, .4, 13.4]); const glass = this.mesh('box', '#d9d4ff', [x, 3.8, 0], [.03, 7.2, 12.7], this.scene, { transparent: true, opacity: .055, depthWrite: false }); glass.castShadow = false; }
    this.rail = this.mesh('box', '#bfc6d9', [0, 7.25, 0], [16.8, .18, .18]);
    this.toys = createActors(this, data.students, [
      { pos: [0, .48, 0], scale: [.38, .48, .31] }, { pos: [0, 1.02, 0], scale: [.36, .34, .3] },
      { pos: [-.27, 1.29, 0], scale: [.14, .16, .13] }, { pos: [.27, 1.29, 0], scale: [.14, .16, .13] },
      { pos: [-.12, 1.07, .28], scale: [.035, .04, .025], color: '#51475b' }, { pos: [.12, 1.07, .28], scale: [.035, .04, .025], color: '#51475b' },
      { pos: [0, .91, .27], scale: [.13, .09, .08], color: '#f5e4d7' },
      { pos: [-.28, .13, .18], scale: [.19, .13, .22] }, { pos: [.28, .13, .18], scale: [.19, .13, .22] },
    ], { columns: Math.ceil(Math.sqrt(data.students.length * 1.3)), spacing: data.students.length > 55 ? 1.45 : 1.8 }); this.actors = this.toys.actors;
    this.claw = new THREE.Group(); this.scene.add(this.claw); this.mesh('sphere', '#dde0ed', [0, 0, 0], [.28, .32, .28], this.claw, { metalness: .5, roughness: .3 });
    this.fingers = [];
    for (let i = 0; i < 3; i++) { const pivot = new THREE.Group(); pivot.rotation.y = i / 3 * Math.PI * 2; this.claw.add(pivot); const finger = new THREE.Group(); finger.position.set(.18, 0, 0); pivot.add(finger); this.mesh('box', '#bfc8dd', [.15, -.4, 0], [.1, .85, .12], finger, { metalness: .5, roughness: .3 }); const tip = this.mesh('box', '#e8e7f3', [.1, -.8, 0], [.3, .1, .12], finger); tip.rotation.z = -.2; this.fingers.push(finger); }
    this.cable = this.mesh('cylinder', '#d3d2e5', [0, 5, 0], [.035, 4, .035]); this.mesh('box', '#bf8ba9', [7, .1, 6], [2.5, .5, 2]); this.mesh('box', '#efd09e', [7, .42, 6], [2.1, .1, 1.6]);
    this.tool = new THREE.Vector3(); this.camera.position.set(19, 20, 28); this.camera.lookAt(0, 2.5, 0); this.mount(); this.animate(0, 0); this.render();
    this.claw.scale.setScalar(1.25);
    this.mesh('box', '#bb86a7', [0, -.65, 7.05], [17.8, 1.05, .5]);
    this.mesh('box', '#67557e', [-5.5, -.55, 7.33], [2.2, .45, .06]);
    this.mesh('sphere', '#efd397', [5, -.45, 7.45], [.3, .2, .16]);
  }
  animate(seconds, progress) {
    const hook = this.scenario.hooks.find(h => seconds * 1000 >= h.startMs && seconds * 1000 <= h.endMs), final = clamp01((progress - .62) / .23);
    const actor = this.actors.find(a => a.id === (hook?.studentId ?? this.scenario.winnerId));
    const phase = hook ? (seconds * 1000 - hook.startMs) / (hook.endMs - hook.startMs) : 0, approach = hook ? Math.sin(phase * Math.PI) ** 2 : smooth(clamp01(final * 1.6));
    const transport = hook ? 0 : smooth(clamp01((final - .65) / .35));
    const x = THREE.MathUtils.lerp(Math.sin(seconds * .6) * 5, actor.home.x, approach), z = THREE.MathUtils.lerp(Math.cos(seconds * .45) * 3, actor.home.z, approach);
    this.tool.set(THREE.MathUtils.lerp(x, 7, transport), hook ? 5.7 - Math.sin(phase * Math.PI) * 3.6 : 5.7 - Math.sin(final * Math.PI) * 3.7, THREE.MathUtils.lerp(z, 6, transport));
    this.claw.position.copy(this.tool); this.rail.position.z = this.tool.z; this.cable.position.set(this.tool.x, (7.2 + this.tool.y) / 2, this.tool.z); this.cable.scale.y = Math.max(.1, 7.2 - this.tool.y);
    for (const finger of this.fingers) finger.rotation.z = .6 - approach * .8;
    for (const a of this.actors) {
      const idleTime = this.context.settings.reducedMotion ? 0 : seconds;
      a.position.copy(a.home); a.position.y += Math.sin(idleTime * 1.3 + a.index) * .035; a.rotation = Math.sin(idleTime * 1.1 + a.index) * .035;
      if (a === actor) {
        if (hook) { const lift = Math.sin(phase * Math.PI) ** 4 * (hook.kind === 'earlyRelease' ? 1.6 : .85); a.position.y = lift; a.rotation += Math.sin(phase * Math.PI * 3) * .16; }
        else if (final > .45) { const lift = smooth(clamp01((final - .45) / .3)); a.position.y = (this.tool.y - 1.5) * lift; a.position.x = THREE.MathUtils.lerp(a.home.x, this.tool.x, lift); a.position.z = THREE.MathUtils.lerp(a.home.z, this.tool.z, lift); }
        if (this.revealed) a.position.set(7, .5, 6);
      }
    }
    this.focusId = this.revealed ? actor.id : hook?.studentId ?? null; this.toys.sync(seconds);
    this.context.status(hook ? 'Ôi, tuột mất rồi! Thử một hướng khác nhé…' : final > 0 ? 'Chiếc móc đã tìm thấy một người bạn…' : 'Lượn một vòng qua thế giới thú bông…');
  }
}
export const createGame = (context, host) => new ClawGame(context, host);
