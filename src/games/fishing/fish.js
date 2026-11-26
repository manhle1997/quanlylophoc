import * as THREE from 'three';
const palette = ['#f8b777', '#f1cd78', '#efa0a2', '#aeb8f1', '#8cdbcc', '#e8c5e0'];
export function createSchool(game, students) {
  const count = students.length, components = [];
  const body = new THREE.InstancedMesh(game.geometry('sphere'), game.material('#ffffff'), count);
  game.scene.add(body); components.push({ mesh: body, pos: [0, 0, 0], scale: [.52, .27, .23] });
  const triangle = game.resources.track(new THREE.BufferGeometry()); triangle.setAttribute('position', new THREE.Float32BufferAttribute([-.2, 0, 0, -.85, .34, 0, -.85, -.34, 0], 3)); triangle.computeVertexNormals();
  const tail = new THREE.InstancedMesh(triangle, game.material('#ffffff', { side: THREE.DoubleSide }), count); game.scene.add(tail); components.push({ mesh: tail, pos: [-.18, 0, 0], scale: [1, .78, 1], tail: true });
  const fins = new THREE.InstancedMesh(game.geometry('cone'), game.material('#ffffff'), count); game.scene.add(fins); components.push({ mesh: fins, pos: [-.13, .24, 0], scale: [.19, .24, .07] });
  for (const side of [-1, 1]) {
    const eyes = new THREE.InstancedMesh(game.geometry('sphere'), game.material('#fff9ed'), count); game.scene.add(eyes); components.push({ mesh: eyes, pos: [.28, .075, side * .17], scale: [.13, .13, .07] });
    const pupils = new THREE.InstancedMesh(game.geometry('sphere'), game.material('#2e3b48'), count); game.scene.add(pupils); components.push({ mesh: pupils, pos: [.33, .09, side * .23], scale: [.052, .062, .025] });
  }
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const actors = students.map((student, i) => {
    const angle = i * goldenAngle, radius = 2 + Math.sqrt((i + .5) / count) * 7;
    const color = new THREE.Color(palette[i % palette.length]); body.setColorAt(i, color); tail.setColorAt(i, color); fins.setColorAt(i, color);
    return { id: student.id, index: i, radius, angle, speed: .08 + (i % 5) * .012, position: new THREE.Vector3(Math.cos(angle) * radius, .12, Math.sin(angle) * radius), rotation: 0, scale: count > 55 ? .78 : 1, labelHeight: .65 };
  });
  for (const part of components) { game.resources.track(part.mesh); part.mesh.frustumCulled = false; part.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  const actorTransform = new THREE.Object3D(), partTransform = new THREE.Object3D(), combined = new THREE.Matrix4();
  return { actors, update(time) {
    for (const actor of actors) {
      actorTransform.position.copy(actor.position); actorTransform.rotation.set(0, actor.rotation, 0); actorTransform.scale.setScalar(actor.scale); actorTransform.updateMatrix();
      for (const part of components) {
        partTransform.position.set(...part.pos); partTransform.scale.set(...part.scale); partTransform.rotation.set(0, part.tail ? Math.sin(time * 8 + actor.index) * .35 : 0, 0); partTransform.updateMatrix();
        combined.multiplyMatrices(actorTransform.matrix, partTransform.matrix); part.mesh.setMatrixAt(actor.index, combined);
      }
    }
    for (const part of components) part.mesh.instanceMatrix.needsUpdate = true;
  } };
}
