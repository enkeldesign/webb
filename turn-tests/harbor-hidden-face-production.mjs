import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [baseWorld, polishWorld] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/harbor-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/harbor-world-r81.js', import.meta.url), 'utf8')
]);

assert.match(baseWorld, /\[202, 196, 76, 18, 38, 0x8e8371\]/, 'The warehouse hiding the face must retain its authored footprint');
assert.match(baseWorld, /marker\.position\.set\(-270 \+ index \* 60, 12\.5, 242 \+ \(index % 2\) \* 11\)/, 'The distant silo row must retain its deterministic placement');
assert.match(polishWorld, /installHiddenSiloFace\(world\)/, 'Production Harbor must install the hidden face');
assert.match(polishWorld, /HIDDEN_FACE_POSITION = Object\.freeze\(\{ x: 210, y: 14\.4, z: 233\.45 \}\)/, 'The face must remain on silo index 8 behind the right warehouse');
assert.match(polishWorld, /HIDDEN_FACE_SIZE = Object\.freeze\(\{ width: 8\.8, height: 9\.65 \}\)/, 'The decal must remain small enough to feel discovered rather than advertised');
assert.match(polishWorld, /decal\.rotation\.y = Math\.PI/, 'The decal must face the explorable warehouse yard');
assert.match(polishWorld, /depthWrite: false/, 'The transparent decal must not create a rectangular depth artefact');
assert.match(polishWorld, /hiddenSiloFace: true/, 'Harbor art direction must record the easter egg');
assert.match(polishWorld, /turnEasterEgg = 'hidden-silo-face'/, 'The mesh must retain a diagnostic easter-egg identity');
assert.doesNotMatch(polishWorld, /setAnimationLoop|requestAnimationFrame|setInterval/, 'The static decal must add no render or polling loop');

const encoded = polishWorld.match(/HIDDEN_FACE_DATA_URI = 'data:image\/png;base64,([^']+)'/)?.[1];
assert.ok(encoded, 'The face image must remain embedded locally without a network dependency');
const png = Buffer.from(encoded, 'base64');
assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'The embedded asset must remain a valid PNG');
assert.equal(png.readUInt32BE(16), 96, 'The optimized face texture must retain its verified width');
assert.equal(png.readUInt32BE(20), 105, 'The optimized face texture must retain its verified height');
assert.ok(png.length < 5000, 'The hidden texture must remain lightweight on older devices');

const warehouseFrontEdge = 196 + 38 / 2;
assert.ok(233.45 > warehouseFrontEdge, 'The face must sit behind the warehouse from the normal racing approach');

console.log('TURN Harbor hidden silo face placement, local texture and static rendering passed.');
