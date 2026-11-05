// Grammar Runner 3D: one job only. Read the sentence, steer into the lane with the right word, run through its arch.
if (!document.createElement('canvas').getContext('webgl2')) location.replace('/games/runner-2d');
import {THREE, makeRenderer, Quality, makeComposer, makeSky, loadAll, inst, play, tintModel, Particles, labelTexture, Sound, reportRun, lexiSession, store, ASSET} from './common.js';

const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LANES = [-2.6, 0, 2.6], SPAWN = 92, GAP_AFTER = 16, WORLD_EVERY = 5, HEARTS = 3;
const ARCH = [{m: 'k_arch_wide_blue', c: '#38a6ff'}, {m: 'k_arch_wide_yellow', c: '#ffc53a'}, {m: 'k_arch_wide_green', c: '#3fdc78'}];

const CATS = {
  s: {name: 'he / she / it + s', rule: 'With he, she or it, the action word gets an -s: she goes, he plays, it runs.'},
  have: {name: 'have or has', rule: 'I, you, we, they have. He, she, it has.'},
  be: {name: 'am, is, are', rule: 'I am. He, she, it is. We, you, they are.'},
  past: {name: 'past tense', rule: 'Yesterday, last night, last week mean the past: go becomes went, kick becomes kicked.'},
  art: {name: 'a or an', rule: 'Use an before a vowel sound (an apple, an umbrella). Use a before other sounds (a cow, a doctor).'},
  prep: {name: 'in, on, at', rule: 'In for months and inside things. On for days and surfaces. At for clock times.'}
};
let BANK = [
  ['s', 'He ___ football every day.', ['plays', 'play', 'playing'], 'He, she, it: add -s. He plays.'],
  ['be', 'They ___ my friends.', ['are', 'is', 'am'], 'They: are.'],
  ['have', 'She ___ a red bag.', ['has', 'have', 'having'], 'She: has.'],
  ['art', 'I ate ___ apple.', ['an', 'a', 'the'], 'Apple starts with a vowel sound: an apple.'],
  ['past', 'Yesterday I ___ to the park.', ['went', 'go', 'goes'], 'Yesterday means the past: go becomes went.'],
  ['prep', 'School starts ___ 9 o\'clock.', ['at', 'in', 'on'], 'At for clock times.']
].map((b, i) => ({id: i, c: b[0], q: b[1], o: b[2], r: b[3]}));
// Never show a sentence with these words, even if the word list has one.
const UNSAFE = /\b(shit\w*|fuck\w*|crap|ass|asses|arse|bitch\w*|bastard|breasts?|boobs?|sex\w*|naked|piss\w*|dick|penis|butt|horny|nude|porn\w*|slut|whore|damn|hell|kill\w*|murder\w*|drunk|beer|wine|drugs?|guns?|suicide|blood\w*|rape\w*)\b/i;

import {Terrain, SHAPES, terrainMaterial, grassBlades, scatterGrass, makeRocks, scatterRocks, Smoke, loadSky, tex, shared, noise} from './worlds.js';

// Each world is built from real photographs: a photo sky, photo-scanned ground and rock, and light that matches the sky.
// Textures not yet supplied fall back to the closest one we have (see TEX below).
const WORLDS = [
  {id: 'meadow', name: 'Sunny Meadow', edge: '#ffd84a', shape: 'meadow', sky: {id: 'meadow'}, exp: 0.95, env: 1.5, sun: '#fff1dc', sunI: 3.2, hemi: ['#cfe3ff', '#4a3f2a', 0.25], fog: [60, 260],
    ground: {a: 'grass', sa: 0.16, ca: '#c8dc8c', b: 'rock', sb: 0.07, cb: '#ffffff', slope: [0.45, 0.75]}, path: {a: 'trail', sa: 0.24, ca: '#ffffff'},
    grass: {base: '#3f5c22', tip: '#8aa04a', h: 0.4, width: 22, spread: 1.5}, rocks: {n: 7, size: 0.3, width: 20, min: 5}, post: 'stone', fx: 'pollen', music: 0},
  {id: 'canyon', name: 'Red Canyon', edge: '#ff7b2c', shape: 'canyon', sky: {id: 'canyon', fallback: {tint: [1.25, 0.85, 0.6], sat: 0.8}}, exp: 1.0, env: 2.0, sun: '#ffe2bc', sunI: 3.6, hemi: ['#ffe0b8', '#a0623a', 0.7], fog: [70, 280], fogTint: '#d9a37a',
    ground: {a: 'sand', sa: 0.13, ca: '#ecd2b4', b: 'rock', sb: 0.1, cb: '#f0ad7c', slope: [0.12, 0.3], strata: true}, path: {a: 'sand', sa: 0.2, ca: '#ecd2b4'},
    grass: null, rocks: {n: 34, size: 0.55, width: 7, min: 4.9}, post: 'stone', fx: 'dust', music: 1},
  {id: 'ice', name: 'Glacier', edge: '#6ff0ff', shape: 'ice', sky: {id: 'ice', fallback: {tint: [0.85, 0.95, 1.15], sat: 0.25, bright: 1.1}}, exp: 0.85, env: 1.3, sun: '#f2f6ff', sunI: 2.6, hemi: ['#e6f0ff', '#8aa6c8', 0.35], fog: [55, 230], fogTint: '#cbd9e6',
    ground: {a: 'snow', sa: 0.2, ca: '#ffffff', b: 'ice2', sb: 0.2, slope: [0.45, 0.75], ice: true, deep: '#4a8ab0'}, path: {a: 'ice3', sa: 0.16, ca: '#d4ecff', rough: 0.18},
    grass: null, post: 'ice', fx: 'snow', music: 2},
  {id: 'lava', name: 'Volcano', edge: '#ff4d1a', shape: 'lava', sky: {id: 'lava', tint: [0.62, 0.5, 0.46], sat: 0.5, bright: 0.5, fallback: {tint: [0.9, 0.35, 0.25], sat: 0.4, bright: 0.35}}, exp: 1.1, env: 0.8, sun: '#ffb27a', sunI: 1.4, hemi: ['#ff9a6a', '#ff5a1a', 0.45], fog: [35, 190], fogColor: '#2d1812',
    ground: {a: 'basalt', sa: 0.12, ca: '#8a817a', b: 'basalt', sb: 0.07, cb: '#6a625c', slope: [0.4, 0.7], lava: true, cracks: true, lavaLevel: -0.55}, path: {a: 'basalt', sa: 0.2, ca: '#8d8580', lava: true, cracks: true, lavaLevel: -5},
    grass: null, rocks: {n: 26, size: 0.55, width: 10, min: 5}, post: 'basalt', fx: 'embers', smoke: true, volcano: true, ribbon: 0.35, music: 3},
  {id: 'moon', name: 'The Moon', edge: '#b9c8ff', shape: 'moon', sky: {id: 'moon', fallback: {photo: 0, stars: 1, top: '#000004', bottom: '#05060c'}}, exp: 1.0, env: 0.1, sun: '#ffffff', sunI: 3.6, hemi: ['#9aa6c0', '#000000', 0.08], fog: [400, 1200], fogColor: '#000000',
    ground: {a: 'regolith', sa: 0.12, ca: '#c9c7c2', b: 'regolith', sb: 0.07, cb: '#9a9893', slope: [0.4, 0.7], desat: 1}, path: {a: 'regolith', sa: 0.25, ca: '#b9b7b2', desat: 1},
    grass: null, rocks: {n: 30, size: 0.5, width: 26, min: 5}, post: 'metal', fx: 'none', earth: true, ribbon: 0.6, music: 4}
];
// Real texture files (CC0 Poly Haven / ambientCG, three.js examples). The fallback is used until the file is added.
const TEX = {
  grass: ['aerial_grass_rock_diff_1k.jpg'], rock: ['rock_face_diff_1k.jpg', 'dirt'], trail: ['rocky_trail_diff_1k.jpg', 'dirt'], sand: ['red_sand_diff_1k.jpg', 'sandcanvas'],
  snow: ['snow_field_aerial_diff_1k.jpg', 'snowcanvas'], ice2: ['Ice002_1K-JPG_Color.jpg'], ice3: ['Ice003_1K-JPG_Color.jpg'], basalt: ['rock_face_diff_1k.jpg', 'basaltcanvas'], regolith: ['aerial_ground_rock_diff_1k.jpg', 'dirt']
};
const HAVE = new Set(window.LEXI_TEX || []);
// Relief for each photo: small normal maps (512px), one per ground type.
const NOR = {grass: 'aerial_grass_rock_nor.jpg', rock: 'rock_face_nor.jpg', basalt: 'rock_face_nor.jpg', trail: 'rocky_trail_nor.jpg', sand: 'red_sand_nor.jpg', snow: 'snow_field_aerial_nor.jpg', ice2: 'Ice002_1K-JPG_NormalGL.jpg', regolith: 'aerial_ground_rock_nor.jpg'};
const NX = key => NOR[key] && HAVE.has(NOR[key]) ? tex(NOR[key], false) : null;
function canvasTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const base = {dirt: [150, 120, 90], sandcanvas: [200, 120, 80], snowcanvas: [235, 240, 248], basaltcanvas: [70, 66, 64]}[kind] || [128, 128, 128];
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, 512, 512); let r = 9; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1400; i++) { const x = rnd() * 512, y = rnd() * 512, s = 3 + rnd() * 30, v = (rnd() - 0.5) * 50; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(${base.map(b => Math.max(0, Math.min(255, b + v))).join(',')},.6)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2); }
  for (let i = 0; i < 3000; i++) { const v = (rnd() - 0.5) * 80; g.fillStyle = `rgba(${base.map(b => Math.max(0, Math.min(255, b + v))).join(',')},.7)`; g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const canvasCache = {};
function TX(key) { const [file, fb] = TEX[key]; if (HAVE.has(file) || !fb) return tex(file); if (/\.(jpg|png)$/.test(fb)) { const t = tex(fb); t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; return t; } return canvasCache[fb] || (canvasCache[fb] = canvasTex(fb)); }

/* ---------------- setup ---------------- */
const canvas = $('game');
const {renderer, startTier} = makeRenderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 3000);
const {composer, bloom} = makeComposer(renderer, scene, camera);
const app = {renderer, scene, bloom, composer, sun: null, beforeApply: t => { shared.lite = t === 0; }};
scene.fog = new THREE.Fog('#c3d3da', 60, 260);
const hemi = new THREE.HemisphereLight('#d4ecff', '#6b5a3c', 0.3); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d2', 2.6); sun.castShadow = true;
Object.assign(sun.shadow.camera, {left: -18, right: 18, top: 22, bottom: -26, near: 1, far: 120}); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target); app.sun = sun;
const sparks = new Particles(scene, 1600, true), confetti = new Particles(scene, 900, false, true), ambient = new Particles(scene, 700, true), snowfall = new Particles(scene, 900, false);
snowfall.mat.blending = THREE.NormalBlending; snowfall.mat.transparent = true; snowfall.mat.depthWrite = false;
app.resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); bloom.resolution.set(w / 2, h / 2); camera.aspect = w / h; camera.fov = w / h < 1 ? 74 : 58; camera.updateProjectionMatrix(); sparks.mat.uniforms.scale.value = h * 0.6; confetti.mat.uniforms.scale.value = h * 0.38; ambient.mat.uniforms.scale.value = h * 0.6; snowfall.mat.uniforms.scale.value = h * 0.6; };
const quality = new Quality(app, store.get('lexi3d-tier', startTier));
quality.locked = store.get('lexi3d-tier-manual', 0) === 1;
addEventListener('resize', app.resize); app.resize();
const sfx = new Sound();
let A = null, sky = null;
const mixers = new Set();

/* ---------------- terrain, grass, effects ---------------- */
const SEG = 24;
const terrain = new Terrain(scene, {seg: SEG, count: 9});
const GRASS_N = [900, 1800, 2800];
const ROCKS_MAX = 40;
terrain.chunks.forEach(c => { c.grass = grassBlades(GRASS_N[2]); c.grp.add(c.grass); c.rocks = makeRocks(ROCKS_MAX); c.rocks.count = 0; c.grp.add(c.rocks); });
let K = WORLDS[0], groundMat = null, pathMat = null;
const matCache = {};
terrain.onBuild = c => {
  if (K.rocks) { c.rocks.visible = true; c.rocks.material = matCache[K.id].rock; c.rocks.count = Math.round(K.rocks.n * [0.4, 0.7, 1][quality.tier]); scatterRocks(c.rocks, terrain.shape, c.zAbs, SEG, K.rocks); } else c.rocks.visible = false;
  if (!K.grass) { c.grass.visible = false; return; }
  c.grass.visible = true; c.grass.count = GRASS_N[quality.tier]; scatterGrass(c.grass, terrain.shape, c.zAbs, SEG, K.grass);
};
// Coloured lane ribbons on the path: only while a question is waiting, so the choice is easy to see.
const laneRibbons = LANES.map((x, i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1, 1, 1), new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {col: {value: new THREE.Color(ARCH[i].c)}, on: {value: 0}, sel: {value: 0}, time: {value: 0}, gain: {value: 1}},
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 col; uniform float on, sel, time, gain; varying vec2 vU; void main(){ float edge = smoothstep(0.0,0.25,vU.x)*smoothstep(1.0,0.75,vU.x); float far = smoothstep(0.0,0.08,vU.y)*smoothstep(1.0,0.9,vU.y); float a = edge*far*on*(0.01 + sel*0.07)*gain; gl_FragColor = vec4(col*a, 1.0); }'}));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, 0); scene.add(m); return m;
});
const smoke = new Smoke(scene, null, 60);
let volcanoes = [], earth = null;
function buildVolcanoes() {
  // two distant volcanic cones with glowing lava streaks and a smoke plume
  [[-110, -360, 70], [150, -520, 95]].forEach(([x, z, h]) => {
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, r = (1 - t) * h * 1.6 + h * 0.12; pts.push(new THREE.Vector2(r, t * h - (t > 0.92 ? (t - 0.92) * h * 1.5 : 0))); }
    const g = new THREE.LatheGeometry(pts, 48); const p = g.attributes.position, ap = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), n = noise(px * 0.05, pz * 0.05) * 0.12 + noise(Math.atan2(pz, px) * 6, py * 0.08) * 0.08; p.setX(i, px * (1 + n)); p.setZ(i, pz * (1 + n)); ap[i * 3] = px * 0.6; ap[i * 3 + 1] = py * 0.6 - h * 0.45; ap[i * 3 + 2] = pz * 0.6; }
    g.setAttribute('apos', new THREE.BufferAttribute(ap, 3)); g.computeVertexNormals();
    const mat = terrainMaterial({id: 'volc', a: TX('basalt'), b: TX('basalt'), sa: 0.05, sb: 0.03, ca: '#4a4240', cb: '#3a3432', slope: [0.4, 0.8], lava: true, cracks: true, lavaLevel: -h * 0.2, lavaTex: tex('lavatile.jpg'), cloudTex: tex('cloud.png', false)});
    const m = new THREE.Mesh(g, mat); m.position.set(x, -4, z); m.visible = false; scene.add(m);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(h * 0.09, 24), new THREE.MeshBasicMaterial({color: new THREE.Color(2.2, 0.6, 0.12), fog: false, transparent: true, opacity: 0.85})); glow.rotation.x = -Math.PI / 2; glow.position.set(x, h - 4.6, z); glow.visible = false; scene.add(glow);
    volcanoes.push({m, glow, x, z, h});
  });
}
function buildEarth() {
  const g = new THREE.Group();
  const e = new THREE.Mesh(new THREE.SphereGeometry(55, 64, 32), new THREE.MeshStandardMaterial({map: tex('earth_atmos_2048.jpg', true, false), roughness: 0.75, metalness: 0, fog: false}));
  const c = new THREE.Mesh(new THREE.SphereGeometry(55.6, 64, 32), new THREE.MeshStandardMaterial({map: tex('earth_clouds_1024.png', true, false), transparent: true, depthWrite: false, fog: false}));
  const atm = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.3,0.6,1.0)*f*0.7, 1.0); }'}));
  g.add(e, c, atm); g.position.set(-240, 235, -900); g.rotation.set(0.35, -1.2, 0.2); g.visible = false; scene.add(g); earth = {g, c};
}
// Gate: two stone (or ice, or metal) posts with a cross beam and a painted word board in the lane's colour.
const postMats = {};
function postMat(kind) {
  if (postMats[kind]) return postMats[kind];
  const t = kind === 'ice' ? TX('ice2') : kind === 'basalt' ? TX('basalt') : kind === 'metal' ? null : TX('rock');
  const m = kind === 'metal' ? new THREE.MeshStandardMaterial({color: '#c7c9cc', metalness: 0.85, roughness: 0.35})
    : kind === 'ice' ? new THREE.MeshPhysicalMaterial({map: t, color: '#bfe4ff', roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1})
    : new THREE.MeshStandardMaterial({map: t, color: kind === 'basalt' ? '#d8cdc3' : '#ffffff', roughness: 0.9});
  return postMats[kind] = m;
}
const postGeo = new THREE.CylinderGeometry(0.16, 0.22, 3.1, 10, 4), beamGeo = new THREE.BoxGeometry(2.75, 0.26, 0.32), boardGeo = new THREE.BoxGeometry(2.4, 0.78, 0.08), bandGeo = new THREE.CylinderGeometry(0.235, 0.235, 0.22, 12);
(() => { const p = postGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)), n = 1 + noise(a * 2, y * 2.5) * 0.12; p.setX(i, p.getX(i) * n); p.setZ(i, p.getZ(i) * n); } postGeo.computeVertexNormals(); const u = postGeo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * 1.2, u.getY(i) * 2.6); const b = beamGeo.attributes.uv; for (let i = 0; i < b.count; i++) b.setXY(i, b.getX(i) * 2.4, b.getY(i) * 0.35); })();

/* ---------------- player ---------------- */
let fox, foxR, shadowBlob;
function buildFox() {
  foxR = inst(A.models, 'fox', 2.3, {axis: 'z'}); fox = new THREE.Group(); fox.add(foxR.obj);
  foxR.obj.rotation.y = Math.PI; scene.add(fox); mixers.add(foxR.mixer); play(foxR, 'run', {speed: 1.2});
  furCoat(foxR.obj);
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; { const x = sc.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0.55, depthWrite: false})); shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.05; scene.add(shadowBlob);
}

// The fox model has one flat colour per facet. Smooth normals across the facets, then grow short fur as shells:
// copies of the mesh pushed out along the normals, each with fewer strands. Skinned, so the fur moves with the run.
const FUR_SHELLS = [0, 5, 9], furLayers = [];
function furCoat(root) {
  const skinned = []; root.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  for (const m of skinned) {
    const g = m.geometry, p = g.attributes.position, n = new Float32Array(p.count * 3), acc = new Map(), idx = g.index, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const key = i => `${Math.round(p.getX(i) * 50)},${Math.round(p.getY(i) * 50)},${Math.round(p.getZ(i) * 50)}`, tris = (idx ? idx.count : p.count) / 3;
    for (let t = 0; t < tris; t++) { const i = idx ? idx.getX(t * 3) : t * 3, j = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, k = idx ? idx.getX(t * 3 + 2) : t * 3 + 2; a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, j).sub(a); c.fromBufferAttribute(p, k).sub(a); b.cross(c);
      for (const v of [i, j, k]) { const K = key(v), e = acc.get(K) || [0, 0, 0]; e[0] += b.x; e[1] += b.y; e[2] += b.z; acc.set(K, e); } }
    for (let i = 0; i < p.count; i++) { const e = acc.get(key(i)), L = Math.hypot(e[0], e[1], e[2]) || 1; n[i * 3] = e[0] / L; n[i * 3 + 1] = e[1] / L; n[i * 3 + 2] = e[2] / L; }
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    g.computeBoundingBox(); const size = g.boundingBox.getSize(new THREE.Vector3()).length(), base = m.material;
    base.flatShading = false; base.roughness = 0.95; base.color.setScalar(0.5); base.needsUpdate = true;
    const N = FUR_SHELLS[2], len = size * 0.016, cell = size * 0.0038;
    for (let s = 1; s <= N; s++) {
      const mat = base.clone(), f = s / N; mat.color.setScalar(0.5 + 0.36 * f); mat.flatShading = false;
      mat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, {furH: {value: f * len}, furF: {value: f}, furC: {value: 1 / cell}});
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float furH; varying vec3 vFur;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFur = position; transformed += normal * furH;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float furF, furC; varying vec3 vFur;').replace('#include <map_fragment>', `#include <map_fragment>
          float furH0 = fract(sin(dot(floor(vFur * furC), vec3(12.9898, 78.233, 37.719))) * 43758.5453); if (furH0 < furF * 0.92) discard;`);
      };
      mat.customProgramCacheKey = () => 'fur';
      const sm = new THREE.SkinnedMesh(g, mat); sm.bind(m.skeleton, m.bindMatrix); sm.frustumCulled = false; sm.castShadow = false; sm.receiveShadow = false; m.parent.add(sm); furLayers.push(sm);
    }
  }
}

/* ---------------- state ---------------- */
let S = null, mode = 'loading', paused = false, sprint = false;
const objs = [];
function newRun() {
  objs.forEach(o => scene.remove(o.obj)); objs.length = 0;
  S = {world: 0, lap: 0, dist: 0, nextAt: 22, score: 0, hearts: HEARTS, correct: 0, wrong: 0, total: 0, streak: 0, best: 0, lane: 1, x: 0, y: 0, vy: 0,
    worldCorrect: 0, portalPending: false, gate: null, misses: {}, missed: [], recent: [], reported: false, shake: 0, kick: 0, stumble: 0, hideCueAt: 0};
  setWorld(0);
  fox.rotation.set(0, 0, 0);
}
// Calm, steady speed. It rises a little per world. Holding Up lets confident players sprint to the arch.
function speed() {
  let v = 9.5 + (S.world % 5) * 0.7 + S.lap * 1.2;
  if (sprint && S.gate && !S.gate.done) v *= 2.3;
  if (S.stumble > 0) v *= 0.5;
  return v;
}

/* ---------------- questions ---------------- */
function pickQuestion() {
  const cats = Object.keys(CATS), w = cats.map(c => 1 + 2 * (S.misses[c] || 0)), tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot, cat = cats[0]; for (let i = 0; i < cats.length; i++) { r -= w[i]; if (r <= 0) { cat = cats[i]; break; } }
  let pool = BANK.filter(b => b.c === cat && !S.recent.includes(b.id)); if (!pool.length) pool = BANK.filter(b => !S.recent.includes(b.id)); if (!pool.length) pool = BANK;
  const q = pool[(Math.random() * pool.length) | 0]; S.recent.push(q.id); if (S.recent.length > 30) S.recent.shift(); return q;
}
// A faint coloured light between the posts, brighter in the lane you are in
const portalMat = c => new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: {time: {value: 0}, col: {value: new THREE.Color(c)}, sel: {value: 0}, gain: {value: K.ribbon ?? 1}},
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform float time, sel, gain; uniform vec3 col; varying vec2 vU; void main(){ vec2 p = vU-0.5; float e = smoothstep(0.5,0.38,abs(p.x)); float s = 0.5+0.5*sin(vU.y*9.0 - time*3.0); float a = gain*e*(0.04 + sel*(0.12+0.06*s))*smoothstep(1.0,0.2,vU.y); gl_FragColor = vec4(col*a, 1.0); }'});
function makeGate(i, word) {
  const g = new THREE.Group(), pm = postMat(K.post), x = LANES[i];
  [-1.17, 1.17].forEach(dx => { const p = new THREE.Mesh(postGeo, pm); p.position.set(x + dx, 1.55, 0); p.castShadow = true; p.receiveShadow = true; g.add(p);
    const band = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({color: ARCH[i].c, roughness: 0.6})); band.position.set(x + dx, 2.55, 0); g.add(band); });
  const beam = new THREE.Mesh(beamGeo, pm); beam.position.set(x, 3.15, 0); beam.castShadow = true; g.add(beam);
  const board = new THREE.Mesh(boardGeo, [new THREE.MeshStandardMaterial({color: ARCH[i].c, roughness: 0.7}), new THREE.MeshStandardMaterial({color: ARCH[i].c, roughness: 0.7}), new THREE.MeshStandardMaterial({color: ARCH[i].c}), new THREE.MeshStandardMaterial({color: ARCH[i].c}),
    new THREE.MeshBasicMaterial({map: labelTexture(word, {bg: ARCH[i].c, border: '#231a45', fg: '#231a45', fs: 112}), toneMapped: false, fog: false}), new THREE.MeshStandardMaterial({color: ARCH[i].c})]);
  board.position.set(x, 3.75, 0.02); board.castShadow = true; g.add(board);
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.0), portalMat(ARCH[i].c)); portal.position.set(x, 1.5, 0); g.add(portal);
  return {arch: g, portal, pm: portal.material, sign: board, h: 3.2};
}
function spawnGate() {
  const q = pickQuestion(), opts = q.o.slice(); for (let i = opts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [opts[i], opts[j]] = [opts[j], opts[i]]; }
  const g = new THREE.Group(); const parts = [];
  for (let i = 0; i < 3; i++) { const p = makeGate(i, opts[i]); g.add(p.arch); parts.push(p); }
  g.position.z = -SPAWN; scene.add(g);
  const o = {kind: 'gate', obj: g, q, opts, ans: opts.indexOf(q.o[0]), parts, done: false};
  objs.push(o); S.gate = o; showCue(o); sfx.tone(660, 0.12, {type: 'triangle', vol: 0.1}); sfx.tone(880, 0.16, {type: 'triangle', vol: 0.1, at: 0.08});
}
function spawnPortal() {
  const nextW = WORLDS[(S.world + 1) % 5]; const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.28, 16, 96), new THREE.MeshStandardMaterial({color: '#222', metalness: 0.9, roughness: 0.3, emissive: nextW.edge, emissiveIntensity: 1.2})); ring.position.y = 2.6; g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.0, 64), new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: {time: {value: 0}, col: {value: new THREE.Color(nextW.edge)}},
    vertexShader: 'varying vec2 vU; void main(){ vU = uv-0.5; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float time; uniform vec3 col; varying vec2 vU; void main(){ float r = length(vU)*2.0; float a = atan(vU.y,vU.x); float s = 0.5+0.5*sin(a*5.0 + r*10.0 - time*3.0); vec3 c = col*(0.15+s*0.35)*(1.0-r*0.7) + vec3(1.0)*smoothstep(0.4,0.0,r)*0.5; gl_FragColor = vec4(c, 1.0); }'}));
  disc.position.y = 2.6; g.add(disc);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.25), new THREE.MeshBasicMaterial({map: labelTexture('To ' + nextW.name, {w: 768, h: 160, border: nextW.edge, fs: 92}), transparent: true, fog: false, toneMapped: false})); sign.position.set(0, 8.6, 0); g.add(sign);
  g.position.z = -SPAWN; scene.add(g); objs.push({kind: 'portal', obj: g, disc, ring});
  loadSky(renderer, WORLDS[(S.world + 1) % 5].sky.id); // fetch the next sky while running
}

/* ---------------- worlds ---------------- */
function worldMats(W) {
  if (matCache[W.id]) return matCache[W.id];
  const gr = W.ground, pa = W.path, lavaT = gr.lava ? tex('lavatile.jpg') : null, cloudT = gr.lava ? tex('cloud.png', false) : null; // only the volcano downloads these
  const ground = terrainMaterial({id: W.id + 'g', a: TX(gr.a), b: TX(gr.b), sa: gr.sa, sb: gr.sb, na: NX(gr.a), nb: NX(gr.b), desat: gr.desat, ca: gr.ca, cb: gr.cb, slope: gr.slope, strata: gr.strata, ice: gr.ice, deep: gr.deep, lava: gr.lava, cracks: gr.cracks, lavaLevel: gr.lavaLevel, lavaTex: lavaT, cloudTex: cloudT});
  const path = terrainMaterial({id: W.id + 'p', a: TX(pa.a), sa: pa.sa, na: NX(pa.a), desat: pa.desat, ca: pa.ca, slope: [2, 3], rough: pa.rough ?? 0.92, lava: pa.lava, cracks: pa.cracks, lavaLevel: pa.lavaLevel, lavaTex: lavaT, cloudTex: cloudT});
  if (W.id === 'ice') { path.normalMap = tex('Ice002_1K-JPG_NormalGL.jpg', false); path.normalScale.set(0.6, 0.6); path.metalness = 0.05; }
  const rk = gr.b, rock = terrainMaterial({id: W.id + 'r', rockInst: true, a: TX(rk), b: TX(rk), sa: gr.sb * 4, sb: gr.sb * 4, na: NX(rk), nb: NX(rk), desat: gr.desat, ca: gr.cb, cb: gr.cb, slope: [2, 3]});
  return matCache[W.id] = {ground, path, rock};
}
let worldToken = 0;
async function setWorld(i) {
  const W = WORLDS[i % 5]; K = W; const tok = ++worldToken;
  const mats = worldMats(W); terrain.setWorld(SHAPES[W.shape], mats.ground, mats.path); terrain.reset(S ? S.dist : 0);
  scene.environmentIntensity = W.env; renderer.toneMappingExposure = W.exp;
  sun.color.set(W.sun); sun.intensity = W.sunI; hemi.color.set(W.hemi[0]); hemi.groundColor.set(W.hemi[1]); hemi.intensity = W.hemi[2];
  if (W.volcano && !volcanoes.length) buildVolcanoes(); if (W.earth && !earth) buildEarth(); // built (and downloaded) on first visit
  volcanoes.forEach(v => { v.m.visible = v.glow.visible = !!W.volcano; }); if (earth) earth.g.visible = !!W.earth;
  if (!W.smoke) smoke.hide();
  laneRibbons.forEach(r => r.material.uniforms.gain.value = W.ribbon ?? 1);
  if (W.grass) terrain.chunks.forEach(c => { const u = c.grass.material.userData.uniforms; u.base.value.set(W.grass.base); u.tip.value.set(W.grass.tip); });
  scene.fog.near = W.fog[0]; scene.fog.far = W.fog[1];
  sfx.key = W.music; sfx.bpm = 108 + (i % 5) * 4;
  document.documentElement.style.setProperty('--edge', W.edge);
  // sky: the world's own photo if we have it, otherwise the meadow photo recoloured
  const own = await loadSky(renderer, W.sky.id), base = own.bg ? own : await loadSky(renderer, 'meadow');
  if (tok !== worldToken) return;
  const look = own.bg ? W.sky : Object.assign({}, W.sky, W.sky.fallback || {});
  const u = sky.material.uniforms; u.map.value = base.bg; u.photo.value = look.photo ?? 1; u.tint.value.setRGB(...(look.tint || [1, 1, 1])); u.sat.value = look.sat ?? 1; u.bright.value = look.bright ?? 1; u.stars.value = look.stars ?? 0;
  if (look.top) { u.top.value.set(look.top); u.bottom.value.set(look.bottom); }
  scene.environment = (own.env || base.env);
  const meta = own.meta || base.meta;
  const fogCol = new THREE.Color(W.fogColor || (own.bg && meta ? meta.horizon : W.fogTint || (meta && meta.horizon) || '#c3d3da'));
  if (!W.fogColor && !own.bg && look.tint) fogCol.multiply(new THREE.Color(...look.tint)).multiplyScalar(look.bright ?? 1);
  scene.fog.color.copy(fogCol);
  sunDir.set(...(own.bg && meta && meta.sun[1] > 0.12 ? meta.sun : [-0.45, 0.62, 0.35])).normalize();
}
const sunDir = new THREE.Vector3(-0.45, 0.62, 0.35);
function nextWorld() {
  S.world++; if (S.world % 5 === 0) S.lap++;
  flash('#ffffff'); sfx.whoosh();
  objs.filter(o => o.kind !== 'portal').forEach(o => scene.remove(o.obj));
  for (let k = objs.length - 1; k >= 0; k--) if (objs[k].kind !== 'portal') objs.splice(k, 1);
  setWorld(S.world);
  S.worldCorrect = 0; S.portalPending = false; S.nextAt = S.dist + 26;
  const healed = S.hearts < HEARTS; S.hearts = Math.min(HEARTS, S.hearts + 1);
  banner(`World ${S.world % 5 + 1}${S.lap ? ' · Lap ' + (S.lap + 1) : ''}`, WORLDS[S.world % 5].name + (healed ? ' · +1 heart' : ''));
  if (S.world > store.get('gr3d-best-world')) store.set('gr3d-best-world', S.world);
  paintHud();
}

/* ---------------- HUD ---------------- */
// The sentence card fills the gap with the word in the lane you are in, so you read the whole sentence before choosing.
function showCue(o) {
  const c = $('cue'); c.hidden = false; c.classList.remove('ok', 'bad', 'in'); void c.offsetWidth; c.classList.add('in'); $('cueMark').hidden = true;
  const [a, b] = o.q.q.split('___'); const t = $('cueText'); t.textContent = '';
  t.append(a || ''); const blank = document.createElement('span'); blank.className = 'blank'; t.append(blank, b || '');
  const ch = $('cueOpts'); ch.textContent = '';
  o.opts.forEach((w, i) => { const s = document.createElement('span'); s.className = 'opt'; s.style.setProperty('--c', ARCH[i].c); const k = document.createElement('kbd'); k.textContent = i + 1; s.append(k, w); ch.append(s); });
  $('cueTag').textContent = CATS[o.q.c].name;
  o.blank = blank; o.shownLane = -1; previewLane(o);
}
function previewLane(o) {
  const l = S.lane; if (!o || o.done || o.shownLane === l) return; o.shownLane = l;
  o.blank.textContent = o.opts[l]; o.blank.style.setProperty('--c', ARCH[l].c);
  [...$('cueOpts').children].forEach((s, i) => s.classList.toggle('sel', i === l));
}
function resolveCue(o, ok) {
  const c = $('cue'); c.classList.add(ok ? 'ok' : 'bad'); o.blank.textContent = o.q.o[0]; o.blank.style.removeProperty('--c');
  [...$('cueOpts').children].forEach((s, i) => { s.classList.toggle('right', i === o.ans); s.classList.remove('sel'); });
  const mark = $('cueMark'); mark.textContent = ok ? 'Right!' : 'Not quite'; mark.hidden = false;
}
function hideCue() { $('cue').hidden = true; $('cueMark').hidden = true; }
function paintHud() {
  $('score').textContent = S.score.toLocaleString();
  const h = $('hearts'); h.textContent = ''; for (let i = 0; i < HEARTS; i++) { const e = document.createElement('i'); if (i >= S.hearts) e.className = 'gone'; h.append(e); }
  const p = $('progress'); p.textContent = ''; for (let i = 0; i < WORLD_EVERY; i++) { const e = document.createElement('i'); if (i < S.worldCorrect) e.className = 'on'; p.append(e); }
  $('worldName').textContent = `World ${S.world % 5 + 1} · ${WORLDS[S.world % 5].name}`;
  const m = S.streak >= 6 ? 3 : S.streak >= 3 ? 2 : 1; const cb = $('streak'); cb.textContent = S.streak >= 2 ? `${S.streak} in a row${m > 1 ? ' · points x' + m : ''}` : ''; cb.dataset.lvl = m;
}
function popScore(text, color) { const p = document.createElement('div'); p.className = 'pop'; p.textContent = text; p.style.color = color || '#fff4dc'; $('pops').append(p); setTimeout(() => p.remove(), 1100); }
function banner(a, b) { const el = $('banner'); $('bannerA').textContent = a; $('bannerB').textContent = b; el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); clearTimeout(banner.t); banner.t = setTimeout(() => el.hidden = true, 2600); }
function flash(c) { const f = $('flash'); f.style.background = c; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

/* ---------------- answering ---------------- */
function resolveGate(o) {
  o.done = true; const pick = S.lane, ok = pick === o.ans; S.total++;
  const P = o.parts[pick], wp = new THREE.Vector3(LANES[pick], 1.6, o.obj.position.z);
  if (ok) {
    S.correct++; S.worldCorrect++; S.streak++; S.best = Math.max(S.best, S.streak);
    const mult = S.streak >= 6 ? 3 : S.streak >= 3 ? 2 : 1, pts = 100 * mult * (S.lap + 1); S.score += pts; popScore('+' + pts, ARCH[pick].c);
    confetti.emit(wp, 40, {colors: [ARCH[pick].c, '#ffffff', '#ffd84a', '#ff7bb0'], speed: 10, life: 1.6, size: 0.16, gravity: -7, drag: 1.4, radius: 2});
    sparks.emit(wp, 22, {colors: [ARCH[pick].c, '#ffffff'], speed: 8, life: 0.5, size: 0.22, gravity: -2});
    sfx.good(); P.arch.visible = false; P.portal.visible = false; P.sign.visible = false; S.kick = 1; S.vy = 6.5; S.y = 0.001;
    if (S.streak === 3 || S.streak === 6) banner(S.streak === 3 ? '3 in a row!' : '6 in a row!', S.streak === 3 ? 'Points x2' : 'Points x3');
    resolveCue(o, true);
  } else {
    S.wrong++; S.streak = 0; S.hearts--; S.misses[o.q.c] = (S.misses[o.q.c] || 0) + 1; S.missed.push(o.q);
    sparks.emit(wp, 90, {colors: ['#ff4d5e', '#ff9a2f', '#ffffff'], speed: 7, life: 0.8, size: 0.45, gravity: -6});
    P.pm.uniforms.col.value.set('#ff3b4e'); o.parts[o.ans].pm.uniforms.sel.value = 1.5;
    sfx.bad(); S.shake = 0.25; S.stumble = 0.5; flash('rgba(255,40,60,.3)');
    resolveCue(o, false);
    if (S.hearts > 0) explain(o, pick);
  }
  laneRibbons.forEach(r => r.material.uniforms.on.value = 0);
  o.parts.forEach(pp => pp.sign.visible = false); o.fade = 0; // the arches you did not take shrink away
  // what comes next: another question, or the portal to the next world
  if (ok && S.worldCorrect >= WORLD_EVERY) S.portalPending = true;
  S.nextAt = S.dist + GAP_AFTER; S.hideCueAt = S.dist + 9;
  paintHud();
  if (S.hearts <= 0) gameOver();
}
function explain(o, pick) {
  paused = true; mode = 'explain';
  const [a, b] = o.q.q.split('___'); const t = $('exSentence'); t.textContent = ''; t.append(a || ''); const m = document.createElement('mark'); m.textContent = o.q.o[0]; t.append(m, b || '');
  $('exYou').textContent = o.opts[pick]; $('exRule').textContent = o.q.r;
  $('explain').hidden = false; setTimeout(() => $('exOk').focus(), 50);
}
function closeExplain() { if (mode !== 'explain') return; $('explain').hidden = true; paused = false; mode = 'run'; last = performance.now(); }

/* ---------------- loop ---------------- */
let last = performance.now(), T = 0;
const camPos = new THREE.Vector3(0, 3, 6), camLook = new THREE.Vector3();
function update(dt) {
  T += dt;
  const running = mode === 'run' && !paused, attract = mode === 'menu' || mode === 'loading';
  const v = running ? speed() : attract ? 8 : mode === 'over' ? 1.5 : 0;
  const dz = v * dt;
  if (!S) return;
  shared.time.value = T;
  if (running || attract) { S.dist += dz; terrain.update(dz, S.dist); }
  volcanoes.forEach(o => { o.m.position.z += dz * 0.08; o.glow.position.z = o.m.position.z; if (o.m.position.z > 40) { o.m.position.z -= 700; o.glow.position.z = o.m.position.z; } });
  if (running) {
    if ((!S.gate || S.gate.done) && S.dist >= S.nextAt) { if (S.portalPending) { S.portalPending = false; S.nextAt = Infinity; spawnPortal(); hideCue(); } else spawnGate(); }
    if (S.hideCueAt && S.dist >= S.hideCueAt && (!S.gate || S.gate.done)) { hideCue(); S.hideCueAt = 0; }
    S.stumble = Math.max(0, S.stumble - dt);
    S.x += (LANES[S.lane] - S.x) * Math.min(1, dt * 12);
    if (S.y > 0) { S.vy -= 24 * dt; S.y += S.vy * dt; if (S.y <= 0) { S.y = 0; S.vy = 0; } }
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i], p = o.obj.position; p.z += dz;
      if (o.kind === 'gate') {
        o.parts.forEach((pp, k) => { pp.pm.uniforms.time.value = T; if (!o.done) pp.pm.uniforms.sel.value = k === S.lane ? 1 : 0; pp.sign.position.y = pp.h + 0.62 + Math.sin(T * 2 + k) * 0.05; });
        if (!o.done && p.z >= -0.2) resolveGate(o);
        if (o.done) { o.fade = Math.min(1, o.fade + dt * 2.5); const k = 1 - o.fade; o.parts.forEach(pp => { pp.arch.scale.setScalar(Math.max(0.001, k)); pp.portal.scale.setScalar(Math.max(0.001, k)); }); }
      } else if (o.kind === 'portal') {
        o.disc.material.uniforms.time.value = T; o.ring.rotation.z += dt * 0.6;
        if (!o.done && p.z >= 0) { o.done = true; nextWorld(); }
      }
      if (p.z > 14) { scene.remove(o.obj); objs.splice(i, 1); }
    }
    // lane ribbons glow only while a question is waiting
    const live = S.gate && !S.gate.done;
    laneRibbons.forEach((r, k) => { const u = r.material.uniforms; u.time.value = T; u.on.value = live ? Math.min(1, u.on.value + dt * 3) : 0; u.sel.value = k === S.lane ? 1 : 0;
      if (live) { const len = Math.max(1, -S.gate.obj.position.z); r.scale.y = len; r.position.z = -len / 2 + 0.6; } });
    if (live) previewLane(S.gate);
    if (S.streak >= 3) sparks.emit(new THREE.Vector3(S.x, 0.45 + S.y, 0.8), 2, {colors: S.streak >= 6 ? ['#7ff7ff', '#ffffff', '#ff7bb0'] : ['#ffd84a', '#ffffff'], speed: 1, vz: 4, life: 0.4, size: 0.08, gravity: 1, radius: 0.4});
  }
  // fox pose
  if (fox) {
    fox.position.set(S.x, S.y, 0);
    fox.rotation.z = (LANES[S.lane] - S.x) * -0.1; fox.rotation.y = (LANES[S.lane] - S.x) * -0.18;
    foxR.obj.rotation.x = S.y > 0 ? -Math.min(0.4, S.vy * 0.05) : 0; fox.rotation.x = S.stumble > 0 ? Math.sin(S.stumble * 16) * 0.15 : 0;
    shadowBlob.position.x = S.x; shadowBlob.scale.setScalar(1 - Math.min(0.5, S.y * 0.3));
    if (foxR.current) foxR.current.timeScale = mode === 'over' ? 0.35 : 1 + (running ? (v - 9.5) * 0.05 : 0);
  }
  const W = K;
  if (running || attract) {
    if (W.fx === 'snow') { for (let k = 0; k < 3; k++) snowfall.emit(new THREE.Vector3((Math.random() - 0.5) * 50, 12 + Math.random() * 6, 6 - Math.random() * 70), 1, {color: '#ffffff', speed: 0.8, dir: new THREE.Vector3(0.6, -0.3, 0), spread: 0.5, gravity: -1.6, life: 7, size: 0.09 + Math.random() * 0.06, drag: 0.4});
      if (Math.random() < 0.15) snowfall.emit(new THREE.Vector3(-14 + Math.random() * 4, 0.3, -Math.random() * 40), 6, {color: '#f4f8ff', speed: 2.5, dir: new THREE.Vector3(1, 0.15, 0), spread: 0.3, gravity: -0.2, life: 3, size: 0.07, drag: 0.2, radius: 2}); }
    if (W.fx === 'embers' && Math.random() < 0.8) ambient.emit(new THREE.Vector3((Math.random() - 0.5) * 50, -0.5, 4 - Math.random() * 70), 1, {colors: ['#ff6a1a', '#ffb347', '#ff3d0a'], speed: 0.8, gravity: 1.8, life: 3.5, size: 0.08 + Math.random() * 0.08, drag: 0.2});
    if (W.fx === 'pollen' && Math.random() < 0.3) ambient.emit(new THREE.Vector3((Math.random() - 0.5) * 30, 0.5 + Math.random() * 3, -Math.random() * 50), 1, {colors: ['#fff6c8', '#ffffff'], speed: 0.25, gravity: 0.05, life: 5, size: 0.05, drag: 0.1});
    if (W.fx === 'dust' && Math.random() < 0.25) ambient.emit(new THREE.Vector3(-20, 0.3 + Math.random() * 2, -Math.random() * 50), 4, {colors: ['#d9a77a', '#c48a5c'], speed: 1.6, dir: new THREE.Vector3(1, 0.05, 0), spread: 0.25, life: 5, size: 0.06, gravity: 0, drag: 0.05, radius: 1.5});
    if (W.smoke && Math.random() < dt * 5) { const side = Math.random() < 0.5 ? -1 : 1; smoke.emit(new THREE.Vector3(side * (9 + Math.random() * 30), -0.5, -15 - Math.random() * 120), {size: 6 + Math.random() * 6, rise: 1.2 + Math.random(), life: 8, opacity: 0.5, color: Math.random() < 0.5 ? '#3a2e2a' : '#5a4842'}); }
    if (W.volcano && Math.random() < dt * 2) volcanoes.forEach(o => smoke.emit(new THREE.Vector3(o.x + (Math.random() - 0.5) * 6, o.h - 4, o.m.position.z), {size: 26, grow: 2.5, rise: 7, life: 12, opacity: 0.65, color: Math.random() < 0.4 ? '#8a4428' : '#2a2220'}));
  }
  sparks.update(dt, running ? v * 0.6 : 0); confetti.update(dt, running ? v * 0.5 : 0); ambient.update(dt, running || attract ? v : 0); snowfall.update(dt, running || attract ? v : 0); smoke.update(dt, running || attract ? dz : 0);
  mixers.forEach(m => m && m.update(dt));
  if (sky) sky.material.uniforms.time.value = T; if (earth) earth.c.rotation.y += dt * 0.004;
  // camera: low and close behind Lexi so the arches and signs fill the view
  const fx = S.x; S.kick = Math.max(0, S.kick - dt * 2);
  if (attract) { const a = T * 0.22; camPos.set(Math.sin(a) * 6, 2.2 + Math.sin(T * 0.4) * 0.4, Math.cos(a) * 6); camLook.set(0, 1, 0); camera.position.copy(camPos); }
  else { camPos.set(fx * 0.5, 2.75, 5.6); camLook.set(fx * 0.7, 1.35, -12); camera.position.lerp(camPos, Math.min(1, dt * 6)); }
  camera.lookAt(camLook);
  if (S.shake > 0 && !reduceMotion) { camera.position.x += (Math.random() - 0.5) * S.shake; camera.position.y += (Math.random() - 0.5) * S.shake * 0.6; } S.shake = Math.max(0, S.shake - dt * 1.5);
  const baseFov = innerWidth / innerHeight < 1 ? 74 : 58; const tf = baseFov + (running && sprint && S.gate && !S.gate.done ? 8 : 0) + S.kick * 3; camera.fov += (tf - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  sun.position.set(fx + sunDir.x * 60, sunDir.y * 60, -8 + sunDir.z * 60); sun.target.position.set(fx, 0, -8);
}
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.1, (now - last) / 1000); last = now;
  update(mode === 'explain' || mode === 'paused' ? 0 : Math.min(rdt, 1 / 30));
  if (mode === 'run') quality.sample(rdt);
  furLayers.forEach((l, i) => l.visible = i < FUR_SHELLS[quality.tier] * (furLayers.length / FUR_SHELLS[2]));
  if (bloom.enabled) composer.render(); else renderer.render(scene, camera);
}

/* ---------------- screens ---------------- */
function startRun() {
  if (mode === 'loading') return;
  sfx.init(); sfx.startMusic(); sfx.intense = false;
  newRun(); mode = 'run'; paused = false; sprint = false;
  ['menu', 'over', 'pauseScr', 'explain'].forEach(id => $(id).hidden = true); hideCue();
  $('hud').hidden = false; paintHud();
  banner('World 1', WORLDS[0].name); last = performance.now();
}
function gameOver() {
  mode = 'over'; laneRibbons.forEach(r => r.material.uniforms.on.value = 0); sfx.stopMusic();
  setTimeout(() => {
    hideCue();
    $('oTitle').textContent = S.correct >= 10 ? 'Great run!' : 'Out of hearts';
    $('oScore').textContent = S.score.toLocaleString(); $('oRight').textContent = S.correct + '/' + S.total; $('oStreak').textContent = S.best; $('oWorldN').textContent = S.world + 1;
    $('oWorld').textContent = `You reached World ${S.world % 5 + 1}: ${WORLDS[S.world % 5].name}${S.lap ? ' (lap ' + (S.lap + 1) + ')' : ''}.`;
    const worst = Object.entries(S.misses).sort((a, b) => b[1] - a[1])[0]; const nt = $('oNotice'); nt.textContent = '';
    if (worst) { const b = document.createElement('b'); b.textContent = 'Practise this: ' + CATS[worst[0]].name + '. '; nt.append(b, CATS[worst[0]].rule); }
    nt.hidden = !worst;
    const ol = $('oFixes'); ol.textContent = ''; const seen = new Set();
    S.missed.forEach(q => { if (seen.has(q.id) || seen.size >= 4) return; seen.add(q.id); const li = document.createElement('li'); const [a, b] = q.q.split('___'); const m = document.createElement('mark'); m.textContent = q.o[0]; li.append(a || '', m, b || ''); ol.append(li); });
    $('oFixWrap').hidden = !seen.size;
    if (S.score > store.get('gr3d-best')) store.set('gr3d-best', S.score); paintBest();
    const ep = $('oEarned'); ep.hidden = true;
    if (lexiSession() && !S.reported) { S.reported = true; reportRun('runner', S.correct, S.total - S.correct).then(r => { ep.hidden = false; ep.textContent = r ? `+${r.points_earned} points added to your Lexi score. You now have ${r.total_score} points (${r.rank}).` : 'Could not reach Lexi to add your points.'; }); }
    $('hud').hidden = true; $('over').hidden = false; $('again').focus();
  }, 1600);
}
function paintBest() { const b = store.get('gr3d-best'), w = store.get('gr3d-best-world'); $('best').textContent = b ? `Your best: ${b.toLocaleString()} points · World ${w % 5 + 1}` : ''; }
function togglePause() {
  if (mode === 'run') { mode = 'paused'; paused = true; $('pauseScr').hidden = false; $('resume').focus(); }
  else if (mode === 'paused') { mode = 'run'; paused = false; $('pauseScr').hidden = true; last = performance.now(); }
}
function setLane(n) { if (mode !== 'run') return; n = Math.max(0, Math.min(2, n)); if (n !== S.lane) { S.lane = n; sfx.tone(480 + n * 120, 0.06, {type: 'triangle', vol: 0.08}); } }
const QN = ['Low', 'Medium', 'High'];
function paintQuality() { $('qBtn').textContent = 'Graphics: ' + (quality.locked ? QN[quality.tier] : 'Auto (' + QN[quality.tier] + ')'); }
$('qBtn').addEventListener('click', () => {
  if (!quality.locked) { quality.locked = true; quality.tier = 0; } else if (quality.tier < 2) quality.tier++; else { quality.locked = false; quality.tier = startTier; }
  quality.apply(); store.set('lexi3d-tier', quality.tier); store.set('lexi3d-tier-manual', quality.locked ? 1 : 0); paintQuality();
});
const paintMute = () => $('mute').textContent = sfx.muted ? 'Sound off' : 'Sound on';
$('mute').addEventListener('click', () => { sfx.init(); sfx.setMuted(!sfx.muted); paintMute(); });
addEventListener('keydown', e => {
  const k = e.key;
  if (mode === 'explain') { if (k === 'Enter' || k === ' ') { e.preventDefault(); closeExplain(); } return; }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(k) && mode === 'run') e.preventDefault();
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') setLane(S.lane - 1);
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') setLane(S.lane + 1);
  else if (k === '1' || k === '2' || k === '3') setLane(+k - 1);
  else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') sprint = true;
  else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
  else if (k === 'm' || k === 'M') { sfx.init(); sfx.setMuted(!sfx.muted); paintMute(); }
  else if (k === 'Enter' && (mode === 'menu' || mode === 'over') && document.activeElement?.tagName !== 'BUTTON') startRun();
});
addEventListener('keyup', e => { if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) sprint = false; });
$('tL').addEventListener('pointerdown', e => { e.preventDefault(); setLane(S.lane - 1); });
$('tR').addEventListener('pointerdown', e => { e.preventDefault(); setLane(S.lane + 1); });
$('tJ').addEventListener('pointerdown', e => { e.preventDefault(); sprint = true; });
addEventListener('pointerup', () => sprint = false);
let sw = null; canvas.addEventListener('pointerdown', e => sw = {x: e.clientX, y: e.clientY});
canvas.addEventListener('pointerup', e => { if (!sw) return; const dx = e.clientX - sw.x; if (Math.abs(dx) > 30) setLane(S.lane + (dx > 0 ? 1 : -1)); sw = null; });
$('start').addEventListener('click', startRun); $('again').addEventListener('click', startRun);
$('resume').addEventListener('click', togglePause); $('pauseBtn').addEventListener('click', togglePause); $('exOk').addEventListener('click', closeExplain);
addEventListener('pagehide', () => { if (S && mode !== 'menu' && S.correct > 0 && !S.reported) { S.reported = true; reportRun('runner', S.correct, S.total - S.correct, true); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'run') togglePause(); });

/* ---------------- boot ---------------- */
(async () => {
  paintBest(); paintQuality(); paintMute();
  fetch(ASSET + 'data/grammar-runner.json').then(r => r.ok ? r.json() : null).then(d => {
    const qs = (d && d.questions || []).filter(b => Array.isArray(b) && CATS[b[0]] && typeof b[1] === 'string' && b[1].includes('___') && Array.isArray(b[2]) && b[2].length === 3 && !UNSAFE.test(b[1] + ' ' + b[2].join(' ')));
    if (qs.length > 50) BANK = qs.map((b, i) => ({id: i, c: b[0], q: b[1], o: b[2], r: b[3]}));
  }).catch(() => {});
  try { await document.fonts.load('40px "Lilita One"'); } catch (e) {}
  A = await loadAll(renderer, ['fox'], p => $('loadFill').style.width = Math.round(p * 80) + '%', {noEnv: true});
  const m0 = await loadSky(renderer, 'meadow'); $('loadFill').style.width = '100%';
  sky = makeSky(scene, m0.bg || A.bg); scene.environment = m0.env || A.env;
  smoke.list.forEach(k => k.s.material.map = tex('smoke1.png'));
  buildFox();
  newRun(); mode = 'menu';
  $('loading').hidden = true; $('start').disabled = false; $('start').textContent = 'Start running';
  window.READY = 1;
})();
window.__dbg = {renderer, next: () => S.gate && !S.gate.done ? S.gate : null, get S() { return S; }, get mode() { return mode; }, quality, sim(n) { for (let i = 0; i < n; i++) update(1 / 30); }, explainOk: () => closeExplain(), setLane, setWorld: i => { S.world = i - 1; nextWorld(); }, K: () => K, camera, terrain};
requestAnimationFrame(frame);
