import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { resolveWorldCollisionState } from '../turn/race/world-collision.js';
import { TRACK_DEFINITIONS } from '../turn/tracks/definitions.js';

const cliffside = TRACK_DEFINITIONS.find((track) => track.id === 'cliffside');
assert.ok(cliffside, 'Cliffside must remain a registered playable track');
assert.equal(cliffside.difficulty, 'MEDIUM');
assert.equal(cliffside.storageRevision, 'cliffside-r68', 'Scenery polish must preserve every existing record');
assert.equal(cliffside.freeRoamDistance, 22.2, 'The final safety edge must sit well beyond the curb');
assert.equal(cliffside.collisionProfile.shoulderStartDistance, 15.2);
assert.equal(cliffside.collisionProfile.shoulderDrag, 1.65);
assert.equal(cliffside.collisionProfile.boundaryTangentRetention, 0.94);
assert.equal(cliffside.collisionProfile.boundaryMinimumRecoverySpeed, 5.5);

const roadSample = {
  point: { x: 0, y: 8, z: 0 },
  tangent: { x: 0, y: 0, z: 1 }
};

const shoulder = collideFrom({ x: 18, y: 8.18, z: 0 }, { x: 30, y: 0, z: 0 }, 1 / 30);
assert.equal(shoulder.result.shoulder, true, 'The run-off shoulder must apply progressive deceleration');
assert.equal(shoulder.result.boundary, false, 'Normal shoulder use must not trigger a hard collision');
assert.equal(shoulder.state.position.x, 18, 'The shoulder must not snap the car sideways');
assert.ok(shoulder.state.velocity.x > 0 && shoulder.state.velocity.x < 30, 'The shoulder must slow rather than stop the car');

const railSide = collideFrom({ x: 30, y: 8.18, z: 0 }, { x: 20, y: 0, z: 16 });
assert.equal(railSide.result.boundary, true, 'The distant guardrail remains the final safety net');
assert.ok(Math.abs(railSide.state.position.x - 19.6) < 1e-9);
assert.ok(railSide.state.velocity.x <= -5.5, 'A head-on edge impact must receive a reliable inward recovery push');
assert.ok(railSide.state.velocity.z > 14, 'A scraping impact must preserve most forward momentum and never pin the car');

const hillSide = collideFrom({ x: -30, y: 8.18, z: 0 }, { x: -20, y: 0, z: 12 });
assert.equal(hillSide.result.boundary, true);
assert.ok(Math.abs(hillSide.state.position.x + 19.6) < 1e-9);
assert.ok(hillSide.state.velocity.x >= 5.5, 'The invisible hill edge must push the car back into the shoulder');
assert.ok(hillSide.state.velocity.z > 10, 'The hill edge must retain useful forward motion');

const [
  definitionsSource,
  baseWorldSource,
  scenicWorldSource,
  physicsSource,
  collisionSource,
  indexSource,
  releaseSource
] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/definitions.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/cliffside-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/cliffside-world-r76.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/world-collision.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);
const importMapText = indexSource.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose the release import map');
const imports = JSON.parse(importMapText).imports;

assert.match(definitionsSource, /freeRoamDistance: 22\.2,[\s\S]*shoulderStartDistance: 15\.2[\s\S]*shoulderDrag: 1\.65/);
assert.match(baseWorldSource, /makeShoulders\(world, samples, trackWidth\)/, 'The extra driving buffer must remain visually legible');
assert.match(baseWorldSource, /trackWidth \/ 2 \+ 8\.7/, 'The visible guardrail must remain beyond the usable shoulder');
assert.match(baseWorldSource, /function makeStartArch/, 'The start line may keep its lightweight arch');
assert.doesNotMatch(baseWorldSource, /makeStartDistrict|const cafe|const deck|const roof/, 'The retired summit building must stay removed');
assert.match(baseWorldSource, /world\.name = 'TURN Cliffside r72'/, 'The verified gameplay world remains the untouched base layer');

assert.match(scenicWorldSource, /installBaseCliffsideWorld\(options\)/, 'The scenic layer must wrap rather than replace the verified track world');
assert.match(scenicWorldSource, /makeInnerHighlands\(world, samples, trackWidth, peakCentre\)/, 'The empty centre must be filled with a continuous highland mass');
assert.match(scenicWorldSource, /makeGroundedPineForest\(world, samples, trackWidth, peakCentre\)/, 'The inner forest must be rebuilt against the new terrain');
assert.match(scenicWorldSource, /groundY \+ TRUNK_HALF_HEIGHT \* scale/, 'Every replacement trunk must be seated on its computed ground surface');
assert.match(scenicWorldSource, /hideLegacyInnerForest\(world\)/, 'The old water-standing pine instances must not remain visible');
assert.match(scenicWorldSource, /new THREE\.InstancedMesh/, 'Repeated trees and rocks must retain batched rendering');
assert.match(scenicWorldSource, /gameplayGeometryUnchanged: true/, 'The scenery wrapper must document its gameplay boundary');
assert.doesNotMatch(
  scenicWorldSource,
  /resolveWorldCollisionState|collisionProfile|freeRoamDistance|shoulderDrag|boundaryTangentRetention|localStorage|state\./,
  'The centre rebuild must not touch physics, collision, storage or race state'
);
assert.equal(
  imports['./tracks/cliffside-world.js'],
  `./tracks/cliffside-world-r76.js?build=${release.cacheKey}`,
  'Production must route Cliffside through the scenery-only wrapper'
);
assert.match(scenicWorldSource, /world\.name = 'TURN Cliffside r76'/);
assert.match(physicsSource, /collisionProfile: currentCollisionProfile\(\),[\s\S]*dt/, 'Shoulder drag must remain frame-rate independent');
assert.match(collisionSource, /minimumNormalSpeed: minimumRecoverySpeed/, 'The final edge must keep its inward escape speed');

console.log(`TURN ${release.id} natural Cliffside highlands and grounded forest passed.`);

function collideFrom(position, velocity, dt = 1 / 60) {
  const state = {
    position: { ...position },
    velocity: { ...velocity },
    speed: Math.hypot(velocity.x, velocity.y, velocity.z)
  };
  const result = resolveWorldCollisionState({
    state,
    dt,
    trackId: 'cliffside',
    nearestTrack: {
      index: 0,
      distance: Math.hypot(position.x - roadSample.point.x, position.z - roadSample.point.z),
      sample: roadSample
    },
    collisionProfile: cliffside.collisionProfile
  });
  return { state, result };
}
