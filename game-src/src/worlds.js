// Realistic world engine for Grammar Runner: scrolling terrain built from photo-scanned materials,
// one shape per world (meadow hills, canyon walls, glacier, lava field, moon craters), wind grass, smoke, lava.
import {THREE, ASSET} from './common.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ---------------- noise ---------------- */
const P = new Uint8Array(512); (() => { const p = [...Array(256).keys()]; let s = 1337; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; })();
const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function noise(x, y) { // 2D simplex, roughly -1..1
  const F = 0.366025403, Gk = 0.211324865; const s = (x + y) * F, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * Gk;
  const x0 = x - (i - t), y0 = y - (j - t); const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
  const x1 = x0 - i1 + Gk, y1 = y0 - j1 + Gk, x2 = x0 - 1 + 2 * Gk, y2 = y0 - 1 + 2 * Gk; const ii = i & 255, jj = j & 255;
  const c = (xx, yy, g) => { let tt = 0.5 - xx * xx - yy * yy; if (tt < 0) return 0; tt *= tt; return tt * tt * (G[g][0] * xx + G[g][1] * yy); };
  return 70 * (c(x0, y0, P[ii + P[jj]] & 7) + c(x1, y1, P[ii + i1 + P[jj + j1]] & 7) + c(x2, y2, P[ii + 1 + P[jj + 1]] & 7));
}
export const fbm = (x, y, o = 4) => { let a = 0, f = 1, w = 0.5; for (let i = 0; i < o; i++) { a += w * noise(x * f, y * f); f *= 2.03; w *= 0.5; } return a; };
const ridge = (x, y, o = 4) => { let a = 0, f = 1, w = 0.5; for (let i = 0; i < o; i++) { a += w * (1 - Math.abs(noise(x * f, y * f))); f *= 2.1; w *= 0.5; } return a; };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------------- world shapes: height of the ground at (x, z); the path (|x| < 4.3) is always at 0 ---------------- */
export const SHAPES = {
  meadow(x, z) { const ax = Math.abs(x), e = sstep(4.6, 18, ax); return -0.05 + e * (1.2 + 5 * (fbm(x * 0.018, z * 0.018) * 0.5 + 0.5) * sstep(10, 60, ax)) + 0.25 * fbm(x * 0.15, z * 0.15) * sstep(4.5, 7, ax); },
  canyon(x, z) {
    const ax = Math.abs(x), floor = 0.35 * fbm(x * 0.08, z * 0.08) * sstep(4.6, 8, ax);
    let w = sstep(11, 17 + 4 * noise(z * 0.03, x > 0 ? 3 : 7), ax) * (24 + 12 * fbm(z * 0.012, x * 0.02));
    w = Math.floor(w / 3.2) * 3.2 + sstep(0, 1, (w % 3.2) / 0.9) * 0.9; // stepped sandstone ledges
    return floor + w + 1.2 * noise(x * 0.3, z * 0.3) * sstep(11, 16, ax);
  },
  ice(x, z) {
    const ax = Math.abs(x); const snow = 0.25 * fbm(x * 0.1, z * 0.1) * sstep(4.6, 7, ax);
    const wall = sstep(8.5, 12 + 2 * noise(z * 0.05, x), ax) * (9 + 9 * ridge(z * 0.035, x * 0.05, 4) + 5 * sstep(20, 50, ax));
    return snow + wall;
  },
  lava(x, z) {
    const ax = Math.abs(x); const crust = 0.4 * fbm(x * 0.12, z * 0.12) + 0.6;
    const channel = 1 - Math.abs(noise(x * 0.025 + 40, z * 0.012)); // winding lava rivers further out
    const w0 = 7 + 1.2 * noise(z * 0.04, x > 0 ? 1 : 5), w1 = w0 + 3 + 2.5 * (noise(z * 0.03, x > 0 ? 9 : 2) * 0.5 + 0.5);
    const moat = sstep(w0 - 1, w0 + 0.6, ax) * sstep(w1 + 0.6, w1 - 1, ax); // a lava river on each side of the causeway
    const chan = Math.max(sstep(0.82, 0.93, channel) * sstep(6.5, 9, ax), moat);
    const ridges = sstep(14, 40, ax) * (4 + 10 * ridge(x * 0.02, z * 0.02, 3));
    return (crust * sstep(4.6, 6.5, ax) - chan * 2.2 + ridges) * 1;
  },
  moon(x, z) {
    const ax = Math.abs(x); let h = 1.5 * fbm(x * 0.02, z * 0.02) * sstep(6, 30, ax) + 0.15 * fbm(x * 0.3, z * 0.3) * sstep(4.6, 6, ax);
    // craters on a jittered grid
    const cs = 22, cx = Math.floor(x / cs), cz = Math.floor(z / cs);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const gx = cx + i, gz = cz + j, r1 = noise(gx * 7.1, gz * 3.3), r2 = noise(gx * 2.7, gz * 9.1), r3 = noise(gx * 5.3, gz * 1.7);
      if (r3 < 0) continue; const px = (gx + 0.5 + r1 * 0.35) * cs, pz = (gz + 0.5 + r2 * 0.35) * cs, R = 3 + r3 * 7;
      if (Math.abs(px) < R + 6) continue; const d = Math.hypot(x - px, z - pz) / R;
      if (d < 1) h += -R * 0.28 * (1 - d * d); else if (d < 1.6) h += R * 0.12 * (1 - (d - 1) / 0.6) ** 2;
    }
    return h * sstep(4.6, 6, ax);
  }
};

/* ---------------- textures ---------------- */
const texCache = {};
export function tex(name, srgb = true, rep = true) {
  if (texCache[name]) return texCache[name];
  const t = new THREE.TextureLoader().load(ASSET + 'tex/' + name, undefined, undefined, () => console.warn('missing texture', name));
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return texCache[name] = t;
}
// Each sky: a photo backdrop (JPG) and a small HDR for lighting. Missing files fall back to the meadow sky.
const skyCache = {};
export async function loadSky(renderer, id) {
  if (skyCache[id]) return skyCache[id];
  const pm = new THREE.PMREMGenerator(renderer);
  const bg = await new THREE.TextureLoader().loadAsync(ASSET + 'sky/' + id + '.jpg').catch(() => null);
  if (bg) bg.colorSpace = THREE.SRGBColorSpace;
  let env = null;
  try {
    let url = ASSET + 'sky/' + id + '.hdr';
    if (window.LEXI_PACK) { const r = await fetch(ASSET + 'sky/' + id + '.hdr.json'); if (!r.ok) throw 0; const s = atob((await r.json()).b64); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); url = URL.createObjectURL(new Blob([b])); }
    const t = await new RGBELoader().loadAsync(url); t.mapping = THREE.EquirectangularReflectionMapping; env = pm.fromEquirectangular(t).texture; t.dispose();
  } catch (e) { console.warn('no hdr for', id); }
  let meta = null; try { const r = await fetch(ASSET + 'sky/' + id + '.json'); if (r.ok) meta = await r.json(); } catch (e) {}
  return skyCache[id] = {bg, env, meta};
}

/* ---------------- terrain material: triplanar photo textures, slope blend, plus lava / ice / strata effects ---------------- */
const SHARED = {time: {value: 0}, lite: false}; // lite: the lowest quality tier skips surface relief
export function terrainMaterial(o) {
  const m = new THREE.MeshStandardMaterial({roughness: o.rough ?? 0.95, metalness: 0, color: '#ffffff'});
  m.userData.o = o;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {tA: {value: o.a}, tB: {value: o.b || o.a}, nA: {value: o.na || null}, nB: {value: o.nb || o.na || null}, nStr: {value: o.ns ?? 0.9}, dsat: {value: o.desat ?? 0}, sA: {value: o.sa || 0.25}, sB: {value: o.sb || 0.12},
      cA: {value: new THREE.Color(o.ca || '#ffffff')}, cB: {value: new THREE.Color(o.cb || '#ffffff')}, slope: {value: new THREE.Vector2(...(o.slope || [0.35, 0.6]))},
      time: SHARED.time, lavaT: {value: o.lavaTex || null}, cloudT: {value: o.cloudTex || null}, lavaLvl: {value: o.lavaLevel ?? -0.6}, deep: {value: new THREE.Color(o.deep || '#0a3a6a')}});
    sh.vertexShader = sh.vertexShader.replace('#include <common>', o.rockInst ? '#include <common>\nvarying vec3 vTP; varying vec3 vTN;' : '#include <common>\nattribute vec3 apos; varying vec3 vTP; varying vec3 vTN;')
      .replace('#include <begin_vertex>', o.rockInst ? '#include <begin_vertex>\nvTP = (instanceMatrix * vec4(position, 1.0)).xyz; vTN = normalize(mat3(instanceMatrix) * normal);' : '#include <begin_vertex>\nvTP = apos; vTN = normal;');
    const defs = (o.lava ? '#define LAVA\n' : '') + (o.ice ? '#define ICE\n' : '') + (o.strata ? '#define STRATA\n' : '') + (o.na && !SHARED.lite ? '#define TNORM\n' : '') + (o.cracks ? '#define CRACKS\n' : '');
    sh.fragmentShader = defs + sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D tA, tB, nA, nB, lavaT, cloudT; uniform float sA, sB, nStr, dsat, time, lavaLvl; uniform vec3 cA, cB, deep; uniform vec2 slope; varying vec3 vTP; varying vec3 vTN;
      vec4 tri(sampler2D t, vec3 p, vec3 w){ return texture2D(t, p.zy)*w.x + texture2D(t, p.xz)*w.y + texture2D(t, p.xy)*w.z; }
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      #ifdef TNORM
      vec3 triN(sampler2D t, vec3 p, vec3 w){ vec2 a = texture2D(t, p.zy).xy*2.0-1.0, b = texture2D(t, p.xz).xy*2.0-1.0, c = texture2D(t, p.xy).xy*2.0-1.0; return vec3(0.0, a.y, a.x)*w.x + vec3(b.x, 0.0, b.y)*w.y + vec3(c.x, c.y, 0.0)*w.z; }
      #endif`)
      .replace('#include <map_fragment>', `
      vec3 tn = normalize(vTN); vec3 gn = normalize(cross(dFdx(vTP), dFdy(vTP))); vec3 bw = pow(abs(mix(tn, gn, 0.8)), vec3(6.0)); bw /= (bw.x+bw.y+bw.z); // weights from the real surface, so steep walls never smear
      vec3 colA = tri(tA, vTP*sA, bw).rgb * cA; vec3 colB = tri(tB, vTP*sB, bw).rgb * cB;
      // break up tiling with a large-scale brightness variation
      float big = texture2D(tA, vTP.xz*0.013).r; colA *= 0.8 + 0.45*big; colB *= 0.85 + 0.3*big;
      float k = smoothstep(slope.x, slope.y, 1.0 - tn.y);
      vec3 col = mix(colA, colB, k);
      #ifdef STRATA
        float band = sin(vTP.y*2.1 + sin(vTP.z*0.05)*2.0) * 0.5 + 0.5; float band2 = sin(vTP.y*0.55 + 1.3)*0.5+0.5;
        col *= mix(vec3(1.0), mix(vec3(1.08,0.82,0.62), vec3(0.78,0.42,0.26), band2) * (0.88 + 0.22*band), k);
      #endif
      #ifdef ICE
        // steep faces are deep glacier ice: blue, glassy, darker in the cracks; flat tops stay snowy
        float lum = dot(colB, vec3(0.333)); vec3 iceCol = mix(deep, vec3(0.78,0.92,0.98), smoothstep(-0.1, 0.7, lum));
        col = mix(colA, iceCol, k*0.7);
      #endif
      col = mix(col, vec3(dot(col, vec3(0.3,0.6,0.1))), dsat);
      diffuseColor.rgb *= col;
      float lavaMask = 0.0;
      #ifdef LAVA
        lavaMask = smoothstep(lavaLvl + 0.25, lavaLvl - 0.15, vTP.y);
        diffuseColor.rgb *= 1.0 - lavaMask*0.95;
      #endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      #ifdef TNORM
        { vec3 off = mix(triN(nA, vTP*sA, bw), triN(nB, vTP*sB, bw), k) * nStr; normal = normalize((viewMatrix * vec4(normalize(tn + off), 0.0)).xyz); }
      #endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      #ifdef ICE
        roughnessFactor = mix(roughnessFactor, 0.12, k);
      #endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef LAVA
        { vec2 uv = vTP.xz * 0.045; vec4 nz = texture2D(cloudT, uv*0.6 + vec2(time*0.004, time*0.011));
          vec2 T = uv + nz.xy*0.25; vec3 lv = texture2D(lavaT, T + vec2(-time*0.012, time*0.02)).rgb;
          float heat = 0.55 + 0.6*texture2D(cloudT, uv*1.7 - vec2(0.0, time*0.02)).r;
          totalEmissiveRadiance += lv*lv*vec3(3.4,1.5,0.5)*lavaMask*heat;
          #ifdef CRACKS
            // glowing seams in the cooled crust: the hottest veins of the lava photo show through, in patches
            vec3 lt = texture2D(lavaT, vTP.xz*0.07 + vec2(0.31,0.17)).rgb; float vein = smoothstep(0.62, 0.9, dot(lt, vec3(0.45,0.45,0.1)));
            float patchy = smoothstep(0.25, 0.6, texture2D(cloudT, vTP.xz*0.012).r);
            totalEmissiveRadiance += vec3(2.4,0.7,0.12)*vein*patchy*(1.0-lavaMask)*(0.75+0.25*sin(time*1.3 + vTP.x*0.7 + vTP.z*0.3));
          #endif
        }
      #endif`);
  };
  m.customProgramCacheKey = () => JSON.stringify([!!o.lava, !!o.ice, !!o.strata, !!o.na && !SHARED.lite, !!o.cracks, !!o.rockInst, o.id]);
  return m;
}

/* ---------------- terrain chunks (scroll with the run, regenerated when recycled) ---------------- */
// x samples: dense near the path, sparse far away
const PLACEHOLDER = new THREE.MeshStandardMaterial({color: '#6a6a60'});
const XS = (() => { const a = [4.25, 4.6, 5.2, 6, 7, 8.2, 9.6, 11, 12.2, 13.4, 14.6, 16, 17.5, 19, 20.5, 22, 24, 26, 28.5, 31, 34.5, 38, 42.5, 47, 52, 58, 65, 72, 90, 115]; return [...a.map(v => -v).reverse(), ...a]; })();
export class Terrain {
  constructor(scene, opts) {
    this.scene = scene; this.SEG = opts.seg || 24; this.N = opts.count || 9; this.ZS = 20; this.chunks = [];
    this.shape = SHAPES.meadow; this.mat = null; this.pathMat = null;
    const cols = XS.length, rows = this.ZS + 1;
    for (let c = 0; c < this.N; c++) {
      const g = new THREE.BufferGeometry(); const n = cols * rows;
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('apos', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      const idx = []; for (let r = 0; r < rows - 1; r++) for (let i = 0; i < cols - 1; i++) { if (XS[i] < 0 && XS[i + 1] > 0) continue; const a = r * cols + i, b = a + 1, d = a + cols, e = d + 1; idx.push(a, b, d, b, e, d); }
      g.setIndex(idx);
      const mesh = new THREE.Mesh(g, PLACEHOLDER); mesh.receiveShadow = true; mesh.castShadow = false; mesh.frustumCulled = false;
      // the path strip: flat, its own photo material
      const pg = new THREE.PlaneGeometry(8.6, this.SEG, 4, 6); pg.rotateX(-Math.PI / 2); pg.setAttribute('apos', new THREE.BufferAttribute(new Float32Array(pg.attributes.position.count * 3), 3));
      const path = new THREE.Mesh(pg, PLACEHOLDER); path.receiveShadow = true; path.position.y = 0.0;
      const grp = new THREE.Group(); grp.add(mesh, path); scene.add(grp);
      this.chunks.push({grp, mesh, path, z0: 0});
    }
  }
  setWorld(shape, mat, pathMat) { this.shape = shape; this.mat = mat; this.pathMat = pathMat; this.chunks.forEach(c => { c.mesh.material = mat; c.path.material = pathMat; }); }
  // place all chunks so they cover from z=+20 to far ahead; dist = metres run so far
  reset(dist) { this.chunks.forEach((c, i) => { c.grp.position.z = 20 - i * this.SEG - this.SEG / 2; this.build(c, dist + (-(c.grp.position.z))); }); this.onBuild && this.chunks.forEach(c => this.onBuild(c)); }
  build(c, zAbsCenter) {
    // zAbs grows in the running direction; local z of a vertex = -(zAbs - zAbsCenter)
    c.zAbs = zAbsCenter; const g = c.mesh.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, ap = g.attributes.apos.array, f = this.shape;
    const cols = XS.length; let k = 0;
    for (let r = 0; r <= this.ZS; r++) {
      const lz = this.SEG / 2 - r * this.SEG / this.ZS, za = zAbsCenter - lz;
      for (let i = 0; i < cols; i++, k++) {
        const x = XS[i], h = f(x, za), e = 0.25, hx = f(x + e, za) - f(x - e, za), hz = f(x, za + e) - f(x, za - e);
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = lz; ap[k * 3] = x; ap[k * 3 + 1] = h; ap[k * 3 + 2] = za;
        const nx = -hx, ny = 2 * e, nz = hz, L = Math.hypot(nx, ny, nz); nor[k * 3] = nx / L; nor[k * 3 + 1] = ny / L; nor[k * 3 + 2] = nz / L;
      }
    }
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.apos.needsUpdate = true;
    const pp = c.path.geometry, pa = pp.attributes.position.array, papos = pp.attributes.apos.array, puv = pp.attributes.uv.array;
    for (let i = 0; i < pp.attributes.position.count; i++) { const x = pa[i * 3], lz = pa[i * 3 + 2]; papos[i * 3] = x; papos[i * 3 + 1] = 0; papos[i * 3 + 2] = zAbsCenter - lz; puv[i * 2] = x / 4.3; puv[i * 2 + 1] = (zAbsCenter - lz) / 4.3; }
    pp.attributes.apos.needsUpdate = pp.attributes.uv.needsUpdate = true;
    g.computeBoundingSphere();
  }
  update(dz, dist) {
    for (const c of this.chunks) {
      c.grp.position.z += dz;
      if (c.grp.position.z - this.SEG / 2 > 20) { c.grp.position.z -= this.N * this.SEG; this.build(c, dist - c.grp.position.z); this.onBuild && this.onBuild(c); }
    }
  }
}

/* ---------------- grass: thin curved blades, coloured from root to tip, swaying in the wind ---------------- */
export function grassBlades(count) {
  const g = new THREE.BufferGeometry(); const pos = [], uvs = [], idx = []; const segs = 2;
  for (let b = 0; b < 3; b++) {
    const ang = b * 2.094 + 0.4, ca = Math.cos(ang), sa = Math.sin(ang), base = pos.length / 3, off = b === 0 ? 0 : 0.05, ox = Math.cos(ang * 2) * off, oz = Math.sin(ang * 2) * off, hb = 1 - b * 0.18;
    for (let s = 0; s <= segs; s++) { const t = s / segs, w = 0.028 * (1 - t * 0.9), bend = t * t * 0.3; const y = t * hb;
      pos.push(ox - ca * w + sa * bend, y, oz - sa * w + ca * bend, ox + ca * w + sa * bend, y, oz + sa * w + ca * bend); uvs.push(0, t, 1, t); }
    for (let s = 0; s < segs; s++) { const a = base + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide});
  m.userData.uniforms = {base: {value: new THREE.Color('#2d5a17')}, tip: {value: new THREE.Color('#9ec25a')}};
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.uniforms, {time: SHARED.time});
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float time; varying float vH; varying vec3 vUpN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vH = uv.y; vUpN = normalMatrix * vec3(0.0, 1.0, 0.0); vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float wv = sin(time*1.7 + ip.x*0.35 + ip.z*0.21) + 0.5*sin(time*2.9 + ip.z*0.7);
        transformed.x += wv * 0.09 * uv.y * uv.y; transformed.z += wv * 0.05 * uv.y * uv.y;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 base, tip; varying float vH; varying vec3 vUpN;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(base, tip, smoothstep(0.0, 1.0, vH));')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(vUpN);');
  };
  const mesh = new THREE.InstancedMesh(g, m, count); mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3); mesh.frustumCulled = false; mesh.receiveShadow = true;
  return mesh;
}
/* ---------------- rocks: lumpy instanced boulders in the world's own photo rock ---------------- */
const rockGeo = (() => { let g = new THREE.IcosahedronGeometry(1, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-3); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.32 * noise(x * 1.3 + z, y * 1.3 - z) + 0.12 * noise(x * 3.1 - y, z * 3.1 + y); p.setXYZ(i, x * n, y * n * 0.72, z * n); }
  g.computeVertexNormals(); return g; })();
export function makeRocks(count) { const m = new THREE.InstancedMesh(rockGeo, PLACEHOLDER, count); m.castShadow = true; m.receiveShadow = true; return m; }
export function scatterRocks(mesh, shape, zAbsCenter, seg, o) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let seed = Math.floor(zAbsCenter * 7.77 + 91) | 0; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < mesh.count; i++) {
    const side = i % 2 ? 1 : -1, ax = (o.min || 5.2) + Math.pow(rnd(), 1.6) * (o.width || 24), lz = (rnd() - 0.5) * seg, x = side * ax, za = zAbsCenter - lz, r = (o.size || 0.5) * (0.25 + Math.pow(rnd(), 2.6) * 2.4) * (1 + ax * 0.04);
    v.set(x, shape(x, za) + r * 0.15, lz); e.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28); q.setFromEuler(e); s.set(r * (0.8 + rnd() * 0.7), r * (0.7 + rnd() * 0.4), r * (0.8 + rnd() * 0.6)); m.compose(v, q, s); mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
}
// Scatter blades over a chunk on the terrain (called whenever a chunk is rebuilt)
export function scatterGrass(mesh, shape, zAbsCenter, seg, opts) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  let seed = Math.floor(zAbsCenter * 13.37) | 0; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < mesh.count; i++) {
    const side = i % 2 ? 1 : -1, ax = 4.35 + Math.pow(rnd(), opts.spread || 1.4) * (opts.width || 16), lz = (rnd() - 0.5) * seg, x = side * ax, za = zAbsCenter - lz;
    const patch = noise(x * 0.08, za * 0.08); if (opts.patchy && patch < opts.patchy) { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); continue; }
    v.set(x, shape(x, za) - 0.03, lz); e.set((rnd() - 0.5) * 0.35, rnd() * 6.28, (rnd() - 0.5) * 0.35); q.setFromEuler(e);
    const h = (opts.h || 0.6) * (0.55 + rnd() * 0.8) * (0.8 + 0.4 * (patch * 0.5 + 0.5)); s.set(1.2, h, 1.2); m.compose(v, q, s); mesh.setMatrixAt(i, m);
    const shade = 0.75 + rnd() * 0.4; c.setRGB(shade * (opts.dry && rnd() < 0.3 ? 1.25 : 1), shade, shade * 0.95); mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
}

/* ---------------- smoke: soft photographic smoke puffs that rise and spread ---------------- */
export class Smoke {
  constructor(scene, map, n = 46) {
    this.list = [];
    for (let i = 0; i < n; i++) { const m = new THREE.SpriteMaterial({map, color: '#3a302c', transparent: true, opacity: 0, depthWrite: false, fog: true}); const s = new THREE.Sprite(m); s.visible = false; scene.add(s); this.list.push({s, life: 0, max: 1, v: new THREE.Vector3(), r: 0}); }
    this.i = 0; this.on = false;
  }
  emit(p, o = {}) { const k = this.list[this.i]; this.i = (this.i + 1) % this.list.length; k.s.position.copy(p); k.life = k.max = o.life || 7; k.size = o.size || 6; k.grow = o.grow || 1.8; k.v.set((Math.random() - 0.5) * 0.6, o.rise || 1.4, (Math.random() - 0.5) * 0.6); k.s.material.color.set(o.color || '#3a302c'); k.op = o.opacity || 0.55; k.s.material.rotation = Math.random() * 6.28; k.r = (Math.random() - 0.5) * 0.15; k.s.visible = true; }
  update(dt, dz) {
    for (const k of this.list) { if (!k.s.visible) continue; k.life -= dt; if (k.life <= 0) { k.s.visible = false; continue; } const t = 1 - k.life / k.max;
      k.s.position.addScaledVector(k.v, dt); k.s.position.z += dz; k.s.material.rotation += k.r * dt; const sc = k.size * (1 + t * k.grow); k.s.scale.set(sc, sc, 1); k.s.material.opacity = k.op * Math.sin(Math.min(1, t * 1.4) * Math.PI) ; }
  }
  hide() { this.list.forEach(k => k.s.visible = false); }
}

export const shared = SHARED;
