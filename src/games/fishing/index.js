import * as THREE from 'three';
import { BaseGame, smooth, clamp01 } from '../shared/base-game.js';
import { buildLake } from './scene.js';
import { createSchool } from './fish.js';
export class FishingGame extends BaseGame {
  prepare(data) {
    this.bind(data); this.lake = buildLake(this); this.school = createSchool(this, data.students); this.actors = this.school.actors; this.target = new THREE.Vector3(1.7, .12, 1.2);
    this.idle = new THREE.Vector3(); this.lineTip = new THREE.Vector3(1.1, 4.6, -3.7); this.mount(); this.animate(0, 0); this.render();
  }
  animate(seconds, progress) {
    const timeMs = seconds * 1000, hook = this.scenario.hooks.find(h => timeMs >= h.startMs && timeMs <= h.endMs);
    const final = clamp01((progress - .62) / .23), focusId = hook?.studentId ?? (final > 0 ? this.scenario.winnerId : null);
    this.focusId = this.revealed ? this.scenario.winnerId : hook?.studentId ?? null;
    const nearProgress = hook ? (timeMs - hook.startMs) / (hook.endMs - hook.startMs) : 0;
    this.context.status(hook ? 'Suýt nữa! Bất ngờ vẫn còn phía trước…' : progress < .15 ? 'Một buổi câu cá thật đẹp…' : final > 0 ? 'Phao đang chuyển động… Chờ một chút nhé!' : 'Thả cần, đón một điều bất ngờ…');
    this.lake.water.uniforms.time.value = seconds;
    const float = this.lake.float;
    float.position.set(this.target.x, .07 + Math.sin(seconds * 3) * .055, this.target.z); float.rotation.z = hook ? Math.sin(nearProgress * Math.PI * 5) * .2 : Math.sin(seconds) * .03;
    this.lake.boat.position.y = .8 + Math.sin(seconds * 1.2) * .045;
    for (const actor of this.actors) {
      const angle = actor.angle + seconds * actor.speed;
      actor.position.set(Math.cos(angle) * actor.radius, .1 + Math.sin(seconds * 2 + actor.index) * .04, Math.sin(angle) * actor.radius * .8);
      actor.rotation = -angle - Math.PI / 2;
      if (actor.id === focusId) {
        const blend = hook ? Math.sin(nearProgress * Math.PI) ** 2 : smooth(final);
        actor.position.lerp(this.target, blend);
        actor.rotation = actor.rotation * (1 - blend) + Math.sin(seconds * 4) * .1 * blend;
        if (hook) actor.position.y += Math.sin(nearProgress * Math.PI) ** 8 * (hook.kind === 'lineShake' ? .8 : hook.kind === 'quickDodge' ? .2 : .45);
        if (this.revealed) { actor.position.copy(this.target); actor.position.y = 1.35; actor.rotation = -.2; }
      }
    }
    this.school.update(seconds);
    const line = this.lake.lineGeometry.attributes.position;
    for (let i = 0; i < 4; i++) { const p = i / 3; line.setXYZ(i, THREE.MathUtils.lerp(this.lineTip.x, float.position.x, p), THREE.MathUtils.lerp(this.lineTip.y, float.position.y + .65, p) - Math.sin(p * Math.PI) * .22, THREE.MathUtils.lerp(this.lineTip.z, float.position.z, p)); }
    line.needsUpdate = true;
    const rippleScale = .7 + (seconds % 1.7) * .5; this.lake.ripple.scale.setScalar(rippleScale); this.lake.ripple.material.opacity = .6 * (1 - seconds % 1.7 / 1.7);
    this.camera.zoom = this.context.settings.reducedMotion ? 1 : 1 + smooth(clamp01(progress / .85)) * .08; this.camera.updateProjectionMatrix();
  }
}
export const createGame = (context, host) => new FishingGame(context, host);
