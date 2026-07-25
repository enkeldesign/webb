import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { resolveWorldCollisionState } from '../turn/race/world-collision.js';
import { TRACK_DEFINITIONS } from '../turn/tracks/definitions.js';

const cliffside = TRACK_DEFINITIONS.find((track) => track.id === 'cliffside');
assert.ok(cliffside, 'Cliffside must remain a registered playable track');
assert.equal(cliffside.difficulty, 'MEDIUM');
assert.equal(cliffside.storageRevision, 'cliffside-r68', 'Scenery and containment polish must preserve records');
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

const [definitionsSource, worldSource, physicsSource, collisionSource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/definitions.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/cliffside-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/world-collision.js', import.meta.url), 'utf8')
]);

assert.match(definitionsSource, /freeRoamDistance: 22\.2,[\s\S]*shoulderStartDistance: 15\.2[\s\S]*shoulderDrag: 1\.65/);
assert.match(worldSource, /makeShoulders\(world, samples, trackWidth\)/, 'The extra driving buffer must be visually legible');
assert.match(worldSource, /trackWidth \/ 2 \+ 8\.7/, 'The visible guardrail must sit beyond the usable shoulder');
assert.match(worldSource, /function makeStartArch/, 'The start line may keep its lightweight arch');
assert.doesNotMatch(worldSource, /makeStartDistrict|const cafe|const deck|const roof/, 'The summit building must be removed entirely');
assert.match(worldSource, /world\.name = 'TURN Cliffside r72'/);
assert.match(physicsSource, /collisionProfile: currentCollisionProfile\(\),[\s\S]*dt/, 'Shoulder drag must be frame-rate independent');
assert.match(collisionSource, /minimumNormalSpeed: minimumRecoverySpeed/, 'The final edge must guarantee an inward escape speed');

console.log('TURN r72 forgiving Cliffside shoulders and anti-stall recovery passed.');

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
