import * as THREE from 'three';
import { BaseGame, smooth, clamp01 } from '../shared/base-game.js';
import { createActors } from '../shared/instanced-actors.js';
export class UfoGame extends BaseGame {
  prepare(data) {
    this.bind(data); this.scene.background.set('#151b39'); this.scene.fog.color.set('#151b39');
    this.ambient.intensity = 1.25; this.sun.intensity = 1.4; this.sun.color.set('#b4bffa');
    this.ground('#171e38'); this.mesh('cylinder', '#384563', [0, -1.5, 0], [12.7, 1.6, 12.7]); this.mesh('cylinder', '#698f8c', [0, -.55, 0], [12.7, .4, 12.7]);
    this.tree(-10, -4, .8, '#6486ac'); this.tree(10, -5, .75, '#6989a2'); this.tree(-9, 6, .6, '#627d9b');
    const house = new THREE.Group(); house.position.set(-5, .1, -9); this.scene.add(house);
    this.mesh('box', '#a9a5c7', [0, .7, 0], [2.5, 2.3, 2], house); const roof = this.mesh('cone', '#706c9c', [0, 2.65, 0], [2.2, 1.6, 2], house); roof.rotation.y = Math.PI / 4;
    for (const x of [-.7, .7]) this.mesh('box', '#ffe5a9', [x, 1, 1.03], [.55, .6, .08], house, { emissive: '#f0ba67', emissiveIntensity: .4 });
    const moon = this.mesh('sphere', '#dddffd', [-10, 12, -13], [1.4, 1.4, 1.4], this.scene, { emissive: '#a6b8ef', emissiveIntensity: .5 }); moon.castShadow = false;
    const stars = this.resources.track(new THREE.InstancedMesh(this.geometry('sphere'), this.material('#dae9fc', { emissive: '#8bbdf2', emissiveIntensity: .8 }), 60));
    const transform = new THREE.Object3D(); for (let i = 0; i < 60; i++) { transform.position.set(Math.sin(i * 42.17) * 22, 6 + (i % 9) * 1.5, -17 - (i % 5)); transform.scale.setScalar(.035 + (i % 3) * .02); transform.updateMatrix(); stars.setMatrixAt(i, transform.matrix); } this.scene.add(stars);
    this.people = createActors(this, data.students, [
      { pos: [0, .55, 0], scale: [.3, .44, .25] }, { pos: [0, 1.1, 0], scale: [.3, .3, .28], color: '#f8d7b3' },
      { pos: [-.1, 1.14, .25], scale: [.035, .045, .035], color: '#384054' }, { pos: [.1, 1.14, .25], scale: [.035, .045, .035], color: '#384054' },
      { pos: [-.16, .12, .08], scale: [.13, .13, .22], color: '#636981' }, { pos: [.16, .12, .08], scale: [.13, .13, .22], color: '#636981' },
      { pos: [-.35, .6, 0], scale: [.1, .3, .1], motion: (actor, transform, seconds) => { transform.rotation.z = -.2 + Math.sin(seconds * 2 + actor.index) * .12; } },
      { pos: [.35, .6, 0], scale: [.1, .3, .1], motion: (actor, transform, seconds) => { transform.rotation.z = .2 - Math.sin(seconds * 2 + actor.index) * .12; } },
    ], { spacing: data.students.length > 55 ? 1.45 : 1.65 }); this.actors = this.people.actors;
    this.ufo = new THREE.Group(); this.scene.add(this.ufo);
    this.mesh('sphere', '#a7a8d0', [0, 0, 0], [2.2, .35, 2.2], this.ufo, { metalness: .25, roughness: .4 });
    this.mesh('sphere', '#9de6df', [0, .45, 0], [1.05, .8, 1.05], this.ufo, { transparent: true, opacity: .85, roughness: .3 });
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; this.mesh('sphere', '#b4ffde', [Math.cos(a) * 1.8, -.1, Math.sin(a) * 1.8], [.16, .12, .16], this.ufo, { emissive: '#69cfb9', emissiveIntensity: .8 }); }
    this.beam = this.mesh('cone', '#a4ffe4', [0, 3, 0], [1.6, 6, 1.6], this.scene, { transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, emissive: '#72ccb9', emissiveIntensity: .5 }); this.beam.castShadow = false;
    this.beam.material = this.resources.track(new THREE.MeshBasicMaterial({ color: '#8bffe2', transparent: true, opacity: .23, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.groundRing = this.mesh('torus', '#adf7e1', [0, -.25, 0], [1.5, 1.5, 1.5], this.scene, { emissive: '#70c9ad', emissiveIntensity: .7 }); this.groundRing.rotation.x = -Math.PI / 2;
    this.search = new THREE.Vector3(); this.tool = new THREE.Vector3(); this.mount(); this.animate(0, 0); this.render();
  }
  animate(seconds, progress) {
    const hook = this.scenario.hooks.find(h => seconds * 1000 >= h.startMs && seconds * 1000 <= h.endMs), final = clamp01((progress - .62) / .23);
    const actor = this.actors.find(a => a.id === (hook?.studentId ?? this.scenario.winnerId));
    const phase = hook ? (seconds * 1000 - hook.startMs) / (hook.endMs - hook.startMs) : 0, blend = hook ? Math.sin(phase * Math.PI) ** 2 : smooth(final);
    this.search.set(Math.sin(seconds * .48) * 5, 6.5 + Math.sin(seconds * 1.5) * .12, Math.cos(seconds * .38) * 3);
    this.tool.copy(this.search); this.tool.x = THREE.MathUtils.lerp(this.search.x, actor.home.x, blend); this.tool.z = THREE.MathUtils.lerp(this.search.z, actor.home.z, blend); this.ufo.position.copy(this.tool);
    this.ufo.rotation.z = this.context.settings.reducedMotion ? 0 : Math.sin(seconds * .7) * .035;
    this.beam.position.set(this.tool.x, this.tool.y / 2, this.tool.z); this.beam.scale.y = this.tool.y; this.beam.material.opacity = .13 + blend * .08;
    this.groundRing.position.set(this.tool.x, -.26, this.tool.z);
    for (const a of this.actors) { a.position.copy(a.home); a.position.x += Math.sin(seconds * .7 + a.index) * .12; a.rotation = Math.sin(seconds * .4 + a.index) * .12; if (a === actor) a.position.y = hook ? (hook.kind === 'beamDrift' ? .65 : 1.6) * Math.sin(phase * Math.PI) ** 4 : this.revealed ? 2.4 : final ** 4 * .6; }
    this.focusId = this.revealed ? actor.id : hook?.studentId ?? null; this.people.sync(seconds);
    this.context.status(hook ? 'Tín hiệu hơi chập chờn… Suýt nữa rồi!' : final > 0 ? 'Phi thuyền đang ổn định tín hiệu…' : 'Vị khách vũ trụ đang tìm người bạn mới…');
  }
}
export const createGame = (context, host) => new UfoGame(context, host);
