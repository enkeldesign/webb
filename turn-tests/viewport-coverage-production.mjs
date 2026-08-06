import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  index,
  nextIndex,
  releaseSource,
  main,
  styles,
  usableViewport,
  productionManifestSource,
  nextManifestSource
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/styles.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/pwa-usable-viewport-r181.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/site.webmanifest', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const productionManifest = JSON.parse(productionManifestSource);
const nextManifest = JSON.parse(nextManifestSource);

assert.match(
  index,
  /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, shrink-to-fit=no">/,
  'Production must explicitly disable legacy virtual-viewport shrinking'
);
assert.match(index, /pwa-usable-viewport-r181\.js\?revision=r181-usable-web-layer/);
assert.ok(
  index.indexOf('install-gate.js') < index.indexOf('pwa-usable-viewport-r181.js'),
  'Standalone detection must run before the usable-viewport boundary'
);
assert.ok(
  index.indexOf('pwa-usable-viewport-r181.js') < index.indexOf('app.js?build='),
  'The PWA boundary must be installed before main.js can publish physical-screen dimensions'
);
assert.match(nextIndex, /pwa-usable-viewport-r181\.js\?revision=r181-usable-web-layer/);

for (const manifest of [productionManifest, nextManifest]) {
  assert.equal(manifest.display, 'standalone', 'iOS must use the stable standalone presentation mode');
  assert.deepEqual(manifest.display_override, ['standalone']);
  assert.equal(manifest.orientation, 'landscape');
}

assert.match(main, /screen\.width/);
assert.match(main, /screen\.height/,
  'The compatibility boundary must explicitly neutralize the legacy physical-screen sizing path');
assert.match(styles, /min-height: 100lvh/,
  'The compatibility boundary must override the legacy large-viewport minimum in installed mode');

assert.match(usableViewport, /if \(!isStandalone\) return;/,
  'Ordinary Safari must remain on the established browser layout path');
assert.match(usableViewport, /--app-width: 100dvw !important/);
assert.match(usableViewport, /--app-height: 100dvh !important/);
assert.match(usableViewport, /min-width: 0 !important/);
assert.match(usableViewport, /min-height: 0 !important/,
  'The installed app must not be forced to the physical large viewport');
assert.match(usableViewport, /const gameRect = game\?\.getBoundingClientRect\(\)/);
assert.match(usableViewport, /Number\(root\.clientWidth\)/);
assert.match(usableViewport, /Number\(root\.clientHeight\)/);
assert.match(usableViewport, /camera\.aspect = width \/ height/);
assert.match(usableViewport, /nativeSetSize\(width, height, false\)/);
assert.match(usableViewport, /renderer\.setSize = function useUsableViewportInsteadOfPhysicalScreen/,
  'Later main.js resize events must not reapply physical-screen dimensions');
assert.match(usableViewport, /SETTLE_DELAYS_MS = Object\.freeze\(\[0, 80, 240, 650, 1200\]\)/,
  'The installed web layer must be sampled as iOS finishes launch and rotation');
assert.match(usableViewport, /__turnPwaViewportDiagnostics/,
  'Device reports must expose actual usable, visual and physical dimensions for follow-up diagnosis');

const sizeStart = usableViewport.indexOf('function usableViewportSize()');
const sizeEnd = usableViewport.indexOf('\n  function publishDiagnostics', sizeStart);
assert.ok(sizeStart >= 0 && sizeEnd > sizeStart, 'The usable viewport measurement must remain independently testable');
const sizeBlock = usableViewport.slice(sizeStart, sizeEnd);
assert.doesNotMatch(sizeBlock, /screen\./,
  'Physical screen dimensions must never participate in app or renderer sizing');
assert.doesNotMatch(sizeBlock, /100lvh|100lvw/,
  'Large viewport units must never participate in the installed app measurement');
assert.match(sizeBlock, /game\?\.getBoundingClientRect/);
assert.match(sizeBlock, /root\.clientWidth/);
assert.match(sizeBlock, /root\.clientHeight/);

assert.match(
  index,
  new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`)
);

console.log(`TURN ${release.id} usable iOS standalone viewport boundary passed.`);
