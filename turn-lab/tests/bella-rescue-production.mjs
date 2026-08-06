import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [behavior, secretEvents, world] = await Promise.all([
  fs.readFile(new URL('../../turn/tracks/countryside-bella-rescue-r173.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/secret-events.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8')
]);

assert.match(behavior, /SAVE_BELLA_ID = 'save-bella'/);
assert.match(behavior, /REQUIRED_VEHICLE_ID = 'firetruck'/);
assert.match(behavior, /RESCUE_SIREN_HOLD_MS = 360/);
assert.match(behavior, /RESCUE_ZONE = Object\.freeze\(\{[\s\S]*centerX: 0,[\s\S]*centerZ: -5\.5,[\s\S]*radiusX: 12,[\s\S]*radiusZ: 10\.5/,
  'SAVE BELLA! must use a compact elliptical rescue patch around the off-road tree area');
assert.match(behavior, /normalizedX \* normalizedX \+ normalizedZ \* normalizedZ <= 1/,
  'The rescue trigger must be bounded by the configured ellipse rather than broad camera distance');
assert.match(behavior, /globalThis\.__turnBoostActive === true/,
  'The Fire Truck siren must be active before Bella can be rescued');
assert.match(behavior, /inRescueZone && sirenActive/);
assert.match(behavior, /now - rescueSirenStartedAt >= RESCUE_SIREN_HOLD_MS/,
  'The siren must remain active briefly inside the rescue patch to avoid drive-by triggers');
assert.match(behavior, /state\.vehicleId === REQUIRED_VEHICLE_ID/,
  'Only the Fire Truck can complete the rescue');
assert.match(behavior, /activeTrackId\(runtime\) === 'countryside'/);

assert.match(behavior, /SAFE_GROUND_POSITION = Object\.freeze\(\{ x: 4\.8, y: 0\.08, z: -3\.2 \}\)/);
assert.match(behavior, /cat\.position\.set\(SAFE_GROUND_POSITION\.x/,
  'Saving Bella must move the existing cat model from the branch to the protected ground position');
assert.match(behavior, /cat\.updateMatrixWorld\(true\)/);
assert.match(behavior, /root\.updateMatrixWorld\(true\)/,
  'The ground move must be committed immediately in the rendered scene graph');
assert.match(behavior, /turnBellaState = 'rescued-stationary'/);
assert.match(behavior, /sourceAnimationClips: 0/,
  'The pinned Kenney cat has no animation section, so the safe fallback must remain stationary');
assert.match(behavior, /Bella cannot enter the road/);
assert.doesNotMatch(behavior, /AnimationMixer|clipAction|cat\.position\.(?:add|lerp)/,
  'Bella must not fake roaming without a walking animation or move towards the track');

const moveIndex = behavior.indexOf('moveBellaToGround(root, { announce: true })');
const signalIndex = behavior.indexOf('signalSecretAchievement(SAVE_BELLA_ID');
assert.ok(moveIndex >= 0 && signalIndex > moveIndex,
  'Bella must reach the ground before SAVE BELLA! is signalled');
assert.match(behavior, /rescueConfirmed: true/);
assert.match(behavior, /rescueMethod: 'fire-truck-siren-zone'/);
assert.doesNotMatch(behavior, /RESCUE_MOVE_DELAY_MS/,
  'The rescue visual and achievement must no longer be separated by a delayed callback');

assert.match(secretEvents, /achievementId === SAVE_BELLA_ID && context\.rescueConfirmed !== true/,
  'Legacy camera-only SAVE BELLA! signals must be rejected');
assert.match(secretEvents, /return false/);
assert.match(behavior, /turn:secret-achievement/);
assert.match(behavior, /turn:achievements-updated/);
assert.match(behavior, /store\?\.isUnlocked\?\.\(SAVE_BELLA_ID\)/,
  'Previously saved profiles must start with Bella safely on the ground');

assert.match(behavior, /MEOW_RANGE_METERS = 108/);
assert.match(behavior, /MEOW_MIN_INTERVAL_MS = 2400/);
assert.match(behavior, /MEOW_MAX_INTERVAL_MS = 5600/);
assert.match(behavior, /spatialPan\(runtime, player, bellaWorldPosition\)/,
  'The Fire Truck cue must indicate Bella’s left-right direction');
assert.match(behavior, /interval = MEOW_MAX_INTERVAL_MS\s*- proximity/,
  'Meows must repeat more quickly as the Fire Truck approaches');
assert.match(behavior, /__turnAudioPreferences\?\.getSettings/,
  'Bella’s cue must respect TURN’s audio preferences');
assert.match(behavior, /settings\?\.audioEnabled === false/);
assert.match(behavior, /createStereoPanner/);
assert.match(behavior, /voice\.frequency\.exponentialRampToValueAtTime/,
  'The procedural cue must use a recognisable rising-and-falling meow contour');
assert.match(behavior, /if \(root\.userData\.turnBellaRescued\) return;/,
  'Directional discovery meows must stop after Bella is safe');

assert.match(world, /countryside-bella-rescue-r173\.js\?revision=r174-siren-rescue-zone/);
assert.match(world, /applyBellaFinalVisuals\(bellaRoot\);\s*installBellaRescueBehavior\(\{ root: bellaRoot, runtime \}\);/,
  'Rescue behavior must install after Bella’s final approved visual treatment');

console.log('TURN Bella siren rescue zone, ground transition and directional meow regression passed.');
