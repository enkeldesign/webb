import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  releaseSource,
  behavior,
  bootstrap,
  secretEvents,
  secretAchievements,
  world,
  app,
  homeLayout,
  index
] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/countryside-bella-rescue-r173.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/countryside-bella-rescue-hotfix-r176.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/secret-events.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/secret-achievements.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);

assert.match(behavior, /SAVE_BELLA_ID = 'save-bella'/);
assert.match(behavior, /REQUIRED_VEHICLE_ID = 'firetruck'/);
assert.match(behavior, /UPDATE_INTERVAL_MS = 120/);
assert.doesNotMatch(behavior, /RESCUE_SIREN_HOLD_MS/,
  'A single sampled active siren inside the deliberate off-road clearing must rescue Bella');
assert.match(behavior, /RESCUE_ZONE = Object\.freeze\(\{[\s\S]*halfWidth: 30,[\s\S]*nearDepth: -7,[\s\S]*farDepth: 50/,
  'SAVE BELLA! must cover a 60 m wide, 57 m deep clearing around and behind the tree');

assert.match(behavior, /return runtime\?\.state\?\.position \|\| runtime\?\.playerCar\?\.position/,
  'Rescue checks must use canonical physics position before the one-frame-late rendered car');
assert.match(behavior, /function nearestRoadSample\(runtime, treeWorldPosition\)/);
assert.match(behavior, /for \(const sample of runtime\?\.samples \|\| \[\]\)/);
assert.match(behavior, /frame\.tree\.x - Number\(nearest\.point\.x \|\| 0\)/);
assert.match(behavior, /frame\.tree\.z - Number\(nearest\.point\.z \|\| 0\)/,
  'The away-from-track axis must be derived from the actual closest road point, not guessed model rotation');
assert.match(behavior, /const depth = frame\.relative\.dot\(frame\.outward\)/);
assert.match(behavior, /const across = frame\.relative\.dot\(frame\.across\)/);
assert.match(behavior, /Math\.abs\(across\) <= RESCUE_ZONE\.halfWidth/);
assert.match(behavior, /depth >= RESCUE_ZONE\.nearDepth/);
assert.match(behavior, /depth <= RESCUE_ZONE\.farDepth/);

assert.match(behavior, /function sirenControlActive\(\)/);
assert.match(behavior, /globalThis\.__turnBoostActive === true/);
assert.match(behavior, /querySelector\('\.drive-boost-zone'\)/);
assert.match(behavior, /classList\.contains\('is-active'\)/);
assert.match(behavior, /classList\.contains\('is-locked'\) === false/);
assert.match(behavior, /Number\(globalThis\.__turnBoostCharge\) > 0\.001/,
  'The trigger must recognise the visibly active Boost control even between physics updates');
assert.match(behavior, /if \(inRescueZone && sirenControlActive\(\)\) \{\s*completeInteractiveRescue\(player\)/,
  'The Fire Truck siren must rescue Bella immediately when sampled inside the clearing');
assert.match(behavior, /String\(state\?\.vehicleId \|\| ''\)\.toLowerCase\(\) === REQUIRED_VEHICLE_ID/);
assert.match(behavior, /state\?\.running === true \|\| state\?\.lapActive === true/);
assert.match(behavior, /activeTrackId\(runtime\) === 'countryside'/);

assert.match(behavior, /SAFE_GROUND_POSITION = Object\.freeze\(\{ x: 4\.8, y: 0\.08, z: -3\.2 \}\)/);
assert.match(behavior, /cat\.position\.set\(SAFE_GROUND_POSITION\.x/);
assert.match(behavior, /cat\.updateMatrixWorld\(true\)/);
assert.match(behavior, /root\.updateMatrixWorld\(true\)/,
  'Bella must be rendered on the ground before the achievement is emitted');
assert.match(behavior, /turnBellaState = 'rescued-stationary'/);
assert.match(behavior, /sourceAnimationClips: 0/);
assert.match(behavior, /Bella cannot enter the road/);
assert.doesNotMatch(behavior, /AnimationMixer|clipAction|cat\.position\.(?:add|lerp)/);

const moveIndex = behavior.indexOf('moveBellaToGround(root, { announce: true })');
const signalIndex = behavior.indexOf('signalSecretAchievement(SAVE_BELLA_ID');
assert.ok(moveIndex >= 0 && signalIndex > moveIndex,
  'Bella must reach the ground before SAVE BELLA! is signalled');
assert.match(behavior, /rescueConfirmed: true/);
assert.match(behavior, /rescueMethod: 'fire-truck-siren-road-derived-zone'/);

assert.match(secretEvents, /achievementId === SAVE_BELLA_ID && context\.rescueConfirmed !== true/);
assert.match(secretEvents, /takePendingSecretAchievements/);
assert.match(secretAchievements, /validSecretContext/);
assert.match(secretAchievements, /context\.rescueConfirmed === true/);
assert.match(secretAchievements, /pendingSecretAchievements\(\)/,
  'Hidden-achievement bootstrap must inspect durable pending evidence without consuming it first');
assert.match(secretAchievements, /acknowledgeSecretAchievement\(achievementId\)/,
  'Hidden-achievement evidence must be cleared only after a recognized unlock');
assert.match(behavior, /store\?\.isUnlocked\?\.\(SAVE_BELLA_ID\)/);

assert.match(behavior, /MEOW_RANGE_METERS = 108/);
assert.match(behavior, /spatialPan\(runtime, player, bellaWorldPosition\)/);
assert.match(behavior, /interval = MEOW_MAX_INTERVAL_MS\s*- proximity/);
assert.match(behavior, /__turnAudioPreferences\?\.getSettings/);
assert.match(behavior, /createStereoPanner/);
assert.match(behavior, /voice\.frequency\.exponentialRampToValueAtTime/);

// Bella keeps its tiny directional world-sound context separate from the central
// game/DBE graph, but ordinary sessions must not keep that third context running.
assert.match(behavior, /function meowContextWanted\(/);
assert.match(
  behavior,
  /activeTrackId\(runtime\) === 'countryside'[\s\S]*vehicleId \|\| ''\)\.toLowerCase\(\) === REQUIRED_VEHICLE_ID[\s\S]*otherSoundPreference\(\) > 0\.001[\s\S]*document\.visibilityState !== 'hidden'/,
  'Bella audio must only arm for a visible Countryside Fire Truck run with other sounds enabled'
);
assert.match(
  behavior,
  /function unlockMeowContext\(\)[\s\S]*if \(meowContextWanted\(\)\) ensureMeowContext\(\)/,
  'Ordinary gestures must not eagerly create the Bella AudioContext'
);
assert.match(behavior, /function suspendMeowContext\(\)/);
assert.match(
  behavior,
  /if \(!eligible \|\| document\.hidden\) \{[\s\S]*suspendMeowContext\(\)/,
  'Leaving an eligible rescue run must suspend Bella audio'
);
assert.match(
  behavior,
  /meowContext\.close\?\.\(\)[\s\S]*meowContext = null/,
  'Disposal must close and release Bella audio completely'
);

assert.match(world, /countryside-bella-rescue-r173\.js\?revision=r164-long-session-robustness/,
  'The Countryside world bootstrap must request the on-demand Bella audio lifecycle under a fresh URL');
assert.match(world, /applyBellaFinalVisuals\(bellaRoot\);\s*installBellaRescueBehavior\(\{ root: bellaRoot, runtime \}\);/);
assert.match(app, /render\/world\.js\?revision=r531-countryside-world-redesign/,
  'The app must request the optimized world graph rather than an older Bella world cache identity');
assert.match(homeLayout, /secret-achievements\.js\?build=\$\{buildKey\}-r174-bella-siren-zone/);

assert.match(bootstrap, /countryside-bella-rescue-r173\.js\?revision=r164-long-session-robustness/,
  'The independent Bella bootstrap must reinstall the same robustness behavior as the world graph');
assert.match(bootstrap, /turnBellaDisposeRescueBehavior\?\.\(\)/);
assert.match(bootstrap, /turnBellaRescueBehaviorInstalled = false/);
assert.match(bootstrap, /function correctedSpatialRuntime\(runtime\)/,
  'The r172 bootstrap must isolate Bella stereo correction from shared TURN coordinates');
assert.match(bootstrap, /property === 'getRight'/);
assert.match(bootstrap, /x: -Number\(right\.x \|\| 0\)/);
assert.match(bootstrap, /y: -Number\(right\.y \|\| 0\)/);
assert.match(bootstrap, /z: -Number\(right\.z \|\| 0\)/,
  'Bella must negate the runtime right vector so Web Audio negative/positive pan maps to the player’s actual left/right');
assert.match(bootstrap, /installBellaRescueBehavior\(\{ root, runtime: correctedSpatialRuntime\(runtime\) \}\)/,
  'The independent bootstrap must install the rescue behavior with the corrected spatial runtime');
assert.doesNotMatch(bootstrap, /installBellaRescueBehavior\(\{ root, runtime \}\)/,
  'The old mirrored Bella bootstrap must not be reintroduced');
assert.match(bootstrap, /turnBellaRescueBootstrap = 'r172-screen-reader-quality'/,
  'The production bootstrap must identify the directional-audio screen-reader quality behavior it reinstalls');
assert.match(bootstrap, /RETRY_DELAYS_MS = Object\.freeze\(\[250, 350, 500, 700, 900, 1200, 1600, 2200, 3000, 4000\]\)/,
  'Async Bella discovery should use a bounded back-off rather than an 8 Hz startup poll');
assert.doesNotMatch(bootstrap, /setInterval/,
  'The independent Bella bootstrap must not maintain its old fixed 120 ms polling interval');
assert.match(index, new RegExp(`app\\.js\\?build=${escapeRegex(release.cacheKey)}-browser-consent-r176-bella-road-derived-zone`),
  'The top-level app URL must use the canonical release cache key so Safari cannot retain an old dependency graph');
assert.match(index, new RegExp(`countryside-bella-rescue-hotfix-r176\\.js\\?build=${escapeRegex(release.cacheKey)}&revision=r530-screen-reader-quality`),
  'The directional Bella replacement must be bound to the canonical release cache identity');

console.log('TURN Bella video-proven rescue, corrected left/right directional audio and bounded bootstrap regression passed.');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
