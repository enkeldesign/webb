import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [sharedHeadlight, mountainWrapper, world, midnight, registry] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/night-player-spotlight-r560.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-player-headlight-r8.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r11.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(sharedHeadlight, /new THREE\.SpotLight\(/,
  'Night-track headlights must use a real SpotLight');
assert.equal((sharedHeadlight.match(/new THREE\.SpotLight\(/g) || []).length, 1,
  'MOUNTAIN and MIDNIGHT CITY must share one central spotlight rig rather than duplicate lights');
assert.match(sharedHeadlight, /intensity: 2200/,
  'The shared spotlight should use the approved racing-speed intensity');
assert.match(sharedHeadlight, /distance: 200/,
  'The shared spotlight should use the approved 200 m racing-speed range');
assert.match(sharedHeadlight, /new Set\(\['midnight-city', 'mountain'\]\)/,
  'Exactly the two night tracks should share the same spotlight configuration');
assert.match(sharedHeadlight, /light\.castShadow = false/,
  'The shared headlight must never allocate a dynamic shadow map');
assert.match(sharedHeadlight, /targetLocal: Object\.freeze\(\{ x: 0, y: -1\.5, z: -54 \}\)/,
  'The shared spotlight should aim lower so flat and downhill roads meet the useful cone sooner');
assert.match(sharedHeadlight, /rig\.add\(light, target\)/,
  'Light and target must share the player-car transform');
assert.doesNotMatch(sharedHeadlight, /PlaneGeometry|BufferGeometry|CircleGeometry|requestAnimationFrame|setAnimationLoop/,
  'The spotlight solution must not reintroduce projected beam geometry or its own animation loop');

assert.match(mountainWrapper, /night-player-spotlight-r560\.js\?revision=r563-lower-target/,
  'MOUNTAIN must cache-bust to the lower shared spotlight aim');
assert.match(mountainWrapper, /installNightPlayerSpotlight\(playerCar, runtime\)/,
  'MOUNTAIN must delegate to the shared night-track spotlight implementation');
assert.match(world, /installMountainSpotlightHeadlight\(runtime\?\.playerCar, runtime\)/,
  'The MOUNTAIN world must attach the shared spotlight to the production player car');
assert.match(midnight, /night-player-spotlight-r560\.js\?revision=r563-lower-target/,
  'MIDNIGHT CITY must cache-bust to the exact same lower shared spotlight aim');
assert.match(midnight, /installNightPlayerSpotlight\(options\.runtime\?\.playerCar, options\.runtime\)/,
  'MIDNIGHT CITY must install the exact same shared spotlight rig');
assert.match(midnight, /shared-warm-shadowless-spotlight-identical-to-mountain/);
assert.match(registry, /mountain-world-r3\.js\?revision=r563-lower-headlight-target/,
  'Production must cache-bust MOUNTAIN to the lower headlight target revision');
assert.match(registry, /midnight-city-world-r11\.js\?build=20260818-r563-lower-headlight-target/,
  'Production must cache-bust MIDNIGHT CITY to the lower headlight target revision');

console.log('TURN shared MOUNTAIN + MIDNIGHT CITY lower-aim 200 m shadowless spotlight contract passed.');
