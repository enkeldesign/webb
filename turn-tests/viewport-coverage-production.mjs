import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, nextIndex, releaseSource, main, styles, responsiveViewport] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/styles.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/startup-viewport-r177.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const blockStart = main.indexOf('function isStandaloneDisplayMode()');
const blockEnd = main.indexOf('\nconst initialViewport = getViewportSize();');
assert.ok(blockStart >= 0 && blockEnd > blockStart, 'Production must retain its base standalone-aware viewport measurement boundary');
const viewportBlock = main.slice(blockStart, blockEnd);

assert.match(viewportBlock, /window\.visualViewport/, 'TURN must still observe the live visual viewport');
assert.match(viewportBlock, /screen\.width/, 'Installed TURN must still be able to recover the physical screen width');
assert.match(viewportBlock, /screen\.height/, 'Installed TURN must still be able to recover the physical screen height');
assert.match(viewportBlock, /navigator\.standalone === true/);
assert.match(viewportBlock, /display-mode: standalone/);
assert.match(viewportBlock, /display-mode: fullscreen/);

assert.match(index, /startup-viewport-r177\.js\?revision=r178-landscape-first-containment/,
  'Production TURN must fetch the corrected independent viewport bootstrap');
assert.ok(
  index.indexOf('turn-landscape-launch-containment-r178') < index.indexOf('startup-viewport-r177.js'),
  'The no-footer containment rule must be parsed before any startup module can measure the viewport'
);
assert.ok(
  index.indexOf('startup-viewport-r177.js') < index.indexOf('app.js?build='),
  'Viewport containment and startup preloads must begin before the canonical app graph'
);
assert.match(nextIndex, /startup-viewport-r177\.js\?revision=r178-landscape-first-containment/,
  'TURN NEXT must exercise the same viewport behavior as production');
assert.match(index, /body \{ position: fixed; inset: 0; min-width: 0; min-height: 0; \}/,
  'The document body must fill the initial containing block without trusting a startup pixel height');
assert.match(index, /\.install-gate, \.rotate-panel, \.m8-home\.m8-home-fixed-layout \{[\s\S]*inset: 0 !important;[\s\S]*height: auto !important;/,
  'Loading, rotation and Home surfaces must independently cover the complete viewport');

assert.match(responsiveViewport, /MIN_RACING_ASPECT = 16 \/ 9/,
  'The 3D racing view must retain at least a 16:9 composition on squarer tablets');
assert.match(responsiveViewport, /renderAspect = Math\.max\(viewportAspect, MIN_RACING_ASPECT\)/);
assert.match(responsiveViewport, /nativeSetSize\(fit\.bufferWidth, fit\.bufferHeight, false\)/,
  'The drawing buffer must not write a conflicting CSS size');
assert.match(responsiveViewport, /camera\.aspect = fit\.renderAspect/,
  'The camera and drawing buffer must share one undistorted aspect ratio');
assert.match(responsiveViewport, /transform: translate\(-50%, -50%\) !important/,
  'Any 3D overflow must be centred and cropped rather than stretched');
assert.match(responsiveViewport, /--turn-racing-cover-width/);
assert.match(responsiveViewport, /--turn-racing-cover-height/);
assert.match(responsiveViewport, /body \{[\s\S]*position: fixed !important;[\s\S]*inset: 0 !important;[\s\S]*width: auto !important;[\s\S]*height: auto !important;/,
  'The runtime must retain viewport containment instead of replacing it with a stale measured height');
assert.match(responsiveViewport, /#game,[\s\S]*html body \.install-gate,[\s\S]*html body \.rotate-panel,[\s\S]*html body \.m8-home\.m8-home-fixed-layout[\s\S]*inset: 0 !important;/);
assert.doesNotMatch(responsiveViewport, /width: var\(--turn-stage-width\) !important|height: var\(--turn-stage-height\) !important/,
  'Top-level surfaces must never again depend on the launch-time pixel measurement');
assert.match(responsiveViewport, /ORIENTATION_SETTLE_DELAYS_MS = Object\.freeze\(\[0, 70, 180, 420, 900, 1600\]\)/,
  'iOS startup and rotation must be sampled beyond the first second');
assert.match(responsiveViewport, /\['resize', 'orientationchange', 'pageshow', 'focus'\]/);
assert.match(responsiveViewport, /visualViewport\?\.addEventListener\('resize', scheduleSettledSync/);
assert.match(responsiveViewport, /screen\.orientation\?\.addEventListener\?\.\('change', scheduleSettledSync/);
assert.match(responsiveViewport, /dataset\.turnViewportFit = 'crop-not-stretch'/);
assert.match(responsiveViewport, /window\.outerWidth/);
assert.match(responsiveViewport, /window\.outerHeight/,
  'Landscape-first launch must consider the outer standalone window when innerHeight is truncated');
assert.match(responsiveViewport, /width:100lvw;height:100lvh/,
  'A CSS large-viewport probe must be available when WebKit JavaScript dimensions disagree');
assert.match(responsiveViewport, /inset:0;width:auto;height:auto/,
  'A fixed-inset probe must measure the same viewport strategy used by the visible surfaces');
assert.match(responsiveViewport, /Math\.max\(\.\.\.candidates\.map\(\(size\) => size\.height\)\)/,
  'The final standalone height must use the largest valid same-orientation candidate, not the first short report');

const fitStart = responsiveViewport.indexOf('function fitRacingSurface(width, height)');
const fitEnd = responsiveViewport.indexOf('\nfunction applyStageSize', fitStart);
assert.ok(fitStart >= 0 && fitEnd > fitStart, 'The responsive layer must expose one pure racing-surface fit function');
const fitRacingSurface = new Function(
  `const MIN_RACING_ASPECT = 16 / 9;\n${responsiveViewport.slice(fitStart, fitEnd)}\nreturn fitRacingSurface;`
)();

const ipadFit = fitRacingSurface(1080, 810);
assert.equal(ipadFit.renderAspect, 16 / 9);
assert.equal(ipadFit.coverWidth, 1440);
assert.equal(ipadFit.coverHeight, 810);
assert.equal(ipadFit.bufferWidth / ipadFit.bufferHeight, 16 / 9);
assert.ok(Math.abs(ipadFit.bufferWidth * ipadFit.bufferHeight - 1080 * 810) < 1800,
  'Cropping must preserve approximately the previous pixel workload on iPad 9');
assert.notEqual(ipadFit.coverWidth / ipadFit.coverHeight, 1080 / 810,
  'A 4:3 tablet must crop a 16:9 racing scene instead of flattening it to 4:3');

const iphoneFit = fitRacingSurface(852, 393);
assert.ok(Math.abs(iphoneFit.renderAspect - 852 / 393) < 1e-9);
assert.equal(iphoneFit.coverWidth, 852);
assert.equal(iphoneFit.coverHeight, 393);

assert.match(styles, /body \{[\s\S]*min-width: 100vw;[\s\S]*min-height: 100vh;/,
  'The base stylesheet remains a no-script fallback; the early inline and runtime layers override it');
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));

console.log(`TURN ${release.id} landscape-first containment and crop-not-stretch tablet rendering passed.`);