// Shared 3D engine for the Lexi games: renderer, sky, lighting, models, particles, sound, auto quality.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

export {THREE};
export const ASSET = (window.LEXI_ASSETS || 'assets/');

/* ---------------- renderer + auto quality ---------------- */
// Tier 2: bloom + soft shadows, tier 1: bloom at low res + small shadows, tier 0: no bloom, no shadows, lower resolution.
export function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let gpu = '';
  try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''; } catch (e) {}
  const weak = /intel|uhd|hd graphics|iris|mali|adreno|swiftshader|llvmpipe|microsoft basic/i.test(gpu);
  return {renderer, gpu, startTier: weak ? 1 : 2};
}

export class Quality {
  constructor(app, tier) { this.app = app; this.tier = tier; this.acc = 0; this.n = 0; this.good = 0; this.locked = false; this.apply(); }
  apply() {
    const {renderer, bloom, sun} = this.app; const t = this.tier;
    this.app.beforeApply && this.app.beforeApply(t);
    const dpr = Math.min(window.devicePixelRatio || 1, [0.75, 1, 1.5][t]);
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = t > 0;
    if (sun) { sun.castShadow = t > 0; const s = t === 2 ? 2048 : 1024; if (sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } }
    if (bloom) bloom.enabled = t > 0;
    const cp = this.app.composer; if (cp) { const n = [0, 2, 4][t]; if (cp.renderTarget1.samples !== n) { cp.renderTarget1.samples = cp.renderTarget2.samples = n; cp.renderTarget1.dispose(); cp.renderTarget2.dispose(); } }
    this.app.resize && this.app.resize();
    this.app.scene && this.app.scene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); } });
  }
  // Called each frame with real frame time; steps the tier down quickly when frames are slow, up slowly when smooth.
  sample(dt) {
    if (this.locked) return;
    this.acc += dt; this.n++;
    if (this.acc < 2) return;
    const fps = this.n / this.acc; this.acc = 0; this.n = 0;
    if (fps < 42 && this.tier > 0) { this.tier--; this.good = 0; this.apply(); }
    else if (fps > 58) { if (++this.good >= 4 && this.tier < 2) { this.tier++; this.good = 0; this.apply(); this.upgraded = (this.upgraded || 0) + 1; if (this.upgraded > 2) this.locked = true; } }
    else this.good = 0;
  }
}

export function makeComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.4, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {composer, bloom};
}

/* ---------------- sky ---------------- */
// One big sphere that shows the real sunset photo, recoloured per world, with a star layer for night and space worlds.
export function makeSky(scene, tex) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {map: {value: tex}, tint: {value: new THREE.Color(1, 1, 1)}, photo: {value: 1}, top: {value: new THREE.Color('#0b0820')}, bottom: {value: new THREE.Color('#3a1240')}, stars: {value: 0}, time: {value: 0}, sat: {value: 1}, bright: {value: 1}},
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 tint, top, bottom; uniform float photo, stars, time, sat, bright; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y,-1.0,1.0)) / 3.14159265 + 0.5);
        vec3 c = texture2D(map, uv).rgb;
        float g = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(g), c, sat) * tint * bright;
        vec3 grad = mix(bottom, top, smoothstep(-0.2, 0.7, d.y));
        vec3 col = mix(grad, c, photo);
        vec3 q = floor(d * 420.0); float s = h(q); float tw = 0.6 + 0.4*sin(time*2.0 + s*40.0);
        col += stars * vec3(step(0.9965, s) * tw) * smoothstep(-0.1, 0.25, d.y);
        vec3 q2 = floor(d * 160.0); float s2 = h(q2+3.1); col += stars * 0.6 * vec3(0.8,0.85,1.0) * step(0.998, s2);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10; scene.add(m);
  return m;
}

/* ---------------- loading ---------------- */
async function fetchJSON(u, onP) {
  const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status);
  const len = +r.headers.get('content-length') || 0; if (!r.body || !len) return r.json();
  const rd = r.body.getReader(); const parts = []; let got = 0;
  for (;;) { const {done, value} = await rd.read(); if (done) break; parts.push(value); got += value.length; onP && onP(Math.min(1, got / len)); }
  const all = new Uint8Array(got); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
  return JSON.parse(new TextDecoder().decode(all));
}
export async function loadAll(renderer, names, onProgress, opts = {}) {
  const manager = new THREE.LoadingManager();
  let done = 0; const total = names.length + (opts.noEnv ? 0 : 2);
  const tick = () => { done++; onProgress && onProgress(Math.min(1, done / total)); };
  const gl = new GLTFLoader(manager);
  const models = {};
  let url = n => ASSET + 'models/' + n + '.glb', hdrUrl = ASSET + 'sky_env.hdr';
  // In the hosted preview, binary files travel inside one JSON pack (base64) and are turned back into files here.
  if (window.LEXI_PACK) {
    try {
      const pack = await fetchJSON(ASSET + window.LEXI_PACK, f => onProgress && onProgress(f * 0.85));
      const blobs = {};
      for (const k in pack) { const s = atob(pack[k]), bin = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i); blobs[k] = URL.createObjectURL(new Blob([bin])); }
      url = n => blobs['models/' + n + '.glb'] || ASSET + 'models/' + n + '.glb'; hdrUrl = blobs['sky_env.hdr'] || hdrUrl;
      done = Math.round(total * 0.85);
    } catch (e) { console.warn('pack failed', e); }
  }
  const jobs = names.map(n => gl.loadAsync(url(n)).then(g => { models[n] = g; tick(); }).catch(e => { console.warn('model failed', n, e); tick(); }));
  const pmrem = new THREE.PMREMGenerator(renderer);
  let env = null, bg = null;
  if (!opts.noEnv) jobs.push(new RGBELoader().loadAsync(hdrUrl).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; env = pmrem.fromEquirectangular(t).texture; t.dispose(); tick(); }).catch(e => { console.warn('hdr failed', e); tick(); }));
  if (!opts.noEnv) jobs.push(new THREE.TextureLoader().loadAsync(ASSET + 'sky_bg.jpg').then(t => { t.colorSpace = THREE.SRGBColorSpace; bg = t; tick(); }).catch(e => { console.warn('sky failed', e); tick(); }));
  await Promise.all(jobs);
  return {models, env, bg};
}

// Clone a loaded model, scale it so its largest side (or a chosen axis) is `size`, and sit it on y=0.
export function inst(models, name, size, opts = {}) {
  const g = models[name]; if (!g) { const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial({color: 0xff00ff})); return {obj: m, mixer: null, clips: []}; }
  const src = g.scene;
  const o = g.animations.length ? SkeletonUtils.clone(src) : src.clone(true);
  const box = new THREE.Box3().setFromObject(o); const s = box.getSize(new THREE.Vector3());
  const ref = opts.axis === 'x' ? s.x : opts.axis === 'y' ? s.y : opts.axis === 'z' ? s.z : Math.max(s.x, s.y, s.z);
  const k = size / (ref || 1);
  const wrap = new THREE.Group(); o.scale.multiplyScalar(k);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
  o.position.set(-c.x, -box.min.y * k, -c.z);
  wrap.add(o);
  const shadow = opts.shadow !== false;
  o.traverse(m => { if (m.isMesh) { m.castShadow = shadow; m.receiveShadow = !!opts.receive; if (opts.cloneMat) m.material = m.material.clone(); if (m.isSkinnedMesh) m.frustumCulled = false; } });
  let mixer = null; if (g.animations.length) mixer = new THREE.AnimationMixer(o);
  wrap.userData.size = new THREE.Vector3(s.x * k, s.y * k, s.z * k);
  return {obj: wrap, mixer, clips: g.animations};
}
export function play(r, part, opts = {}) {
  if (!r.mixer) return null;
  const clip = r.clips.find(c => c.name.toLowerCase().includes(part.toLowerCase())); if (!clip) return null;
  const a = r.mixer.clipAction(clip);
  if (opts.once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
  if (opts.fade && r.current && r.current !== a) { a.reset().play(); r.current.crossFadeTo(a, opts.fade, false); }
  else { if (!opts.keep) r.mixer.stopAllAction(); a.reset().play(); }
  if (opts.speed) a.timeScale = opts.speed;
  r.current = a; return a;
}
export function tintModel(obj, color, amount = 0.6) {
  const c = new THREE.Color(color);
  obj.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color = m.material.color.clone().lerp(c, amount); } });
}

/* ---------------- particles ---------------- */
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}
// Glowing sparks (additive) or solid confetti (normal blend). Each particle: velocity, gravity, drag, life.
export class Particles {
  constructor(scene, max = 1500, additive = true, square = false) {
    this.max = max; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grav = new Float32Array(max); this.base = new Float32Array(max); this.drag = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const tex = square ? null : dotTexture();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {map: {value: tex}, scale: {value: 400}, square: {value: square ? 1 : 0}},
      vertexShader: `attribute float size; varying vec3 vC; varying float vR; uniform float scale; void main(){ vC=color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scale/max(0.1,-mv.z); vR = position.x*7.0+position.y*3.0; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; uniform float square; varying vec3 vC; varying float vR; void main(){ if(square>0.5){ vec2 p=gl_PointCoord-0.5; float a=vR; vec2 q=vec2(cos(a)*p.x-sin(a)*p.y, sin(a)*p.x+cos(a)*p.y); if(abs(q.x)>0.42||abs(q.y)>0.22) discard; gl_FragColor=vec4(vC,1.0);} else { vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vC*t.a, t.a);} }`,
      transparent: !square, depthWrite: square, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, vertexColors: true
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }
  emit(p, n, o = {}) {
    const col = new THREE.Color(); const cols = o.colors || [o.color || '#ffffff'];
    for (let k = 0; k < n; k++) {
      const i = this.i; this.i = (this.i + 1) % this.max;
      const sp = (o.speed || 5) * (0.35 + Math.random() * 0.65);
      let dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
      if (o.dir) { dx = dx * (o.spread ?? 0.4) + o.dir.x; dy = dy * (o.spread ?? 0.4) + o.dir.y; dz = dz * (o.spread ?? 0.4) + o.dir.z; }
      const r = o.radius || 0;
      this.pos[i * 3] = p.x + (Math.random() - 0.5) * r; this.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * r * (o.flat ? 0.2 : 1); this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * r;
      this.vel[i * 3] = dx * sp; this.vel[i * 3 + 1] = dy * sp + (o.up || 0); this.vel[i * 3 + 2] = dz * sp + (o.vz || 0);
      col.set(cols[(Math.random() * cols.length) | 0]); this.col[i * 3] = col.r; this.col[i * 3 + 1] = col.g; this.col[i * 3 + 2] = col.b;
      this.life[i] = this.maxLife[i] = (o.life || 1) * (0.6 + Math.random() * 0.4);
      this.base[i] = (o.size || 0.3) * (0.6 + Math.random() * 0.8); this.size[i] = this.base[i];
      this.grav[i] = o.gravity ?? -9; this.drag[i] = o.drag ?? 1.5;
    }
  }
  update(dt, scroll = 0) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.size[i]) this.size[i] = 0; continue; }
      this.life[i] -= dt; const f = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + scroll) * dt;
      this.size[i] = this.base[i] * Math.min(1, f * 2.5);
    }
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.color.needsUpdate = true;
  }
}

/* ---------------- text labels ---------------- */
export function labelTexture(text, o = {}) {
  const w = o.w || 512, h = o.h || 176; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const r = 36; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, r);
  g.fillStyle = o.bg || '#fff4dc'; g.fill(); g.lineWidth = 12; g.strokeStyle = o.border || '#231a45'; g.stroke();
  let fs = o.fs || 100; g.font = `${fs}px "Lilita One", "Arial Rounded MT Bold", sans-serif`;
  while (g.measureText(text).width > w - 70 && fs > 30) { fs -= 4; g.font = `${fs}px "Lilita One", "Arial Rounded MT Bold", sans-serif`; }
  g.fillStyle = o.fg || '#231a45'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + fs * 0.06);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// The fox model has one flat colour per facet. Smooth normals across the facets, then grow short fur as shells:
// copies of the mesh pushed out along the normals, each with fewer strands. Skinned, so the fur moves with the run.
export const FUR_SHELLS = [0, 5, 9];
export function furCoat(root) {
  const furLayers = [];
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
  return furLayers;
}


/* ---------------- sound (all synthesized, no files) ---------------- */
export class Sound {
  constructor() { this.ac = null; this.muted = false; try { this.muted = localStorage.getItem('lexi3d-mute') === '1'; } catch (e) {} this.musicOn = false; this.step = 0; this.key = 0; }
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.master = this.ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(this.ac.destination);
    this.musicGain = this.ac.createGain(); this.musicGain.gain.value = 0.28; this.musicGain.connect(this.master);
    const len = this.ac.sampleRate * 0.5; this.noise = this.ac.createBuffer(1, len, this.ac.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setMuted(m) { this.muted = m; try { localStorage.setItem('lexi3d-mute', m ? '1' : '0'); } catch (e) {} if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ac.currentTime, 0.05); }
  tone(f, dur, o = {}) {
    if (!this.ac) return; const t = this.ac.currentTime + (o.at || 0);
    const osc = this.ac.createOscillator(); const g = this.ac.createGain();
    osc.type = o.type || 'square'; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || this.master); osc.start(t); osc.stop(t + dur + 0.05);
  }
  hiss(dur, o = {}) {
    if (!this.ac) return; const t = this.ac.currentTime + (o.at || 0);
    const s = this.ac.createBufferSource(); s.buffer = this.noise; const f = this.ac.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 1200, t); if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
    const g = this.ac.createGain(); g.gain.setValueAtTime(o.vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.dest || this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  coin() { this.tone(988, 0.07, {vol: 0.12}); this.tone(1319, 0.14, {vol: 0.12, at: 0.06}); }
  jump() { this.tone(300, 0.18, {to: 700, type: 'triangle', vol: 0.18}); }
  good() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, {at: i * 0.06, vol: 0.16, type: 'square'})); this.hiss(0.4, {f: 6000, fTo: 1500, vol: 0.12, type: 'highpass'}); }
  bad() { this.tone(180, 0.35, {to: 90, type: 'sawtooth', vol: 0.22}); this.tone(120, 0.4, {to: 70, type: 'square', vol: 0.12, at: 0.05}); }
  boom(big) { this.hiss(big ? 1.2 : 0.6, {f: 900, fTo: 60, vol: big ? 0.8 : 0.5}); this.tone(90, big ? 0.8 : 0.4, {to: 35, type: 'sine', vol: 0.5}); }
  power() { [440, 554, 659, 880, 1109].forEach((f, i) => this.tone(f, 0.12, {at: i * 0.045, type: 'triangle', vol: 0.15})); }
  hit() { this.hiss(0.25, {f: 800, fTo: 200, vol: 0.4}); this.tone(140, 0.2, {to: 60, vol: 0.25, type: 'square'}); }
  whoosh() { this.hiss(0.6, {f: 400, fTo: 4000, vol: 0.25, type: 'bandpass'}); }
  // Simple driving beat: kick, hat, bass and arpeggio, key changes per world.
  startMusic() { if (!this.ac || this.musicOn) return; this.musicOn = true; this.next = this.ac.currentTime + 0.1; this.timer = setInterval(() => this.schedule(), 50); }
  stopMusic() { this.musicOn = false; clearInterval(this.timer); }
  schedule() {
    if (!this.ac) return; const spb = 60 / (this.bpm || 124) / 4;
    const roots = [[45, 45, 48, 43], [40, 40, 43, 38], [47, 47, 43, 45], [38, 38, 41, 36], [42, 42, 45, 40]][this.key % 5];
    while (this.next < this.ac.currentTime + 0.15) {
      const s = this.step % 16, bar = Math.floor(this.step / 16) % 4, at = this.next - this.ac.currentTime, root = roots[bar];
      const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
      if (s % 4 === 0) { this.tone(110, 0.18, {to: 40, type: 'sine', vol: 0.55, at, dest: this.musicGain}); }
      if (s % 2 === 1) this.hiss(0.04, {f: 8000, type: 'highpass', vol: 0.12, at, dest: this.musicGain});
      if (s === 4 || s === 12) this.hiss(0.15, {f: 2500, fTo: 900, type: 'bandpass', vol: 0.35, at, dest: this.musicGain});
      if (s % 2 === 0) this.tone(mtof(root - 12 + (s % 8 === 6 ? 12 : 0)), 0.14, {type: 'sawtooth', vol: 0.09, at, dest: this.musicGain});
      const arp = [0, 7, 12, 15, 12, 7, 3, 7][s % 8]; if (this.intense && s % 1 === 0) this.tone(mtof(root + 12 + arp), 0.09, {type: 'square', vol: 0.035, at, dest: this.musicGain});
      this.step++; this.next += spb;
    }
  }
}

export function lexiSession() { try { const s = JSON.parse(sessionStorage.getItem('lexi-return')); return s && s.session && s.session.sessionId ? s.session.sessionId : null; } catch (e) { return null; } }
export function reportRun(game, correct, wrong, leaving) {
  const sid = lexiSession(); if (!sid) return Promise.resolve(null);
  const body = JSON.stringify({session_id: sid, game, correct, wrong});
  return fetch('/game_result', {method: 'POST', headers: {'Content-Type': 'application/json'}, body, keepalive: !!leaving}).then(r => r.ok ? r.json() : null).catch(() => null);
}
export const store = {get(k, d = 0) { try { const v = localStorage.getItem(k); return v === null ? d : (+v || 0); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }};
