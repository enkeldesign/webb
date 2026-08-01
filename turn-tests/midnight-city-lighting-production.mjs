import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [claritySource, districtSource, registrySource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r4.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(claritySource, /installMidnightCityWorld as installMidnightCityWorldR2/);
assert.match(claritySource, /removeUnanchoredStreetPools\(world\)/);
assert.match(claritySource, /new THREE\.PointLight\(PLAYER_FILL, 3\.1, 17, 2\)/);
assert.match(claritySource, /const HEADLIGHT_PROJECTION_NAME = 'Midnight City projected headlights'/);
assert.match(claritySource, /makeHeadlightWedge/);
assert.match(claritySource, /farZ: -38/);
assert.match(claritySource, /continuous cyan-left amber-right reflective ribbons and studs/);

assert.match(districtSource, /installMidnightCityWorld as installMidnightCityWorldR3/);
assert.match(districtSource, /const DISTRICTS = Object\.freeze\(\[/);
assert.match(districtSource, /id: 'neon-quarter'/);
assert.match(districtSource, /id: 'downtown-core'/);
assert.match(districtSource, /id: 'uptown'/);
assert.match(districtSource, /id: 'motor-mile'/);
assert.match(districtSource, /districtCount: DISTRICTS\.length/);

assert.match(districtSource, /REMOVED_BORDER_PREFIXES/);
assert.match(districtSource, /'Midnight City road edge'/);
assert.match(districtSource, /'Midnight City sidewalk'/);
assert.match(districtSource, /removeLegacyBuildingInstances/);
assert.match(districtSource, /isBuildingClearOfTrack/);
assert.match(districtSource, /trackWidth \/ 2 \+ footprintRadius \+ 6/);

assert.match(districtSource, /installWindowBands/);
assert.match(districtSource, /facadeTransform\(building\.x, y, building\.z \+ building\.depth \/ 2/);
assert.match(districtSource, /facadeTransform\(building\.x \+ building\.width \/ 2/);
assert.match(districtSource, /everyBuildingHasLitWindowBands: true/);
assert.match(districtSource, /unlit emissive color bands on all four facades/);
assert.match(districtSource, /new THREE\.MeshBasicMaterial\(\{ color, toneMapped: false \}\)/);

assert.match(districtSource, /installLampPostPools/);
assert.match(districtSource, /makeRadialLightTexture/);
assert.match(districtSource, /context\.createRadialGradient/);
assert.match(districtSource, /gradient\.addColorStop\(1, 'rgba\(255, 196, 70, 0\)'\)/);
assert.match(districtSource, /bulbOffset = side \* \(trackWidth \/ 2 \+ 4\.68\)/);
assert.match(districtSource, /one instanced radial-gradient quad beneath every visual lamp post/);
assert.match(districtSource, /new THREE\.InstancedMesh\(geometry, material, total\)/);

assert.match(districtSource, /installDistrictDetails/);
assert.match(districtSource, /makeDistrictSign/);
assert.match(districtSource, /MIDNIGHT CITY r4/);
assert.match(districtSource, /externalAssetFiles: false/);
assert.doesNotMatch(
  districtSource,
  /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/,
  'Midnight City districts must remain static and use the existing render loop'
);
assert.doesNotMatch(
  districtSource,
  /fetch\(|GLTFLoader|TextureLoader|new Audio/,
  'The district pass must not introduce runtime network assets or unrelated systems'
);

assert.match(registrySource, /midnight-city-world-r4\.js\?build=20260801-r4/);
assert.match(registrySource, /'midnight-city'\(\{ scene, samples, trackWidth, runtime \}\)/);
assert.match(registrySource, /installMidnightCityWorld\(\{ scene, samples, trackWidth, runtime \}\)/);

console.log('TURN Midnight City district buildings, lit facades, aligned lamp pools and visual clarity passed.');
