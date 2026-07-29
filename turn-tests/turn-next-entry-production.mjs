import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  productionIndex,
  productionApp,
  nextIndex,
  nextApp,
  storage,
  safeZoneBootstrap,
  steeringLimitWarning,
  steeringLimitWarningCss,
  identity,
  manifestSource,
  releaseSource,
  platformContext,
  webPlatform,
  motionInput,
  cameraSource,
  orientationCompat
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/storage-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/safe-zone-bootstrap.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/steering-limit-warning.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/steering-limit-warning.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/identity.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/platform/platform-context.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/platform/web-platform.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/input/motion.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/camera.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/orientation-compat.js', import.meta.url), 'utf8')
]);

const manifest = JSON.parse(manifestSource);
const release = JSON.parse(releaseSource);

assert.match(productionIndex, new RegExp(`TURN v${release.version} · Build ${release.id}`));
assert.match(nextIndex, /<base href="\/turn\/">/, 'TURN NEXT must reuse the current production module graph during the migration milestone');
assert.match(nextIndex, /data-turn-deployment="next"/);
assert.match(nextIndex, /<meta name="robots" content="noindex,nofollow">/);
assert.match(nextIndex, /TURN NEXT · Source TURN/);
assert.match(nextIndex, /class="turn-next-badge"/);
assert.match(nextIndex, /\/turn-next\/storage-bootstrap\.js/);
assert.match(nextIndex, /\/turn-next\/safe-zone-bootstrap\.js\?source=.*&stage=directional-limit-m4/);
assert.match(nextIndex, /\/turn-next\/steering-limit-warning\.css\?source=.*&stage=directional-limit-m4/);
assert.match(nextIndex, /\/turn-next\/identity\.css/);
assert.match(nextIndex, /\/turn-next\/identity\.js/);
assert.match(nextIndex, /\/turn-next\/site\.webmanifest/);
assert.match(nextIndex, /src="\/turn-next\/app\.js\?source=/, 'The parity entry must launch through its own staging bootstrap');
assert.ok(
  nextIndex.indexOf('/turn-next/storage-bootstrap.js') < nextIndex.indexOf('./install-gate.js'),
  'Storage isolation must install before any production script can access storage'
);
assert.ok(
  nextIndex.indexOf('/turn-next/safe-zone-bootstrap.js') < nextIndex.indexOf('./orientation-compat.js'),
  'The 24-degree motion envelope must exist before orientation feedback initializes'
);
assert.doesNotMatch(nextIndex, /turnAppViewport|orientation-preflight|orientation-freeze/);
assert.doesNotMatch(nextIndex, /href="\.\/site\.webmanifest/);

assert.match(nextApp, /Generated from turn\/app\.js/);
assert.match(nextApp, /const productionModuleBase = new URL\('\/turn\/'/);
assert.match(nextApp, /const platformModuleBase = new URL\('\/turn\/platform\/'/);
assert.match(nextApp, /const turnNextModuleBase = new URL\('\/turn-next\/'/);
assert.match(nextApp, /const webPlatform = createWebPlatform\(\)/);
assert.match(nextApp, /installTurnPlatform\(webPlatform\)/);
assert.match(nextApp, /installTurnNextSteeringLimitWarning\(\)/);
assert.match(nextApp, /steering-limit-warning\.js\?source=.*&stage=directional-limit-m4/);
assert.match(nextApp, /dataset\.turnPlatform = 'web-adapter'/);
assert.match(nextApp, /Platform M1 · Safe Zone M3 · Limit M4/, 'The visible staging badge must identify the active platform, safe-zone and directional-limit milestones');
assert.doesNotMatch(nextApp, /orientation-freeze|installTurnNextOrientationFreeze|Orientation M2/);
assert.ok(
  nextApp.indexOf('installTurnPlatform(webPlatform)') < nextApp.indexOf("withBuild('./main.js')"),
  'The platform must be composed before main.js imports motion input'
);
assert.ok(
  nextApp.indexOf('installTurnNextSteeringLimitWarning()') < nextApp.indexOf("withBuild('./main.js')"),
  'The directional warning must be ready before the race core starts'
);
assert.doesNotMatch(productionApp, /installTurnPlatform\(webPlatform\)|Safe Zone M3|Limit M4/, 'Production must retain the proven browser bootstrap during this TURN NEXT experiment');
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
  'installPaceNotePriority',
  'installUniversalDrivingSoundscape',
  'installPaceNotes',
  'installOffroadEarDirection',
  'installRecoveryGuidance',
  'installAudioPreferenceRuntime',
  'installRaceSpeech',
  'installRacePositionLayout'
]) {
  assert.ok(productionApp.includes(requiredInstall), `Production bootstrap must still contain ${requiredInstall}`);
  assert.ok(nextApp.includes(requiredInstall), `TURN NEXT bootstrap must preserve ${requiredInstall}`);
}

assert.match(safeZoneBootstrap, /SAFE_ZONE_DEGREES = 24/);
assert.match(safeZoneBootstrap, /steeringDegrees: SAFE_ZONE_DEGREES/);
assert.match(safeZoneBootstrap, /horizonDegrees: SAFE_ZONE_DEGREES/);
assert.match(safeZoneBootstrap, /feedbackNearDegrees: 19/);
assert.match(safeZoneBootstrap, /feedbackHardDegrees: SAFE_ZONE_DEGREES/);
assert.match(safeZoneBootstrap, /feedbackHardRearmDegrees: 22/);
assert.match(safeZoneBootstrap, /feedbackClearDegrees: 17\.5/);
assert.match(safeZoneBootstrap, /directionalFeedback: true/);
assert.match(safeZoneBootstrap, /data.*turnMotionSafeZone|dataset\.turnMotionSafeZone/);
assert.match(steeringLimitWarning, /turn:steering-limit-feedback/);
assert.match(steeringLimitWarning, /Left steering limit reached\./);
assert.match(steeringLimitWarning, /Right steering limit reached\./);
assert.match(steeringLimitWarning, /aria-live', 'assertive'/);
assert.match(steeringLimitWarning, /__turnAudio/);
assert.match(steeringLimitWarningCss, /turn-steering-limit-edge-left/);
assert.match(steeringLimitWarningCss, /turn-steering-limit-edge-right/);
assert.match(steeringLimitWarningCss, /turn-steering-limit-edge-flash/);

assert.match(platformContext, /installTurnPlatform/);
assert.match(platformContext, /requireTurnPlatform/);
assert.match(platformContext, /validateTurnPlatform/);
assert.doesNotMatch(platformContext, /\b(?:window|document|screen|DeviceMotionEvent)\b/, 'The platform context must remain environment-agnostic');
assert.match(webPlatform, /requestPermission/);
assert.match(webPlatform, /addEventListener\('devicemotion'/);
assert.match(webPlatform, /requestFullscreen/);
assert.match(webPlatform, /lockLandscape/);
assert.match(motionInput, /getTurnPlatform/);
assert.match(motionInput, /resolveSteeringRollLimit/);
assert.match(motionInput, /__TURN_MOTION_SAFE_ZONE__/);
assert.match(motionInput, /getTurnPlatform\(\)\?\.motion\?\.getScreenOrientationAngle/);
assert.match(motionInput, /globalThis\.screen/, 'Production must retain its browser fallback until the adapter is promoted');
assert.match(cameraSource, /resolveSensorCameraRollLimit/);
assert.match(cameraSource, /__TURN_MOTION_SAFE_ZONE__/);
assert.match(orientationCompat, /feedbackHardDegrees/);
assert.match(orientationCompat, /feedbackHardRearmDegrees/);
assert.match(orientationCompat, /turn:steering-limit-feedback/);
assert.match(orientationCompat, /__TURN_MOTION_SAFE_ZONE__/);

assert.match(storage, /const LOCAL_PREFIX = 'turn-next:';/);
assert.match(storage, /const SESSION_PREFIX = 'turn-next-session:';/);
assert.match(storage, /proto\.getItem = function getItem/);
assert.match(storage, /proto\.setItem = function setItem/);
assert.match(storage, /proto\.removeItem = function removeItem/);
assert.match(storage, /proto\.clear = function clear/);
assert.match(storage, /proto\.key = function key/);
assert.match(storage, /globalThis\.__TURN_NEXT_STORAGE_READY__ = true/);
assert.doesNotMatch(storage, /seed|copyProduction|COPY_ONCE/i, 'TURN NEXT must not copy production data automatically');
assert.match(identity, /MutationObserver/, 'Dynamic install-gate copy must retain the TURN NEXT identity');

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

console.log(`TURN NEXT isolated Limit M4 entry for TURN ${release.id} passed.`);
