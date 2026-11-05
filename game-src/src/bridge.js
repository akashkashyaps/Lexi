// Word Bridge: the planks of a rope bridge are the words of a sentence. Word pairs that belong together hold;
// where the grammar is wrong the joint snaps under the fox. Physics by Rapier (2D), drawn in the 3D worlds.
import {THREE, makeRenderer, Quality, makeComposer, makeSky, loadAll, inst, play, Particles, Sound, reportRun, lexiSession, store, ASSET, furCoat, FUR_SHELLS} from './common.js';
import {loadSky, tex, terrainMaterial, shared, noise, fbm} from './worlds.js';
import RAPIER from '@dimforge/rapier2d-compat';

const $ = id => document.getElementById(id);
if (!document.createElement('canvas').getContext('webgl2')) {
  $('start').textContent = 'This computer cannot run 3D games'; $('loading').hidden = true;
  throw new Error('WebGL2 not available');
}

// Confidence-based marking (Gardner-Medwin): bet what you really believe. Best choice by chance of being right:
// under 67% Not sure, 67 to 80% Quite sure, over 80% Certain. Bluffing loses points in the long run.
const STAKES = [{name: 'Not sure', key: 'a', win: 100, lose: 0}, {name: 'Quite sure', key: 's', win: 200, lose: 200}, {name: 'Certain', key: 'd', win: 300, lose: 600}];
const CAT_NAMES = {s: 'he / she / it + s', have: 'have or has', be: 'am, is, are', past: 'past tense', art: 'a or an', prep: 'in, on, at'};
const MULT_STEP = 0.5, MULT_MAX = 3, SCOUTS = 2;
const G = 14, FLOOR = -13, CABLE = 4.6, PLANK_H = 0.7, FOX_R = 0.42, BRIDGES_PER_WORLD = 3, HEARTS = 3;
const UNSAFE = /\b(shit\w*|fuck\w*|crap|ass|asses|arse|bitch\w*|bastard|breasts?|boobs?|sex\w*|naked|piss\w*|dick|penis|butt|horny|nude|porn\w*|slut|whore|damn|hell|kill\w*|murder\w*|drunk|wasted|lying|beer|wine|drugs?|guns?|suicide|blood\w*|rape\w*|die|dead|hate)\b/i;
let BANK = [
  ['He ___ football every day.', ['plays', 'play', 'playing'], 'He, she, it: add -s. He plays.'],
  ['They ___ my friends.', ['are', 'is', 'am'], 'They: are.'],
  ['She ___ a red bag.', ['has', 'have', 'having'], 'She: has.'],
  ['I ate ___ apple.', ['an', 'a', 'the'], 'Apple starts with a vowel sound: an apple.'],
  ['Yesterday I ___ to the park.', ['went', 'go', 'goes'], 'Yesterday means the past: go becomes went.'],
  ['School starts ___ 9 o\'clock.', ['at', 'in', 'on'], 'At for clock times.'],
  ['We ___ dinner at home.', ['eat', 'eats', 'eating'], 'We: no -s. We eat.']
].map((b, i) => makeQ(b[0], b[1], b[2], ['s', 'be', 'have', 'art', 'past', 'prep', 's'][i])).filter(Boolean);
// Turn a gap sentence into the words of the sentence and the wrong words that could trick you.
function makeQ(s, opts, rule, c) {
  if (UNSAFE.test(s + ' ' + opts.join(' '))) return null;
  const m = s.match(/(\S*)___(\S*)/); if (!m) return null;
  const dress = (w, first) => m[1] + (first ? w[0].toUpperCase() + w.slice(1) : w) + m[2];
  const first = s.startsWith('___');
  const words = s.replace(/(\S*)___(\S*)/, dress(opts[0], first)).split(/\s+/);
  if (words.length < 3 || words.length > 7 || words.some(w => w.length > 13)) return null;
  const wrong = opts.slice(1).map(w => dress(w, first)).filter(w => !words.includes(w));
  return wrong.length ? {words, wrong, rule, c, len: words.length} : null;
}

// Each world: its own photo sky, ground and gravity. Longer sentences as you go.
const WORLDS = [
  {id: 'canyon', name: 'Red Canyon', edge: '#ff7b2c', exp: 1.0, env: 2.0, sun: '#ffe2bc', sunI: 3.6, hemi: ['#ffe0b8', '#a0623a', 0.7], g: 9.81, len: [3, 4], extra: 1, water: '#2f6168',
    ground: {a: 'red_sand_diff_1k.jpg', na: 'red_sand_nor.jpg', sa: 0.13, ca: '#ecd2b4', b: 'rock_face_diff_1k.jpg', nb: 'rock_face_nor.jpg', sb: 0.1, cb: '#f0ad7c', slope: [0.12, 0.3], strata: true}},
  {id: 'ice', name: 'Glacier', edge: '#6ff0ff', exp: 0.85, env: 1.3, sun: '#f2f6ff', sunI: 2.6, hemi: ['#e6f0ff', '#8aa6c8', 0.35], g: 9.81, len: [4, 5], extra: 1, water: '#17384f',
    ground: {a: 'snow_field_aerial_diff_1k.jpg', na: 'snow_field_aerial_nor.jpg', sa: 0.2, ca: '#ffffff', b: 'Ice002_1K-JPG_Color.jpg', nb: 'Ice002_1K-JPG_NormalGL.jpg', sb: 0.2, slope: [0.45, 0.75], ice: true, deep: '#4a8ab0'}},
  {id: 'lava', name: 'Volcano', edge: '#ff4d1a', exp: 1.1, env: 0.8, sun: '#ffb27a', sunI: 1.4, hemi: ['#ff9a6a', '#ff5a1a', 0.45], g: 9.81, len: [5, 6], extra: 2, tint: [0.62, 0.5, 0.46], sat: 0.5, bright: 0.5, fogColor: '#2d1812',
    ground: {a: 'rock_face_diff_1k.jpg', na: 'rock_face_nor.jpg', sa: 0.12, ca: '#8a817a', b: 'rock_face_diff_1k.jpg', nb: 'rock_face_nor.jpg', sb: 0.07, cb: '#6a625c', slope: [0.4, 0.7], lava: true, cracks: true, lavaLevel: FLOOR + 1.4}},
  {id: 'moon', name: 'The Moon', edge: '#b9c8ff', exp: 1.0, env: 0.1, sun: '#ffffff', sunI: 3.6, hemi: ['#9aa6c0', '#000000', 0.08], g: 1.62, len: [5, 7], extra: 2, fogColor: '#000000', fog: [400, 1200],
    ground: {a: 'aerial_ground_rock_diff_1k.jpg', na: 'aerial_ground_rock_nor.jpg', sa: 0.12, ca: '#c9c7c2', b: 'aerial_ground_rock_diff_1k.jpg', nb: 'aerial_ground_rock_nor.jpg', sb: 0.07, cb: '#9a9893', slope: [0.4, 0.7], desat: 1}}
];

/* ---------------- renderer and scene ---------------- */
const canvas = $('game');
const {renderer, startTier} = makeRenderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 3000); camera.position.set(0, 3.4, 17); camera.lookAt(0, 0.1, 0);
const {composer, bloom} = makeComposer(renderer, scene, camera);
const hemi = new THREE.HemisphereLight('#d4ecff', '#6b5a3c', 0.3); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d2', 2.6); sun.castShadow = true;
Object.assign(sun.shadow.camera, {left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 90}); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
scene.fog = new THREE.Fog('#c3d3da', 40, 320);
const app = {renderer, scene, bloom, composer, sun, beforeApply: t => { shared.lite = t === 0; }};
app.resize = () => { const w = innerWidth, h = innerHeight, asp = w / h; renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); bloom.resolution.set(w / 2, h / 2); camera.aspect = asp; camera.fov = Math.max(39, 2 * Math.atan(10.5 / (16 * asp)) * 180 / Math.PI); camera.updateProjectionMatrix(); sparks.mat.uniforms.scale.value = h * renderer.getPixelRatio(); };
const sparks = new Particles(scene, 500, true);
const quality = new Quality(app, store.get('lexi3d-tier', startTier));
quality.locked = store.get('lexi3d-tier-manual', 0) === 1;
addEventListener('resize', app.resize); app.resize();
const sfx = new Sound();
let sky = null, foxR = null, fox = null, furLayers = [], woodImg = null, W = WORLDS[0];

/* ---------------- the gorge: one height field, dead straight at the bridge, wandering further away ---------------- */
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function gorge(x, z) {
  const ax = Math.abs(x), far = sstep(4, 40, -z), w = G / 2 + far * (3 + 5 * noise(z * 0.014, 1) + 0.8 * noise(z * 0.03, x > 0 ? 3 : 7));
  const rim = sstep(w - 0.45, w, ax), flat = sstep(2.6, 9, Math.abs(z));
  const top = flat * 0.5 * fbm(x * 0.12, z * 0.12) + sstep(w + 3, w + 45, ax) * (7 + 12 * (fbm(x * 0.015, z * 0.015) * 0.5 + 0.5));
  return (FLOOR + 0.9 * fbm(x * 0.1, z * 0.1)) * (1 - rim) + top * rim;
}
const groundMesh = (() => {
  const a = [0, 2, 4, 5.5, 6.1, 6.4, 6.55, 6.7, 6.85, 7, 7.2, 7.6, 8.4, 9.5, 11, 13, 16, 20, 26, 34, 45, 60, 80, 110, 150], xs = [...a.slice(1).map(v => -v).reverse(), ...a];
  const zs = [34, 28, 22, 16, 11, 7.5, 5, 3.5, 2.5, 1.5, 0, -1.5, -2.5, -3.5, -5]; for (let z = -7; z > -320; z *= 1.09) zs.push(z - 1);
  const n = xs.length * zs.length, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = []; let k = 0;
  for (const z of zs) for (const x of xs) { const h = gorge(x, z), e = 0.2, hx = gorge(x + e, z) - gorge(x - e, z), hz = gorge(x, z + e) - gorge(x, z - e), L = Math.hypot(hx, 2 * e, hz); pos.set([x, h, z], k * 3); nor.set([-hx / L, 2 * e / L, -hz / L], k * 3); k++; }
  for (let r = 0; r < zs.length - 1; r++) for (let c = 0; c < xs.length - 1; c++) { const p = r * xs.length + c, q = p + xs.length; idx.push(p, p + 1, q, p + 1, q + 1, q); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('apos', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color: '#555'})); m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m;
})();
const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 700), new THREE.MeshStandardMaterial({color: '#2f6168', roughness: 0.12, metalness: 0.25})); water.rotation.x = -Math.PI / 2; water.position.set(0, FLOOR + 0.5, -300); scene.add(water);
// Rope posts and the overhead cable that holds the planks while you build
let woodMat = null; const rig = new THREE.Group(); scene.add(rig);
function buildRig() {
  woodMat = new THREE.MeshStandardMaterial({map: tex('wood_planks.jpg'), color: '#d9a877', roughness: 0.9});
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, CABLE + 0.6, 0.34), woodMat); p.position.set(s * (G / 2 + 0.55), (CABLE + 0.6) / 2, -1.25); p.castShadow = true; rig.add(p); }
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, G + 1.1, 8), new THREE.MeshStandardMaterial({color: '#3a2c20', roughness: 1})); c.rotation.z = Math.PI / 2; c.position.set(0, CABLE, 0); c.castShadow = true; rig.add(c);
}
const matCache = {};
function groundMat(w) {
  if (matCache[w.id]) return matCache[w.id];
  const g = w.ground, L = g.lava;
  return matCache[w.id] = terrainMaterial({id: 'b' + w.id, a: tex(g.a), b: tex(g.b), na: tex(g.na, false), nb: tex(g.nb, false), sa: g.sa, sb: g.sb, ca: g.ca, cb: g.cb, slope: g.slope, strata: g.strata, ice: g.ice, deep: g.deep, desat: g.desat, lava: L, cracks: g.cracks, lavaLevel: g.lavaLevel, lavaTex: L ? tex('lavatile.jpg') : null, cloudTex: L ? tex('cloud.png', false) : null});
}
let worldToken = 0;
async function setWorld(i) {
  W = WORLDS[i % WORLDS.length]; const tok = ++worldToken;
  groundMesh.material = groundMat(W);
  renderer.toneMappingExposure = W.exp; scene.environmentIntensity = W.env; sun.color.set(W.sun); sun.intensity = W.sunI; hemi.color.set(W.hemi[0]); hemi.groundColor.set(W.hemi[1]); hemi.intensity = W.hemi[2];
  water.visible = !!W.water; if (W.water) water.material.color.set(W.water);
  scene.fog.near = (W.fog || [40])[0]; scene.fog.far = (W.fog || [40, 320])[1];
  document.documentElement.style.setProperty('--edge', W.edge);
  const s = await loadSky(renderer, W.id); if (tok !== worldToken) return;
  const u = sky.material.uniforms; u.map.value = s.bg; u.tint.value.setRGB(...(W.tint || [1, 1, 1])); u.sat.value = W.sat ?? 1; u.bright.value = W.bright ?? 1;
  scene.environment = s.env; scene.fog.color.set(W.fogColor || (s.meta && s.meta.horizon) || '#c3d3da');
  const d = s.meta && s.meta.sun[1] > 0.12 ? s.meta.sun : [-0.45, 0.62, 0.35]; sun.position.set(d[0] * 40, Math.abs(d[1]) * 40, Math.abs(d[2]) * 40); sun.target.position.set(0, 0, 0);
}

/* ---------------- plank drawing ---------------- */
function plankFace(word, w) {
  const c = document.createElement('canvas'), aspect = w / PLANK_H; c.height = 128; c.width = Math.min(512, Math.round(128 * aspect)); const g = c.getContext('2d');
  if (woodImg) { g.filter = 'sepia(.55) brightness(1.05)'; g.drawImage(woodImg, 0, 0, c.width, c.height); g.filter = 'none'; } else { g.fillStyle = '#8a6a48'; g.fillRect(0, 0, c.width, c.height); }
  let fs = 84; g.font = `${fs}px "Lilita One","Arial Rounded MT Bold",sans-serif`; while (g.measureText(word).width > c.width - 22 && fs > 26) { fs -= 3; g.font = `${fs}px "Lilita One","Arial Rounded MT Bold",sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = Math.max(6, fs * 0.16); g.strokeStyle = '#1d1640'; g.strokeText(word, c.width / 2, 68); g.fillStyle = '#fff4dc'; g.fillText(word, c.width / 2, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function makePlankMesh(word, w) {
  const face = new THREE.MeshStandardMaterial({map: plankFace(word, w), roughness: 0.85});
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, PLANK_H, 2.1), [woodMat, woodMat, woodMat, woodMat, face, woodMat]); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}

/* ---------------- physics ---------------- */
const CLIFF = (1 << 16) | 4, PLANK = (2 << 16) | 4, FOX = (4 << 16) | 3;
let world = null, anchor = null, foxBody = null;
function newWorld() {
  if (world) world.free();
  world = new RAPIER.World({x: 0, y: -W.g}); world.timestep = 1 / 60; world.numSolverIterations = 8;
  anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  for (const s of [-1, 1]) world.createCollider(RAPIER.ColliderDesc.roundCuboid(39.9, 19.9, 0.1).setTranslation(s * (G / 2 + 40), -20).setCollisionGroups(CLIFF).setFriction(0), anchor);
  foxBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-G / 2 - 3.2, FOX_R + 0.02).lockRotations().setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.ball(FOX_R).setDensity(3).setFriction(0).setRestitution(0).setCollisionGroups(FOX), foxBody);
}

/* ---------------- game state ---------------- */
let mode = 'loading', Q = null, tray = [], planks = [], junctions = [], nLen = 0, pw = 0, S = null, t0 = 0, snapIdx = -1, keep = 0;
const rest = -PLANK_H / 2;
function newRun() { S = {world: 0, lap: 0, built: 0, bank: 0, pot: 0, mult: 1, hearts: HEARTS, correct: 0, wrong: 0, reported: false, recent: [], scouts: SCOUTS, streak: 0, misses: {}, stake: 0, record: STAKES.map(() => ({n: 0, right: 0})), lostPot: 0}; }
// The Troll is your opponent. It sets its trap in the grammar you get wrong most, and backs off when you beat it there.
// So the way to beat the Troll is to fix your weak spots.
function trollCategory() {
  const cats = Object.keys(CAT_NAMES), w = cats.map(c => 1 + 3 * (S.misses[c] || 0)); let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cats.length; i++) { r -= w[i]; if (r <= 0) return cats[i]; } return cats[0];
}
function pickQ() {
  const [a, b] = W.len, cat = trollCategory(), fits = q => q.len >= a && q.len <= b && !S.recent.includes(q);
  let pool = BANK.filter(q => fits(q) && q.c === cat); if (!pool.length) pool = BANK.filter(fits); if (!pool.length) pool = BANK;
  const q = pool[(Math.random() * pool.length) | 0]; S.recent.push(q); if (S.recent.length > 40) S.recent.shift(); return q;
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function clearPlanks() { planks.forEach(p => { scene.remove(p.mesh); p.mesh.material[4].map.dispose(); p.mesh.material[4].dispose(); p.mesh.geometry.dispose(); p.lines.forEach(l => { scene.remove(l); l.geometry.dispose(); }); }); planks = []; junctions = []; }
function setupBridge(fresh) {
  clearPlanks(); snapIdx = -1;
  if (fresh) { Q = pickQ(); nLen = Q.words.length; pw = G / nLen * 1.03; keep = 0; const wrong = shuffle(Q.wrong.slice()).slice(0, W.extra + (S.streak >= 3 ? 1 : 0)); tray = shuffle([...Q.words, ...wrong.map(w => w)]).map(w => ({w, used: false, gone: false})); }
  newWorld(); rig.visible = true;
  const kept = S.keptWords || []; S.keptWords = null;
  tray.forEach(t => t.used = t.gone);
  kept.forEach(w => { const t = tray.find(x => !x.used && x.w === w); if (t) { t.used = true; addPlank(t, true); } });
  keep = kept.length; mode = 'build'; fox.visible = true; play(foxR, 'survey', {speed: 1}); paint();
}
function addPlank(t, settled) {
  const i = planks.length; if (i >= nLen) return; t.used = true;
  const cx = -G / 2 + (G / nLen) * (i + 0.5), body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(cx, settled ? rest : 3.3).setLinearDamping(0.4).setAngularDamping(2).setRotation(settled ? 0 : (Math.random() - 0.5) * 0.5));
  world.createCollider(RAPIER.ColliderDesc.cuboid(pw / 2, PLANK_H / 2).setDensity(1).setFriction(0).setCollisionGroups(PLANK), body);
  const span = pw * 0.38, len = CABLE - rest, ropes = [-1, 1].map(s => world.createImpulseJoint(RAPIER.JointData.rope(len, {x: cx + s * span, y: CABLE}, {x: s * span, y: 0}), anchor, body, true));
  const lines = [-1, 1].map(() => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({color: '#3a2c20'})); l.frustumCulled = false; scene.add(l); return l; });
  planks.push({t, w: t.w, body, ropes, lines, cx, span, mesh: makePlankMesh(t.w, pw)});
  if (!settled) sfx.tone(240, 0.1, {to: 140, type: 'triangle', vol: 0.18});
}
function removeLast() {
  if (mode !== 'build' || planks.length <= keep) return;
  const p = planks.pop(); p.ropes.forEach(j => world.removeImpulseJoint(j, true)); world.removeRigidBody(p.body); scene.remove(p.mesh); p.lines.forEach(l => scene.remove(l)); p.t.used = false; sfx.tone(180, 0.08, {type: 'triangle', vol: 0.12}); paint();
}
const follows = (a, b) => Q.words.some((w, i) => w === a && Q.words[i + 1] === b);
function junctionBad(j) {
  if (j === 0) return planks[0].w !== Q.words[0];
  if (j === nLen) return planks[nLen - 1].w !== Q.words[nLen - 1];
  return !follows(planks[j - 1].w, planks[j].w);
}
// Cut the ropes: the bridge now hangs only from the joints between neighbouring words.
function send(stake) {
  if (mode !== 'build' || planks.length < nLen) return;
  S.stake = stake; S.record[stake].n++;
  sfx.init(); sfx.tone(900, 0.12, {to: 300, type: 'sawtooth', vol: 0.12});
  planks.forEach(p => { p.ropes.forEach(j => world.removeImpulseJoint(j, true)); p.ropes = []; p.lines.forEach(l => l.visible = false); });
  junctions = [];
  for (let j = 0; j <= nLen; j++) {
    const data = j === 0 ? RAPIER.JointData.revolute({x: -G / 2, y: rest}, {x: -pw / 2, y: 0}) : j === nLen ? RAPIER.JointData.revolute({x: pw / 2, y: 0}, {x: G / 2, y: rest}) : RAPIER.JointData.revolute({x: pw / 2, y: 0}, {x: -pw / 2, y: 0});
    junctions.push({joint: world.createImpulseJoint(data, j === 0 ? anchor : planks[j - 1].body, j === nLen ? anchor : planks[j].body, true), bad: junctionBad(j)});
  }
  rig.visible = true; mode = 'settle'; t0 = 0; status(STAKES[stake].name + '! Ropes cut'); paint();
}
function junctionX(j) { if (j === 0) return -G / 2; const b = planks[j - 1].body, p = b.translation(), r = b.rotation(); return p.x + Math.cos(r) * pw / 2; }
function snap(j) {
  snapIdx = j; world.removeImpulseJoint(junctions[j].joint, true); mode = 'fall'; t0 = 0; S.wrong++; S.hearts--; S.streak = 0; S.misses[Q.c] = (S.misses[Q.c] || 0) + 1;
  // a snap costs half the pot you did not bank, plus what you staked
  const before = S.pot, lose = Math.round(STAKES[S.stake].lose * S.mult); S.pot = Math.floor(S.pot / 2) - lose; if (S.pot < 0) { S.bank = Math.max(0, S.bank + S.pot); S.pot = 0; } S.lostPot += before - S.pot; S.mult = 1;
  sfx.hit(); sfx.bad(); status(lose ? `Snap! -${lose} for betting ${STAKES[S.stake].name}` : 'Snap!');
  sparks.emit(new THREE.Vector3(junctionX(j), rest, 1), 40, {colors: ['#c79a63', '#8a6a48', '#fff4dc'], speed: 6, life: 0.8, size: 0.22, gravity: -9});
  play(foxR, 'survey', {speed: 1}); paint();
}
function explain() {
  mode = 'explain'; status('');
  const j = snapIdx, a = j > 0 ? planks[j - 1].w : null, b = j < nLen ? planks[j].w : null, pair = $('exPair'), why = $('exWhy'), fix = $('exFix'); pair.textContent = ''; fix.textContent = '';
  const mark = (t, m) => { const e = document.createElement('mark'); e.textContent = t; m.append(e); };
  let next = Q.words[0];
  if (j === 0) { mark(b, pair); pair.append(' cannot start this sentence.'); why.textContent = 'A sentence starts with a capital letter.'; }
  else if (j === nLen) { mark(a, pair); pair.append(' cannot end this sentence.'); why.textContent = 'Look for the word with the full stop or question mark.'; next = Q.words[nLen - 1]; }
  else { mark(a, pair); pair.append(' '); mark(b, pair); why.textContent = Q.wrong.includes(b) || Q.wrong.includes(a) ? Q.rule : 'These two words do not go next to each other here.'; const i = Q.words.indexOf(a); next = i >= 0 ? Q.words[i + 1] : Q.words[j]; }
  fix.append(j === nLen ? 'End with ' : j === 0 ? 'Start with ' : `After “${a}” comes `); mark(next, fix); fix.append('.');
  $('explain').hidden = false; $('hud').hidden = false; $('exOk').focus();
}
function closeExplain() {
  $('explain').hidden = true;
  if (S.hearts <= 0) return gameOver();
  S.keptWords = planks.slice(0, snapIdx).map(p => p.w); // what was right stays up
  setupBridge(false);
}
function win() {
  mode = 'won'; t0 = 0; S.correct++; S.built++; S.streak++; S.record[S.stake].right++; if (S.misses[Q.c]) S.misses[Q.c]--;
  const pts = Math.round(STAKES[S.stake].win * S.mult * (S.lap + 1)); S.pot += pts;
  sfx.good(); status(`It holds! +${pts}`); play(foxR, 'survey', {speed: 1});
  sparks.emit(new THREE.Vector3(G / 2 + 1, 1.2, 0.5), 40, {colors: [W.edge, '#ffffff', '#ffd84a'], speed: 5, life: 1, size: 0.16, gravity: -4});
  speak(Q.words.join(' ')); paint();
}
function speak(text) { try { if (!sfx.muted && 'speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch (e) {} }
// After each bridge: keep your winnings safe, or leave them in the pot and raise the multiplier.
function bank() { if (mode !== 'decide') return; S.bank += S.pot; S.pot = 0; S.mult = 1; if (S.bank > store.get('wb-best')) store.set('wb-best', S.bank); sfx.coin(); nextBridge(); }
function push() { if (mode !== 'decide') return; S.mult = Math.min(MULT_MAX, S.mult + MULT_STEP); sfx.tone(520, 0.12, {to: 780, type: 'triangle', vol: 0.14}); nextBridge(); }
function scout() {
  if (mode !== 'build' || S.scouts <= 0) return; const fake = tray.find(t => !t.used && !t.gone && Q.wrong.includes(t.w) && !Q.words.includes(t.w)); if (!fake) return;
  fake.gone = true; fake.used = true; S.scouts--; sfx.power(); paint();
}
function nextBridge() {
  if (S.built >= BRIDGES_PER_WORLD) { S.built = 0; S.world++; if (S.world % WORLDS.length === 0) S.lap++; S.hearts = Math.min(HEARTS, S.hearts + 1); S.scouts = Math.min(SCOUTS + 1, S.scouts + 1); setWorld(S.world); sfx.whoosh(); }
  setupBridge(true);
}
function gameOver() {
  mode = 'over'; world.free(); world = null; $('hud').hidden = true; $('over').hidden = false;
  $('oTitle').textContent = S.correct ? `${S.correct} bridge${S.correct === 1 ? '' : 's'} built!` : 'Good try!';
  const lost = S.pot; S.pot = 0; if (S.bank > store.get('wb-best')) store.set('wb-best', S.bank);
  $('oStats').textContent = `Banked: ${S.bank.toLocaleString()}${lost ? ` (${lost.toLocaleString()} still in the pot was lost)` : ''}. You reached ${WORLDS[S.world % WORLDS.length].name}.`; paintBest();
  const cal = $('oCal'); cal.textContent = ''; STAKES.forEach((k, i) => { const r = S.record[i]; if (!r.n) return; const li = document.createElement('li'); li.textContent = `${k.name}: right ${r.right} of ${r.n}`; cal.append(li); }); $('oCalWrap').hidden = !cal.children.length;
  const worst = Object.entries(S.misses).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1])[0]; $('oTroll').textContent = worst ? `The Troll found your weak spot: ${CAT_NAMES[worst[0]]}. Practise it and it will back off.` : '';
  const ep = $('oEarned'); ep.hidden = true;
  if (lexiSession() && !S.reported) { S.reported = true; reportRun('bridge', S.correct, S.wrong).then(r => { ep.hidden = false; ep.textContent = r ? `+${r.points_earned} points added to your Lexi score. You now have ${r.total_score} points (${r.rank}).` : 'Could not reach Lexi to add your points.'; }); }
  $('again').focus();
}
function startRun() {
  sfx.init(); newRun(); $('menu').hidden = true; $('over').hidden = true; $('hud').hidden = false;
  setWorld(0).then(() => { }); setupBridge(true);
}

/* ---------------- HUD ---------------- */
function status(t) { const e = $('status'); e.textContent = t; e.hidden = !t; }
function paint() {
  $('bank').textContent = S.bank.toLocaleString(); $('pot').textContent = S.pot.toLocaleString(); $('mult').textContent = S.mult > 1 ? ' x' + S.mult : '';
  const tr0 = $('troll'); tr0.hidden = !Q || mode === 'decide'; if (Q) tr0.textContent = `The Troll set a trap: ${CAT_NAMES[Q.c] || 'word order'}`;
  const h = $('hearts'); h.textContent = ''; for (let i = 0; i < HEARTS; i++) { const e = document.createElement('i'); if (i >= S.hearts) e.className = 'gone'; h.append(e); }
  const p = $('pips'); p.textContent = ''; for (let i = 0; i < BRIDGES_PER_WORLD; i++) { const e = document.createElement('i'); if (i < S.built) e.className = 'on'; p.append(e); }
  $('worldName').textContent = `World ${S.world % WORLDS.length + 1} · ${WORLDS[S.world % WORLDS.length].name}`;
  const st = $('strip'); st.textContent = '';
  for (let i = 0; i < nLen; i++) { const b = document.createElement('button'); b.type = 'button'; const pk = planks[i]; b.className = 'slot' + (pk ? ' full' : '') + (i < keep ? ' keep' : ''); b.textContent = pk ? pk.w : ''; if (i === planks.length - 1 && i >= keep && mode === 'build') { b.title = 'Take this word off'; b.addEventListener('click', removeLast); } else b.disabled = true; st.append(b); }
  const tr = $('tray'); tr.textContent = ''; tr.hidden = mode !== 'build' && mode !== 'decide';
  if (mode === 'build') {
    tray.forEach((t, i) => { if (t.gone) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'word'; b.disabled = t.used; const k = document.createElement('kbd'); k.textContent = i + 1; b.append(k, t.w); b.addEventListener('click', () => pick(i)); tr.append(b); });
    const sc = document.createElement('button'); sc.type = 'button'; sc.className = 'pbtn scout'; sc.textContent = `Scout (${S.scouts})`; sc.title = 'Remove one trap word. Key: H'; sc.disabled = S.scouts <= 0 || !tray.some(t => !t.used && !t.gone && Q.wrong.includes(t.w) && !Q.words.includes(t.w)); sc.addEventListener('click', scout); tr.append(sc);
    const row = document.createElement('div'); row.className = 'stakes'; const full = planks.length >= nLen;
    STAKES.forEach((k, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'send'; b.disabled = !full; const lo = Math.round(k.lose * S.mult), hi = Math.round(k.win * S.mult * (S.lap + 1)); const kb = document.createElement('kbd'); kb.textContent = k.key.toUpperCase(); const sm = document.createElement('small'); sm.textContent = `+${hi}${lo ? ' / -' + lo : ' / 0'}`; b.append(kb, k.name, sm); b.addEventListener('click', () => send(i)); row.append(b); });
    tr.append(row);
  } else if (mode === 'decide') {
    const mk = (t, sub2, fn, key) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'send'; const kb = document.createElement('kbd'); kb.textContent = key; const sm = document.createElement('small'); sm.textContent = sub2; b.append(kb, t, sm); b.addEventListener('click', fn); tr.append(b); return b; };
    mk(`Bank ${S.pot.toLocaleString()}`, 'safe, multiplier back to x1', bank, 'B');
    mk(`Push on to x${Math.min(MULT_MAX, S.mult + MULT_STEP)}`, 'a snap loses half the pot', push, 'P');
  }
}
function pick(i) { const t = tray[i]; if (mode !== 'build' || !t || t.used || planks.length >= nLen) return; sfx.init(); addPlank(t, false); paint(); }
function paintBest() { const b = store.get('wb-best'); $('bestLine').textContent = b ? `Your best: ${b.toLocaleString()} points` : ''; }
function paintMute() { $('hudMute').textContent = sfx.muted ? 'Sound off' : 'Sound on'; }
$('start').addEventListener('click', startRun); $('again').addEventListener('click', startRun); $('exOk').addEventListener('click', closeExplain);
$('hudMute').addEventListener('click', () => { sfx.init(); sfx.setMuted(!sfx.muted); paintMute(); });
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (mode === 'build') {
    if (/^[1-9]$/.test(e.key)) pick(+e.key - 1);
    else if (e.key === 'Backspace') { e.preventDefault(); removeLast(); }
    else if (e.key === 'Enter') { e.preventDefault(); send(0); }
    else if (e.key === 'h' || e.key === 'H') scout();
    else { const k = STAKES.findIndex(x => x.key === e.key.toLowerCase()); if (k >= 0) send(k); }
  } else if (mode === 'decide') { if (e.key === 'b' || e.key === 'B') bank(); else if (e.key === 'p' || e.key === 'P') push(); }
  else if (mode === 'explain' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); closeExplain(); }
});
addEventListener('pagehide', () => { if (S && !S.reported && (S.correct > 0 || S.wrong > 0)) { S.reported = true; reportRun('bridge', S.correct, S.wrong, true); } });

/* ---------------- loop ---------------- */
const mp = new THREE.Vector3(), mq = new THREE.Quaternion(), ax = new THREE.Vector3(0, 0, 1), rp = new THREE.Vector3();
function syncScene() {
  for (const p of planks) {
    const t = p.body.translation(), r = p.body.rotation(); p.mesh.position.set(t.x, t.y, 0); p.mesh.quaternion.copy(mq.setFromAxisAngle(ax, r));
    if (p.ropes.length) p.lines.forEach((l, i) => { const s = i ? 1 : -1, px = t.x + Math.cos(r) * s * p.span, py = t.y + Math.sin(r) * s * p.span, a = l.geometry.attributes.position; a.setXYZ(0, p.cx + s * p.span, CABLE, 0); a.setXYZ(1, px, py, 0); a.needsUpdate = true; });
  }
  if (foxBody) { const t = foxBody.translation(), v = foxBody.linvel(); fox.position.set(t.x, t.y - FOX_R, 0); const tilt = mode === 'cross' ? Math.max(-0.6, Math.min(0.6, Math.atan2(v.y, Math.max(0.5, v.x)))) : 0; fox.rotation.z += (tilt - fox.rotation.z) * 0.15; }
}
let acc = 0, last = performance.now(), crossT = 0;
function stepGame(dt) {
  t0 += dt;
  if (mode === 'settle' && t0 > 0.9) { mode = 'cross'; t0 = 0; crossT = 0; status(''); play(foxR, 'run', {speed: 1.1}); }
  if (mode === 'cross') {
    crossT += dt; const v = foxBody.linvel(); foxBody.setLinvel({x: 3.4, y: v.y}, true); foxBody.wakeUp();
    const x = foxBody.translation().x;
    const bad = junctions.findIndex(j => j.bad);
    if (bad >= 0 && x > junctionX(bad) - 0.35) snap(bad);
    else if (x > G / 2 + 1.6) win();
    else if (crossT > 12) { if (bad >= 0) snap(bad); else { foxBody.setTranslation({x: G / 2 + 1.7, y: FOX_R + 0.05}, true); win(); } }
  } else if (mode === 'fall') {
    const y = foxBody.translation().y;
    if (y < FLOOR + 1 && fox.visible) { fox.visible = false; sfx.boom(false); sparks.emit(new THREE.Vector3(foxBody.translation().x, FLOOR + 1, 0), 60, {colors: W.id === 'lava' ? ['#ff6a1a', '#ffb347'] : ['#ffffff', '#cfe3ff'], speed: 7, life: 1, size: 0.3, gravity: -8}); }
    if (t0 > (W.g < 3 ? 3.2 : 2.2)) explain();
  } else if (mode === 'won') {
    foxBody.setLinvel({x: 0, y: foxBody.linvel().y}, true);
    if (t0 > 1.4) { status(''); mode = 'decide'; paint(); }
  } else if (mode === 'build' || mode === 'settle' || mode === 'decide') foxBody.setLinvel({x: 0, y: foxBody.linvel().y}, true);
}
function update(dt) {
  shared.time.value += dt; if (sky) sky.material.uniforms.time.value = shared.time.value;
  if (world && mode !== 'explain' && mode !== 'over') { stepGame(dt); if (world) { acc += dt; while (acc >= 1 / 60) { world.step(); acc -= 1 / 60; } } }
  if (world && fox) syncScene();
  if (foxR && foxR.mixer) foxR.mixer.update(dt);
  sparks.update(dt, 0);
}
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.1, (now - last) / 1000); last = now;
  if (mode !== 'loading') update(Math.min(rdt, 1 / 20));
  if (mode === 'build' || mode === 'cross') quality.sample(rdt);
  furLayers.forEach((l, i) => l.visible = i < FUR_SHELLS[quality.tier] * (furLayers.length / FUR_SHELLS[2]));
  if (bloom.enabled) composer.render(); else renderer.render(scene, camera);
}

/* ---------------- boot ---------------- */
(async () => {
  paintBest(); paintMute();
  fetch(ASSET + 'data/grammar-runner.json').then(r => r.ok ? r.json() : null).then(d => {
    const qs = (d && d.questions || []).map(b => Array.isArray(b) && typeof b[1] === 'string' && Array.isArray(b[2]) && b[2].length === 3 ? makeQ(b[1], b[2], b[3], b[0]) : null).filter(Boolean);
    if (qs.length > 50) BANK = qs;
  }).catch(() => {});
  await RAPIER.init(); $('loadFill').style.width = '40%';
  try { await document.fonts.load('40px "Lilita One"'); } catch (e) {}
  await new Promise(res => { const i = new Image(); i.onload = () => { woodImg = i; res(); }; i.onerror = res; i.src = ASSET + 'tex/wood_planks.jpg'; });
  const A = await loadAll(renderer, ['fox'], p => $('loadFill').style.width = 40 + Math.round(p * 30) + '%', {noEnv: true});
  const s0 = await loadSky(renderer, 'canyon'); $('loadFill').style.width = '100%';
  sky = makeSky(scene, s0.bg); scene.environment = s0.env;
  foxR = inst(A.models, 'fox', 1.9, {axis: 'z'}); fox = new THREE.Group(); fox.add(foxR.obj); foxR.obj.rotation.y = Math.PI / 2; fox.position.set(-G / 2 - 3.2, 0, 0); scene.add(fox); furLayers = furCoat(foxR.obj); play(foxR, 'survey', {speed: 1});
  buildRig(); newRun(); await setWorld(0); mode = 'menu';
  $('loading').hidden = true; $('start').disabled = false; $('start').textContent = 'Start building'; window.READY = 1;
})();
window.__dbg = {renderer, quality, get mode() { return mode; }, get S() { return S; }, get Q() { return Q; }, get tray() { return tray; }, get planks() { return planks; }, get fox() { return foxBody; }, pick, send, bank, push, scout, sim(n) { for (let i = 0; i < n; i++) update(1 / 60); }, setWorld: i => { S.world = i; S.built = 0; setWorld(i); setupBridge(true); }, explainOk: closeExplain};
requestAnimationFrame(frame);
