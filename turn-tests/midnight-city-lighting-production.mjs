import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [claritySource, districtSource, cityLifeSource, showcaseSource, registrySource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r4.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r5.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r6.js', import.meta.url), 'utf8'),
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
assert.match(cityLifeSource, /installParkTrees/);
assert.match(cityLifeSource, /Midnight City neon fountain fallback/);
assert.match(cityLifeSource, /gradient\.addColorStop\(0, 'rgba\(255, 255, 234, 0\.98\)'\)/);
assert.match(cityLifeSource, /material\.color\.setHex\(COLORS\.lamp\)/);

for (const label of ['BOOST STREET', 'TURN AVENUE', 'DRIFT LANE', 'AIRPORT', 'HARBOR', 'CLIFFSIDE']) {
  assert.match(cityLifeSource, new RegExp(`label: '${label}'`));
}
assert.match(cityLifeSource, /Midnight City inaccessible lore road/);
assert.match(cityLifeSource, /ROAD CLOSED/);
assert.match(cityLifeSource, /loreRoadsAreOutsideRaceBoundary: true/);
assert.match(cityLifeSource, /districtIdentity: 'pink, cyan, yellow and purple entrance stripes plus matching edge pylons'/);
assert.match(cityLifeSource, /installSkylineBillboards/);
assert.match(cityLifeSource, /GLTFLoader/);
assert.match(cityLifeSource, /pavement-fountain\.glb/);
assert.match(cityLifeSource, /externalAssetSource: 'Kenney Starter Kit City Builder, pinned commit, CC0'/);

assert.match(showcaseSource, /installMidnightCityWorld as installMidnightCityWorldR5/);
assert.match(showcaseSource, /const SHOWCASE_CENTER = Object\.freeze\(\{ x: 80, z: 75 \}\)/);
assert.match(showcaseSource, /const SHOWCASE_FOUNTAIN = Object\.freeze\(\{ x: 20, z: -27 \}\)/);
assert.match(showcaseSource, /hideOriginalCommons\(world\)/);
assert.match(showcaseSource, /original\.visible = false/);
assert.match(showcaseSource, /removeLegacyParkTrees\(world\)/);
assert.match(showcaseSource, /installTracksideCommons\(world\)/);
assert.match(showcaseSource, /TURN Commons road-facing promenade/);
assert.match(showcaseSource, /TURN Commons reflecting pond/);
assert.match(showcaseSource, /TURN Commons illuminated footbridge/);
assert.match(showcaseSource, /Midnight City showcase fountain fallback/);
assert.match(showcaseSource, /new THREE\.ConeGeometry\(2\.1, 14\.5, 24, 1, true\)/);
assert.match(showcaseSource, /for \(let index = 0; index < 6; index \+= 1\)/);
assert.match(showcaseSource, /SHOWCASE_ASSET_SCALE = 1\.42/);
assert.match(showcaseSource, /object\.name === 'Midnight City Kenney fountain landmark'/);
assert.match(showcaseSource, /object\.position\.copy\(showcase\.fountainAnchor\)/);
assert.match(showcaseSource, /showcase\.fallback\.visible = false/);
assert.match(showcaseSource, /road-facing fountain plaza, axial promenade, reflecting pond, bridge, paths, benches and framed trees/);
assert.match(showcaseSource, /noDynamicLightsAdded: true/);
assert.doesNotMatch(
  showcaseSource,
  /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/,
  'The fountain showcase must remain static and use the existing render loop'
);
assert.doesNotMatch(showcaseSource, /new THREE\.PointLight|new THREE\.SpotLight/);
assert.doesNotMatch(showcaseSource, /GLTFLoader|fetch\(/, 'The showcase must reuse the already pinned r5 asset loader');

assert.match(registrySource, /midnight-city-world-r6\.js\?build=20260801-r6/);
assert.match(registrySource, /'midnight-city'\(\{ scene, samples, trackWidth, runtime \}\)/);
assert.match(registrySource, /installMidnightCityWorld\(\{ scene, samples, trackWidth, runtime \}\)/);

console.log('TURN Commons trackside fountain, promenade, reflecting pond, bridge and framed park passed.');
