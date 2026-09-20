import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  releaseSource,
  indexSource,
  profileSource,
  runtimeSource,
  settingSource,
  worldSource,
  artPassSource,
  contextualEdgesSource,
  carModelsSource,
  mainSource,
  landmarksSource,
  countrysideSource,
  bellaSource,
  airportWorldSource,
  airportAircraftSource,
  airportEmergencySource,
  cliffsideSource,
  startAreaSource,
  worldAssetsSource,
  midnightBaseSource,
  midnightR2Source,
  midnightR3Source
] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/graphics-profile.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/three-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/low-graphics-setting.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/world-art-pass.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/contextual-road-edges.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/kenney-track-landmarks-r517.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/countryside-world-r531.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/countryside-bella-r166.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/airport-world-r50.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/airport-world-r53.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/airport-emergency-r493.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/cliffside-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/start-area-polish-r519.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/world-assets.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r2.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/midnight-city-world-r3.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(release.version, /^\d+\.\d+\.\d+$/, 'LOW GRAPHICS must work with the current semantic TURN release.');
assert.match(release.id, /^\d{4}\.\d{2}\.\d{2}-r\d+$/, 'LOW GRAPHICS must work with the current TURN build id.');
assert.match(release.cacheKey, /^\d{8}-r\d+$/, 'LOW GRAPHICS must work with the current TURN cache key.');
assert.equal(release.id.replaceAll('.', '').replace('-', '-'), release.cacheKey,
  'LOW GRAPHICS release assertions must follow turn/release.json rather than a historical build.');

assert.match(indexSource, /"three-native": "https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.184\.0\/build\/three\.module\.js"/);
assert.ok(indexSource.includes(`"three": "/turn/three-runtime.js?build=${release.cacheKey}"`),
  'The shared Three runtime must use the current release identity.');
assert.ok(indexSource.includes(`"/turn/graphics-profile.js": "/turn/graphics-profile.js?build=${release.cacheKey}"`),
  'The LOW GRAPHICS profile must use the current release identity.');
assert.ok(indexSource.includes(`ui/low-graphics-setting.js?build=${release.cacheKey}`),
  'The LOW GRAPHICS Settings module must use the current release identity.');

assert.match(profileSource, /turn-low-graphics-v1/);
assert.match(profileSource, /dprCap: lowGraphics \? 1 : Infinity/);
assert.match(profileSource, /antialias: true/);
assert.doesNotMatch(profileSource, /shadows:/);
assert.match(profileSource, /pointLights: !lowGraphics/);
assert.match(profileSource, /optionalScenery: true/);

assert.match(runtimeSource, /from '\/turn\/graphics-profile\.js'/);
assert.match(runtimeSource, /antialias: true/);
assert.match(runtimeSource, /graphicsPixelRatio\(value\)/);
assert.doesNotMatch(runtimeSource, /shadowMap/);
assert.match(runtimeSource, /class PointLight extends NativeThree\.PointLight/);
assert.doesNotMatch(runtimeSource, /turnLowGraphicsHiddenOutline|isTurnOutline|Object3D\.prototype\.add|queueMicrotask/,
  'LOW GRAPHICS must not create contours and then hide/remove them in the shared Three runtime.');
assert.match(runtimeSource, /class PointLight extends NativeThree\.PointLight/);
assert.match(runtimeSource, /this\.visible = false/);
assert.match(runtimeSource, /this\.intensity = 0/);

assert.match(settingSource, /<strong>LOW GRAPHICS<\/strong>/);
assert.match(settingSource, /Better performance on older devices/);
assert.match(settingSource, /Restart TURN to apply changes/);
assert.doesNotMatch(settingSource, /Antialiasing and all track scenery stay unchanged/,
  'LOW GRAPHICS settings copy should avoid implementation-detail reassurance.');
assert.match(settingSource, /aria-describedby="m8LowGraphicsDescription m8LowGraphicsRestartNote"/);

assert.doesNotMatch(worldSource, /if \(graphicsProfile\.lowGraphics\)/,
  'LOW GRAPHICS must not bypass the full Countryside cosmetic graph.');
assert.match(worldSource, /world-beauty\.js/);
assert.match(worldSource, /world-art-pass\.js/);
assert.match(worldSource, /countryside-bella-r166\.js/);
assert.match(worldSource, /track-identity\.js/);
assert.match(worldSource, /section-intensity\.js/);


assert.match(carModelsSource, /graphicsProfile\.outlines/,
  'Preview car contours retain the existing graphics-profile policy');
for (const source of [mainSource, landmarksSource, countrysideSource, bellaSource,
  airportWorldSource, airportAircraftSource, airportEmergencySource, cliffsideSource,
  startAreaSource, worldAssetsSource, artPassSource, contextualEdgesSource, worldSource]) {
  assert.doesNotMatch(source, /graphicsProfile\.outlines|THREE\.BackSide/,
    'Racing producers must not construct contour shells in either graphics mode');
}
assert.doesNotMatch(artPassSource, /applyWorldContours|contourObject|addRoadOuterContour|OUTLINE_MATERIAL/,
  'Race-only contour materials, builders and delayed sweeps are removed');
assert.match(artPassSource, /function addRoadOuterAsphaltTrim\(/,
  'Countryside keeps its asphalt-coloured strip outside the painted road edge');
assert.match(artPassSource, /turnRoadEdgeTrim = 'countryside'/,
  'Countryside road-edge trim is explicitly classified as track geometry');
assert.match(contextualEdgesSource, /export const ROAD_EDGE_TRIMS = Object\.freeze/,
  'Airport, Cliffside and Harbor retain their asphalt-coloured outer road trim');
assert.match(contextualEdgesSource, /turnRoadEdgeTrim: trackId/,
  'Contextual road-edge trim is explicitly classified as track geometry');
assert.doesNotMatch(contextualEdgesSource, /turnContextualRoadContour|outer road contour/i,
  'Restored asphalt trim must not revive the removed contour-shell identity');
assert.doesNotMatch(runtimeSource, /turnOutline|TURN_INK|BackSide/,
  'The shared runtime must not hide or strip already constructed contours');
assert.match(mainSource, /targetLength: 5\.5,\s*outline: false/,
  'Player and rivals explicitly request race visuals without contours');

assert.match(midnightBaseSource, /if \(graphicsProfile\.pointLights\) \{[\s\S]*new THREE\.PointLight\(WARM_LIGHT/,
  'MIDNIGHT CITY must not construct sparse real street lights in LOW GRAPHICS.');
assert.match(midnightR2Source, /function strengthenStreetLights\(world\) \{\n  if \(!graphicsProfile\.pointLights\) return 0;/,
  'MIDNIGHT CITY r2 must not strengthen inherited PointLights in LOW GRAPHICS.');
assert.match(midnightR3Source, /if \(!graphicsProfile\.pointLights\) \{[\s\S]*return \{ active: 0, disabled: lights\.length \};/,
  'MIDNIGHT CITY final alignment must not re-enable PointLights in LOW GRAPHICS.');

const lowGraphicsProfile = Object.freeze({ outlines: false, pointLights: false });
const alignSparseStreetLights = compileFunction(midnightR3Source, 'alignSparseStreetLights', {
  graphicsProfile: lowGraphicsProfile,
  WARM_LIGHT: 0xffd27a
});
const streetLights = Array.from({ length: 12 }, () => ({
  isPointLight: true,
  color: { getHex: () => 0xffd27a },
  visible: false,
  intensity: 0,
  castShadow: false,
  userData: {},
  position: {}
}));
const streetWorld = { traverse(callback) { for (const light of streetLights) callback(light); } };
const aligned = alignSparseStreetLights(streetWorld, [{}], 27);
assert.deepEqual(aligned, { active: 0, disabled: streetLights.length },
  'Completed MIDNIGHT CITY street-light alignment must report zero active lights in LOW GRAPHICS.');
assert.ok(streetLights.every((light) => light.visible === false && light.intensity === 0),
  'Completed MIDNIGHT CITY setup must leave every real street light disabled.');

function compileFunction(source, name, bindings) {
  const functionSource = extractFunction(source, name);
  const names = Object.keys(bindings);
  const values = Object.values(bindings);
  return Function(...names, `"use strict"; ${functionSource}; return ${name};`)(...values);
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Expected ${name}() in production source.`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}().`);
}

console.log('LOW GRAPHICS production contract passed.');
