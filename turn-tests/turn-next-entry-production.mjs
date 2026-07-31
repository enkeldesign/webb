import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  productionIndex,
  productionApp,
  productionMain,
  nextIndex,
  nextApp,
  nextMain,
  storage,
  productionManifestSource,
  nextManifestSource,
  releaseSource,
  platformContext,
  webPlatform,
  motionLifecycleBridge,
  displayLifecycleBridge,
  orientationGuardCss,
  homeSource,
  homeCss,
  fixedLayoutSource,
  fixedLayoutCss,
  cardScrollSource,
  cardScrollCss
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/platform/platform-context.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/platform/web-platform.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/motion-lifecycle-bridge.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/display-lifecycle-bridge.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-guard.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-card-scroll-fixes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-card-scroll-fixes.css', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const productionManifest = JSON.parse(productionManifestSource);
const nextManifest = JSON.parse(nextManifestSource);

assert.equal(release.version, '1.25.0');
assert.equal(release.id, '2026.07.31-r120');
assert.equal(release.cacheKey, '20260731-r120');

assert.match(productionIndex, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(productionIndex, /<meta name="theme-color" content="#08090a">/);
assert.match(productionIndex, new RegExp(`src="\\.\\/app\\.js\\?build=${release.cacheKey}(?:-[^"]+)?"`));
assert.match(productionIndex, /id="intro" hidden aria-hidden="true"/);
assert.match(productionIndex, /id="motionButton"/);
assert.match(productionIndex, /id="manualButton"/);
assert.match(productionIndex, /id="status"/);
assert.doesNotMatch(productionIndex, /class="start-card"|Enable motion &amp; race|Desktop \/ manual mode/);

assert.match(productionApp, /retireLegacyStartPanel\(\)/);
assert.match(productionApp, /createWebPlatform/);
assert.match(productionApp, /installTurnPlatform\(webPlatform\)/);
assert.match(productionApp, /installMotionLifecycleBridge\(\{ platform: webPlatform \}\)/);
assert.match(productionApp, /installDisplayLifecycleBridge\(\{ platform: webPlatform \}\)/);
assert.match(productionApp, /await import\(withBuild\('\.\/main\.js'\)\)/);
assert.match(productionApp, /installM8HomeNavigation\(\)/);
assert.match(productionApp, /installM8HomeFixedLayout\(\)/);
assert.match(productionApp, /TURN V\$\{release\?\.version/);
assert.ok(productionApp.indexOf('installTurnPlatform(webPlatform)') < productionApp.indexOf("withBuild('./main.js')"));
assert.ok(productionApp.indexOf("withBuild('./main.js')") < productionApp.indexOf('installM8HomeNavigation()'));
assert.match(productionMain, /createRaceSessionOrchestrator/);
assert.match(productionMain, /openLot: raceSession\.openLotFromRace/);
assert.equal(nextMain, productionMain, 'TURN NEXT main must mirror canonical TURN exactly');

assert.match(nextIndex, /data-turn-deployment="next"/);
assert.match(nextIndex, /<base href="\/turn\/">/);
assert.match(nextIndex, /<meta name="robots" content="noindex,nofollow">/);
assert.match(nextIndex, new RegExp(`TURN NEXT · Source TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(nextIndex, new RegExp(`/turn-next/storage-bootstrap\\.js\\?source=${release.cacheKey}`));
assert.match(nextIndex, new RegExp(`/turn-next/app\\.js\\?source=${release.cacheKey}-promoted`));
assert.ok(nextIndex.indexOf('/turn-next/storage-bootstrap.js') < nextIndex.indexOf('/turn-next/app.js'));
assert.match(nextIndex, /\/turn-next\/identity\.css/);
assert.match(nextIndex, /\/turn-next\/identity\.js/);
assert.match(nextIndex, /\/turn-next\/site\.webmanifest/);
assert.doesNotMatch(nextIndex, /class="start-card"|Enable motion &amp; race|Desktop \/ manual mode/);

assert.match(nextApp, /new URL\('\/turn\/app\.js'/);
assert.match(nextApp, /await import\(url\.href\)/);
assert.doesNotMatch(nextApp, /installMotionLifecycleBridge|installDisplayLifecycleBridge|installM8HomeNavigation|installM8HomeFixedLayout/);

assert.match(platformContext, /installTurnPlatform/);
assert.match(platformContext, /requireTurnPlatform/);
assert.match(webPlatform, /requestFullscreen/);
assert.match(webPlatform, /lockLandscape/);
assert.match(motionLifecycleBridge, /motion\.requestPermission\(\)/);
assert.match(motionLifecycleBridge, /motion\.subscribe\(listener\)/);
assert.match(displayLifecycleBridge, /display\.requestFullscreen\(root\)/);
assert.match(displayLifecycleBridge, /display\.lockLandscape\(\)/);

assert.match(homeSource, /TRACK_SELECTION_CATALOG\.map\(renderTrackCard\)/);
assert.match(homeSource, /raceSession\.prepareMotionAccess\(\)/);
assert.match(homeSource, /runtime\.openLot = leaveRaceForHome/);
assert.match(homeCss, /turn-m8-active \.audio-settings-button/);
assert.match(fixedLayoutSource, /installM8HomeCardScrollFixes\(\)/);
assert.match(fixedLayoutCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(cardScrollSource, /rail\.dataset\.scrollMode = 'native'/);
assert.doesNotMatch(cardScrollSource, /pointerdown|pointermove|setPointerCapture|startInertia/);
assert.match(cardScrollCss, /touch-action: pan-y pinch-zoom/);
assert.match(cardScrollCss, /-webkit-overflow-scrolling: touch/);

assert.match(orientationGuardCss, /#intro[\s\S]*display: none !important/);
assert.match(orientationGuardCss, /body[\s\S]*position: fixed/);
assert.match(orientationGuardCss, /object-fit: contain/);
assert.doesNotMatch(orientationGuardCss, /100lvh/);

assert.match(storage, /const LOCAL_PREFIX = 'turn-next:';/);
assert.match(storage, /const SESSION_PREFIX = 'turn-next-session:';/);
assert.match(storage, /globalThis\.__TURN_NEXT_STORAGE_READY__ = true/);

assert.deepEqual(
  {
    id: productionManifest.id,
    startUrl: productionManifest.start_url,
    scope: productionManifest.scope,
    background: productionManifest.background_color,
    theme: productionManifest.theme_color
  },
  {
    id: '/turn/',
    startUrl: '/turn/',
    scope: '/turn/',
    background: '#08090a',
    theme: '#08090a'
  }
);
assert.deepEqual(
  {
    id: nextManifest.id,
    startUrl: nextManifest.start_url,
    scope: nextManifest.scope,
    background: nextManifest.background_color,
    theme: nextManifest.theme_color
  },
  {
    id: '/turn-next/',
    startUrl: '/turn-next/',
    scope: '/turn-next/',
    background: '#08090a',
    theme: '#08090a'
  }
);

console.log(`TURN ${release.id} owns M5–M8; TURN NEXT is an isolated canonical wrapper.`);
