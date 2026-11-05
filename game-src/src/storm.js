// Word Storm 3D: words fall as glowing blocks onto a floating island. Lexi catches the ones that fit the rule.
import {THREE, makeRenderer, Quality, makeComposer, makeSky, loadAll, inst, play, Particles, labelTexture, Sound, reportRun, lexiSession, store, ASSET} from './common.js';

const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TARGET = 6, LIVES = 3, ISLAND_R = 9.5, FOX_Z = 2.2, XMAX = 7.2;

/* ---------------- word rules (same rules and lists as the 2D Word Catcher) ---------------- */
const pairs = arr => ({yes: arr.map(p => p[0]), no: arr.map(p => p[1]), map: Object.fromEntries(arr.map(p => [p[1], p[0]]))});
let PAST = pairs([['went', 'go'], ['saw', 'see'], ['ate', 'eat'], ['played', 'play'], ['kicked', 'kick'], ['ran', 'run'], ['drank', 'drink'], ['wrote', 'write'], ['found', 'find'], ['jumped', 'jump'], ['cooked', 'cook'], ['slept', 'sleep']]);
let PLUR = pairs([['cats', 'cat'], ['buses', 'bus'], ['children', 'child'], ['mangoes', 'mango'], ['boxes', 'box'], ['mice', 'mouse'], ['feet', 'foot'], ['books', 'book'], ['teeth', 'tooth'], ['women', 'woman']]);
let HE = pairs([['goes', 'go'], ['has', 'have'], ['is', 'are'], ['plays', 'play'], ['eats', 'eat'], ['does', 'do'], ['runs', 'run'], ['likes', 'like'], ['watches', 'watch']]);
const LEX = {
  noun: ['teacher', 'school', 'mango', 'river', 'pencil', 'bus', 'mother', 'garden', 'city', 'doctor', 'window', 'elephant'],
  verb: ['eat', 'write', 'sing', 'climb', 'sleep', 'laugh', 'go', 'sit', 'think', 'bring', 'speak', 'buy'],
  adjective: ['big', 'happy', 'tall', 'sweet', 'noisy', 'tiny', 'soft', 'angry', 'brave', 'beautiful', 'hungry', 'heavy'],
  adverb: ['quickly', 'slowly', 'loudly', 'happily', 'quietly', 'carefully', 'softly', 'sadly', 'gently', 'badly'],
  pronoun: ['he', 'she', 'they', 'we', 'it', 'I', 'you', 'him', 'them', 'us'],
  preposition: ['in', 'on', 'under', 'behind', 'between', 'near', 'above', 'beside', 'into', 'with'],
  conjunction: ['and', 'but', 'because', 'so', 'or']
};
const POS = {
  noun: {name: 'nouns', one: 'a noun', tell: 'names a person, place or thing'}, verb: {name: 'verbs', one: 'a verb', tell: 'an action word'},
  adjective: {name: 'adjectives', one: 'an adjective', tell: 'describes a noun'}, adverb: {name: 'adverbs', one: 'an adverb', tell: 'tells how something is done'},
  pronoun: {name: 'pronouns', one: 'a pronoun', tell: 'takes the place of a noun'}, preposition: {name: 'prepositions', one: 'a preposition', tell: 'tells where'},
  conjunction: {name: 'conjunctions', one: 'a conjunction', tell: 'joins two ideas'}
};
let posIndex = new Map(); const posOf = w => posIndex.get(w);
function posRule(p) {
  return {title: POS[p].name, hint: POS[p].tell, yes: LEX[p], no: Object.keys(LEX).filter(k => k !== p).flatMap(k => LEX[k]),
    why: w => { const q = posOf(w); return [w, ` is ${POS[q].one} (it ${POS[q].tell.replace(/^an? /, m => 'is ' + m)}), not ${POS[p].one}.`]; }};
}
let RULES;
function makeRules() {
  posIndex = new Map(); Object.keys(LEX).forEach(k => LEX[k].forEach(w => posIndex.set(w, k)));
  RULES = [posRule('noun'), posRule('verb'), posRule('adjective'), posRule('pronoun'), posRule('preposition'),
    {title: 'past tense', hint: 'already happened: went, played', yes: PAST.yes, no: PAST.no, why: w => [w, ` is now. The past is ${PAST.map[w]}.`]},
    posRule('adverb'),
    {title: 'plurals', hint: 'more than one: cats, buses', yes: PLUR.yes, no: PLUR.no, why: w => [w, ` is only one. More than one: ${PLUR.map[w]}.`]},
    posRule('conjunction'),
    {title: 'words that fit "He ___"', hint: 'he, she, it + s: goes, has, is', yes: HE.yes, no: HE.no, why: w => [w, `: we say "He ${HE.map[w]}", not "He ${w}".`]}];
}
makeRules();
const BLOCK_COLORS = ['#38a6ff', '#ffc53a', '#3fdc78', '#ff5fb4', '#b66bff', '#ff7b2c'];
const POWERS = {
  bomb: {m: 'q_Bomb', c: '#ff4d1a', name: 'Word Bomb', note: 'Blows up every wrong word'},
  slow: {m: 'q_Gem_Pink', c: '#ff5fb4', name: 'Slow time', note: 'Words fall slowly for 8 seconds'},
  heart: {m: 'q_Heart', c: '#ff4d5e', name: 'Extra heart', note: 'Back up to 3 hearts'},
  net: {m: 'q_Star', c: '#ffd23a', name: 'Big net', note: 'Catch from further away for 10 seconds'}
};

/* ---------------- setup ---------------- */
const canvas = $('game');
const {renderer, startTier} = makeRenderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
const {composer, bloom} = makeComposer(renderer, scene, camera);
scene.fog = new THREE.Fog('#c3d3da', 80, 320);
const hemi = new THREE.HemisphereLight('#d4ecff', '#6b5a3c', 0.5); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d2', 2.4); sun.position.set(-10, 20, 12); sun.castShadow = true;
Object.assign(sun.shadow.camera, {left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60}); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; scene.add(sun);
const app = {renderer, scene, bloom, sun};
const sparks = new Particles(scene, 2200, true), confetti = new Particles(scene, 1400, false, true), smoke = new Particles(scene, 500, false), ambient = new Particles(scene, 400, true);
smoke.mat.blending = THREE.NormalBlending; smoke.mat.transparent = true;
app.resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); bloom.resolution.set(w / 2, h / 2); camera.aspect = w / h; camera.fov = w / h < 1 ? 72 : 50; camera.updateProjectionMatrix(); sparks.mat.uniforms.scale.value = h * 0.6; confetti.mat.uniforms.scale.value = h * 0.45; smoke.mat.uniforms.scale.value = h * 0.8; ambient.mat.uniforms.scale.value = h * 0.6; };
const quality = new Quality(app, store.get('lexi3d-tier', startTier)); quality.locked = store.get('lexi3d-tier-manual', 0) === 1;
addEventListener('resize', app.resize); app.resize();
const sfx = new Sound();
let A = null, sky = null, fox, foxR, netRing; const mixers = new Set();

/* ---------------- island ---------------- */
function noiseTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = 200 + Math.random() * 55; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 2 + Math.random() * 5); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildIsland() {
  const g = new THREE.Group();
  const tex = noiseTex(); tex.repeat.set(5, 5);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R, 0.8, 64), new THREE.MeshStandardMaterial({color: '#4fae3c', map: tex, roughness: 0.95})); top.position.y = -0.4; top.receiveShadow = true; g.add(top);
  const rockTex = noiseTex(); rockTex.repeat.set(6, 2);
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - 0.1, 2.2, 9, 24, 4), new THREE.MeshStandardMaterial({color: '#7a4c2c', map: rockTex, roughness: 1, flatShading: true}));
  const pos = rock.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { if (pos.getY(i) < 4.4) { pos.setX(i, pos.getX(i) * (0.85 + Math.random() * 0.3)); pos.setZ(i, pos.getZ(i) * (0.85 + Math.random() * 0.3)); } }
  rock.geometry.computeVertexNormals(); rock.position.y = -5.3; g.add(rock);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R, 0.09, 8, 128), new THREE.MeshStandardMaterial({color: '#000', emissive: '#ffd84a', emissiveIntensity: 2.4})); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; g.add(ring);
  // a path strip where Lexi runs
  const lane = new THREE.Mesh(new THREE.BoxGeometry(XMAX * 2 + 2.2, 0.06, 2.2), new THREE.MeshStandardMaterial({color: '#c99f63', map: tex, roughness: 0.8})); lane.position.set(0, 0.03, FOX_Z); lane.receiveShadow = true; g.add(lane);
  scene.add(g);
  // trees and bushes around the back of the island
  [['q_Tree_Fruit', 4.2, -6, -5], ['q_Tree', 3.8, 5.5, -6], ['q_Tree', 3.2, -1.5, -8], ['q_Bush_Fruit', 1.5, -8, -1.5], ['q_Bush', 1.4, 8, -2], ['q_Rock_2', 1.2, 3, -7.5], ['q_Bush', 1.2, -4, -7.5], ['q_Tree_Fruit', 3, 8, -5.5], ['k_signage_finish_wide', 2.2, 0, -5.2]].forEach(([n, s, x, z]) => { const r = inst(A.models, n, s); r.obj.position.set(x, 0, z); r.obj.rotation.y = Math.random() * (n.startsWith('k_') ? 0 : 6); scene.add(r.obj); });
  for (let i = 0; i < 14; i++) {
    const c = inst(A.models, 'q_Cloud_' + (1 + i % 3), 8 + Math.random() * 14, {shadow: false}).obj;
    c.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.fog = false; m.material.emissive = new THREE.Color('#fff'); m.material.emissiveIntensity = 0.35; } });
    const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 80; c.position.set(Math.cos(a) * r, 10 + Math.random() * 30, -Math.abs(Math.sin(a)) * r - 20); c.userData.v = 0.4 + Math.random() * 0.8; scene.add(c); clouds.push(c);
  }
  for (let i = 0; i < 0; i++) {
    const gI = new THREE.Group(); const b = inst(A.models, 'q_RockPlatform_Tall', 14 + Math.random() * 10, {shadow: false}); gI.add(b.obj);
    const t = inst(A.models, i % 2 ? 'q_Tree' : 'q_Tree_Fruit', 7, {shadow: false}); t.obj.position.y = b.obj.userData.size.y - 0.5; gI.add(t.obj);
    gI.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.fog = false; } });
    const side = i % 2 ? 1 : -1; gI.position.set(side * (28 + Math.random() * 40), -b.obj.userData.size.y + Math.random() * 6 - 2, -30 - Math.random() * 60); scene.add(gI); islands.push(gI);
  }
}
const clouds = [], islands = [];

/* ---------------- state ---------------- */
let S = null, mode = 'loading', topic = -1;
const blocks = [];
function newGame() {
  blocks.forEach(b => scene.remove(b.obj)); blocks.length = 0;
  const order = topic < 0 ? RULES.map((_, i) => i) : [topic, topic, topic];
  S = {order, ri: 0, rule: RULES[order[0]], got: 0, lives: LIVES, score: 0, combo: 0, best: 0, correct: 0, wrong: 0, missed: 0, x: 0, vx: 0, targetX: null, hop: 0,
    spawnT: 1.2, t: 0, meteor: 0, slow: 0, net: 0, level: 0, wrongs: [], reported: false, shake: 0, recent: [], done: false, sinceGood: 0};
  paintRule(); paintHud();
}
const fallSpeed = () => { let v = 2.3 + S.ri * 0.18 + (topic >= 0 ? S.ri * 0.5 : 0); if (S.meteor > 0) v *= 1.9; if (S.slow > 0) v *= 0.45; return v; };
const spawnGap = () => { let g = Math.max(0.75, 1.55 - S.ri * 0.07 - (topic >= 0 ? S.ri * 0.2 : 0)); if (S.meteor > 0) g *= 0.55; if (S.slow > 0) g *= 1.6; return g; };

/* ---------------- blocks ---------------- */
function pickWord() {
  const r = S.rule; const good = Math.random() < (S.sinceGood >= 2 ? 0.75 : 0.45);
  const list = good ? r.yes : r.no; let w;
  for (let k = 0; k < 12; k++) { w = list[(Math.random() * list.length) | 0]; if (!S.recent.includes(w)) break; }
  S.recent.push(w); if (S.recent.length > 16) S.recent.shift(); S.sinceGood = good ? 0 : S.sinceGood + 1;
  return {w, good};
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function spawnWord() {
  const {w, good} = pickWord(); const gold = good && Math.random() < 0.09;
  const col = gold ? '#ffd23a' : BLOCK_COLORS[(Math.random() * BLOCK_COLORS.length) | 0];
  const len = Math.max(2.2, Math.min(4.4, 1.1 + w.length * 0.34)), h = 0.95, d = 0.95;
  const tex = labelTexture(w, {w: 512, h: 160, bg: gold ? '#fff2b0' : '#fff4dc', border: col, fs: 104});
  const face = new THREE.MeshStandardMaterial({map: tex, roughness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.06});
  const side = new THREE.MeshStandardMaterial({color: col, roughness: 0.35, metalness: 0.1, emissive: col, emissiveIntensity: gold ? 0.7 : 0.18});
  const m = new THREE.Mesh(boxGeo, [side, side, side, side, face, side]); m.scale.set(len, h, d); m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  const x = (Math.random() * 2 - 1) * (XMAX - len / 2 + 0.6);
  g.position.set(x, 15, FOX_Z + (Math.random() - 0.5) * 0.4); g.rotation.z = (Math.random() - 0.5) * 0.3;
  scene.add(g);
  blocks.push({obj: g, mesh: m, w, good, gold, col, len, vy: -fallSpeed(), vx: 0, vz: 0, wz: (Math.random() - 0.5) * 0.6, wx: 0, landed: false, life: 0, kind: 'word', meteor: S.meteor > 0});
}
function spawnPower() {
  const keys = Object.keys(POWERS).filter(k => !(k === 'heart' && S.lives >= LIVES)); const k = keys[(Math.random() * keys.length) | 0]; const p = POWERS[k];
  const r = inst(A.models, p.m, 1.3); r.obj.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(p.c); m.material.emissiveIntensity = 0.8; } });
  const g = new THREE.Group(); r.obj.position.y = -0.65; g.add(r.obj);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), new THREE.MeshBasicMaterial({color: p.c, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide})); g.add(halo);
  g.position.set((Math.random() * 2 - 1) * (XMAX - 1), 15, FOX_Z); scene.add(g);
  blocks.push({obj: g, kind: 'power', key: k, halo, vy: -fallSpeed() * 0.8, vx: 0, vz: 0, wz: 0, wx: 0, landed: false, life: 0, len: 1.4});
}
function removeBlock(b) { scene.remove(b.obj); const i = blocks.indexOf(b); if (i >= 0) blocks.splice(i, 1); if (b.mesh) { b.mesh.material[4].map.dispose(); } }
function shatter(b, good) {
  const p = b.obj.position;
  confetti.emit(p, good ? 90 : 40, {colors: good ? [b.col, '#ffffff', '#ffd84a'] : [b.col, '#444444'], speed: good ? 11 : 6, life: 2, size: 0.3, gravity: -9, drag: 1.2, radius: b.len * 0.8});
  sparks.emit(p, good ? 70 : 30, {colors: good ? [b.col, '#ffffff'] : ['#ff4d5e', '#ff9a2f'], speed: good ? 9 : 6, life: 0.8, size: 0.45, gravity: -2});
  if (!good) smoke.emit(p, 26, {colors: ['#2a2238', '#4a4058', '#1a1626'], speed: 2.5, life: 1.4, size: 1.6, gravity: 1.5, drag: 1.5, radius: 1});
  removeBlock(b);
}

/* ---------------- events ---------------- */
function catchBlock(b) {
  S.hop = 1;
  if (b.kind === 'power') { usePower(b.key); removeBlock(b); return; }
  const fits = b.good;
  if (fits) {
    S.correct++; S.got++; S.combo++; S.best = Math.max(S.best, S.combo);
    const mult = (S.combo >= 8 ? 3 : S.combo >= 4 ? 2 : 1) * (b.gold ? 3 : 1) * (S.meteor > 0 ? 2 : 1); const pts = 50 * mult; S.score += pts;
    pop('+' + pts + (b.gold ? ' gold!' : ''), b.gold ? '#ffd23a' : '#fff4dc', b.obj.position);
    shatter(b, true); sfx.good();
    if (S.combo === 4 || S.combo === 8) { banner(S.combo === 4 ? 'Combo!' : 'Mega combo!', S.combo === 4 ? 'Points x2' : 'Points x3'); sfx.power(); }
    paintPips(); if (S.got >= TARGET) ruleDone();
  } else {
    S.wrong++; S.combo = 0; S.lives--; S.wrongs.push({w: b.w, rule: S.rule});
    shatter(b, false); sfx.bad(); S.shake = 0.5; flash('rgba(255,40,60,.4)');
    const [w, rest] = S.rule.why(b.w); toast(w, rest);
    if (S.lives <= 0) gameOver();
  }
  paintHud();
}
function usePower(k) {
  const p = POWERS[k]; sfx.power(); sparks.emit(new THREE.Vector3(S.x, 1.6, FOX_Z), 120, {color: p.c, speed: 10, life: 0.8, size: 0.45});
  if (k === 'bomb') {
    const bad = blocks.filter(b => b.kind === 'word' && !b.good); sfx.boom(true); S.shake = 0.9; flash('rgba(255,140,40,.45)');
    bad.forEach((b, i) => setTimeout(() => { if (blocks.includes(b)) { sparks.emit(b.obj.position, 120, {colors: ['#ff7b2c', '#ffd84a', '#ffffff'], speed: 14, life: 1, size: 0.6, gravity: -3}); shatter(b, false); S.score += 25; } }, i * 90));
    pop(bad.length ? `Boom! ${bad.length} wrong word${bad.length > 1 ? 's' : ''} gone` : 'Boom!', '#ff7b2c');
  }
  if (k === 'slow') { S.slow = 8; blocks.forEach(b => { if (!b.landed) b.vy *= 0.45; }); }
  if (k === 'heart') S.lives = Math.min(LIVES, S.lives + 1);
  if (k === 'net') S.net = 10;
  if (k !== 'bomb') pop(p.name + '!', p.c);
  paintHud();
}
function ruleDone() {
  S.ri++; S.got = 0; S.sinceGood = 0; sfx.boom(false);
  for (let i = 0; i < 5; i++) setTimeout(() => { const p = new THREE.Vector3((Math.random() - 0.5) * 14, 6 + Math.random() * 5, -2 - Math.random() * 4); sparks.emit(p, 160, {colors: [BLOCK_COLORS[i % 6], '#ffffff', '#ffd84a'], speed: 12, life: 1.4, size: 0.45, gravity: -4}); sfx.boom(false); }, i * 260);
  blocks.filter(b => b.kind === 'word').forEach(b => shatter(b, b.good));
  if (S.ri >= S.order.length) { win(); return; }
  S.rule = RULES[S.order[S.ri]]; S.recent = [];
  if (topic < 0 && S.ri % 3 === 0) { S.meteor = 14; banner('Meteor shower!', 'Words fall fast. Points x2'); S.shake = 0.6; }
  else banner(topic < 0 ? `Rule ${S.ri + 1} of ${S.order.length}` : `Level ${S.ri + 1}`, 'Now catch ' + S.rule.title);
  S.spawnT = 2.2; paintRule();
}
let toastT = 0;
function toast(w, rest) { const t = $('toast'); t.textContent = ''; const b = document.createElement('b'); b.textContent = w; t.append(b, rest); t.hidden = false; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); toastT = 3.2; }

/* ---------------- HUD ---------------- */
function paintRule() { $('ruleName').textContent = S.rule.title; $('ruleHint').textContent = S.rule.hint; $('ruleNo').textContent = topic < 0 ? `Rule ${S.ri + 1} of ${S.order.length}` : `Level ${S.ri + 1} of 3`; paintPips(); }
function paintPips() { const p = $('pips'); p.textContent = ''; for (let i = 0; i < TARGET; i++) { const e = document.createElement('i'); if (i < S.got) e.className = 'on'; p.append(e); } }
function paintHud() {
  $('score').textContent = S.score.toLocaleString(); $('right').textContent = S.correct;
  const h = $('hearts'); h.textContent = ''; for (let i = 0; i < LIVES; i++) { const e = document.createElement('i'); if (i >= S.lives) e.className = 'gone'; h.append(e); }
  const m = S.combo >= 8 ? 3 : S.combo >= 4 ? 2 : 1; const cb = $('combo'); cb.textContent = S.combo > 1 ? `${S.combo} in a row${m > 1 ? ' · x' + m : ''}` : ''; cb.dataset.lvl = m;
  const pw = $('powers'); pw.textContent = ''; const add = (c, t) => { const s = document.createElement('span'); s.className = 'pw'; s.style.setProperty('--c', c); s.textContent = t; pw.append(s); };
  if (S.meteor > 0) add('#ff7b2c', 'Meteors ' + Math.ceil(S.meteor)); if (S.slow > 0) add(POWERS.slow.c, 'Slow ' + Math.ceil(S.slow)); if (S.net > 0) add(POWERS.net.c, 'Big net ' + Math.ceil(S.net));
}
const tv = new THREE.Vector3();
function pop(text, color, at) {
  const p = document.createElement('div'); p.className = 'pop'; p.textContent = text; p.style.color = color || '#fff4dc';
  if (at) { tv.copy(at).project(camera); p.style.left = ((tv.x + 1) / 2 * innerWidth) + 'px'; p.style.top = ((1 - tv.y) / 2 * innerHeight) + 'px'; } else { p.style.left = '50%'; p.style.top = '40%'; }
  $('pops').append(p); setTimeout(() => p.remove(), 1100);
}
function banner(a, b) { const el = $('banner'); $('bannerA').textContent = a; $('bannerB').textContent = b; el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); clearTimeout(banner.t); banner.t = setTimeout(() => el.hidden = true, 2600); }
function flash(c) { const f = $('flash'); f.style.background = c; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

/* ---------------- loop ---------------- */
let last = performance.now(), T = 0; const keys = {l: false, r: false};
function update(dt) {
  T += dt;
  const running = mode === 'play';
  clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 130) c.position.x = -130; });
  islands.forEach((g, i) => { g.position.y += Math.sin(T * 0.5 + i) * dt * 0.3; });
  if (S && running) {
    S.t += dt;
    for (const k of ['meteor', 'slow', 'net']) if (S[k] > 0) { S[k] -= dt; if (S[k] <= 0 || ((S[k] * 1) | 0) !== (((S[k] + dt) * 1) | 0)) paintHud(); }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').hidden = true; }
    // movement: keys accelerate, pointer sets a target
    const acc = 70, maxV = 13;
    if (keys.l || keys.r) { S.targetX = null; S.vx += ((keys.r ? 1 : 0) - (keys.l ? 1 : 0)) * acc * dt; S.vx = Math.max(-maxV, Math.min(maxV, S.vx)); }
    else if (S.targetX !== null) { const d = S.targetX - S.x; S.vx = Math.max(-maxV, Math.min(maxV, d * 9)); }
    else S.vx *= Math.exp(-dt * 10);
    S.x += S.vx * dt; if (Math.abs(S.x) > XMAX) { S.x = Math.sign(S.x) * XMAX; S.vx = 0; }
    S.hop = Math.max(0, S.hop - dt * 3.5);
    // spawn
    S.spawnT -= dt; if (S.spawnT <= 0) { if (Math.random() < 0.07 && S.ri + S.got > 1) spawnPower(); else spawnWord(); S.spawnT = spawnGap() * (0.7 + Math.random() * 0.6); }
    // blocks
    const reach = S.net > 0 ? 2.6 : 1.5;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i], p = b.obj.position;
      if (!b.landed) {
        p.y += b.vy * dt; b.obj.rotation.z += b.wz * dt * 0.3; if (Math.abs(b.obj.rotation.z) > 0.3) b.wz *= -1;
        if (b.kind === 'power') { b.halo.rotation.z += dt * 2; b.obj.rotation.y += dt * 2; }
        if (b.meteor && b.kind === 'word') sparks.emit(p.clone().add(new THREE.Vector3(0, 0.5, 0)), 4, {colors: ['#ff7b2c', '#ffd84a', '#ff4d1a'], speed: 1.5, up: 3, life: 0.5, size: 0.5, gravity: 2, radius: b.len * 0.6});
        // catch: the block reaches Lexi's net
        if (p.y < 2.6 && p.y > 0.8 && Math.abs(p.x - S.x) < reach + b.len * 0.35) { catchBlock(b); continue; }
        if (p.y <= 0.48) {
          b.landed = true; p.y = 0.48; b.vy = 3 + Math.random() * 2; b.vx = (Math.random() - 0.5) * 3; b.vz = -1.5 - Math.random() * 2; b.wx = -3 - Math.random() * 4; b.wz = (Math.random() - 0.5) * 6;
          sfx.tone(140, 0.12, {to: 70, type: 'sine', vol: 0.3}); sparks.emit(p, 14, {color: '#d8c49a', speed: 3, life: 0.5, size: 0.35, gravity: -6});
          if (b.kind === 'word' && b.good) { S.missed++; S.combo = 0; paintHud(); pop('Missed: ' + b.w, '#ffb4b4', p); }
        }
      } else {
        // simple physics after landing: bounce, roll back across the island, fall off the edge
        b.vy -= 22 * dt; p.x += b.vx * dt; p.z += b.vz * dt; p.y += b.vy * dt; b.obj.rotation.x += b.wx * dt; b.obj.rotation.z += b.wz * dt; b.life += dt;
        const onIsland = Math.hypot(p.x, p.z) < ISLAND_R - 0.4;
        if (onIsland && p.y < 0.48) { p.y = 0.48; b.vy = Math.abs(b.vy) > 1.5 ? -b.vy * 0.35 : 0; b.vx *= 0.9; b.vz *= 0.9; b.wx *= 0.8; b.wz *= 0.8; }
        for (const o of blocks) if (o !== b && o.landed) { const dx = p.x - o.obj.position.x, dz = p.z - o.obj.position.z, dd = Math.hypot(dx, dz), min = 1.1; if (dd < min && dd > 0.001) { const push = (min - dd) / 2; p.x += dx / dd * push; p.z += dz / dd * push; } }
        if (b.life > 1.4 || p.y < -14) { if (p.y > -2) shatter(b, false); else removeBlock(b); }
      }
    }
    if (S.meteor > 0 && Math.random() < dt * 3) { const p = new THREE.Vector3((Math.random() - 0.5) * 60, 30, -40 - Math.random() * 30); for (let k = 0; k < 18; k++) sparks.emit(p.clone().add(new THREE.Vector3(k * 1.2, -k * 1.2, 0)), 3, {colors: ['#ff7b2c', '#ffd84a'], speed: 0.5, life: 0.6 + k * 0.02, size: 0.9 - k * 0.04, gravity: 0}); }
  }
  // fox
  if (fox) {
    const x = S ? S.x : Math.sin(T * 0.6) * 4; const v = S ? S.vx : Math.cos(T * 0.6) * 2.4;
    fox.position.set(x, S ? Math.sin(S.hop * Math.PI) * 0.5 : 0, FOX_Z);
    const want = Math.abs(v) > 0.6 ? (v > 0 ? Math.PI / 2 : -Math.PI / 2) : 0; fox.rotation.y += (want - fox.rotation.y) * Math.min(1, (S ? dt : 1 / 60) * 10);
    const moving = Math.abs(v) > 0.6; if (moving !== foxR.moving) { foxR.moving = moving; play(foxR, moving ? 'run' : 'survey', {fade: 0.2}); }
    netRing.position.set(x, 1.3 + (S ? Math.sin(S.hop * Math.PI) * 0.5 : 0), FOX_Z); const ns = S && S.net > 0 ? 1.7 : 1; netRing.scale.setScalar(netRing.scale.x + (ns - netRing.scale.x) * 0.1); 
    netRing.material.uniforms.time.value = T;
  }
  sparks.update(dt); confetti.update(dt); smoke.update(dt); ambient.update(dt);
  if (Math.random() < 0.4) ambient.emit(new THREE.Vector3((Math.random() - 0.5) * 30, Math.random() * 8, -Math.random() * 20), 1, {colors: ['#fff6b0', '#ffffff'], speed: 0.3, gravity: 0.1, life: 4, size: 0.12, drag: 0.1});
  mixers.forEach(m => m && m.update(dt)); if (sky) sky.material.uniforms.time.value = T;
  // camera follows a little, shakes on hits
  const fx = S ? S.x : 0; camera.position.set(fx * 0.25, 5.4, 15); camera.lookAt(fx * 0.2, 3.9, 0);
  const sh = S ? S.shake : 0; if (S) S.shake = Math.max(0, S.shake - dt * 1.5);
  if (sh > 0 && !reduceMotion) { camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh; }
  if (mode === 'menu') { const a = T * 0.15; camera.position.set(Math.sin(a) * 15, 6 + Math.sin(T * 0.3), Math.cos(a) * 15); camera.lookAt(0, 2, 0); }
}
function frame(now) {
  const rdt = Math.min(0.1, (now - last) / 1000); last = now;
  update(mode === 'paused' ? 0 : Math.min(rdt, 1 / 30));
  if (mode === 'play') quality.sample(rdt);
  if (bloom.enabled) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------------- screens ---------------- */
function start() {
  if (mode === 'loading') return; sfx.init(); sfx.startMusic(); sfx.key = 2; sfx.bpm = 116;
  newGame(); mode = 'play'; ['menu', 'over', 'pauseScr'].forEach(id => $(id).hidden = true); $('hud').hidden = false; $('toast').hidden = true;
  banner(topic < 0 ? 'Rule 1 of 10' : 'Level 1', 'Catch ' + S.rule.title); last = performance.now();
}
function finishScreen(title) {
  mode = 'over'; sfx.intense = false;
  setTimeout(() => {
    $('oTitle').textContent = title; $('oScore').textContent = S.score.toLocaleString(); $('oRight').textContent = S.correct; $('oStreak').textContent = S.best; $('oRules').textContent = Math.min(S.ri, S.order.length) + '/' + S.order.length;
    const ol = $('oFixes'); ol.textContent = ''; const seen = new Set();
    S.wrongs.forEach(x => { if (seen.has(x.w) || seen.size >= 4) return; seen.add(x.w); const li = document.createElement('li'); const [w, rest] = x.rule.why(x.w); const b = document.createElement('b'); b.textContent = w; li.append(b, rest); ol.append(li); });
    $('oFixWrap').hidden = !seen.size;
    if (S.score > store.get('ws3d-best')) store.set('ws3d-best', S.score); paintBest();
    const ep = $('oEarned'); ep.hidden = true;
    if (lexiSession() && !S.reported) { S.reported = true; reportRun('catcher', S.correct, S.wrong).then(r => { ep.hidden = false; ep.textContent = r ? `+${r.points_earned} points added to your Lexi score. You now have ${r.total_score} points (${r.rank}).` : 'Could not reach Lexi to add your points.'; }); }
    $('hud').hidden = true; $('over').hidden = false; $('again').focus();
  }, 900);
}
function gameOver() { sfx.boom(true); S.shake = 0.9; finishScreen('Out of hearts!'); }
function win() { sfx.good(); setTimeout(() => sfx.good(), 300); finishScreen(topic < 0 ? 'You beat all 10 rules!' : 'Topic complete!'); }
function paintBest() { const b = store.get('ws3d-best'); $('best').textContent = b ? `Your best: ${b.toLocaleString()} points` : ''; }
function togglePause() { if (mode === 'play') { mode = 'paused'; $('pauseScr').hidden = false; $('resume').focus(); } else if (mode === 'paused') { mode = 'play'; $('pauseScr').hidden = true; last = performance.now(); } }
const QN = ['Low', 'Medium', 'High'];
function paintQuality() { $('qBtn').textContent = 'Graphics: ' + (quality.locked ? QN[quality.tier] : 'Auto (' + QN[quality.tier] + ')'); }
$('qBtn').addEventListener('click', () => { if (!quality.locked) { quality.locked = true; quality.tier = 0; } else if (quality.tier < 2) quality.tier++; else { quality.locked = false; quality.tier = startTier; } quality.apply(); store.set('lexi3d-tier', quality.tier); store.set('lexi3d-tier-manual', quality.locked ? 1 : 0); paintQuality(); });
const paintMute = () => $('mute').textContent = sfx.muted ? 'Sound off' : 'Sound on';
$('mute').addEventListener('click', () => { sfx.init(); sfx.setMuted(!sfx.muted); paintMute(); });
function buildTopics() {
  const box = $('topics'); box.textContent = '';
  [{i: -1, t: 'All 10 rules'}].concat(RULES.map((r, i) => ({i, t: r.title}))).forEach(o => { const b = document.createElement('button'); b.type = 'button'; b.className = 'topic' + (o.i === topic ? ' on' : ''); b.textContent = o.t; b.setAttribute('aria-pressed', o.i === topic); b.addEventListener('click', () => { topic = o.i; buildTopics(); }); box.append(b); });
}
addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', ' '].includes(k) && mode === 'play') e.preventDefault();
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.l = true;
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.r = true;
  else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
  else if (k === 'm' || k === 'M') { sfx.init(); sfx.setMuted(!sfx.muted); paintMute(); }
  else if (k === 'Enter' && (mode === 'menu' || mode === 'over') && document.activeElement?.tagName !== 'BUTTON') start();
});
addEventListener('keyup', e => { const k = e.key; if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.l = false; if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.r = false; });
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -FOX_Z), hit = new THREE.Vector3();
function pointerX(e) { if (mode !== 'play') return; ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera); if (ray.ray.intersectPlane(plane, hit)) S.targetX = Math.max(-XMAX, Math.min(XMAX, hit.x)); }
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) pointerX(e); });
canvas.addEventListener('pointerdown', pointerX);
$('start').addEventListener('click', start); $('again').addEventListener('click', start); $('menuBtn').addEventListener('click', () => { $('over').hidden = true; $('menu').hidden = false; mode = 'menu'; blocks.forEach(b => scene.remove(b.obj)); blocks.length = 0; S = null; });
$('resume').addEventListener('click', togglePause); $('pauseBtn').addEventListener('click', togglePause);
addEventListener('pagehide', () => { if (S && S.correct > 0 && !S.reported) { S.reported = true; reportRun('catcher', S.correct, S.wrong, true); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });

(async () => {
  paintBest(); paintQuality(); paintMute(); buildTopics();
  fetch(ASSET + 'data/word-catcher.json').then(r => r.ok ? r.json() : null).then(d => {
    if (!d) return; const ok = (a, n) => Array.isArray(a) && a.length >= n;
    if (d.pos) Object.keys(LEX).forEach(k => { if (ok(d.pos[k], 5)) LEX[k] = d.pos[k]; });
    if (ok(d.past, 8)) PAST = pairs(d.past); if (ok(d.plural, 8)) PLUR = pairs(d.plural); if (ok(d.he, 8)) HE = pairs(d.he); makeRules();
  }).catch(() => {});
  try { await document.fonts.load('40px "Lilita One"'); } catch (e) {}
  A = await loadAll(renderer, ['fox', 'q_Tree', 'q_Tree_Fruit', 'q_Bush', 'q_Bush_Fruit', 'q_Rock_2', 'q_RockPlatform_Tall', 'q_Cloud_1', 'q_Cloud_2', 'q_Cloud_3', 'q_Bomb', 'q_Gem_Pink', 'q_Heart', 'q_Star', 'k_signage_finish_wide'], p => $('loadFill').style.width = Math.round(p * 100) + '%');
  scene.environment = A.env; scene.environmentIntensity = 0.6; renderer.toneMappingExposure = 0.95; sky = makeSky(scene, A.bg); sky.material.uniforms.sat.value = 1.1;
  buildIsland();
  foxR = inst(A.models, 'fox', 2.4, {axis: 'z'}); fox = new THREE.Group(); fox.add(foxR.obj); scene.add(fox); mixers.add(foxR.mixer); play(foxR, 'survey');
  netRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 8, 48), new THREE.ShaderMaterial({uniforms: {time: {value: 0}}, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float time; varying vec2 vU; void main(){ float s = 0.5+0.5*sin(vU.x*40.0 - time*6.0); gl_FragColor = vec4(mix(vec3(0.3,0.9,1.0), vec3(1.0,0.85,0.3), s)*1.6, 1.0); }'}));
  netRing.rotation.x = Math.PI / 2 - 0.55; scene.add(netRing);
  mode = 'menu'; $('loading').hidden = true; $('start').disabled = false; $('start').textContent = 'Start catching';
  window.READY = 1;
})();
window.__dbg = {get S() { return S; }, get mode() { return mode; }, quality, sim(n) { for (let i = 0; i < n; i++) update(1 / 30); }, spawnWord: () => spawnWord(), blocks, catchNext() { const b = blocks.find(b => !b.landed && b.kind === 'word'); if (b) catchBlock(b); return b && b.w; }};
requestAnimationFrame(frame);
