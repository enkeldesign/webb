import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  WORLD_FREE_ROAM_DISTANCE,
  resolveWorldCollisionState
} from '../../turn/race/world-collision.js';

function makeState({ x = 0, z = 0, vx = 0, vz = 0 } = {}) {
  return {
    position: { x, y: 0.18, z },
    velocity: {
      x: vx,
      y: 0,
      z: vz,
      length() { return Math.hypot(this.x, this.y, this.z); }
    },
    speed: Math.hypot(vx, vz)
  };
}

assert.equal(WORLD_FREE_ROAM_DISTANCE.countryside, 170, 'Countryside must stop free roaming before its mountain ring');
assert.equal(WORLD_FREE_ROAM_DISTANCE.airport, 95, 'Airport must stop free roaming before its close distant hills');

const countryside = makeState({ x: 220, vx: 30 });
const countrysideCollision = resolveWorldCollisionState({
  state: countryside,
  trackId: 'countryside',
  nearestTrack: { distance: 220, sample: { point: { x: 0, z: 0 } } }
});
assert.equal(countrysideCollision.boundary, true);
assert.ok(countryside.position.x < 170, 'The car radius must be kept inside the invisible world wall');
assert.ok(countryside.velocity.x < 0, 'An outward impact must bounce slightly back into the playable world');
assert.ok(countryside.speed < 30, 'World-wall impacts must shed speed rather than pinball at full velocity');

const airport = makeState({ z: -130, vz: -25 });
const airportCollision = resolveWorldCollisionState({
  state: airport,
  trackId: 'airport',
  nearestTrack: { distance: 130, sample: { point: { x: 0, z: 0 } } }
});
assert.equal(airportCollision.boundary, true);
assert.ok(Math.abs(airport.position.z) < 95, 'Airport containment must use its tighter scenery-safe envelope');
assert.ok(airport.velocity.z > 0, 'The Airport wall must return outward velocity toward the world');

const inside = makeState({ x: 40, vx: 12 });
const insideCollision = resolveWorldCollisionState({
  state: inside,
  trackId: 'airport',
  nearestTrack: { distance: 40, sample: { point: { x: 0, z: 0 } } }
});
assert.equal(insideCollision.collided, false, 'Normal off-road exploration inside the world envelope must remain untouched');
assert.equal(inside.position.x, 40);
assert.equal(inside.velocity.x, 12);

const circleState = makeState({ x: 2, vx: -10 });
const circleCollision = resolveWorldCollisionState({
  state: circleState,
  trackId: 'airport',
  nearestTrack: { distance: 0, sample: { point: { x: 2, z: 0 } } },
  collisionProfile: {
    freeRoamDistance: 500,
    colliders: [{ type: 'circle', x: 0, z: 0, radius: 5 }]
  }
});
assert.equal(circleCollision.obstacles, 1, 'The collision foundation must already support circular scenery colliders');
assert.ok(circleState.position.x >= 7.5, 'Circular colliders must include the player-car safety radius');

const boxState = makeState({ x: 0, z: 0, vx: 0, vz: 12 });
const boxCollision = resolveWorldCollisionState({
  state: boxState,
  trackId: 'airport',
  nearestTrack: { distance: 0, sample: { point: { x: 0, z: 0 } } },
  collisionProfile: {
    freeRoamDistance: 500,
    colliders: [{ type: 'box', minX: -4, maxX: 4, minZ: -6, maxZ: 6 }]
  }
});
assert.equal(boxCollision.obstacles, 1, 'The collision foundation must support box colliders for buildings and large props');
assert.ok(Math.abs(boxState.position.x) >= 6.5 || Math.abs(boxState.position.z) >= 8.5, 'Box collisions must eject the car beyond the expanded solid footprint');

const [index, physics] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.7\.0 · Build 2026\.07\.23-r53/);
assert.match(index, /"\.\/vehicle\/physics\.js\?build=20260720-r19": "\.\/vehicle\/physics\.js\?build=20260723-r53"/, 'Production must cache-bust the collision-aware physics module');
assert.match(physics, /world-collision\.js\?build=20260723-r53/, 'Vehicle physics must load the world collision resolver');
assert.match(physics, /resolveWorldCollisionState\(/, 'Every physics step must resolve the world boundary after movement');
assert.match(physics, /if \(collision\.collided\) nearestAfter = findNearestTrack\(state\.position\)/, 'Track progress must be recomputed after a collision moves the car');

console.log('TURN track-aware invisible world walls and collision foundation regression passed.');
