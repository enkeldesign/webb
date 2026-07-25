import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, releaseSource, main, styles] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/styles.css', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const viewportFunction = main.match(/function getViewportSize\(\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(viewportFunction, 'Production must expose one viewport measurement boundary');

assert.match(viewportFunction, /window\.visualViewport/, 'TURN must still observe the live visual viewport');
assert.match(viewportFunction, /window\.innerWidth/, 'Width must fall back to the layout viewport');
assert.match(viewportFunction, /window\.innerHeight/, 'Height must fall back to the layout viewport');
assert.match(viewportFunction, /root\.clientWidth/, 'Width must include the document viewport as an iOS rotation fallback');
assert.match(viewportFunction, /root\.clientHeight/, 'Height must include the document viewport as an iOS rotation fallback');
assert.ok((viewportFunction.match(/Math\.max\(/g) || []).length >= 4, 'Viewport dimensions must choose the largest valid measurement rather than the first stale iOS value');
assert.doesNotMatch(viewportFunction, /viewport\?\.height \|\| window\.innerHeight/, 'A temporarily short visual viewport must never expose the cyan page background');

assert.match(styles, /body \{[\s\S]*min-width: 100vw;[\s\S]*min-height: 100vh;/, 'The app surface must cover the complete layout viewport even between resize events');
assert.match(styles, /@supports \(height: 100lvh\) \{[\s\S]*body \{[\s\S]*min-height: 100lvh;/, 'Modern WebKit must use the stable large viewport as the final coverage floor');
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`), 'The viewport fix must ship through the current release identity');

console.log(`TURN ${release.id} full viewport coverage after iOS rotation passed.`);
