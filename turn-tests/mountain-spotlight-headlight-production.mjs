import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [headlight, world, registry] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/mountain-player-headlight-r8.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(headlight, /new THREE\.SpotLight\(/,
  'MOUNTAIN headlight experiment must use a real SpotLight');
assert.equal((headlight.match(/new THREE\.SpotLight\(/g) || []).length, 1,
  'MOUNTAIN should use one central spotlight rather than two expensive lamps');
assert.match(headlight, /light\.castShadow = false/,
  'The experimental headlight must never allocate a dynamic shadow map');
assert.match(headlight, /target\.position\.set\(0, -0\.15, -44\)/,
  'The spotlight target should live far ahead of the car so its inherited road pitch drives the beam');
assert.match(headlight, /rig\.add\(light, target\)/,
  'Light and target must share the player-car transform');
assert.match(headlight, /event\.detail\?\.trackId/,
  'The MOUNTAIN-only spotlight must switch off on other tracks');
assert.doesNotMatch(headlight, /PlaneGeometry|BufferGeometry|CircleGeometry|requestAnimationFrame|setAnimationLoop/,
  'The spotlight solution must not reintroduce visible projected beam geometry or its own animation loop');

assert.match(world, /installMountainSpotlightHeadlight\(runtime\?\.playerCar, runtime\)/,
  'The MOUNTAIN world must attach the spotlight to the production player car');
assert.match(world, /single-warm-shadowless-spotlight-car-child-following-existing-road-pitch/);
assert.match(registry, /mountain-world-r3\.js\?revision=r8-shadowless-spotlight/,
  'Production must cache-bust to the spotlight experiment');

console.log('TURN MOUNTAIN shadowless spotlight headlight contract passed.');
