import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [skySource, worldSource, nightSource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/shared-night-sky.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r6-night.js', import.meta.url), 'utf8')
]);

assert.match(skySource, /const SKY_REFERENCE_ASPECT = 1536 \/ 709/,
  'The approved wide-phone MOUNTAIN sky composition must remain the visual reference');
assert.match(skySource, /const SKY_PLANE_ASPECT = 2/,
  'The shared celestial plane must retain the established overscan proportions');
assert.match(skySource, /const visiblePlaneX = Math\.max\(1e-6, Math\.min\(1, visibleWidth \/ \(coverHeight \* SKY_PLANE_ASPECT\)\)\)/,
  'Procedural sampling must know how much of the overscanned plane is visible horizontally');
assert.match(skySource, /const visiblePlaneY = Math\.max\(1e-6, Math\.min\(1, visibleHeight \/ coverHeight\)\)/,
  'Procedural sampling must know how much of the overscanned plane is visible vertically');
assert.match(skySource, /const repeatU = visibleU \* REFERENCE_SKY_COVERAGE\.x \/ visiblePlaneX/,
  'Horizontal procedural sampling must compensate for aspect-dependent plane overhang');
assert.match(skySource, /const repeatV = REFERENCE_SKY_COVERAGE\.y \/ visiblePlaneY/,
  'Vertical procedural sampling must preserve the established star scale across aspect ratios');
assert.match(skySource, /uSampleScale\.value\.set\(repeatU, repeatV\)/,
  'The normalized sample span must be applied directly to the procedural shader');
assert.match(skySource, /const localU = \(anchorU - motion\.offsetU\) \/ motion\.repeatU/,
  'The moon must invert the same aspect-corrected horizontal sample transform');
assert.match(skySource, /const localV = \(MOON_SKY_ANCHOR_V - motion\.offsetV\) \/ motion\.repeatV/,
  'The moon must invert the same aspect-corrected vertical sample transform');
assert.match(skySource, /existing\?\.sky\?\.parent === world/,
  'A retained track world must not accumulate duplicate sky or moon nodes');
assert.doesNotMatch(skySource, /mountain-night-sky\.jpg/,
  'The shared sky must not depend on the retired raster panorama');
assert.doesNotMatch(worldSource, /mountain-world-r7-sky/,
  'Current MOUNTAIN production should no longer install the raster-specific r7 UV repair layer');
assert.match(nightSource, /installSharedNightSky\(world, \{ trackId: 'mountain' \}\)/,
  'MOUNTAIN night treatment must use the shared procedural celestial layer');

const phone = skySampling({ fov: 68, aspect: 1536 / 709 });
const ipad9 = skySampling({ fov: 68, aspect: 4 / 3 });

const phoneAngularScale = phone.visibleSampleU / phone.horizontalFov;
const ipadAngularScale = ipad9.visibleSampleU / ipad9.horizontalFov;
assert.ok(Math.abs(phoneAngularScale - ipadAngularScale) < 1e-12,
  `Phone/iPad horizontal star scale diverged: ${phoneAngularScale} vs ${ipadAngularScale}`);
assert.ok(ipad9.visibleSampleU > 0.88 && ipad9.visibleSampleU < 0.90,
  `4:3 iPad should see about 0.89 procedural sample widths at 68° FOV, got ${ipad9.visibleSampleU}`);

assert.ok(Math.abs(phone.visibleSampleV - ipad9.visibleSampleV) < 1e-12,
  `Phone/iPad vertical star scale diverged: ${phone.visibleSampleV} vs ${ipad9.visibleSampleV}`);

assert.ok(Math.abs(phone.repeatU - phone.visibleU) < 1e-12,
  'Reference phone horizontal sampling must remain visually unchanged');
assert.ok(Math.abs(phone.repeatV - 1) < 1e-12,
  'Reference phone vertical sampling must remain visually unchanged');

console.log('TURN shared procedural night sky preserves the approved phone composition and normalized 4:3 sampling.');

function skySampling({ fov, aspect }) {
  const skyPlaneAspect = 2;
  const skyWorldCycles = 4;
  const overscan = 1.05;
  const referenceAspect = 1536 / 709;
  const verticalFov = fov * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const visibleU = horizontalFov / (Math.PI * 2) * skyWorldCycles;
  const coverage = planeCoverage(aspect, skyPlaneAspect, overscan);
  const referenceCoverage = planeCoverage(referenceAspect, skyPlaneAspect, overscan);
  const repeatU = visibleU * referenceCoverage.x / coverage.x;
  const repeatV = referenceCoverage.y / coverage.y;
  return {
    horizontalFov,
    visibleU,
    repeatU,
    repeatV,
    visibleSampleU: repeatU * coverage.x,
    visibleSampleV: repeatV * coverage.y
  };
}

function planeCoverage(aspect, skyPlaneAspect, overscan) {
  const coverHeightInVisibleHeights = Math.max(1, aspect / skyPlaneAspect) * overscan;
  return {
    x: Math.min(1, aspect / (coverHeightInVisibleHeights * skyPlaneAspect)),
    y: Math.min(1, 1 / coverHeightInVisibleHeights)
  };
}
