import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  index,
  nextIndex,
  labIndex,
  releaseSource,
  main,
  styles,
  usableViewport,
  productionManifestSource,
  nextManifestSource,
  labManifestSource,
  labBootstrap,
  labDiagnostics,
  labRepair
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/styles.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/pwa-usable-viewport-r181.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/lab-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/viewport-diagnostics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/viewport-repair-r3.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const productionManifest = JSON.parse(productionManifestSource);
const nextManifest = JSON.parse(nextManifestSource);
const labManifest = JSON.parse(labManifestSource);

function importMap(source) {
  const text = source.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(text, 'Expected an import map');
  return JSON.parse(text).imports;
}

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

// TURN LAB is a deployed diagnostic shell around the exact current production runtime.
assert.match(labIndex, /<base href="\/turn\/">/,
  'TURN LAB must resolve all ordinary game assets from the current production TURN tree');
assert.deepEqual(importMap(labIndex), importMap(index),
  'TURN LAB must use the exact production import-map graph so viewport tests exercise current TURN code');
assert.match(labIndex, new RegExp(`version: '${release.version.replaceAll('.', '\\.')}'`));
assert.match(labIndex, new RegExp(`id: '${release.id.replaceAll('.', '\\.')}'`));
assert.match(labIndex, new RegExp(`cacheKey: '${release.cacheKey}'`));
assert.ok(
  labIndex.indexOf('/turn-lab/lab-bootstrap.js') < labIndex.indexOf('/turn-lab/viewport-diagnostics.js'),
  'LAB storage and standalone detection must exist before the flight recorder starts'
);
assert.ok(
  labIndex.indexOf('/turn-lab/viewport-diagnostics.js') < labIndex.indexOf('pwa-usable-viewport-r181.js'),
  'The flight recorder must observe the page before the production PWA viewport boundary mutates it'
);
assert.ok(
  labIndex.indexOf('pwa-usable-viewport-r181.js') < labIndex.indexOf('app.js?build='),
  'LAB must preserve the production PWA-boundary-before-runtime ordering'
);

assert.equal(labManifest.id, '/turn-lab/');
assert.equal(labManifest.start_url, '/turn-lab/');
assert.equal(labManifest.scope, '/turn-lab/');
assert.equal(labManifest.display, 'standalone');
assert.deepEqual(labManifest.display_override, ['standalone']);
assert.equal(labManifest.orientation, 'any',
  'TURN LAB deliberately removes the landscape manifest lock for the real-device startup-orientation experiment');

assert.match(labBootstrap, /LOCAL_PREFIX = 'turn-lab:'/,
  'LAB local storage must stay in its own namespace');
assert.match(labBootstrap, /SESSION_PREFIX = 'turn-lab-session:'/,
  'LAB session storage must stay in its own namespace');
assert.doesNotMatch(labBootstrap, /seed|COPY_ONCE|turn-personal-rivals/,
  'The fresh viewport lab must not seed or modify production TURN save data');
assert.match(labBootstrap, /__turnLaunchReady/,
  'LAB must preserve the production startup gate contract');
assert.match(labBootstrap, /viewport-repair-r3\.js\?revision=r5-auto-watchdog/,
  'LAB must load the cache-busted event-driven repair watchdog without modifying production TURN');

for (const requiredDiagnostic of [
  'screen.width',
  'screen.height',
  'window.innerHeight',
  'root.clientHeight',
  'window.visualViewport',
  "rectFor('#game')",
  "rectFor('.m8-home')",
  "rectFor('.rotate-panel')",
  "rectFor('#installGate')",
  '__turnPwaViewportDiagnostics',
  "markSession('BAD')",
  "markSession('GOOD')",
  'COLOR LAYERS',
  'COPY LOG'
]) {
  assert.ok(labDiagnostics.includes(requiredDiagnostic), `TURN LAB recorder must include ${requiredDiagnostic}`);
}
assert.match(labDiagnostics, /MAX_SESSIONS = 8/,
  'The recorder must retain several random good/bad cold launches for comparison');
assert.match(labDiagnostics, /localStorage\.setItem\(STORAGE_KEY/,
  'Viewport evidence must survive reloads and orientation cycles');

// The repair bench remains LAB-only. Automatic mode watches startup events and confirms a persistent BAD signature before pulsing viewport meta.
assert.doesNotThrow(() => new Function(labRepair), 'The LAB repair probe must remain valid JavaScript');
for (const requiredRepair of [
  "measureHeight('100dvh')",
  "measureHeight('100lvh')",
  'BAD_GAP_MIN = 40',
  'Math.abs(sample.clientH - sample.dvh) <= 2',
  'Math.abs(sample.visualH - sample.dvh) <= 2',
  'TRY VIEWPORT REFLOW',
  'META_PULSE_MS = 120',
  'CHECKPOINTS_MS = Object.freeze([0, 80, 250, 650])',
  'AUTO_CONFIRM_MS = 90',
  'AUTO_WATCHDOG_MS = 10000',
  'AUTO_CHECKS_MS = Object.freeze([120, 240, 400, 650, 1000, 1600, 2500, 4000, 6000, 8000, 10000])',
  "snapshot(`auto-confirm:${reason}`)",
  "window.addEventListener('turn:runtime-ready', onWatchdogEvent)",
  "window.addEventListener('turn:home-ready', onWatchdogEvent)",
  "window.visualViewport?.addEventListener('resize', onWatchdogEvent",
  "runMetaReflow({ trigger: 'auto' })",
  "meta.setAttribute('content', pulse)",
  "meta.setAttribute('content', original)",
  '__turnLabViewportRepairResult',
  '__turnLabViewportAutoRepairResult',
  "outcome: recovered ? 'RECOVERED' : 'STILL_BAD'",
  'repairInFlight',
  'COPY REPAIR RESULT'
]) {
  assert.ok(labRepair.includes(requiredRepair), `TURN LAB repair bench must include ${requiredRepair}`);
}
assert.doesNotMatch(labRepair, /screen\.(?:width|height)/,
  'The repair experiment must never size content from physical screen dimensions');
assert.match(labRepair, /if \(!hasBadSignature\(before\)\)/,
  'The viewport meta pulse must not run on healthy launches');

console.log(`TURN ${release.id} usable iOS standalone viewport boundary and TURN LAB recorder/repair bench passed.`);
