import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  releaseSource,
  indexSource,
  profileSource,
  runtimeSource,
  settingSource,
  worldSource
] = await Promise.all([
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/graphics-profile.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/three-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/low-graphics-setting.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/world.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.equal(release.version, '1.19.8');
assert.equal(release.id, '2026.09.13-r222');
assert.equal(release.cacheKey, '20260913-r222');

assert.match(indexSource, /"three-native": "https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.184\.0\/build\/three\.module\.js"/);
assert.match(indexSource, /"three": "\/turn\/three-runtime\.js\?build=20260913-r222"/);
assert.match(indexSource, /"\/turn\/graphics-profile\.js": "\/turn\/graphics-profile\.js\?build=20260913-r222"/);
assert.match(indexSource, /ui\/low-graphics-setting\.js\?build=20260913-r222/);

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
assert.match(runtimeSource, /function isTurnOutline\(node\)/);
assert.match(runtimeSource, /node\.userData\?\.turnOutline/);
assert.match(runtimeSource, /node\.userData\?\.turnStartBannerContour/);
assert.match(runtimeSource, /candidate\?\.side === NativeThree\.BackSide/);
assert.match(runtimeSource, /candidate\?\.color\?\.getHex\?\.\(\) === TURN_INK/);
assert.match(runtimeSource, /node\.visible = false/);

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

console.log('LOW GRAPHICS production contract passed.');
