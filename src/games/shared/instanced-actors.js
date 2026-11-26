import * as THREE from 'three';
export const actorPalette = ['#eab18c', '#b7b0e4', '#8ecfc5', '#f0cc89', '#e9a4b9', '#a7c494'];
export function createActors(game, students, parts, { columns = Math.ceil(Math.sqrt(students.length * 1.35)), spacing = 1.6, scale = 1 } = {}) {
  const rows = Math.ceil(students.length / columns);
  const actors = students.map((s, i) => ({ id: s.id, index: i, position: new THREE.Vector3((i % columns - (columns - 1) / 2) * spacing, 0, (Math.floor(i / columns) - (rows - 1) / 2) * spacing), rotation: 0, scale, labelHeight: 1.6, lid: 0 }));
  for (const actor of actors) actor.home = actor.position.clone();
  const batches = parts.map(part => {
    const mesh = game.resources.track(new THREE.InstancedMesh(game.geometry(part.type ?? 'sphere'), game.material(part.color ?? '#ffffff', part.options ?? {}), students.length));
    mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (!part.color) actors.forEach((a, i) => mesh.setColorAt(i, new THREE.Color(actorPalette[i % actorPalette.length])));
    game.scene.add(mesh); return { ...part, mesh };
  });
  const actorTransform = new THREE.Object3D(), partTransform = new THREE.Object3D(), matrix = new THREE.Matrix4();
  return { actors, sync(seconds) {
    for (const actor of actors) {
      actorTransform.position.copy(actor.position); actorTransform.rotation.set(0, actor.rotation, 0); actorTransform.scale.setScalar(actor.scale); actorTransform.updateMatrix();
      for (const part of batches) {
        partTransform.position.set(...(part.pos ?? [0, 0, 0])); partTransform.scale.set(...(part.scale ?? [1, 1, 1])); partTransform.rotation.set(...(part.rotate ?? [0, 0, 0])); part.motion?.(actor, partTransform, seconds); partTransform.updateMatrix();
        matrix.multiplyMatrices(actorTransform.matrix, partTransform.matrix); part.mesh.setMatrixAt(actor.index, matrix);
      }
    }
    for (const part of batches) part.mesh.instanceMatrix.needsUpdate = true;
  } };
}
