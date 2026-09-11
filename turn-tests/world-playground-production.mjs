import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [course, session, entry, fixedLayout] = await Promise.all([
  fs.readFile(new URL('../turn/training/world-playground-course.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/world-playground.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/training/world-playground-entry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8')
]);

assert.match(course, /WORLD_PLAYGROUND_TRACK_ID = 'world-playground'/);
assert.match(course, /new THREE\.CatmullRomCurve3\(points, true, 'centripetal'\)/,
  'The playground road must be one closed continuous loop');
assert.match(course, /WORLD_PLAYGROUND_ROAD_WIDTH = 38/,
  'The model world road must stay deliberately oversized');
assert.match(course, /noLapVoid = true/);
assert.match(course, /noMountainTunnel = true/,
  'The MOUNTAIN section must not introduce a tunnel');
assert.match(course, /World Playground western sea/);
assert.match(course, /World Playground eastern mountain boundary/);
assert.match(course, /WORLD_PLAYGROUND_BOUNDARY/,
  'Shore and mountain-range limits must publish a hard free-roam boundary');

for (const district of ['HARBOR', 'CLIFFSIDE', 'MOUNTAIN', 'MIDNIGHT CITY', 'COUNTRYSIDE', 'AIRPORT']) {
  assert.match(course, new RegExp(district.replace(' ', '\\s+')),
    `The model world must contain the ${district} district`);
}

assert.match(course, /Harbor container stack/);
assert.match(course, /Harbor crane/);
assert.match(course, /Harbor ship/);
assert.match(course, /Cliffside house/);
assert.match(course, /Cliffside classic ocean liner asset/);
assert.match(course, /Mountain village house/);
assert.match(course, /Mountain model river/);
assert.match(course, /Mountain waterfall/);
assert.match(course, /Midnight City skyscraper/);
assert.match(course, /Midnight City park/);
assert.match(course, /← HARBOR/);
assert.match(course, /AIRPORT →/);
assert.match(course, /Countryside farm field/);
assert.match(course, /Countryside classic windmill/);
assert.match(course, /Airport runway/);
assert.match(course, /Airport control tower/);
assert.match(course, /Airport grounded airplane/);
assert.match(course, /Airport airplane in the air/);

for (const asset of [
  'fantasy-town/windmill.glb',
  'watercraft/ship-ocean-liner.glb',
  'countryside/suburban/building-type-a.glb',
  'countryside/nature/tree_oak.glb',
  'mountain/nature/cliff-waterfall-rock.glb'
]) {
  assert.match(course, new RegExp(asset.replaceAll('/', '\\/').replaceAll('.', '\\.')),
    `The playground must reuse the classic ${asset} asset family`);
}

assert.match(entry, /Explore the world of TURN/);
assert.match(entry, /data-turn-world-playground-entry/);
assert.match(entry, /var\(--turn-action-information, #38d9ff\)/,
  'The eighth HOW TO PLAY action must use the blue information treatment');
assert.match(entry, /aria-label', 'Explore the world of TURN in the Learner Car'/);
assert.doesNotMatch(entry, /<details/,
  'Explore is an action straight into play, not an eighth disclosure');

assert.match(session, /TRAINING_CAR_ID/,
  'The playground must temporarily use the same Learner Car identity as DBE training');
assert.match(session, /raceSession\.selectVehicle\(\{[\s\S]*carId: TRAINING_CAR_ID/);
assert.match(session, /runtime\.state\.freeRoam = true/);
assert.match(session, /globalThis\.__turnIsForgivingSurface = \(\) => true/,
  'Free roam must never create an off-road LAP VOID');
assert.match(session, /pointInsideBoundary/);
assert.match(session, /nearestBoundaryPoint/,
  'The shore/mountain outline must act as an invisible wall instead of a reset volume');
assert.match(session, /runtime\.state\.lapActive = false/,
  'The playground must keep timed lap recording dormant');
assert.match(session, /runtime\.state\.lapInvalid = false/);
assert.match(session, /suppressNextLapStartMessage = true/);
assert.match(session, /activateTrack\(snapshot\.trackId, runtime\)/,
  'Leaving the playground must restore the previously selected real track');
assert.match(session, /raceSession\.selectVehicle\(snapshot\.vehicle\)/,
  'Leaving the playground must restore the player car');

assert.match(fixedLayout, /world-playground-entry\.js/);
assert.match(fixedLayout, /world-playground\.js/);
assert.match(fixedLayout, /installWorldPlaygroundEntry\(\)/);
assert.match(fixedLayout, /installWorldPlayground\(globalThis\.__turnRuntime\)/);

console.log('TURN HOW TO PLAY world playground contract passed.');
