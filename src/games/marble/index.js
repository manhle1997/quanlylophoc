import * as THREE from 'three';
import { BaseGame, smooth, clamp01 } from '../shared/base-game.js';
import { createActors } from '../shared/instanced-actors.js';
import { raceProgress } from './race-progress.js';
export class MarbleGame extends BaseGame {
  prepare(data) {
    this.bind(data); this.scene.background.set('#282742'); this.scene.fog.color.set('#282742'); this.ground('#302f49');
    this.mesh('cylinder', '#5b5383', [0, -2, 0], [13.2, .8, 12]); this.mesh('cylinder', '#8e8ab2', [0, -1.5, 0], [13.2, .22, 12]);
    this.track = new THREE.CatmullRomCurve3([[-9, 2.5, -6], [-10, 2.2, 1], [-6, 1.5, 7], [3, 1.2, 7], [9, .9, 3], [8, .5, -5], [1, .3, -8], [-4, .2, -4], [-2, .1, 1], [6, 0, 1]].map(p => new THREE.Vector3(...p)), false, 'catmullrom', .4);
    const positions = [], indices = [], edges = [[], []], point = new THREE.Vector3(), tangent = new THREE.Vector3(), normal = new THREE.Vector3();
    for (let i = 0; i <= 140; i++) {
      this.track.getPoint(i / 140, point); this.track.getTangent(i / 140, tangent); normal.set(-tangent.z, 0, tangent.x).normalize();
      for (let side = 0; side < 2; side++) { const sign = side ? 1 : -1; const x = point.x + normal.x * sign * 1.25, z = point.z + normal.z * sign * 1.25; positions.push(x, point.y, z); edges[side].push(new THREE.Vector3(x, point.y + .15, z)); }
      if (i < 140) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
      if (i % 20 === 0) this.mesh('cylinder', '#cbb4e2', [point.x, (point.y - 1.4) / 2, point.z], [.15, point.y + 1.4, .15]);
    }
    const ribbon = this.resources.track(new THREE.BufferGeometry()); ribbon.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); ribbon.setIndex(indices); ribbon.computeVertexNormals();
    const road = new THREE.Mesh(ribbon, this.material('#78629f', { side: THREE.DoubleSide })); road.receiveShadow = true; this.scene.add(road);
    for (const edge of edges) this.scene.add(new THREE.Mesh(this.resources.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 160, .085, 6, false)), this.material('#d5b9f4')));
    this.finish = this.track.getPoint(1); const direction = this.track.getTangent(1);
    const arch = new THREE.Group(); arch.position.copy(this.finish); arch.rotation.y = Math.atan2(direction.x, direction.z); this.scene.add(arch);
    for (const x of [-1.5, 1.5]) this.mesh('cylinder', '#f2d994', [x, 1.3, 0], [.1, 2.6, .1], arch);
    this.mesh('box', '#f6e9c7', [0, 2.5, 0], [3.3, .5, .15], arch);
    for (let i = 0; i < 6; i++) this.mesh('box', i % 2 ? '#f5e9d5' : '#514965', [-1.25 + i * .5, 2.5, .09], [.5, .48, .03], arch);
    this.podium = new THREE.Vector3(9, .7, 6); this.mesh('cylinder', '#e6c27d', [9, -.3, 6], [1.3, 1.4, 1.3]);
    this.balls = createActors(this, data.students, [{ scale: [.33, .33, .33], options: { roughness: .3, metalness: .15 } }, { type: 'torus', scale: [.31, .31, .31], color: '#f4efe8', motion: (_actor, transform, seconds) => { transform.rotation.set(seconds * 2, .2, seconds * .7); } }, { pos: [.13, .19, .2], scale: [.07, .07, .04], color: '#fff6e5' }]);
    this.actors = this.balls.actors; for (const a of this.actors) a.labelHeight = .7;
    this.scratch = new THREE.Vector3(); this.tangent = new THREE.Vector3(); this.normal = new THREE.Vector3(); this.mount(); this.animate(0, 0); this.render();
  }
  animate(seconds, progress) {
    const hook = this.scenario.hooks.find(h => seconds * 1000 >= h.startMs && seconds * 1000 <= h.endMs);
    for (const actor of this.actors) {
      const p = raceProgress(this.scenario, actor.id, actor.index, seconds * 1000);
      this.track.getPoint(p, actor.position); this.track.getTangent(p, this.tangent); this.normal.set(-this.tangent.z, 0, this.tangent.x).normalize();
      actor.position.addScaledVector(this.normal, ((actor.index % 7) - 3) * .25); actor.position.y += .35; actor.rotation = -seconds * 3 + actor.index;
      if (this.revealed && actor.id === this.scenario.winnerId) actor.position.lerp(this.podium, smooth(clamp01((progress - .85) / .15)));
    }
    this.focusId = this.revealed ? this.scenario.winnerId : hook?.studentId ?? null; this.balls.sync(seconds);
    this.context.status(hook ? 'Một người bạn vừa vươn lên… Nhưng vẫn còn khúc cua!' : progress > .62 ? 'Đoạn nước rút bắt đầu…' : 'Các viên bi đã sẵn sàng khám phá đường đua!');
  }
}
export const createGame = (context, host) => new MarbleGame(context, host);
