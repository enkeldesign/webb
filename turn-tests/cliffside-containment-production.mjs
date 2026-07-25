import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { resolveWorldCollisionState } from '../turn/race/world-collision.js';
import { TRACK_DEFINITIONS } from '../turn/tracks/definitions.js';

const cliffside = TRACK_DEFINITIONS.find((track) => track.id === 'cliffside');
assert.ok(cliffside, 'Cliffside must remain a registered playable track');
assert.equal(cliffside.difficulty, 'MEDIUM', 'Player testing defines Cliffside as MEDIUM rather than HARD');
assert.equal(cliffside.storageRevision, 'cliffside-r68', 'Containment and scenery placement must preserve existing records');
assert.equal(cliffside.freeRoamDistance, 15.7, 'The playable envelope must meet the visible guardrail centre');
assert.equal(cliffside.collisionProfile.freeRoamDistance, 15.7);

const roadSample = {
  point: { x: 0, y: 8, z: 0 },
  tangent: { x: 0, y: 0, z: 1 }
};

const railSide = collideFrom({ x: 30, y: 8.18, z: 0 }, { x: 20, y: 0, z: 0 });
assert.equal(railSide.result.boundary, true, 'The guardrail side must stop a departing car');
assert.ok(Math.abs(railSide.state.position.x - 13.1) < 1e-9, 'Car centre must stop with its radius touching the guardrail');
assert.ok(railSide.state.velocity.x < 0, 'The guardrail must return outward velocity toward the road');

const hillSide = collideFrom({ x: -30, y: 8.18, z: 0 }, { x: -20, y: 0, z: 0 });
assert.equal(hillSide.result.boundary, true, 'The terrain side must stop a car before it enters the hill mesh');
assert.ok(Math.abs(hillSide.state.position.x + 13.1) < 1e-9, 'The invisible hill boundary must mirror the rail-side driving width');
assert.ok(hillSide.state.velocity.x > 0, 'The hill boundary must return outward velocity toward the road');

const [definitionsSource, worldSource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/definitions.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/cliffside-world.js', import.meta.url), 'utf8')
]);

assert.match(definitionsSource, /id: 'cliffside'[\s\S]*difficulty: 'MEDIUM'/);
assert.match(definitionsSource, /freeRoamDistance: 15\.7,[\s\S]*collisionProfile: \{[\s\S]*freeRoamDistance: 15\.7/);
assert.match(worldSource, /addScaledVector\(sample\.normal, -\(trackWidth \/ 2 \+ 2\.2\)\)/, 'The visible rail must remain centred at the containment envelope');
assert.match(worldSource, /const inner = start\.point\.clone\(\)\.addScaledVector\(start\.normal, trackWidth \/ 2 \+ 10\)/, 'The summit cafe must sit on the prepared inner shoulder rather than behind the hill');
assert.match(worldSource, /const summitDeckY = start\.point\.y \+ 3\.2/);
assert.match(worldSource, /cafe\.position\.y = summitDeckY \+ 4\.6/, 'The cafe must be lifted fully above the terrain ribbon');
assert.match(worldSource, /world\.name = 'TURN Cliffside r69'/);

console.log('TURN r69 Cliffside containment and summit placement passed.');

function collideFrom(position, velocity) {
  const state = {
    position: { ...position },
    velocity: { ...velocity },
    speed: Math.hypot(velocity.x, velocity.y, velocity.z)
  };
  const result = resolveWorldCollisionState({
    state,
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
