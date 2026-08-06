import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  behavior,
  bootstrap,
  secretEvents,
  secretAchievements,
  world,
  app,
  homeLayout,
  index
] = await Promise.all([
  fs.readFile(new URL('../../turn/tracks/countryside-bella-rescue-r173.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/countryside-bella-rescue-hotfix-r176.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/secret-events.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/secret-achievements.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8')
]);

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
assert.match(secretAchievements, /takePendingSecretAchievements\(\)/);
assert.match(behavior, /store\?\.isUnlocked\?\.\(SAVE_BELLA_ID\)/);

assert.match(behavior, /MEOW_RANGE_METERS = 108/);
assert.match(behavior, /spatialPan\(runtime, player, bellaWorldPosition\)/);
assert.match(behavior, /interval = MEOW_MAX_INTERVAL_MS\s*- proximity/);
assert.match(behavior, /__turnAudioPreferences\?\.getSettings/);
assert.match(behavior, /createStereoPanner/);
assert.match(behavior, /voice\.frequency\.exponentialRampToValueAtTime/);

assert.match(world, /countryside-bella-rescue-r173\.js\?revision=r176-road-derived-rescue-zone/);
assert.match(world, /applyBellaFinalVisuals\(bellaRoot\);\s*installBellaRescueBehavior\(\{ root: bellaRoot, runtime \}\);/);
assert.match(app, /render\/world\.js\?revision=r175-bella-broad-rear-zone/,
  'The established app world entry remains valid while the independent rescue bootstrap replaces cached behavior');
assert.match(homeLayout, /secret-achievements\.js\?build=\$\{buildKey\}-r174-bella-siren-zone/);

assert.match(bootstrap, /turnBellaDisposeRescueBehavior\?\.\(\)/);
assert.match(bootstrap, /turnBellaRescueBehaviorInstalled = false/);
assert.match(bootstrap, /installBellaRescueBehavior\(\{ root, runtime \}\)/);
assert.match(bootstrap, /turnBellaRescueBootstrap = 'r176-road-derived-zone'/,
  'The production bootstrap must dispose and replace any rescue timer installed by a cached world module');
assert.match(index, /app\.js\?build=20260805-r160-browser-consent-r176-bella-road-derived-zone/,
  'The top-level app URL must change so Safari cannot retain the old dependency graph');
assert.match(index, /countryside-bella-rescue-hotfix-r176\.js\?revision=r176-video-proven-rescue/,
  'The current rescue replacement must be loaded independently from the cached world graph');

console.log('TURN Bella video-proven road-derived rescue, siren input, ground transition and cache replacement regression passed.');
