import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  productionIndex,
  productionApp,
  nextIndex,
  nextApp,
  storage,
  safeZoneSource,
  steeringLimitWarning,
  steeringLimitWarningCss,
  identity,
  identityCss,
  manifestSource,
  releaseSource,
  platformContext,
  webPlatform,
  motionLifecycleBridge,
  displayLifecycleBridge,
  motionInput,
  cameraSource,
  orientationCompat,
  orientationGuardCss,
  homeSource,
  homeCss
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/motion-safe-zone.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/steering-limit-warning.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/steering-limit-warning.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/identity.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/identity.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/platform/platform-context.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/platform/web-platform.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/motion-lifecycle-bridge.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/display-lifecycle-bridge.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/input/motion.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/camera.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-compat.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-guard.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/m8-home.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/m8-home.css', import.meta.url), 'utf8')
]);

const manifest = JSON.parse(manifestSource);
const release = JSON.parse(releaseSource);

assert.match(productionIndex, new RegExp(`TURN v${release.version} · Build ${release.id}`));
assert.match(productionIndex, /motion-safe-zone\.js\?build=/);
assert.ok(
  productionIndex.indexOf('./motion-safe-zone.js') < productionIndex.indexOf('./orientation-compat.js'),
  'Production must configure the motion envelope before orientation feedback'
);

assert.match(nextIndex, /<base href="\/turn\/">/, 'TURN NEXT must reuse the canonical production module graph');
assert.match(nextIndex, /data-turn-deployment="next"/);
assert.match(nextIndex, /<meta name="robots" content="noindex,nofollow">/);
assert.match(nextIndex, /TURN NEXT · Source TURN/);
assert.match(nextIndex, /class="turn-next-badge"/);
assert.match(nextIndex, /\/turn-next\/storage-bootstrap\.js/);
assert.match(nextIndex, /\.\/motion-safe-zone\.js\?build=/);
assert.match(nextIndex, /\/turn-next\/identity\.css\?source=.*-m8\.5/);
assert.match(nextIndex, /\/turn-next\/identity\.js\?source=.*-m8\.5/);
assert.match(nextIndex, /\/turn-next\/site\.webmanifest/);
assert.match(nextIndex, /src="\/turn-next\/app\.js\?source=.*-m8\.4"/);
assert.match(nextIndex, /id="installGate"/);
assert.match(nextIndex, /Add TURN NEXT to your Home Screen/);
assert.doesNotMatch(nextIndex, /turn-next\/safe-zone-bootstrap|turn-next\/steering-limit-warning/);
assert.ok(
  nextIndex.indexOf('/turn-next/storage-bootstrap.js') < nextIndex.indexOf('./install-gate.js'),
  'Storage isolation must install before production scripts access storage'
);
assert.ok(
  nextIndex.indexOf('/turn-next/identity.css') < nextIndex.indexOf('/turn-next/app.js'),
  'The no-flash identity stylesheet must load before the M8 application bootstrap'
);
assert.ok(
  nextIndex.indexOf('/turn-next/identity.js') < nextIndex.indexOf('/turn-next/app.js'),
  'The legacy start panel must be retired before the M8 application bootstrap'
);
assert.ok(
  nextIndex.indexOf('./motion-safe-zone.js') < nextIndex.indexOf('./orientation-compat.js'),
  'TURN NEXT must inherit the canonical safe zone before orientation feedback'
);
assert.doesNotMatch(nextIndex, /turnAppViewport|orientation-preflight|orientation-freeze/);
assert.doesNotMatch(nextIndex, /href="\.\/site\.webmanifest/);

assert.match(identity, /function retireLegacyStartPanel\(\)/);
assert.match(identity, /intro\.hidden = true/);
assert.match(identity, /intro\.replaceChildren\(/);
assert.match(identity, /makeHiddenHook\('button', 'motionButton'\)/);
assert.match(identity, /makeHiddenHook\('button', 'manualButton'\)/);
assert.match(identity, /makeHiddenHook\('p', 'status'\)/);
assert.match(identity, /turnLegacyStart = 'retired'/);
assert.match(identityCss, /html\[data-turn-deployment="next"\] #intro[\s\S]*display: none !important/);
assert.match(identityCss, /html\[data-turn-deployment="next"\] body[\s\S]*position: fixed[\s\S]*inset: 0/);
assert.match(identityCss, /html\[data-turn-deployment="next"\] #game,[\s\S]*\.m8-home,[\s\S]*\.rotate-panel[\s\S]*position: fixed[\s\S]*inset: 0/);
assert.match(identityCss, /min-width: 0/);
assert.match(identityCss, /min-height: 0/);
assert.match(identityCss, /background: #08090a/);
assert.doesNotMatch(identityCss, /100lvh|min-height:\s*100vh/);

assert.match(nextApp, /Generated from turn\/app\.js/);
assert.match(nextApp, /const productionModuleBase = new URL\('\/turn\/'/);
assert.match(nextApp, /const platformModuleBase = new URL\('\/turn\/platform\/'/);
assert.match(nextApp, /const stagingModuleBase = new URL\('\/turn-next\/'/);
assert.match(nextApp, /const webPlatform = createWebPlatform\(\)/);
assert.match(nextApp, /installTurnPlatform\(webPlatform\)/);
assert.match(nextApp, /installMotionLifecycleBridge\(\{ platform: webPlatform \}\)/);
assert.match(nextApp, /installDisplayLifecycleBridge\(\{ platform: webPlatform \}\)/);
assert.match(nextApp, /dataset\.turnPlatform = 'web-adapter'/);
assert.match(nextApp, /dataset\.turnMotionLifecycle = 'platform-m5'/);
assert.match(nextApp, /dataset\.turnDisplayLifecycle = 'platform-m6'/);
assert.match(nextApp, /dataset\.turnSessionLifecycle = 'orchestrator-m7'/);
assert.match(nextApp, /dataset\.turnHomeLifecycle = 'home-m8'/);
assert.match(nextApp, /main\.js\?source=\$\{buildKey\}-m8/);
assert.match(nextApp, /m8-home\.css\?source=\$\{buildKey\}-m8/);
assert.match(nextApp, /m8-home\.js\?source=\$\{buildKey\}-m8/);
assert.match(nextApp, /m8-home-fixed-layout\.js\?source=\$\{buildKey\}-m8\.4/);
assert.match(nextApp, /installM8HomeNavigation\(\)/);
assert.match(nextApp, /installM8HomeFixedLayout\(\)/);
assert.match(nextApp, /Platform M5–M8 · Motion \+ Display \+ Session \+ Home/);
assert.doesNotMatch(nextApp, /turnNextModuleBase|turn-next\/steering-limit-warning|installTurnNextSteeringLimitWarning/);
assert.ok(
  nextApp.indexOf('installTurnPlatform(webPlatform)') < nextApp.indexOf('main.js?source=${buildKey}-m8'),
  'The platform must be composed before main.js imports browser-dependent systems'
);
assert.ok(
  nextApp.indexOf('installMotionLifecycleBridge({ platform: webPlatform })') < nextApp.indexOf('main.js?source=${buildKey}-m8'),
  'Platform M5 must own legacy permission and subscription calls before main.js loads'
);
assert.ok(
  nextApp.indexOf('installDisplayLifecycleBridge({ platform: webPlatform })') < nextApp.indexOf('main.js?source=${buildKey}-m8'),
  'Platform M6 must own legacy fullscreen and landscape calls before main.js loads'
);
assert.ok(
  nextApp.indexOf("withBuild('./ui/in-game-menu.js')") < nextApp.indexOf('installM8HomeNavigation()'),
  'M8 must consolidate the already-composed race menu rather than racing it during startup'
);
assert.match(nextApp, /new URL\(path, productionModuleBase\)/);
assert.doesNotMatch(nextApp, /new URL\(path, import\.meta\.url\)/);
assert.match(nextApp, /TURN NEXT:/);

for (const requiredInstall of [
  'installPerformanceProfile',
  'installCoveredRenderingGuard',
  'installDriveByEarSetting',
  'prepareOrganicRibbonCapture',
  'prepareRecoveryGuidanceCapture',
  'preparePaceNotePriorityCapture',
  'installTurnAudio',
  'installSteeringLimitWarning',
  'installPaceNotePriority',
  'installUniversalDrivingSoundscape',
  'installPaceNotes',
  'installOffroadEarDirection',
  'installRecoveryGuidance',
  'installAudioPreferenceRuntime',
  'installRaceSpeech',
  'installRacePositionLayout'
]) {
  assert.ok(productionApp.includes(requiredInstall), `Production bootstrap must contain ${requiredInstall}`);
  assert.ok(nextApp.includes(requiredInstall), `TURN NEXT bootstrap must preserve ${requiredInstall}`);
}

assert.match(productionApp, /installStylesheet\('\.\/steering-limit-warning\.css'/);
assert.match(nextApp, /installStylesheet\('\.\/steering-limit-warning\.css'/);
assert.ok(
  productionApp.indexOf('installSteeringLimitWarning()') < productionApp.indexOf("withBuild('./main.js')")
);
assert.ok(
  nextApp.indexOf('installSteeringLimitWarning()') < nextApp.indexOf('main.js?source=${buildKey}-m8')
);

assert.match(homeSource, /TILT\. DRIFT\.[\s\S]*BEAT YOUR BEST\./);
assert.match(homeSource, /HOW TO PLAY/);
assert.match(homeSource, /SETTINGS/);
assert.match(homeSource, /m8-track-rail/);
assert.match(homeSource, /TRACK_SELECTION_CATALOG\.map\(renderTrackCard\)/);
assert.match(homeSource, /showTheLot\(\{ initialSelection: selectedVehicle\(runtime\) \}\)/);
assert.match(homeSource, /raceSession\.prepareMotionAccess\(\)/);
assert.match(homeSource, /raceSession\.prepareManualAccess\(\)/);
assert.match(homeSource, /raceSession\.selectVehicle\(selection\)/);
assert.match(homeSource, /showTrackIntro\(selectedTrackId\)/);
assert.match(homeSource, /raceSession\.startGame\(pendingAccess\?\.fullscreenPromise\)/);
assert.match(homeSource, /runtime\.openLot = leaveRaceForHome/);
assert.match(homeCss, /scroll-snap-type: x mandatory/);
assert.match(homeCss, /turn-m8-active \.audio-settings-button/);
assert.match(homeCss, /turn-m8-active \.reset-rivals-button/);

assert.match(safeZoneSource, /SAFE_ZONE_DEGREES = 24/);
assert.match(safeZoneSource, /steeringDegrees: SAFE_ZONE_DEGREES/);
assert.match(safeZoneSource, /horizonDegrees: SAFE_ZONE_DEGREES/);
assert.match(safeZoneSource, /feedbackNearDegrees: 19/);
assert.match(safeZoneSource, /feedbackHardDegrees: SAFE_ZONE_DEGREES/);
assert.match(safeZoneSource, /feedbackHardRearmDegrees: 22/);
assert.match(safeZoneSource, /feedbackClearDegrees: 17\.5/);
assert.match(safeZoneSource, /directionalFeedback: true/);
assert.match(safeZoneSource, /dataset\.turnMotionSafeZone/);

assert.match(steeringLimitWarning, /turn:steering-limit-feedback/);
assert.match(steeringLimitWarning, /Left steering limit reached\./);
assert.match(steeringLimitWarning, /Right steering limit reached\./);
assert.match(steeringLimitWarning, /aria-live', 'assertive'/);
assert.match(steeringLimitWarning, /__turnAudio/);
assert.match(steeringLimitWarning, /steeringLimitVisualGrowth/);
assert.match(steeringLimitWarning, /steeringLimitInertialStep/);
assert.match(steeringLimitWarning, /VISUAL_RELEASE_HOLD_MS = 300/);
assert.match(steeringLimitWarning, /VISUAL_ATTACK_TAU_MS = 360/);
assert.match(steeringLimitWarning, /VISUAL_RELEASE_TAU_MS = 780/);
assert.match(steeringLimitWarning, /requestAnimationFrame\(animateVisuals\)/);
assert.doesNotMatch(steeringLimitWarning, /FLASH_DURATION|is-flashing|function flash/);
assert.match(steeringLimitWarningCss, /turn-steering-limit-edge-left/);
assert.match(steeringLimitWarningCss, /turn-steering-limit-edge-right/);
assert.match(steeringLimitWarningCss, /width: clamp\(34px, 9vw, 75px\)/);
assert.match(steeringLimitWarningCss, /transition: none/);
assert.doesNotMatch(steeringLimitWarningCss, /transition-duration|animation|@keyframes|is-flashing/);
assert.doesNotMatch(orientationGuardCss, /\.hud::before|turn-steering-limit-pulse|@keyframes/);

assert.match(platformContext, /installTurnPlatform/);
assert.match(platformContext, /requireTurnPlatform/);
assert.match(platformContext, /validateTurnPlatform/);
assert.doesNotMatch(platformContext, /\b(?:window|document|screen|DeviceMotionEvent)\b/);
assert.match(webPlatform, /requestMotionPermission = motionEventType\?\.requestPermission/);
assert.match(webPlatform, /addWindowEventListener\('devicemotion'/);
assert.match(webPlatform, /removeWindowEventListener\?\.\('devicemotion'/);
assert.match(webPlatform, /requestDefaultFullscreen = defaultFullscreenRoot\?\.requestFullscreen/);
assert.match(webPlatform, /lockScreenOrientation = screenOrientation\?\.lock/);
assert.match(webPlatform, /requestFullscreen/);
assert.match(webPlatform, /lockLandscape/);
assert.match(motionLifecycleBridge, /motion\.requestPermission\(\)/);
assert.match(motionLifecycleBridge, /motion\.subscribe\(listener\)/);
assert.match(motionLifecycleBridge, /type === 'devicemotion'/);
assert.match(motionLifecycleBridge, /launchPending && !intro\.hidden/);
assert.doesNotMatch(motionLifecycleBridge, /pagehide/, 'M5 must preserve production background/resume listener behavior');
assert.match(displayLifecycleBridge, /display\.requestFullscreen\(root\)/);
assert.match(displayLifecycleBridge, /display\.lockLandscape\(\)/);
assert.match(displayLifecycleBridge, /fullscreenPending/);
assert.match(displayLifecycleBridge, /landscapePending/);
assert.match(motionInput, /getTurnPlatform/);
assert.match(motionInput, /resolveSteeringRollLimit/);
assert.match(motionInput, /__TURN_MOTION_SAFE_ZONE__/);
assert.match(cameraSource, /resolveSensorCameraRollLimit/);
assert.match(cameraSource, /__TURN_MOTION_SAFE_ZONE__/);
assert.match(orientationCompat, /feedbackHardDegrees/);
assert.match(orientationCompat, /feedbackHardRearmDegrees/);
assert.match(orientationCompat, /turn:steering-limit-feedback/);
assert.match(orientationCompat, /__TURN_MOTION_SAFE_ZONE__/);

assert.match(storage, /const LOCAL_PREFIX = 'turn-next:';/);
assert.match(storage, /const SESSION_PREFIX = 'turn-next-session:';/);
assert.match(storage, /globalThis\.__TURN_NEXT_STORAGE_READY__ = true/);
assert.doesNotMatch(storage, /seed|copyProduction|COPY_ONCE/i);
assert.match(identity, /MutationObserver/);

for (const removedPath of [
  '../turn-next/safe-zone-bootstrap.js',
  '../turn-next/steering-limit-warning.js',
  '../turn-next/steering-limit-warning.css'
]) {
  await assert.rejects(fs.access(new URL(removedPath, import.meta.url)));
}

assert.deepEqual(
  {
    id: manifest.id,
    name: manifest.name,
    shortName: manifest.short_name,
    startUrl: manifest.start_url,
    scope: manifest.scope,
    display: manifest.display,
    orientation: manifest.orientation
  },
  {
    id: '/turn-next/',
    name: 'TURN NEXT',
    shortName: 'TURN NEXT',
    startUrl: '/turn-next/',
    scope: '/turn-next/',
    display: 'fullscreen',
    orientation: 'landscape'
  }
);

console.log(`TURN NEXT Platform M5–M8 entry for TURN ${release.id} passed.`);
