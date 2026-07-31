import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  homeSource,
  homeCss,
  fixedLayoutSource,
  fixedLayoutCss,
  cardScrollSource,
  cardScrollCss,
  productionApp,
  productionMain,
  nextApp,
  nextMain,
  orchestrator
] = await Promise.all([
  fs.readFile(new URL('../turn-next/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/m8-home.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/m8-home-fixed-layout.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/m8-home-card-scroll-fixes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/m8-home-card-scroll-fixes.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/session-orchestrator.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(productionApp, /installM8HomeNavigation|m8-home-fixed-layout|installM8HomeFixedLayout|m8-home-card-scroll/);
assert.doesNotMatch(productionMain, /createRaceSessionOrchestrator/);
assert.match(nextApp, /installM8HomeNavigation/);
assert.match(nextApp, /installM8HomeFixedLayout/);
assert.match(nextApp, /m8-home-fixed-layout\.js\?source=\$\{buildKey\}-m8\.3/);
assert.ok(nextApp.indexOf('installM8HomeNavigation()') < nextApp.indexOf('installM8HomeFixedLayout()'));
assert.match(nextApp, /turnHomeLifecycle = 'home-m8'/);
assert.match(nextMain, /session-orchestrator\.js\?source=20260729-r118-m8/);

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
  assert.ok(homeSource.includes(requiredCopy), 'M8 Home must contain ' + requiredCopy);
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

assert.match(fixedLayoutSource, /const LAYOUT_ID = 'fixed-grid-v4'/);
assert.match(fixedLayoutSource, /trackBrowser\.append\(headingRow, rail\)/);
assert.match(fixedLayoutSource, /menu\.append\(settingsButton, howButton, status, raceButton\)/);
assert.match(fixedLayoutSource, /oldScrollButtons\.hidden = true/);
assert.match(fixedLayoutSource, /raceButton\.textContent = 'RACE'/);
assert.match(fixedLayoutSource, /Race on \$\{spokenTrackName\(selectedTrackName\)\}/);
assert.match(fixedLayoutSource, /new MutationObserver\(syncRaceLabel\)/);
assert.match(fixedLayoutSource, /m8-home-card-scroll-fixes\.js\?source=\$\{buildKey\}-m8\.3/);
assert.match(fixedLayoutSource, /installM8HomeCardScrollFixes\(\)/);
assert.match(fixedLayoutSource, /turnHomeLayout = LAYOUT_ID/);

assert.match(fixedLayoutCss, /height: 100dvh/);
assert.match(fixedLayoutCss, /\.m8-home\.m8-home-fixed-layout[\s\S]*overflow: hidden/);
assert.match(fixedLayoutCss, /grid-template-columns: minmax\(0, 1fr\) clamp\(190px, 21vw, 280px\)/);
assert.match(fixedLayoutCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(fixedLayoutCss, /overflow-x: hidden/);
assert.match(fixedLayoutCss, /overflow-y: auto/);
assert.match(fixedLayoutCss, /-webkit-overflow-scrolling: touch/);
assert.match(fixedLayoutCss, /\.m8-home-fixed-layout \.m8-home-menu/);
assert.match(fixedLayoutCss, /\.m8-home-fixed-layout \.m8-home-status[\s\S]*margin: auto 0 10px/);
assert.match(fixedLayoutCss, /\.m8-home-fixed-layout \.m8-track-continue[\s\S]*background: var\(--m8-pink\)/);
assert.match(fixedLayoutCss, /@media \(max-height: 560px\) and \(orientation: landscape\)/);
assert.match(fixedLayoutCss, /@media \(max-width: 760px\) and \(orientation: portrait\)/);
assert.match(fixedLayoutCss, /prefers-reduced-motion/);

assert.match(cardScrollSource, /const FIX_ID = 'card-scroll-v2'/);
assert.match(cardScrollSource, /const DRAG_THRESHOLD_PX = 7/);
assert.match(cardScrollSource, /m8-track-scroll-indicator/);
assert.match(cardScrollSource, /rail\.scrollTop = startScrollTop - distance/);
assert.match(cardScrollSource, /rail\.setPointerCapture/);
assert.match(cardScrollSource, /CLICK_SUPPRESSION_MS/);
assert.match(cardScrollSource, /event\.stopImmediatePropagation\(\)/);
assert.match(cardScrollSource, /startInertia\(\)/);
assert.match(cardScrollSource, /ResizeObserver/);
assert.match(cardScrollSource, /rail\.style\.scrollSnapType = 'none'/);
assert.match(cardScrollSource, /rail\.style\.scrollSnapStop = 'normal'/);
assert.match(cardScrollSource, /rail\.dataset\.scrollRelease = 'free'/);
assert.ok(
  cardScrollSource.indexOf("rail.style.scrollSnapType = 'none'") < cardScrollSource.indexOf('installDragScrolling(rail)'),
  'Free scrolling must be established before pointer dragging is installed.'
);
assert.match(cardScrollSource, /turnHomeCardScrollFixes = FIX_ID/);

assert.match(cardScrollCss, /\.m8-track-scroll-viewport/);
assert.match(cardScrollCss, /\.m8-track-scroll-indicator/);
assert.match(cardScrollCss, /\.m8-track-scroll-thumb/);
assert.match(cardScrollCss, /touch-action: none/);
assert.match(cardScrollCss, /cursor: grab/);
assert.match(cardScrollCss, /\.track-card-summary[\s\S]*display: contents/);
assert.match(cardScrollCss, /\.track-card-choice[\s\S]*grid-row: 1/);
assert.match(cardScrollCss, /\.track-card-difficulty[\s\S]*grid-row: 2/);
assert.match(cardScrollCss, /\.track-card-preview[\s\S]*grid-row: 1 \/ 3/);
assert.match(cardScrollCss, /\.track-card-best[\s\S]*grid-row: 3/);
assert.match(cardScrollCss, /\.track-card-best-model[\s\S]*justify-self: end/);

assert.match(orchestrator, /async function prepareMotionAccess\(\)/);
assert.match(orchestrator, /function prepareManualAccess\(\)/);
assert.match(orchestrator, /async function selectVehicle\(selection\)/);
assert.match(orchestrator, /function leaveRace\(\)/);
assert.match(orchestrator, /publish\('home-open'\)/);
assert.match(orchestrator, /phase = 'home'/);

console.log('TURN NEXT M8 fixed Home, free drag scrolling and navigation contracts passed.');
