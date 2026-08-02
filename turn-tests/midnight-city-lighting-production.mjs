import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  claritySource,
  districtSource,
  cityLifeSource,
  showcaseSource,
  signParkSource,
  easterEggSource,
  registrySource
] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r4.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r5.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r6.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r7.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(claritySource, /installMidnightCityWorld as installMidnightCityWorldR2/);
assert.match(claritySource, /removeUnanchoredStreetPools\(world\)/);
assert.match(claritySource, /Midnight City projected headlights/);
assert.match(claritySource, /continuous cyan-left amber-right reflective ribbons and studs/);

assert.match(districtSource, /id: 'neon-quarter'/);
assert.match(districtSource, /id: 'downtown-core'/);
assert.match(districtSource, /id: 'uptown'/);
assert.match(districtSource, /id: 'motor-mile'/);
assert.match(districtSource, /removeLegacyBuildingInstances/);
assert.match(districtSource, /installWindowBands/);
assert.match(districtSource, /everyBuildingHasLitWindowBands: true/);
assert.match(districtSource, /installLampPostPools/);

for (const label of [
  'TURN COMMONS',
  'VIOLET GARDENS',
  'SUNRISE PARK',
  'BOOST STREET',
  'TURN AVENUE',
  'DRIFT LANE',
  'AIRPORT',
  'HARBOR',
  'CLIFFSIDE'
]) {
  assert.match(cityLifeSource, new RegExp(label));
}
assert.match(cityLifeSource, /Midnight City inaccessible lore road/);
assert.match(cityLifeSource, /ROAD CLOSED/);
assert.match(cityLifeSource, /installSkylineBillboards/);
assert.match(cityLifeSource, /pavement-fountain\.glb/);

assert.match(showcaseSource, /installTracksideCommons\(world\)/);
assert.match(showcaseSource, /TURN Commons road-facing promenade/);
assert.match(showcaseSource, /TURN Commons reflecting pond/);
assert.match(showcaseSource, /TURN Commons illuminated footbridge/);
assert.match(showcaseSource, /noDynamicLightsAdded: true/);
assert.doesNotMatch(showcaseSource, /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/);

assert.match(signParkSource, /installReadableSignBacks\(world\)/);
assert.match(signParkSource, /reverse\.rotation\.y = Math\.PI/);
assert.match(signParkSource, /label: 'VIOLET GARDENS'[\s\S]*x: -590[\s\S]*z: -125/);
assert.match(signParkSource, /label: 'SUNRISE PARK'[\s\S]*x: 570[\s\S]*z: 145/);
assert.match(signParkSource, /rebuildParkTrees\(world\)/);
assert.match(signParkSource, /noDynamicLightsAdded: true/);
assert.doesNotMatch(signParkSource, /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout/);

await fs.access(new URL('../turn/LILYA.PNG', import.meta.url));
assert.match(easterEggSource, /installMidnightCityWorld as installMidnightCityWorldR7/);
assert.match(easterEggSource, /new URL\('\.\.\/LILYA\.PNG', import\.meta\.url\)\.href/);
assert.match(easterEggSource, /x: -500\.70[\s\S]*y: 11\.96[\s\S]*z: 40\.20/);
assert.match(easterEggSource, /maxWidth: 46[\s\S]*maxHeight: 21/);
assert.match(easterEggSource, /const LILYA_WALL_NORMAL = new THREE\.Vector3\(-1, 0, 0\)/);
assert.match(easterEggSource, /side: THREE\.FrontSide/);
assert.match(easterEggSource, /portrait\.rotation\.y = -Math\.PI \/ 2/);
assert.match(easterEggSource, /armViewTriggeredTextureLoad\(world, portrait\)/);
assert.match(easterEggSource, /wallToCamera\.dot\(LILYA_WALL_NORMAL\) < LILYA_MIN_FRONT_DOT/);
assert.match(easterEggSource, /cameraForward\.dot\(cameraToWall\) < LILYA_MIN_VIEW_DOT/);
assert.match(easterEggSource, /texture\.generateMipmaps = false/);
assert.match(
  easterEggSource,
  /hiddenLilyaPlacement: 'west facade of the surviving low Neon Quarter building inside the western hairpin'/
);
assert.match(easterEggSource, /hiddenLilyaFitsFacade: true/);
assert.match(easterEggSource, /gameplayGeometryUnchanged: true/);
assert.doesNotMatch(
  easterEggSource,
  /requestAnimationFrame|setAnimationLoop|setInterval|setTimeout|new THREE\.PointLight|new THREE\.SpotLight/,
  'The hidden portrait must use the existing render loop without adding timers or lights'
);

assert.match(registrySource, /midnight-city-world-r10\.js\?build=20260802-r10/);
assert.match(registrySource, /'midnight-city'\(\{ scene, samples, trackWidth, runtime \}\)/);
assert.match(registrySource, /installMidnightCityWorld\(\{ scene, samples, trackWidth, runtime \}\)/);

console.log('TURN Midnight City lighting, scenery and corrected lazy LILYA wall placement passed.');
