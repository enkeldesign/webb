import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [behavior, world] = await Promise.all([
  fs.readFile(new URL('../../turn/tracks/countryside-bella-rescue-r173.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8')
]);

assert.match(behavior, /SAVE_BELLA_ID = 'save-bella'/);
assert.match(behavior, /REQUIRED_VEHICLE_ID = 'firetruck'/);
assert.match(behavior, /SAFE_GROUND_POSITION = Object\.freeze\(\{ x: 5\.4, y: 0\.08, z: 2\.2 \}\)/);
assert.match(behavior, /cat\.position\.set\(SAFE_GROUND_POSITION\.x/,
  'Saving Bella must move the existing cat model from the branch to the protected ground position');
assert.match(behavior, /turnBellaState = 'rescued-stationary'/);
assert.match(behavior, /sourceAnimationClips: 0/,
  'The pinned Kenney cat has no animation section, so the safe fallback must remain stationary');
assert.match(behavior, /Bella cannot enter the road/);
assert.doesNotMatch(behavior, /AnimationMixer|clipAction|cat\.position\.(?:add|lerp)/,
  'Bella must not fake roaming without a walking animation or move towards the track');

assert.match(behavior, /turn:secret-achievement/);
assert.match(behavior, /turn:achievements-updated/);
assert.match(behavior, /store\?\.isUnlocked\?\.\(SAVE_BELLA_ID\)/,
  'Previously saved profiles must start with Bella safely on the ground');
assert.match(behavior, /RESCUE_MOVE_DELAY_MS = 80/,
  'The ground transition should follow the achievement signal rather than precede it');

assert.match(behavior, /MEOW_RANGE_METERS = 108/);
assert.match(behavior, /MEOW_MIN_INTERVAL_MS = 2400/);
assert.match(behavior, /MEOW_MAX_INTERVAL_MS = 5600/);
assert.match(behavior, /spatialPan\(runtime, player, bellaWorldPosition\)/,
  'The Fire Truck cue must indicate Bella’s left-right direction');
assert.match(behavior, /interval = MEOW_MAX_INTERVAL_MS\s*- proximity/,
  'Meows must repeat more quickly as the Fire Truck approaches');
assert.match(behavior, /state\.vehicleId === REQUIRED_VEHICLE_ID/,
  'Only the Fire Truck should receive Bella’s discovery cue');
assert.match(behavior, /activeTrackId\(runtime\) === 'countryside'/);
assert.match(behavior, /__turnAudioPreferences\?\.getSettings/,
  'Bella’s cue must respect TURN’s audio preferences');
assert.match(behavior, /settings\?\.audioEnabled === false/);
assert.match(behavior, /createStereoPanner/);
assert.match(behavior, /voice\.frequency\.exponentialRampToValueAtTime/,
  'The procedural cue must use a recognisable rising-and-falling meow contour');
assert.match(behavior, /if \(root\.userData\.turnBellaRescued\) return;/,
  'Directional discovery meows must stop after Bella is safe');

assert.match(world, /countryside-bella-rescue-r173\.js\?revision=r173-ground-and-meow/);
assert.match(world, /applyBellaFinalVisuals\(bellaRoot\);\s*installBellaRescueBehavior\(\{ root: bellaRoot, runtime \}\);/,
  'Post-rescue behavior must install after Bella’s final approved visual treatment');

console.log('TURN Bella post-rescue and directional meow regression passed.');
