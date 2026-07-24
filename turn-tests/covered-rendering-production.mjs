import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [releaseSource, index, app, guard, selector, main] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/covered-rendering.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, new RegExp(`\\.\\/app\\.js\\?build=${release.cacheKey}`));

assert.match(app, /import\(withBuild\('\.\/render\/covered-rendering\.js'\)\)/, 'The covered-rendering policy must load through the release-aware app loader');
assert.match(app, /installCoveredRenderingGuard\(\)/, 'The renderer guard must install before the game core');
assert.ok(
  app.indexOf('./render/covered-rendering.js') < app.indexOf('./main.js'),
  'The guard must wrap WebGLRenderer before main.js registers its animation loop'
);

assert.match(guard, /THREE\.WebGLRenderer\.prototype/, 'The guard must cover the renderer loop at its shared registration boundary');
assert.match(guard, /TRACK_SELECTOR_CLASS = 'turn-track-select-open'/, 'Only the fully covering track selector should add this new pause condition');
assert.match(guard, /document\.body\?\.classList\.contains\(TRACK_SELECTOR_CLASS\)/, 'Covered frames must be detected from the selector lifecycle class');
assert.match(guard, /stats\.skippedFrames \+= 1/, 'Skipped covered frames must remain measurable through diagnostics');
assert.match(guard, /callback\.call\(renderer, time, frame\)/, 'Visible frames must preserve the original renderer callback context and arguments');
assert.match(guard, /typeof callback !== 'function'/, 'Removing an animation loop must still delegate directly to Three.js');
assert.match(guard, /Symbol\.for\('turn\.covered-rendering-installed'\)/, 'Installation must be idempotent across app reload paths');
assert.match(guard, /globalThis\.__turnCoveredRendering = diagnostics/, 'Diagnostics must be inspectable without changing gameplay state');
assert.doesNotMatch(guard, /requestAnimationFrame|setInterval|setTimeout/, 'The guard must not create a second scheduling loop');

assert.match(selector, /document\.body\.classList\.add\('turn-track-select-open'\)/, 'Track selection must announce when it fully covers the race scene');
assert.match(selector, /document\.body\.classList\.remove\('turn-track-select-open'\)/, 'Closing track selection must resume normal rendering');
assert.match(main, /if \(document\.body\.classList\.contains\('turn-lot-open'\)\) return 'lot'/, 'The existing Lot pause must remain intact');
assert.match(main, /if \(installGate && !installGate\.hidden\) return 'install gate'/, 'The existing install-gate pause must remain intact');

console.log(`TURN ${release.id} fully covered track-selector rendering guard passed.`);
