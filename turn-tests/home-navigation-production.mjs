import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  homeSource,
  homeCss,
  fixedLayoutSource,
  fixedLayoutCss,
  cardScrollSource,
  cardScrollCss,
  orientationGuardCss,
  productionApp,
  productionMain,
  nextApp,
  nextMain,
  orchestrator
] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-card-scroll-fixes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-card-scroll-fixes.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-guard.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/session-orchestrator.js', import.meta.url), 'utf8')
]);

assert.match(productionApp, /installM8HomeNavigation/);
assert.match(productionApp, /installM8HomeFixedLayout/);
assert.match(productionApp, /installStylesheet\('\.\/m8-home\.css'/);
assert.match(productionApp, /m8-home-fixed-layout\.js\?revision=m8\.7-home-polish/);
assert.ok(productionApp.indexOf('installM8HomeNavigation()') < productionApp.indexOf('installM8HomeFixedLayout()'));
assert.match(productionApp, /turnHomeLifecycle = 'home-m8'/);
assert.match(productionApp, /retireLegacyStartPanel\(\)/);
assert.match(productionMain, /createRaceSessionOrchestrator/);
assert.equal(nextMain, productionMain, 'TURN NEXT must run the canonical M7 main runtime');
assert.match(nextApp, /new URL\('\/turn\/app\.js'/);
assert.doesNotMatch(nextApp, /installM8HomeNavigation|installM8HomeFixedLayout|m8-home-card-scroll/);

for (const requiredCopy of [
  'TILT. DRIFT.',
  'BEAT YOUR BEST.',
  'HOW TO PLAY',
  'CHOOSE YOUR TRACK',
  'SETTINGS',
  'Drive By Ear™',
  'Device rotation',
  'On-screen steering',
  'RESET RIVALS'
]) {
  assert.ok(homeSource.includes(requiredCopy), `M8 Home must contain ${requiredCopy}`);
}

assert.match(homeSource, /TRACK_SELECTION_CATALOG\.map\(renderTrackCard\)/);
assert.match(homeSource, /aria-pressed="false"/);
assert.match(homeSource, /showTheLot\(\{ initialSelection: selectedVehicle\(runtime\) \}\)/);
assert.doesNotMatch(homeSource, /chooseTrackBeforeLot|lot-track-select/);
assert.match(homeSource, /raceSession\.prepareMotionAccess\(\)/);
assert.match(homeSource, /raceSession\.prepareManualAccess\(\)/);
assert.match(homeSource, /raceSession\.selectVehicle\(selection\)/);
assert.match(homeSource, /showTrackIntro\(selectedTrackId\)/);
assert.match(homeSource, /raceSession\.startGame\(pendingAccess\?\.fullscreenPromise\)/);
assert.ok(homeSource.indexOf('activateTrack(selectedTrackId, runtime)') < homeSource.indexOf('showTheLot({ initialSelection: selectedVehicle(runtime) })'));
assert.ok(homeSource.indexOf('raceSession.selectVehicle(selection)') < homeSource.indexOf('showTrackIntro(selectedTrackId)'));
assert.ok(homeSource.indexOf('showTrackIntro(selectedTrackId)') < homeSource.indexOf('raceSession.startGame(pendingAccess?.fullscreenPromise)'));
assert.match(homeSource, /runtime\.openLot = leaveRaceForHome/);
assert.match(homeSource, /showHome\(\{ focus: true \}\)/);
assert.match(homeSource, /turn-steering-mode-v1/);
assert.match(homeSource, /saveDriveByEarEnabled/);
assert.match(homeSource, /__turnResetRivals/);

assert.match(homeCss, /turn-m8-active \.audio-settings-button/);
assert.match(homeCss, /turn-m8-active \.reset-rivals-button/);
assert.match(homeCss, /prefers-reduced-motion/);

assert.match(fixedLayoutSource, /const LAYOUT_ID = 'fixed-grid-v7'/);
assert.match(fixedLayoutSource, /m8-home-fixed-layout\.css\?build=\$\{buildKey\}-m8\.7-home-polish/);
assert.match(fixedLayoutSource, /trackBrowser\.append\(headingRow, rail\)/);
assert.match(fixedLayoutSource, /menu\.append\(settingsButton, howButton, status, raceButton\)/);
assert.match(fixedLayoutSource, /oldScrollButtons\.hidden = true/);
assert.match(fixedLayoutSource, /raceButton\.textContent = 'RACE'/);
assert.match(fixedLayoutSource, /Race on \$\{spokenTrackName\(selectedTrackName\)\}/);
assert.match(fixedLayoutSource, /new MutationObserver\(syncRaceLabel\)/);
assert.match(fixedLayoutSource, /\/turn\/m8-home-card-scroll-fixes\.js\?build=\$\{buildKey\}-m8\.8-full-track-names/);
assert.match(fixedLayoutSource, /installM8HomeCardScrollFixes\(\)/);
assert.match(fixedLayoutSource, /turnHomeLayout = LAYOUT_ID/);

assert.match(fixedLayoutCss, /height: 100dvh/);
assert.match(fixedLayoutCss, /\.m8-home\.m8-home-fixed-layout[\s\S]*overflow: hidden/);
assert.match(fixedLayoutCss, /grid-template-columns: minmax\(0, 1fr\) clamp\(190px, 21vw, 280px\)/);
assert.match(fixedLayoutCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(fixedLayoutCss, /overflow-x: hidden/);
assert.match(fixedLayoutCss, /overflow-y: auto/);
assert.match(fixedLayoutCss, /-webkit-overflow-scrolling: touch/);
assert.match(fixedLayoutCss, /\.m8-home-fixed-layout \.m8-home-menu[\s\S]*border-left: 0/);
assert.doesNotMatch(fixedLayoutCss, /border-left:\s*[45]px solid/);
assert.match(fixedLayoutCss, /\.m8-home-fixed-layout \.m8-home-status[\s\S]*margin: auto 0 10px/);
assert.match(fixedLayoutCss, /\.m8-home-fixed-layout \.m8-track-continue[\s\S]*background: var\(--m8-pink\)/);
assert.match(fixedLayoutCss, /\.m8-home-fixed-layout \.m8-home-head[\s\S]*padding: 0 max\(22px, env\(safe-area-inset-right\)\) 0 0/);
assert.match(fixedLayoutCss, /\.m8-home-fixed-layout \.m8-home-logo[\s\S]*width: auto[\s\S]*height: 100%[\s\S]*aspect-ratio: 1[\s\S]*object-fit: contain[\s\S]*object-position: left center/);
assert.doesNotMatch(fixedLayoutCss, /object-fit: cover/);
assert.doesNotMatch(fixedLayoutCss, /padding-block: 5px/);
assert.match(fixedLayoutCss, /@media \(max-height: 560px\) and \(orientation: landscape\)[\s\S]*\.m8-home-fixed-layout \.m8-home-head[\s\S]*padding-block: 0/);
assert.match(fixedLayoutCss, /@media \(max-height: 560px\) and \(orientation: landscape\)[\s\S]*\.m8-home-fixed-layout \.m8-home-menu[\s\S]*border-left: 0/);
assert.match(fixedLayoutCss, /@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*\.m8-home-fixed-layout \.m8-home-head[\s\S]*padding: 0 12px 0 0/);
assert.match(fixedLayoutCss, /prefers-reduced-motion/);

assert.match(cardScrollSource, /const FIX_ID = 'native-scroll-full-track-names-v3'/);
assert.match(cardScrollSource, /m8-home-card-scroll-fixes\.css\?build=\$\{buildKey\}-m8\.8-full-track-names/);
assert.match(cardScrollSource, /m8-track-scroll-indicator/);
assert.match(cardScrollSource, /ResizeObserver/);
assert.match(cardScrollSource, /rail\.style\.scrollSnapType = 'none'/);
assert.match(cardScrollSource, /rail\.dataset\.scrollMode = 'native'/);
assert.match(cardScrollSource, /turnHomeCardScrollFixes = FIX_ID/);
assert.doesNotMatch(cardScrollSource, /pointerdown|pointermove|setPointerCapture|releasePointerCapture/);
assert.doesNotMatch(cardScrollSource, /preventDefault\(\)|stopImmediatePropagation\(\)|startInertia|velocity/);

assert.match(cardScrollCss, /\.m8-track-scroll-viewport/);
assert.match(cardScrollCss, /\.m8-track-scroll-indicator/);
assert.match(cardScrollCss, /\.m8-track-scroll-thumb/);
assert.match(cardScrollCss, /touch-action: pan-y pinch-zoom/);
assert.match(cardScrollCss, /-webkit-overflow-scrolling: touch/);
assert.match(cardScrollCss, /scroll-snap-type: none !important/);
assert.match(cardScrollCss, /overscroll-behavior-y: contain/);
assert.doesNotMatch(cardScrollCss, /touch-action: none|cursor: grab|cursor: grabbing|is-drag-scrolling/);
assert.match(cardScrollCss, /\.track-card-summary[\s\S]*display: contents/);
assert.match(cardScrollCss, /\.track-card-choice[\s\S]*grid-row: 1/);
assert.match(cardScrollCss, /\.track-card-difficulty[\s\S]*grid-row: 2/);
assert.match(cardScrollCss, /\.track-card-preview[\s\S]*grid-row: 1 \/ 3/);
assert.match(cardScrollCss, /\.track-card-best[\s\S]*grid-row: 3/);
assert.match(cardScrollCss, /\.track-card-best-model[\s\S]*justify-self: end/);
assert.match(cardScrollCss, /grid-template-columns: minmax\(0, 1fr\) minmax\(108px, 39%\)/);
assert.match(cardScrollCss, /\.track-card-name[\s\S]*text-overflow: clip[\s\S]*white-space: normal/);
assert.doesNotMatch(cardScrollCss, /\.track-card-name[\s\S]{0,240}text-overflow: ellipsis/);

assert.match(orientationGuardCss, /#intro[\s\S]*display: none !important/);
assert.match(orientationGuardCss, /\.m8-home-fixed-layout \.m8-home-head[\s\S]*padding-top: 0/);
assert.match(orientationGuardCss, /\.m8-home-fixed-layout \.m8-home-logo[\s\S]*object-fit: contain/);
assert.match(orientationGuardCss, /object-position: left center/);
assert.doesNotMatch(orientationGuardCss, /100lvh/);

assert.match(orchestrator, /async function prepareMotionAccess\(\)/);
assert.match(orchestrator, /function prepareManualAccess\(\)/);
assert.match(orchestrator, /async function selectVehicle\(selection\)/);
assert.match(orchestrator, /function leaveRace\(\)/);
assert.match(orchestrator, /publish\('home-open'\)/);
assert.match(orchestrator, /phase = 'home'/);

console.log('TURN production M8 Home, complete track names, native scrollbar divider and NEXT wrapper contracts passed.');
