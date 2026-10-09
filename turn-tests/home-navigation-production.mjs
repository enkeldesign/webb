import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { installMotionPermissionCancelRecovery } from '../turn/ui/motion-permission-cancel-recovery.js';

const [
  homeSource,
  homeCss,
  fixedLayoutSource,
  roadbookSource,
  roadbookCss,
  preRaceCss,
  orientationGuardCss,
  productionApp,
  productionMain,
  orchestrator,
  retrySource
] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/roadbook/roadbook.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/roadbook/roadbook.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/pre-race.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-guard.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/session-orchestrator.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/motion-permission-cancel-recovery.js', import.meta.url), 'utf8')
]);

assert.match(productionApp, /installM8HomeNavigation/);
assert.match(productionApp, /m8-home\.js\?revision=r217-track-record-layout/);
assert.match(productionApp, /installM8HomeFixedLayout/);
assert.match(
  productionApp,
  /installStylesheet\(\s*'\.\/m8-home\.css\?revision=r224-modal-headings',\s*'data-turn-m8-home-styles'\s*\)/
);
assert.match(productionApp, /m8-home-fixed-layout\.js\?revision=m8\.9-track-title-alignment/);
assert.ok(productionApp.indexOf('installM8HomeNavigation()') < productionApp.indexOf('installM8HomeFixedLayout()'));
assert.match(productionApp, /turnHomeLifecycle = 'home-m8'/);
assert.match(productionApp, /retireLegacyStartPanel\(\)/);
assert.match(productionMain, /createRaceSessionOrchestrator/);

for (const requiredCopy of ['ROADBOOK', 'Choose your track', 'CHOOSE CAR', 'Track sheet']) {
  assert.ok(roadbookSource.includes(requiredCopy), `ROADBOOK must contain ${requiredCopy}`);
}
assert.doesNotMatch(roadbookSource, /PRE-RACE/, 'ROADBOOK has no eyebrow above its heading');

for (const requiredCopy of [
  'HOW TO PLAY',
  'SETTINGS',
  'Drive By Ear™',
  'Device rotation',
  'On-screen steering',
  'RESET RIVALS'
]) {
  assert.ok(homeSource.includes(requiredCopy), `M8 Home must contain ${requiredCopy}`);
}

assert.match(roadbookSource, /tracks\.map\(renderCard\)/);
assert.match(roadbookSource, /aria-pressed="false"/);
assert.match(homeSource, /installRoadbook\(\{/);
assert.match(homeSource, /garageModule\.showGarage\(\{\s*initialSelection: selectedVehicle\(runtime\),/);
assert.match(
  homeSource,
  /function prepareGarageOnce\(\) \{[\s\S]*const preparation = import\('\/turn\/garage\/garage\.js'\)[\s\S]*lotWarmupPromise = preparation/,
  'Home must reuse one GARAGE warmup across idle preparation and the explicit transition'
);
assert.match(
  homeSource,
  /function scheduleEnhancedLotWarmup\(\)[\s\S]*requestIdleCallback[\s\S]*setTimeout\(beginWarmup, 600\)/,
  'Home should prepare GARAGE after its first paint, with an idle callback and a Safari fallback'
);
assert.match(
  homeSource,
  /roadbook\.setBusy\(`PREPARING \$\{trackName\}…`\);[\s\S]*await waitForHomePaint\(\);/,
  'The selected track action must visibly acknowledge input before expensive setup starts'
);
assert.match(roadbookSource, /function setBusy\(label\) \{[\s\S]*chooseButton\.disabled = Boolean\(label\);[\s\S]*setAttribute\('aria-busy', 'true'\)/);
assert.match(
  homeSource,
  /await Promise\.all\(\[[\s\S]*activateTrack\(trackId, runtime\),[\s\S]*prepareGarageOnce\(\)[\s\S]*\]\);/,
  'Track activation and the reused showroom warmup should share the same transition window'
);
assert.doesNotMatch(homeSource, /chooseTrackBeforeLot/);
assert.match(homeSource, /raceSession\.prepareMotionAccess\(\)/);
assert.match(homeSource, /raceSession\.prepareManualAccess\(\)/);
assert.match(homeSource, /raceSession\.selectVehicle\(selection\)/);
assert.match(homeSource, /showTrackIntro\(trackId\)/);
assert.match(homeSource, /raceSession\.startGame\(pendingAccess\?\.fullscreenPromise\)/);
assert.match(
  homeSource,
  /await Promise\.all\(\[\s*raceSession\.selectVehicle\(selection\),\s*showTrackIntro\(trackId\)\s*\]\);/,
  'Race-car preparation should run behind the existing track intro instead of extending the wait'
);
assert.ok(homeSource.indexOf('activateTrack(trackId, runtime)') < homeSource.indexOf('garageModule.showGarage({'));
assert.ok(homeSource.indexOf('prepareGarageOnce()') < homeSource.indexOf('garageModule.showGarage({'));
assert.ok(homeSource.indexOf('raceSession.selectVehicle(selection)') < homeSource.indexOf('showTrackIntro(trackId)'));
assert.ok(homeSource.indexOf('showTrackIntro(trackId)') < homeSource.indexOf('raceSession.startGame(pendingAccess?.fullscreenPromise)'));
assert.match(homeSource, /runtime\.openGarage = leaveRaceForHome/);
assert.match(homeSource, /showHome\(\{ focus: true \}\)/);
assert.match(homeSource, /turn:home-shown/, 'Home navigation must publish an explicit shown lifecycle event for queued feedback');
assert.match(homeSource, /turn-steering-mode-v1/);
assert.match(homeSource, /saveDriveByEarEnabled/);
assert.match(homeSource, /__turnResetRivals/);

const lotRaceGateStart = homeSource.indexOf('function installGarageRaceGate');
const lotRaceGateEnd = homeSource.indexOf('export async function installM8HomeNavigation');
assert.ok(lotRaceGateStart >= 0 && lotRaceGateEnd > lotRaceGateStart, 'Home must keep a dedicated Race This Car access gate');
const lotRaceGateSource = homeSource.slice(lotRaceGateStart, lotRaceGateEnd);
assert.match(
  homeSource,
  /function motionPermissionWasDismissed\(error\) \{[\s\S]*Motion permission was not granted\./,
  'A cancelled motion prompt must be recognized as a retryable dismissal'
);
assert.match(lotRaceGateSource, /status\.textContent = '';/, 'Each Race This Car attempt starts with no stale permission message');
assert.match(
  lotRaceGateSource,
  /catch \(error\) \{[\s\S]*if \(!motionPermissionWasDismissed\(error\)\) \{[\s\S]*Choose on-screen steering in Settings/,
  'Only genuine motion errors should show the fallback information; cancelling the prompt stays silent'
);
assert.match(
  lotRaceGateSource,
  /raceButton\.addEventListener\('click', gate, true\);/,
  'The motion gate remains armed while a fresh-document retry is prepared'
);
assert.match(lotRaceGateSource, /raceButton\.disabled = false;[\s\S]*raceButton\.focus\(\);/);

assert.match(productionApp, /installMotionPermissionCancelRecovery/);
assert.match(productionApp, /motion-permission-cancel-recovery\.js\?revision=r132-fresh-document/);
assert.match(productionApp, /motionPermissionCancelRecovery\.resume\(home, globalThis\.__turnRuntime\)/);
assert.match(retrySource, /turn-motion-permission-retry-v2/);
assert.match(retrySource, /environment\.__turnGarage\?\.getChoice\?\.\(\)/,
  'The retry keeps GARAGE’s playable choice, never a locked preview');
assert.match(
  retrySource,
  /permissionWasDismissed\(error\)[\s\S]*saveRetryState\(environment\)[\s\S]*reload\(environment\)[\s\S]*return waitForever\(\)/,
  'A cancelled iOS permission prompt must reload into a fresh document instead of silently swallowing every later denial'
);
assert.match(
  retrySource,
  /runtime\.state\.vehicleId[\s\S]*runtime\.state\.vehicleColor[\s\S]*runtime\.state\.vehicleSecondaryColor/,
  'The selected car and paint must survive the fresh-document retry'
);
assert.match(retrySource, /void home\.continueToTrack\(\)/, 'The retry must return the player directly to GARAGE');
assert.doesNotMatch(retrySource, /textContent|aria-live/, 'The fresh-document recovery must not add permission-denied UI copy');

const retryValues = new Map();
const retryStorage = {
  getItem(key) {
    return retryValues.get(key) ?? null;
  },
  setItem(key, value) {
    retryValues.set(key, String(value));
  },
  removeItem(key) {
    retryValues.delete(key);
  }
};

class DismissedMotionEvent {}
Object.defineProperty(DismissedMotionEvent, 'requestPermission', {
  configurable: true,
  value: async () => {
    throw new Error('Motion permission was not granted.');
  }
});

let reloads = 0;
const dismissedEnvironment = {
  DeviceMotionEvent: DismissedMotionEvent,
  document: {
    body: { classList: { contains: (name) => name === 'turn-garage-open' } }
  },
  __turnGarage: {
    getChoice: () => ({ carId: 'sedan-sports', color: '#123456', secondaryColor: '#654321' })
  },
  sessionStorage: retryStorage,
  location: {
    reload() {
      reloads += 1;
    }
  },
  __turnHome: { getSelectedTrackId: () => 'midnight-city' }
};

installMotionPermissionCancelRecovery({ environment: dismissedEnvironment });
void DismissedMotionEvent.requestPermission();
await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
assert.equal(reloads, 1, 'Cancelling permission must create a fresh document so iOS can prompt again');
assert.ok(retryValues.has('turn-motion-permission-retry-v2'), 'The retry route must be saved before reload');

class FreshMotionEvent {}
Object.defineProperty(FreshMotionEvent, 'requestPermission', {
  configurable: true,
  value: async () => 'granted'
});
let continued = 0;
const resumedRuntime = {
  state: {
    vehicleId: 'classic',
    vehicleColor: '#ffffff',
    vehicleSecondaryColor: '#ffffff'
  }
};
const freshEnvironment = {
  DeviceMotionEvent: FreshMotionEvent,
  document: { body: { classList: { contains: () => false } } },
  sessionStorage: retryStorage,
  location: { reload() {} },
  requestAnimationFrame(callback) {
    callback();
    return 1;
  },
  __turnRuntime: resumedRuntime
};
const freshRecovery = installMotionPermissionCancelRecovery({ environment: freshEnvironment });
assert.equal(freshRecovery.resume({
  continueToTrack() {
    continued += 1;
    return Promise.resolve(true);
  }
}, resumedRuntime), true);
assert.equal(continued, 1, 'The fresh document must reopen GARAGE automatically');
assert.equal(resumedRuntime.state.vehicleId, 'sedan-sports');
assert.equal(resumedRuntime.state.vehicleColor, '#123456');
assert.equal(resumedRuntime.state.vehicleSecondaryColor, '#654321');
assert.equal(retryValues.has('turn-motion-permission-retry-v2'), false, 'The retry route is consumed only once');

assert.match(homeCss, /turn-m8-active \.audio-settings-button/);
assert.match(homeCss, /turn-m8-active \.reset-rivals-button/);
assert.match(homeCss, /prefers-reduced-motion/);

// Home's layout is ROADBOOK's; the former fixed layout only installs Home's runtime modules.
assert.match(fixedLayoutSource, /const LAYOUT_ID = 'roadbook'/);
assert.match(fixedLayoutSource, /turnHomeLayout = LAYOUT_ID/);
assert.doesNotMatch(fixedLayoutSource, /m8-home-fixed-layout\.css|m8-home-card-scroll-fixes|syncRaceLabel|MutationObserver\(syncRace/,
  'The retired layout layers stay retired');

// ROADBOOK scrolls as one page under the sticky app bar, with room for the dock.
assert.match(roadbookCss, /calc\(var\(--roadbook-dock-height\) \+ 20px\)/);
assert.match(roadbookCss, /scroll-padding-bottom: calc\(var\(--roadbook-dock-height\) \+ 12px\)/);
assert.match(roadbookSource, /new ResizeObserver\(syncDockSpace\)\.observe\(dock\)/,
  'The dock space follows the dock at any text size');
assert.match(roadbookCss, /@container \(min-width: 38rem\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(preRaceCss, /\.turn-pr-card-name \{[^}]*overflow-wrap: break-word;/, 'Names wrap rather than clip');
assert.doesNotMatch(preRaceCss, /text-overflow: ellipsis/, 'Nothing in the pre-race primitives truncates');
assert.match(preRaceCss, /@container \(max-width: 20rem\)[\s\S]*\.turn-pr-card-art \{\s*display: none;/,
  'At 320px the route gives way before the name');
assert.doesNotMatch(`${roadbookCss}\n${preRaceCss}`, /100lvh|100vh/, 'Layout uses the usable viewport, never the physical screen');

assert.match(orientationGuardCss, /#intro[\s\S]*display: none !important/);
assert.doesNotMatch(orientationGuardCss, /100lvh/);

assert.match(orchestrator, /async function prepareMotionAccess\(\)/);
assert.match(orchestrator, /function prepareManualAccess\(\)/);
assert.match(orchestrator, /async function selectVehicle\(selection[,)]/);
assert.match(orchestrator, /function leaveRace\(\)/);
assert.match(orchestrator, /publish\('home-open'\)/);
assert.match(orchestrator, /phase = 'home'/);

console.log('TURN production M8 Home, prepared showroom entry, fresh-document motion permission recovery, stable record-card layout, and native scrollbar divider contracts passed.');
