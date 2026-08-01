import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [lightingSource, registrySource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r2.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(lightingSource, /installMidnightCityWorld as installMidnightCityWorldR1/);
assert.match(lightingSource, /const PLAYER_LIGHT_RIG_NAME = 'TURN Midnight City player light rig'/);
assert.match(lightingSource, /for \(const side of \[-1, 1\]\)/);
assert.match(lightingSource, /new THREE\.PointLight\(PLAYER_FILL, 6\.2, 58, 1\.72\)/);
assert.match(lightingSource, /light\.position\.set\(side \* 1\.55, 2\.85, 2\.4\)/);
assert.match(lightingSource, /playerCar\.add\(rig\)/);
assert.match(lightingSource, /rig\.visible = event\.detail\?\.trackId === 'midnight-city'/);
assert.match(lightingSource, /node\.intensity = Math\.max\(node\.intensity, 11\.5\)/);
assert.match(lightingSource, /node\.distance = Math\.max\(node\.distance, 96\)/);
assert.match(lightingSource, /node\.decay = 1\.5/);
assert.match(lightingSource, /new THREE\.InstancedMesh\(geometry, poolMaterial, count\)/);
assert.match(lightingSource, /new THREE\.CircleGeometry\(11\.5, 24\)/);
assert.match(lightingSource, /blending: THREE\.AdditiveBlending/);
assert.match(lightingSource, /streetLightPoolCount/);
assert.doesNotMatch(
  lightingSource,
  /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/,
  'Midnight City lighting must ride the existing render loop without creating another one'
);
assert.doesNotMatch(
  lightingSource,
  /fetch\(|GLTFLoader|TextureLoader|new Audio/,
  'The visibility fix must add no network assets or unrelated runtime systems'
);

assert.match(registrySource, /midnight-city-world-r2\.js\?build=20260731-r120/);
assert.match(registrySource, /'midnight-city'\(\{ scene, samples, trackWidth, runtime \}\)/);
assert.match(registrySource, /installMidnightCityWorld\(\{ scene, samples, trackWidth, runtime \}\)/);

console.log('TURN Midnight City player visibility and stronger street lighting passed.');
