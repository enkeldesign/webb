import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';

const [baseWorld, polishWorld, orientation] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/harbor-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/harbor-world-r81.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/harbor-hidden-face-r88.js', import.meta.url), 'utf8')
]);

assert.match(baseWorld, /\[202, 196, 76, 18, 38, 0x8e8371\]/, 'The warehouse hiding the face must retain its authored footprint');
assert.match(baseWorld, /marker\.position\.set\(-270 \+ index \* 60, 12\.5, 242 \+ \(index % 2\) \* 11\)/, 'The distant silo row must retain its deterministic placement');
assert.match(polishWorld, /installHiddenSiloFace\(world\)/, 'Production Harbor must install the hidden face');
assert.match(polishWorld, /HIDDEN_FACE_POSITION = Object\.freeze\(\{ x: 210, y: 14\.4, z: 233\.45 \}\)/, 'The base decal must remain attached to silo index 8');
assert.match(polishWorld, /HIDDEN_FACE_SIZE = Object\.freeze\(\{ width: 8\.8, height: 9\.65 \}\)/, 'The decal must remain small enough to feel discovered rather than advertised');
assert.match(polishWorld, /depthWrite: false/, 'The transparent decal must not create a rectangular depth artefact');
assert.match(polishWorld, /turnEasterEgg = 'hidden-silo-face'/, 'The mesh must retain a diagnostic easter-egg identity');

assert.match(orientation, /PLAYER_FACING_POSITION = Object\.freeze\(\{ x: 202\.65, y: 14\.4, z: 237\.55 \}\)/, 'The face must move onto the silo side visible from the player approach');
assert.match(orientation, /PLAYER_FACING_ROTATION_Y = -Math\.PI \* 0\.675/, 'The face must turn toward the approaching player');
assert.match(orientation, /turn:track-changed/, 'The orientation must apply whenever Harbor becomes active');
assert.match(orientation, /faces-player-approach/, 'The oriented face must retain a diagnostic identity');
assert.doesNotMatch(`${polishWorld}\n${orientation}`, /setAnimationLoop|requestAnimationFrame|setInterval/, 'The static decal must add no render or polling loop');

const encoded = polishWorld.match(/HIDDEN_FACE_DATA_URI = 'data:image\/png;base64,([^']+)'/)?.[1];
assert.ok(encoded, 'The face image must remain embedded locally without a network dependency');
const png = Buffer.from(encoded, 'base64');
assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'The embedded asset must remain a valid PNG');
assert.equal(png.readUInt32BE(16), 96, 'The optimized face texture must retain its verified width');
assert.equal(png.readUInt32BE(20), 105, 'The optimized face texture must retain its verified height');
assert.ok(png.length < 5000, 'The hidden texture must remain lightweight on older devices');

const warehouseFrontEdge = 196 + 38 / 2;
assert.ok(237.55 > warehouseFrontEdge, 'The face must remain behind the warehouse from the normal racing approach');

console.log('TURN Harbor hidden face now greets the exploring player without affecting gameplay.');