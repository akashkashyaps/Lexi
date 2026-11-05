// Builds the 3D games into Lexi's static/games folder.
//   cd game-src && npm install && npm run build
// Output (relative to the Lexi repo root):
//   static/games/grammar-runner.html   3D Grammar Runner (replaces the 2D one)
//   static/games/word-bridge.html      Word Bridge (Rapier physics)
//   (static/games/word-storm.html      3D Word Storm, only if enabled in GAMES below)
//   each page also gets a .gz copy, because the physics engine is large
//   static/games/{models,sky,tex}/, sky_env.hdr, sky_bg.jpg   assets loaded at runtime
// Game data stays where it already is: static/games/data/*.json
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');           // Lexi repo root
const OUT = path.join(ROOT, 'static', 'games');
const ASSETS = '/static/games/';                                  // URL the games load assets from
// Word Storm (storm) is built too only if you add it here: {runner: ..., storm: 'word-storm.html'}
const GAMES = {runner: 'grammar-runner.html', bridge: 'word-bridge.html'};

fs.mkdirSync(OUT, {recursive: true});
for (const dir of ['models', 'sky', 'tex']) fs.cpSync(path.join(import.meta.dirname, 'assets', dir), path.join(OUT, dir), {recursive: true});
for (const f of ['sky_env.hdr', 'sky_bg.jpg']) fs.copyFileSync(path.join(import.meta.dirname, 'assets', f), path.join(OUT, f));
const tex = fs.readdirSync(path.join(import.meta.dirname, 'assets', 'tex')).sort();

for (const [g, file] of Object.entries(GAMES)) {
  const r = await build({entryPoints: [path.join(import.meta.dirname, 'src', g + '.js')], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, logLevel: 'warning'});
  const js = `window.LEXI_ASSETS=${JSON.stringify(ASSETS)};window.LEXI_TEX=${JSON.stringify(tex)};` + r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  let html = fs.readFileSync(path.join(import.meta.dirname, 'src', g + '.html'), 'utf8');
  html = html.replace('<script>/*PACK*/</script>', '')                          // packs were only for the preview host
             .replace(/href="index\.html"/g, 'href="/"')                         // "All games" goes back to the Lexi lobby
             .replace(/>All games</g, '>Back to Lexi<')
             .replace('/*BUNDLE*/', () => js);
  fs.writeFileSync(path.join(OUT, file), html);
  const gz = zlib.gzipSync(html, {level: 9}); fs.writeFileSync(path.join(OUT, file + '.gz'), gz); // Flask sends this copy, see send_game in main.py
  console.log(file, Math.round(html.length / 1024) + ' KB, gzipped ' + Math.round(gz.length / 1024) + ' KB');
}
