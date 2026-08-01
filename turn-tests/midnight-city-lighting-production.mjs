import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [claritySource, districtSource, cityLifeSource, registrySource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r4.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r5.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(claritySource, /installMidnightCityWorld as installMidnightCityWorldR2/);
assert.match(claritySource, /removeUnanchoredStreetPools\(world\)/);
assert.match(claritySource, /new THREE\.PointLight\(PLAYER_FILL, 3\.1, 17, 2\)/);
assert.match(claritySource, /const HEADLIGHT_PROJECTION_NAME = 'Midnight City projected headlights'/);
assert.match(claritySource, /continuous cyan-left amber-right reflective ribbons and studs/);

assert.match(districtSource, /installMidnightCityWorld as installMidnightCityWorldR3/);
assert.match(districtSource, /id: 'neon-quarter'/);
assert.match(districtSource, /id: 'downtown-core'/);
assert.match(districtSource, /id: 'uptown'/);
assert.match(districtSource, /id: 'motor-mile'/);
assert.match(districtSource, /removeThickStreetBorders/);
assert.match(districtSource, /removeLegacyBuildingInstances/);
assert.match(districtSource, /installWindowBands/);
assert.match(districtSource, /everyBuildingHasLitWindowBands: true/);
assert.match(districtSource, /installLampPostPools/);
assert.match(districtSource, /one instanced radial-gradient quad beneath every visual lamp post/);

assert.match(cityLifeSource, /installMidnightCityWorld as installMidnightCityWorldR4/);
assert.match(cityLifeSource, /const PARKS = Object\.freeze\(\[/);
assert.match(cityLifeSource, /label: 'TURN COMMONS'/);
assert.match(cityLifeSource, /label: 'VIOLET GARDENS'/);
assert.match(cityLifeSource, /label: 'SUNRISE PARK'/);
assert.match(cityLifeSource, /installParks\(world, samples, trackWidth\)/);
assert.match(cityLifeSource, /new THREE\.CircleGeometry\(park\.radius, 48\)/);
assert.match(cityLifeSource, /new THREE\.RingGeometry\(park\.radius \* 0\.54, park\.radius \* 0\.67, 48\)/);
assert.match(cityLifeSource, /installParkTrees/);
assert.match(cityLifeSource, /Midnight City neon fountain fallback/);

assert.match(cityLifeSource, /gradient\.addColorStop\(0, 'rgba\(255, 255, 234, 0\.98\)'\)/);
assert.match(cityLifeSource, /material\.color\.setHex\(COLORS\.lamp\)/);
assert.match(cityLifeSource, /material\.opacity = 0\.72/);

for (const label of ['BOOST STREET', 'TURN AVENUE', 'DRIFT LANE', 'AIRPORT', 'HARBOR', 'CLIFFSIDE']) {
  assert.match(cityLifeSource, new RegExp(`label: '${label}'`));
}
assert.match(cityLifeSource, /Midnight City inaccessible lore road/);
assert.match(cityLifeSource, /ROAD CLOSED/);
assert.match(cityLifeSource, /trackWidth \/ 2 \+ 39/);
assert.match(cityLifeSource, /loreRoadsAreOutsideRaceBoundary: true/);

assert.match(cityLifeSource, /districtIdentity: 'pink, cyan, yellow and purple entrance stripes plus matching edge pylons'/);
assert.match(cityLifeSource, /installDistrictColorLanguage/);
assert.match(cityLifeSource, /Midnight City district entrance/);
assert.match(cityLifeSource, /Midnight City district edge pylons/);
assert.match(cityLifeSource, /new THREE\.InstancedMesh/);

assert.match(cityLifeSource, /installSkylineBillboards/);
assert.match(cityLifeSource, /makeSkylineTexture/);
assert.match(cityLifeSource, /six low-detail generated skyline texture billboards/);
assert.match(cityLifeSource, /panelCount = 6/);

assert.match(cityLifeSource, /GLTFLoader/);
assert.match(cityLifeSource, /Starter-Kit-City-Builder@\$\{CITY_BUILDER_COMMIT\}/);
assert.match(cityLifeSource, /pavement-fountain\.glb/);
assert.match(cityLifeSource, /CITY_BUILDER_COMMIT = '4535092b740b378b700efd9df9e27a631815b84a'/);
assert.match(cityLifeSource, /externalAssetSource: 'Kenney Starter Kit City Builder, pinned commit, CC0'/);
assert.doesNotMatch(
  cityLifeSource,
  /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/,
  'Parks, lore and skyline must remain static and use the existing render loop'
);
assert.doesNotMatch(cityLifeSource, /new THREE\.PointLight|new THREE\.SpotLight/);

assert.match(registrySource, /midnight-city-world-r5\.js\?build=20260801-r5/);
assert.match(registrySource, /'midnight-city'\(\{ scene, samples, trackWidth, runtime \}\)/);
assert.match(registrySource, /installMidnightCityWorld\(\{ scene, samples, trackWidth, runtime \}\)/);

console.log('TURN Midnight City parks, lighter lamp pools, district colors, lore roads, skyline and CC0 fountain passed.');
