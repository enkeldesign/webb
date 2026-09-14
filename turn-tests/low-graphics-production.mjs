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
assert.match(profileSource, /shadows: !lowGraphics/);
assert.match(profileSource, /pointLights: !lowGraphics/);
assert.match(profileSource, /optionalScenery: true/);

assert.match(runtimeSource, /from '\/turn\/graphics-profile\.js'/);
assert.match(runtimeSource, /antialias: true/);
assert.match(runtimeSource, /graphicsPixelRatio\(value\)/);
assert.match(runtimeSource, /Object\.defineProperty\(this\.shadowMap, 'enabled'/);
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
assert.match(worldSource, /countryside-scenery-r177\.js/);
assert.match(worldSource, /countryside-bella-r166\.js/);
assert.match(worldSource, /track-identity\.js/);
assert.match(worldSource, /section-intensity\.js/);


const producerContracts = [
  [mainSource, 'main outlinedMesh'],
  [carModelsSource, 'car outlines'],
  [landmarksSource, 'landmark outlines'],
  [countrysideSource, 'Countryside authored outlines'],
  [bellaSource, 'Bella primitive outlines'],
  [airportWorldSource, 'Airport primitive outlines'],
  [airportAircraftSource, 'Airport aircraft outlines'],
  [airportEmergencySource, 'Airport emergency outlines'],
  [cliffsideSource, 'Cliffside outlines'],
  [startAreaSource, 'start-area contours'],
  [worldAssetsSource, 'Countryside start flags']
];
for (const [source, label] of producerContracts) {
  assert.match(source, /graphicsProfile\.outlines/,
    `${label} must check the shared graphics profile before constructing contour meshes.`);
}
assert.match(artPassSource, /if \(!graphicsProfile\.outlines\) return;/,
  'The art pass contour helpers must return before contour construction in LOW GRAPHICS.');
assert.match(artPassSource, /const OUTLINE_MATERIAL = graphicsProfile\.outlines/,
  'The art pass must not allocate its outline material in LOW GRAPHICS.');
assert.match(artPassSource, /bold surroundings art pass loaded without contour construction/,
  'The full art pass remains installed while late contour sweeps are skipped.');
assert.doesNotMatch(runtimeSource, /turnOutline|TURN_INK|BackSide/,
  'The shared runtime must not be responsible for post-hoc contour suppression.');


assert.match(worldAssetsSource, /const blackOutlineMaterial = graphicsProfile\.outlines/,
  'COUNTRYSIDE must not allocate the flag outline material in LOW GRAPHICS.');
assert.match(worldAssetsSource, /function addOutline\(root, scale = 1\.025\) \{\n  if \(!graphicsProfile\.outlines\) return;/,
  'COUNTRYSIDE flag outlines must return before mesh allocation.');
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

let flagOutlineAllocations = 0;
class FlagOutlineMesh {
  constructor(geometry, material) {
    flagOutlineAllocations += 1;
    this.geometry = geometry;
    this.material = material;
    this.scale = { setScalar() {} };
  }
}
const addFlagOutlineLow = compileFunction(worldAssetsSource, 'addOutline', {
  graphicsProfile: lowGraphicsProfile,
  THREE: { Mesh: FlagOutlineMesh },
  blackOutlineMaterial: {}
});
const flagMesh = { isMesh: true, geometry: {}, add() { throw new Error('LOW GRAPHICS must not attach a flag outline.'); } };
addFlagOutlineLow({ traverse(callback) { callback(flagMesh); } });
assert.equal(flagOutlineAllocations, 0,
  'LOW GRAPHICS must not allocate a COUNTRYSIDE flag outline mesh.');

let normalOutlineAllocations = 0;
class NormalFlagOutlineMesh {
  constructor(geometry, material) {
    normalOutlineAllocations += 1;
    this.geometry = geometry;
    this.material = material;
    this.scale = { setScalar() {} };
  }
}
const addFlagOutlineNormal = compileFunction(worldAssetsSource, 'addOutline', {
  graphicsProfile: { outlines: true },
  THREE: { Mesh: NormalFlagOutlineMesh },
  blackOutlineMaterial: {}
});
addFlagOutlineNormal({ traverse(callback) { callback({ isMesh: true, geometry: {}, add() {} }); } });
assert.equal(normalOutlineAllocations, 1,
  'The flag-outline regression harness must exercise the normal allocation path.');

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
