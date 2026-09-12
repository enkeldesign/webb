import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [identity, worldMode, worldData, worldCss] = await Promise.all([
  fs.readFile(new URL('../turn-next/identity.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/world-mode.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/world-data.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/world-mode.css', import.meta.url), 'utf8')
]);

assert.match(identity, /import\('\/turn-next\/world-mode\.js'\)/,
  'TURN NEXT identity should install WORLD without editing generated app/index files');
assert.match(identity, /__turnHomeLayout\?\.menu/,
  'WORLD should attach only after the protected Home layout exists');

assert.match(worldData, /overpass-api\.de\/api\/interpreter/,
  'WORLD should load semantic map data from an OpenStreetMap Overpass endpoint');
assert.match(worldData, /way\[\\"highway\\"/,
  'WORLD should derive drivable road geometry from OpenStreetMap highway semantics');
assert.match(worldData, /way\[\\"building\\"\]/,
  'WORLD should derive low-poly buildings from OpenStreetMap building footprints');
assert.match(worldData, /natural\\"~\\"water\|wood/,
  'WORLD should use semantic water and woodland data rather than raster map imagery');
assert.match(worldData, /elevation-tiles-prod\/terrarium/,
  'WORLD should load open Terrarium elevation tiles');
assert.match(worldData, /\(red \* 256 \+ green \+ blue \/ 256\) - 32768/,
  'WORLD should decode Terrarium elevation values');
assert.doesNotMatch(worldData, /mapbox|google\s*maps|satellite/i,
  'WORLD data loading must not introduce a satellite/raster basemap provider');

assert.match(worldMode, /runtime\.samples\.splice\(0, runtime\.samples\.length, \.\.\.worldData\.samples\)/,
  'WORLD should feed its real road network into the existing TURN physics runtime');
assert.match(worldMode, /runtime\.trackSpatialIndex\.replaceSamples\(runtime\.samples\)/,
  'WORLD should rebuild TURN nearest-road lookup for the imported road network');
assert.match(worldMode, /runtime\.setSceneOverride\(\(dt\) => renderWorldFrame/,
  'WORLD should use the TURN scene override to apply terrain altitude without forking core physics');
assert.match(worldMode, /terrain\.heightAtWorld/,
  'WORLD should pose the car against DEM terrain height');
assert.match(worldMode, /await activateTrack\(snapshot\.trackId, runtime\)/,
  'Leaving WORLD should restore the selected canonical TURN track');
assert.match(worldMode, /© OpenStreetMap contributors/,
  'WORLD setup must expose OpenStreetMap attribution');
assert.match(worldMode, /registry\.opendata\.aws\/terrain-tiles/,
  'WORLD should expose terrain-data attribution');
assert.match(worldCss, /turn-next-world-active/,
  'WORLD should own an isolated TURN NEXT presentation state');

console.log('TURN NEXT WORLD static contract passed.');
