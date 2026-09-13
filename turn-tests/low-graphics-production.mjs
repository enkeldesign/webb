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
  startAreaSource
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
  fs.readFile(new URL('../turn/tracks/start-area-polish-r519.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.equal(release.version, '1.19.9');
assert.equal(release.id, '2026.09.13-r223');
assert.equal(release.cacheKey, '20260913-r223');

assert.match(indexSource, /"three-native": "https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.184\.0\/build\/three\.module\.js"/);
assert.match(indexSource, /"three": "\/turn\/three-runtime\.js\?build=20260913-r223"/);
assert.match(indexSource, /"\/turn\/graphics-profile\.js": "\/turn\/graphics-profile\.js\?build=20260913-r223"/);
assert.match(indexSource, /ui\/low-graphics-setting\.js\?build=20260913-r223/);

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
  [startAreaSource, 'start-area contours']
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

console.log('LOW GRAPHICS production contract passed.');
