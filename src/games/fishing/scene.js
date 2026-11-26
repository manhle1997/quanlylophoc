import * as THREE from 'three';
export function buildLake(game) {
  game.ground('#8eafa5');
  game.mesh('cylinder', '#527f72', [0, -1.4, 0], [13.2, 1.6, 13.2]);
  game.mesh('cylinder', '#a5c99a', [0, -.55, 0], [13.25, .4, 13.25]);
  game.mesh('cylinder', '#8bd6be', [0, -.29, 0], [11.1, .13, 11.1]);
  const water = game.resources.track(new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vPosition;uniform float time;void main(){float r=length(vPosition.xy)/10.8;float wave=sin(vPosition.x*2.5+time*.8)*sin(vPosition.y*3.5-time*.6);float line=smoothstep(.94,1.,sin(vPosition.x*1.5+vPosition.y*2.+time*.8));vec3 deep=vec3(.12,.59,.65);vec3 shallow=vec3(.38,.78,.73);vec3 col=mix(deep,shallow,smoothstep(.1,1.,r));col+=wave*.025+line*.025;gl_FragColor=vec4(col,1.);}',
  }));
  const lake = new THREE.Mesh(game.resources.track(new THREE.CircleGeometry(10.8, 80)), water); lake.rotation.x = -Math.PI / 2; lake.position.y = -.18; lake.receiveShadow = true; game.scene.add(lake);
  for (let i = 0; i < 13; i++) {
    const angle = i / 13 * Math.PI * 2, radius = 12.05;
    if (i % 3 !== 1) game.tree(Math.cos(angle) * radius, Math.sin(angle) * radius, .57 + (i % 3) * .12, ['#6da78a', '#8abc95', '#5d9b88'][i % 3]);
    else game.mesh('rock', '#9cb9ac', [Math.cos(angle) * radius, .02, Math.sin(angle) * radius], [.7, .7, .6]);
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 9.7;
    game.mesh('cylinder', '#72ba91', [Math.cos(a) * r, -.08, Math.sin(a) * r], [.42, .035, .48]);
    if (i % 2 === 0) game.mesh('sphere', '#f4b4cf', [Math.cos(a) * r + .05, .07, Math.sin(a) * r], [.16, .14, .16]);
  }
  // Handcrafted stylized boat with seats, a friendly fisher, rod, float and continuous line.
  const boat = new THREE.Group(); boat.position.set(-2.4, .8, -5.7); boat.rotation.y = -.23; game.scene.add(boat);
  game.mesh('sphere', '#a27150', [0, -.1, 0], [1.25, .55, 2.1], boat);
  game.mesh('sphere', '#d6a879', [0, .16, 0], [1.23, .28, 2.04], boat);
  game.mesh('sphere', '#70574a', [0, .26, 0], [.94, .15, 1.68], boat);
  for (const z of [-.8, .55]) game.mesh('box', '#e3bd8b', [0, .39, z], [1.95, .17, .35], boat);
  game.mesh('box', '#a39ace', [-.1, .9, -.5], [.7, .8, .6], boat);
  game.mesh('sphere', '#ffe0b3', [-.1, 1.68, -.45], [.45, .47, .45], boat);
  game.mesh('cylinder', '#e5b778', [-.1, 2.02, -.45], [.75, .11, .75], boat);
  game.mesh('sphere', '#e8bd7a', [-.1, 2.15, -.45], [.43, .27, .43], boat);
  game.mesh('sphere', '#3b4850', [.19, 1.73, -.13], [.04, .05, .035], boat);
  game.mesh('sphere', '#3b4850', [-.16, 1.73, -.02], [.04, .05, .035], boat);
  const rodCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-2, 2.25, -5.7), new THREE.Vector3(-.8, 4.9, -4.9), new THREE.Vector3(1.1, 4.6, -3.7)]);
  game.scene.add(new THREE.Mesh(game.resources.track(new THREE.TubeGeometry(rodCurve, 20, .045, 6, false)), game.material('#e7ca94')));
  const lineGeometry = game.resources.track(new THREE.BufferGeometry()); lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  const line = new THREE.Line(lineGeometry, game.resources.track(new THREE.LineBasicMaterial({ color: '#edfff0', transparent: true, opacity: .8 }))); line.frustumCulled = false; game.scene.add(line);
  const float = new THREE.Group(); game.scene.add(float); game.mesh('sphere', '#fa9f81', [0, .2, 0], [.21, .24, .21], float); game.mesh('cylinder', '#fff5dc', [0, .02, 0], [.18, .15, .18], float); game.mesh('cylinder', '#d9e6c7', [0, .57, 0], [.025, .6, .025], float);
  const ripple = game.mesh('torus', '#a8f5de', [1.7, -.01, 1.2], [.8, .8, .8], game.scene, { transparent: true, opacity: .55 }); ripple.rotation.x = -Math.PI / 2; ripple.castShadow = false;
  return { water, boat, float, lineGeometry, ripple };
}
