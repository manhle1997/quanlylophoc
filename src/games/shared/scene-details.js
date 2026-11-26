import * as THREE from 'three';

function batch(game, type, color, transforms, options = {}) {
  const mesh = game.resources.track(new THREE.InstancedMesh(game.geometry(type), game.material(color, options), transforms.length));
  const dummy = new THREE.Object3D();
  transforms.forEach(({ position, scale, rotation = [0, 0, 0] }, index) => {
    dummy.position.set(...position); dummy.scale.set(...scale); dummy.rotation.set(...rotation); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.castShadow = false; mesh.receiveShadow = true; game.scene.add(mesh); return mesh;
}

function fishingDetails(game) {
  game.scene.background.set('#c4ddd7'); game.scene.fog.color.set('#c4ddd7'); game.sun.intensity = 3.2;
  const planks = Array.from({ length: 7 }, (_, i) => ({ position: [-7.8, .16, -7.2 + i * .48], scale: [2.9, .16, .4], rotation: [0, -.22, 0] }));
  batch(game, 'box', '#c49365', planks);
  batch(game, 'cylinder', '#896447', [-9.1, -6.5].flatMap(x => [-7.4, -4.2].map(z => ({ position: [x, -.1, z], scale: [.13, 1.3, .13] }))));
  const reeds = [], flowers = [];
  for (let i = 0; i < 24; i++) {
    const a = .25 + i / 24 * Math.PI * 2, r = 11.6 + Math.sin(i * 4) * .3;
    const height = .55 + i % 3 * .17, x = Math.cos(a) * r, z = Math.sin(a) * r;
    reeds.push({ position: [x, height / 2 + .04, z], scale: [.045, height, .045], rotation: [0, 0, Math.sin(i) * .16] });
    flowers.push({ position: [x, height + .08, z], scale: [.13, .16, .13] });
  }
  batch(game, 'cylinder', '#668b55', reeds); batch(game, 'sphere', '#f4d28c', flowers);
  const ripples = Array.from({ length: 5 }, (_, i) => ({ position: [Math.cos(i * 2.4) * 6.8, -.065, Math.sin(i * 2.4) * 6.8], scale: [.55, .55, .55], rotation: [-Math.PI / 2, 0, 0] }));
  const rings = batch(game, 'torus', '#c4f3de', ripples, { transparent: true, opacity: .32, depthWrite: false });
  const dummy = new THREE.Object3D();
  return { update(seconds) {
    ripples.forEach((p, i) => {
      const size = .45 + ((seconds * .22 + i * .2) % 1) * .75;
      dummy.position.set(...p.position); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(size); dummy.updateMatrix(); rings.setMatrixAt(i, dummy.matrix);
    }); rings.instanceMatrix.needsUpdate = true;
  } };
}

function sign(game, text, position, size, { background = '#25334b', color = '#fff5de' } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, 768, 128);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(8, 8, 752, 112);
  ctx.fillStyle = color; ctx.font = '600 52px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 67, 700);
  const texture = game.resources.track(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = game.resources.track(new THREE.PlaneGeometry(...size));
  const material = game.resources.track(new THREE.MeshBasicMaterial({ map: texture }));
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); game.scene.add(mesh); return mesh;
}

function motes(game, color, count, radius, center) {
  const positions = new Float32Array(count * 3), geometry = game.resources.track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(8, 8, 6, 0, Math.PI * 2); ctx.fill();
  const map = game.resources.track(new THREE.CanvasTexture(canvas));
  const material = game.resources.track(new THREE.PointsMaterial({ color, map, size: 3, transparent: true, opacity: .75, depthWrite: false, sizeAttenuation: false }));
  const points = new THREE.Points(geometry, material); points.frustumCulled = false; game.scene.add(points);
  return seconds => {
    const origin = center();
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399 + seconds * .35, r = .5 + i % 7 / 7 * radius;
      positions[i * 3] = origin.x + Math.cos(angle) * r;
      positions[i * 3 + 1] = origin.y + .2 + (i * .17 + seconds * .24) % 2.2;
      positions[i * 3 + 2] = origin.z + Math.sin(angle) * r;
    }
    geometry.attributes.position.needsUpdate = true;
  };
}

function ufoDetails(game) {
  game.scene.background.set('#101d38'); game.scene.fog.color.set('#101d38');
  const stones = Array.from({ length: 18 }, (_, i) => ({ position: [-9.8 + i * 1.12, -.22, 7 + Math.sin(i * .65)], scale: [.4, .07, .3], rotation: [0, i * .3, 0] }));
  batch(game, 'cylinder', '#8d9bad', stones);
  const posts = [-10, -5, 0, 5, 10].map(x => ({ position: [x, 1, -7.3], scale: [.07, 2, .07] }));
  batch(game, 'cylinder', '#a7b7c0', posts);
  const lamps = batch(game, 'sphere', '#c4f5dc', posts.map(p => ({ position: [p.position[0], 2.05, -7.3], scale: [.17, .2, .17] })), { emissive: '#a5edcf', emissiveIntensity: .65 });
  game.mesh('sphere', '#ddc5d9', [9, 9.4, -11], [.85, .85, .85], game.scene, { emissive: '#9b7fac', emissiveIntensity: .3 });
  const planetRing = game.mesh('torus', '#e4d7b7', [9, 9.4, -11], [1.5, 1.5, 1.5]); planetRing.rotation.set(.65, .2, .35);
  game.mesh('sphere', '#bde7b5', [0, .65, .13], [.33, .35, .28], game.ufo);
  for (const x of [-.12, .12]) game.mesh('sphere', '#263d48', [x, .72, .37], [.075, .1, .04], game.ufo);
  game.mesh('cylinder', '#94abae', [0, 1.2, 0], [.025, .65, .025], game.ufo);
  const antenna = game.mesh('sphere', '#f2d499', [0, 1.55, 0], [.12, .12, .12], game.ufo, { emissive: '#caa86b', emissiveIntensity: .5 });
  sign(game, 'TRẠM VŨ TRỤ', [-5, 2.1, -7.9], [3.3, .62], { background: '#464365', color: '#e3f4d9' });
  const center = new THREE.Vector3(0, .2, 0), particles = motes(game, '#acdfd7', 20, 10, () => center);
  return { update(seconds) { particles(seconds); lamps.material.emissiveIntensity = .55 + Math.sin(seconds * 1.2) * .15; antenna.scale.setScalar(.12 + Math.sin(seconds * 1.4) * .01); } };
}

function clawDetails(game) {
  game.scene.background.set('#493646'); game.scene.fog.color.set('#493646');
  const lightStripes = [], darkStripes = [];
  for (let i = 0; i < 10; i++) (i % 2 ? lightStripes : darkStripes).push({ position: [-8.1 + i * 1.8, 7.75, 6.9], scale: [1.8, .27, 1.1] });
  batch(game, 'box', '#fff0df', lightStripes); batch(game, 'box', '#df8eab', darkStripes);
  sign(game, 'GẮP MỘT NIỀM VUI', [0, 8.45, 7.05], [9, 1.05], { background: '#8c4763', color: '#fff3d9' });
  const bulbs = Array.from({ length: 12 }, (_, i) => ({ position: [-8 + i * 1.45, 7.55, 7.5], scale: [.12, .12, .12] }));
  const lights = batch(game, 'sphere', '#ffe3a4', bulbs, { emissive: '#f9c971', emissiveIntensity: .55 });
  batch(game, 'box', '#f2c9b2', [{ position: [7, -.3, 7.7], scale: [2.8, .4, 1.2] }, { position: [7, -.6, 8.5], scale: [3, .25, .65] }]);
  const balloons = [];
  for (const x of [-10.2, 10.2]) for (let i = 0; i < 3; i++) {
    const balloon = game.mesh('sphere', ['#f2bdcd', '#c7bee2', '#f5d9a5'][i], [x + (i - 1) * .45, 3.4 + i % 2 * .7, 2.8], [.38, .51, .38]); balloon.castShadow = false;
    balloons.push({ mesh: balloon, x: balloon.position.x, y: balloon.position.y });
    const string = game.mesh('cylinder', '#d8b9ca', [balloon.position.x, 1.6, 2.8], [.015, 3, .015]); string.castShadow = false;
  }
  return { update(seconds) { lights.material.emissiveIntensity = .5 + Math.sin(seconds * 1.4) * .2; balloons.forEach((b, i) => { b.mesh.position.x = b.x + Math.sin(seconds * .9 + i) * .08; b.mesh.position.y = b.y + Math.sin(seconds + i) * .05; }); } };
}

function marbleDetails(game) {
  game.scene.background.set('#3f3b57'); game.scene.fog.color.set('#3f3b57');
  const seats = [];
  for (let row = 0; row < 3; row++) seats.push({ position: [0, -.2 + row * .3, -10.2 - row * .6], scale: [10.2, .24, .55] });
  batch(game, 'box', '#aab5ca', seats);
  const spectators = Array.from({ length: 18 }, (_, i) => ({ position: [-4.5 + i % 9 * 1.1, .75 + Math.floor(i / 9) * .33, -10.2 - Math.floor(i / 9) * .65], scale: [.17, .22, .17] }));
  batch(game, 'sphere', '#f4d6a3', spectators);
  const flagGeometry = game.resources.track(new THREE.BufferGeometry()); flagGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.3, -.12, 0, 0, -.65, 0], 3)); flagGeometry.computeVertexNormals();
  const flags = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 11.6, z = Math.sin(a) * 10.6;
    const pole = game.mesh('cylinder', '#eadfcd', [x, .7, z], [.04, 3.4, .04]); pole.castShadow = false;
    const flag = new THREE.Mesh(flagGeometry, game.material(['#edacaa', '#9cd3c6', '#e5c77e'][i % 3], { side: THREE.DoubleSide })); flag.position.set(x, 2.3, z); game.scene.add(flag); flags.push(flag);
  }
  const banner = sign(game, 'VỀ ĐÍCH!', [game.finish.x, game.finish.y + 3.1, game.finish.z + .1], [3, .65], { background: '#524374', color: '#fff0c6' });
  banner.rotation.y = Math.atan2(game.track.getTangent(1).x, game.track.getTangent(1).z);
  const cup = new THREE.Group(); cup.position.set(11.1, .1, 3.6); game.scene.add(cup);
  game.mesh('cylinder', '#bb8f4d', [0, .15, 0], [.55, .25, .55], cup);
  game.mesh('cylinder', '#e3bb6d', [0, .65, 0], [.1, 1, .1], cup);
  game.mesh('sphere', '#f1cc7f', [0, 1.35, 0], [.56, .6, .56], cup, { metalness: .35, roughness: .35 });
  for (const x of [-.55, .55]) game.mesh('torus', '#d5ac5a', [x, 1.35, 0], [.32, .4, .32], cup);
  return { update(seconds) { flags.forEach((flag, i) => { flag.rotation.y = Math.sin(seconds * 1.6 + i) * .15; flag.rotation.z = Math.sin(seconds * 1.4 + i) * .035; }); } };
}

function treasureDetails(game) {
  game.scene.background.set('#294044'); game.scene.fog.color.set('#294044');
  game.sun.intensity = 3.1;
  const stones = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, r = 10.7;
    stones.push({ position: [Math.cos(a) * r, -.21, Math.sin(a) * r], scale: [.6, .12, .45], rotation: [0, a, 0] });
  }
  batch(game, 'rock', '#a7b394', stones);
  for (const x of [-7.5, 7.5]) {
    game.mesh('cylinder', '#8a967d', [x, 1, -7.6], [.33, 2.8, .33]);
    game.mesh('cylinder', '#c4c6a0', [x, 2.55, -7.6], [.55, .3, .55]);
    for (let i = 0; i < 4; i++) {
      const leaf = game.mesh('sphere', '#6a9b83', [x + Math.cos(i * Math.PI / 2) * .7, 2.7, -7.6 + Math.sin(i * Math.PI / 2) * .7], [1.2, .11, .25]); leaf.rotation.y = -i * Math.PI / 2; leaf.castShadow = false;
    }
  }
  sign(game, 'ĐẢO KHO BÁU', [0, 4.4, -9.2], [5.9, .73], { background: '#56675b', color: '#f8e5b6' });
  const key = new THREE.Group(); game.scene.add(key);
  game.mesh('torus', '#ffdfa0', [0, .32, 0], [.24, .24, .24], key, { emissive: '#cba65b', emissiveIntensity: .5 });
  game.mesh('box', '#ffdfa0', [0, -.07, 0], [.09, .55, .09], key);
  for (const y of [-.2, -.34]) game.mesh('box', '#ffdfa0', [.1, y, 0], [.25, .08, .08], key);
  const particles = motes(game, '#fbe3a4', game.context.settings.quality === 'low' ? 18 : 32, 1.4, () => game.target);
  return { update(seconds) { key.position.copy(game.target); key.position.y += .4; key.rotation.set(.1, seconds * .7, Math.sin(seconds) * .12); particles(seconds); } };
}

export function createSceneDetails(game, id) {
  if (id === 'fishing') return fishingDetails(game);
  if (id === 'ufo') return ufoDetails(game);
  if (id === 'claw') return clawDetails(game);
  if (id === 'marble') return marbleDetails(game);
  if (id === 'treasure') return treasureDetails(game);
  return { update() {} };
}
