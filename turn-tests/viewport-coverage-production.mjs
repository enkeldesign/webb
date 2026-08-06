import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, nextIndex, releaseSource, main, styles, legacyViewportEntry, startupPerformance] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/styles.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/startup-viewport-r177.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/startup-performance-r180.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);

assert.match(index, /startup-performance-r180\.js\?revision=r180-single-viewport-owner/,
  'Production must load the non-layout startup performance module');
assert.doesNotMatch(index, /startup-viewport-r177\.js/,
  'Production must not execute the experimental viewport layer');
assert.ok(
  index.indexOf('startup-performance-r180.js') < index.indexOf('app.js?build='),
  'Cold-start preloading must begin before the canonical app graph'
);
assert.match(nextIndex, /startup-performance-r180\.js\?revision=r180-single-viewport-owner/,
  'TURN NEXT must use the same non-layout startup path');
assert.doesNotMatch(nextIndex, /startup-viewport-r177\.js/);

assert.match(legacyViewportEntry, /startup-performance-r180\.js\?revision=r180-single-viewport-owner/);
assert.doesNotMatch(legacyViewportEntry, /MIN_RACING_ASPECT|fitRacingSurface|standaloneScreenSize|targetViewportSize|renderer\.setSize|camera\.aspect|--turn-stage/,
  'The old URL may only forward to startup performance behavior');
assert.doesNotMatch(startupPerformance, /MIN_RACING_ASPECT|fitRacingSurface|standaloneScreenSize|targetViewportSize|renderer\.setSize|camera\.aspect|--turn-stage|--app-width|--app-height/,
  'Startup performance must never size the page or renderer');

assert.match(styles, /:root \{[\s\S]*--app-width: 100vw;[\s\S]*--app-height: 100vh;/,
  'CSS must provide the app viewport before JavaScript starts');
assert.match(styles, /@supports \(height: 100dvh\)[\s\S]*--app-width: 100dvw;[\s\S]*--app-height: 100dvh;/,
  'Dynamic viewport units must remain the progressive enhancement');
assert.match(styles, /html,[\s\S]*body \{[\s\S]*width: 100%;[\s\S]*height: 100%;[\s\S]*overflow: hidden;/);
assert.match(styles, /#game \{[\s\S]*position: absolute;[\s\S]*inset: 0;[\s\S]*width: 100%;[\s\S]*height: 100%;/,
  'The renderer container must inherit the CSS viewport rather than create another page size');
assert.match(styles, /#game canvas \{[\s\S]*width: 100% !important;[\s\S]*height: 100% !important;/);

const resizeStart = main.indexOf('let resizeFrame = 0;');
const resizeEnd = main.indexOf('\nwindow.addEventListener(\'resize\'', resizeStart);
assert.ok(resizeStart >= 0 && resizeEnd > resizeStart, 'The canonical renderer resize function must exist in main.js');
const resizeBlock = main.slice(resizeStart, resizeEnd);
assert.match(resizeBlock, /const \{ width, height \} = getViewportSize\(\)/);
assert.match(resizeBlock, /camera\.aspect = width \/ height/);
assert.match(resizeBlock, /renderer\.setSize\(width, height\)/);
assert.equal((main.match(/renderer\.setSize\(/g) || []).length, 2,
  'Only main.js may initialize and resize the WebGL drawing buffer');

assert.doesNotMatch(index, /turn-landscape-launch-containment-r178/);
assert.doesNotMatch(nextIndex, /turn-landscape-launch-containment-r178/);
assert.doesNotMatch(index, /shell=20260806-r179/);
assert.doesNotMatch(nextIndex, /shell=20260806-r179/);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));

console.log(`TURN ${release.id} single-authority viewport architecture passed.`);