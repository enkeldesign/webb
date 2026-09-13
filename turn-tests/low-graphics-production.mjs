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
assert.equal(release.version, '1.19.7');
assert.equal(release.id, '2026.09.13-r221');
assert.equal(release.cacheKey, '20260913-r221');

assert.match(indexSource, /"three-native": "https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.184\.0\/build\/three\.module\.js"/);
assert.match(indexSource, /"three": "\/turn\/three-runtime\.js\?build=20260913-r221"/);
assert.match(indexSource, /ui\/low-graphics-setting\.js\?build=20260913-r221/);

assert.match(profileSource, /turn-low-graphics-v1/);
assert.match(profileSource, /dprCap: lowGraphics \? 1 : Infinity/);
assert.match(profileSource, /antialias: !lowGraphics/);
assert.match(profileSource, /shadows: !lowGraphics/);
assert.match(profileSource, /pointLights: !lowGraphics/);
assert.match(profileSource, /optionalScenery: !lowGraphics/);

assert.match(runtimeSource, /antialias: false/);
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

const lowBranchStart = worldSource.indexOf('if (graphicsProfile.lowGraphics)');
const fullBranchStart = worldSource.indexOf('const [beauty, art, identity');
assert.ok(lowBranchStart >= 0 && fullBranchStart > lowBranchStart, 'World loader exposes a LOW GRAPHICS branch before the full cosmetic graph.');
const lowBranch = worldSource.slice(lowBranchStart, fullBranchStart);
assert.doesNotMatch(lowBranch, /world-beauty\.js/);
assert.doesNotMatch(lowBranch, /world-art-pass\.js/);
assert.doesNotMatch(lowBranch, /countryside-scenery-r177\.js/);
assert.match(lowBranch, /countryside-bella-r166\.js/);
assert.match(lowBranch, /track-identity\.js/);
assert.match(lowBranch, /section-intensity\.js/);

console.log('LOW GRAPHICS production contract passed.');
