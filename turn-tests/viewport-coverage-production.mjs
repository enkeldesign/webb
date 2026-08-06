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

assert.match(index, /startup-viewport-r177\.js\?revision=r177-cold-start-rotation-crop/,
  'Production TURN must load the independent responsive viewport bootstrap before the canonical app');
assert.ok(
  index.indexOf('startup-viewport-r177.js') < index.indexOf('app.js?build='),
  'Viewport containment and startup preloads must begin before the canonical app graph'
);
assert.match(nextIndex, /startup-viewport-r177\.js\?revision=r177-cold-start-rotation-crop/,
  'TURN NEXT must exercise the same viewport behavior as production');

assert.match(responsiveViewport, /MIN_RACING_ASPECT = 16 \/ 9/,
  'The 3D racing view must retain at least a 16:9 composition on squarer tablets');
assert.match(responsiveViewport, /renderAspect = Math\.max\(viewportAspect, MIN_RACING_ASPECT\)/);
assert.match(responsiveViewport, /nativeSetSize\(fit\.bufferWidth, fit\.bufferHeight, false\)/,
  'The drawing buffer must no longer write a second, conflicting CSS size');
assert.match(responsiveViewport, /camera\.aspect = fit\.renderAspect/,
  'The camera and drawing buffer must share one undistorted aspect ratio');
assert.match(responsiveViewport, /transform: translate\(-50%, -50%\) !important/,
  'Any overflow must be centred and cropped rather than stretched');
assert.match(responsiveViewport, /--turn-racing-cover-width/);
assert.match(responsiveViewport, /--turn-racing-cover-height/);
assert.match(responsiveViewport, /min-width: 0 !important/);
assert.match(responsiveViewport, /min-height: 0 !important/,
  'The late responsive layer must neutralize stale 100vw, 100vh and 100lvh floors after rotation');
assert.match(responsiveViewport, /ORIENTATION_SETTLE_DELAYS_MS = Object\.freeze\(\[0, 70, 180, 420, 900\]\)/,
  'iOS rotation must be sampled repeatedly after the first orientation event');
assert.match(responsiveViewport, /\['resize', 'orientationchange', 'pageshow', 'focus'\]/);
assert.match(responsiveViewport, /visualViewport\?\.addEventListener\('resize', scheduleSettledSync/);
assert.match(responsiveViewport, /screen\.orientation\?\.addEventListener\?\.\('change', scheduleSettledSync/);
assert.match(responsiveViewport, /dataset\.turnViewportFit = 'crop-not-stretch'/);
assert.match(responsiveViewport, /standaloneScreenSize\(live\) \|\| live/,
  'Installed iPad mode must retain complete physical-screen coverage after live orientation has settled');

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
assert.ok(Math.abs(ipadFit.bufferWidth / ipadFit.bufferHeight - 16 / 9) < 0.002);
assert.ok(Math.abs(ipadFit.bufferWidth * ipadFit.bufferHeight - 1080 * 810) < 1800,
  'Cropping must preserve approximately the previous pixel workload on iPad 9');
assert.notEqual(ipadFit.coverWidth / ipadFit.coverHeight, 1080 / 810,
  'A 4:3 tablet must crop a 16:9 racing scene instead of flattening it to 4:3');

const iphoneFit = fitRacingSurface(852, 393);
assert.ok(Math.abs(iphoneFit.renderAspect - 852 / 393) < 1e-9);
assert.equal(iphoneFit.coverWidth, 852);
assert.equal(iphoneFit.coverHeight, 393);

assert.match(styles, /body \{[\s\S]*min-width: 100vw;[\s\S]*min-height: 100vh;/,
  'The base stylesheet remains a no-script fallback until the responsive bootstrap takes control');
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));

console.log(`TURN ${release.id} settled rotation coverage and crop-not-stretch tablet rendering passed.`);