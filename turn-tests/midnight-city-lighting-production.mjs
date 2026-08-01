import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [lightingSource, registrySource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(lightingSource, /installMidnightCityWorld as installMidnightCityWorldR2/);
assert.match(lightingSource, /removeUnanchoredStreetPools\(world\)/);
assert.match(lightingSource, /world\.getObjectByName\(STREET_POOL_NAME\)/);
assert.match(lightingSource, /pools\.parent\?\.remove\(pools\)/);
assert.doesNotMatch(lightingSource, /new THREE\.CircleGeometry\(11\.5, 24\)/);

assert.match(lightingSource, /new THREE\.PointLight\(PLAYER_FILL, 3\.1, 17, 2\)/);
assert.match(lightingSource, /const HEADLIGHT_PROJECTION_NAME = 'Midnight City projected headlights'/);
assert.match(lightingSource, /makeHeadlightWedge/);
assert.match(lightingSource, /farZ: -38/);
assert.match(lightingSource, /blending: THREE\.AdditiveBlending/);
assert.match(lightingSource, /toneMapped: false/);
assert.equal(
  (lightingSource.match(/new THREE\.PointLight/g) || []).length,
  1,
  'The clarity pass may add only one short-range player light'
);

assert.match(lightingSource, /if \(index % 2 === 1\) \{[\s\S]*light\.visible = false/);
assert.match(lightingSource, /bulbOffset = side \* \(trackWidth \/ 2 \+ 4\.68\)/);
assert.match(lightingSource, /light\.intensity = 7\.2/);
assert.match(lightingSource, /light\.distance = 62/);
assert.match(lightingSource, /light\.decay = 1\.9/);
assert.match(lightingSource, /six sparse real lights anchored to visible lamp posts/);

assert.match(lightingSource, /const LEFT_EDGE = 0x74e8ff/);
assert.match(lightingSource, /const RIGHT_EDGE = 0xffd27a/);
assert.match(lightingSource, /makeTrackBorderGuidance/);
assert.match(lightingSource, /makeEdgeRibbon/);
assert.match(lightingSource, /makeEdgeStuds/);
assert.match(lightingSource, /new THREE\.InstancedMesh/);
assert.match(lightingSource, /continuous cyan-left amber-right reflective ribbons and studs/);
assert.match(lightingSource, /new THREE\.MeshBasicMaterial/);

assert.doesNotMatch(
  lightingSource,
  /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/,
  'Midnight City clarity must ride the existing vehicle and render transforms without another loop'
);
assert.doesNotMatch(
  lightingSource,
  /fetch\(|GLTFLoader|TextureLoader|new Audio/,
  'The visibility fix must add no network assets or unrelated runtime systems'
);

assert.match(registrySource, /midnight-city-world-r3\.js\?build=20260731-r120/);
assert.match(registrySource, /'midnight-city'\(\{ scene, samples, trackWidth, runtime \}\)/);
assert.match(registrySource, /installMidnightCityWorld\(\{ scene, samples, trackWidth, runtime \}\)/);

console.log('TURN Midnight City projected headlights, anchored lamps and reflective borders passed.');
