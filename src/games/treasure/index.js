import * as THREE from 'three';
import { BaseGame, smooth, clamp01 } from '../shared/base-game.js';
import { createActors } from '../shared/instanced-actors.js';
export class TreasureGame extends BaseGame {
  prepare(data) {
    this.bind(data); this.scene.background.set('#282c3d'); this.scene.fog.color.set('#282c3d'); this.ground('#293443');
    this.mesh('cylinder', '#8b927a', [0, -1.5, 0], [12.5, 1.5, 12.5]); this.mesh('cylinder', '#cfbc8f', [0, -.57, 0], [12.55, .35, 12.55]);
    this.tree(-10, -3, .75, '#91a994'); this.tree(10, -4, .8, '#8ca69a'); this.tree(-8, 8, .55, '#9ab295');
    for (const x of [-3.2, 3.2]) { this.mesh('box', '#8d8ea0', [x, 2.1, -10], [1, 4.8, 1.2]); this.mesh('sphere', '#bcebd5', [x, 4.75, -10], [.5, .5, .5], this.scene, { emissive: '#72bda5', emissiveIntensity: .8 }); }
    this.mesh('box', '#abacae', [0, 4.4, -10], [7.4, .8, 1.5]);
    const lidMotion = (actor, transform) => { transform.rotation.x = -actor.lid; transform.position.y = .76 + Math.sin(actor.lid) * .3; transform.position.z = -.3 + Math.cos(actor.lid) * .3; };
    this.chests = createActors(this, data.students, [
      { type: 'box', pos: [0, .36, 0], scale: [.9, .7, .65], color: '#bb8957' },
      { type: 'box', pos: [-.3, .36, .01], scale: [.075, .74, .68], color: '#f1cd82' }, { type: 'box', pos: [.3, .36, .01], scale: [.075, .74, .68], color: '#f1cd82' },
      { type: 'box', pos: [0, .76, 0], scale: [.96, .16, .72], color: '#dba862', motion: lidMotion },
      { type: 'box', pos: [0, .5, .355], scale: [.16, .22, .06], color: '#ffe1a0' },
      { type: 'sphere', pos: [0, .51, .39], scale: [.025, .035, .02], color: '#806240' },
    ], { spacing: data.students.length > 55 ? 1.55 : 1.9 }); this.actors = this.chests.actors; for (const actor of this.actors) actor.labelHeight = 1.1;
    this.orb = this.mesh('sphere', '#ffde9b', [0, 3, 0], [.3, .3, .3], this.scene, { emissive: '#e1a857', emissiveIntensity: 1.2 }); this.orb.castShadow = false;
    this.orbit = this.mesh('torus', '#e7c892', [0, 3, 0], [.55, .55, .55], this.scene, { emissive: '#d7b27a', emissiveIntensity: .6 });
    this.light = new THREE.PointLight('#ffce7a', 7, 8); this.scene.add(this.light);
    this.magicRing = this.mesh('torus', '#ffe0a3', [0, -.2, 0], [.9, .9, .9], this.scene, { emissive: '#e8ba79', emissiveIntensity: 1.0 }); this.magicRing.rotation.x = -Math.PI / 2;
    this.target = new THREE.Vector3(); this.mount(); this.animate(0, 0); this.render();
  }
  animate(seconds, progress) {
    const hook = this.scenario.hooks.find(h => seconds * 1000 >= h.startMs && seconds * 1000 <= h.endMs), final = clamp01((progress - .62) / .23);
    const focus = this.actors.find(a => a.id === (hook?.studentId ?? this.scenario.winnerId));
    const phase = hook ? (seconds * 1000 - hook.startMs) / (hook.endMs - hook.startMs) : 0, blend = hook ? Math.sin(phase * Math.PI) ** 2 : smooth(final);
    this.target.set(Math.cos(seconds * .5) * 6, 2.6 + Math.sin(seconds * 1.3) * .2, Math.sin(seconds * .5) * 4);
    this.target.x = THREE.MathUtils.lerp(this.target.x, focus.home.x, blend); this.target.z = THREE.MathUtils.lerp(this.target.z, focus.home.z, blend);
    this.orb.position.copy(this.target); this.orbit.position.copy(this.target); this.orbit.rotation.set(seconds * .4, seconds * .3, .5); this.light.position.copy(this.target);
    this.magicRing.position.set(this.target.x, -.22, this.target.z); this.magicRing.material.opacity = .5 + blend * .5;
    for (const actor of this.actors) {
      actor.position.copy(actor.home); actor.rotation = 0; actor.lid = 0;
      if (actor === focus) {
        if (hook) { actor.lid = Math.sin(phase * Math.PI) * .09; actor.rotation = Math.sin(phase * Math.PI * 7) * .05; }
        else actor.lid = this.revealed ? .2 + smooth(clamp01((progress - .85) / .15)) * 1.4 : final ** 6 * .12;
      }
    }
    this.focusId = this.revealed ? focus.id : hook?.studentId ?? null; this.chests.sync(seconds);
    this.context.status(hook ? 'Chiếc khóa vẫn chưa mở… Hành trình tiếp tục!' : final > 0 ? 'Chìa khóa đã tìm thấy chiếc rương đặc biệt…' : 'Đi theo ánh sáng, tìm điều kỳ diệu…');
  }
}
export const createGame = (context, host) => new TreasureGame(context, host);
