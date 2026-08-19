import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [skySource, worldSource, registrySource] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/mountain-world-r7-sky.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(skySource, /const SKY_REFERENCE_ASPECT = 1536 \/ 709/,
  'The approved wide-phone MOUNTAIN sky composition must remain the visual reference');
assert.match(skySource, /const visiblePlaneX = Math\.max\(1e-6, Math\.min\(1, visibleWidth \/ \(coverHeight \* SKY_IMAGE_ASPECT\)\)\)/,
  'Sky sampling must know how much of the overscanned 2:1 plane is actually visible horizontally');
assert.match(skySource, /const visiblePlaneY = Math\.max\(1e-6, Math\.min\(1, visibleHeight \/ coverHeight\)\)/,
  'Sky sampling must know how much of the overscanned plane is actually visible vertically');
assert.match(skySource, /const repeatU = visibleU \* REFERENCE_SKY_COVERAGE\.x \/ visiblePlaneX/,
  'Horizontal UV repeat must compensate for aspect-dependent plane overhang');
assert.match(skySource, /const repeatV = REFERENCE_SKY_COVERAGE\.y \/ visiblePlaneY/,
  'Vertical UV repeat must preserve the established star scale across aspect ratios');
assert.match(skySource, /texture\.repeat\.set\(repeatU, repeatV\)/,
  'The compensated UV repeat must be applied to the live star texture');
assert.match(skySource, /const localU = \(anchorU - skyMotion\.offsetU\) \/ skyMotion\.repeatU/,
  'The moon must invert the aspect-corrected horizontal star transform');
assert.match(skySource, /const localV = \(MOON_SKY_ANCHOR_V - skyMotion\.offsetV\) \/ skyMotion\.repeatV/,
  'The moon must invert the aspect-corrected vertical star transform');
assert.match(worldSource, /mountain-world-r7-sky\.js\?revision=r177-ipad-aspect-normalization/,
  'MOUNTAIN must cache-bust the corrected sky module');
assert.match(registrySource, /mountain-world-r3\.js\?revision=r177-ipad-sky-aspect/,
  'Production must cache-bust the MOUNTAIN world wrapper containing the corrected sky dependency');

const phone = skySampling({ fov: 68, aspect: 1536 / 709 });
const ipad9 = skySampling({ fov: 68, aspect: 4 / 3 });

// The visible horizontal texture span should scale only with horizontal FOV.
// Before this fix the 4:3 viewport saw just ~0.59 texture widths versus ~1.18
// on the phone: the hidden 2:1-plane overhang nearly doubled the apparent zoom
// and yaw travel. The normalized transform restores one angular texel scale.
const phoneAngularScale = phone.visibleTextureU / phone.horizontalFov;
const ipadAngularScale = ipad9.visibleTextureU / ipad9.horizontalFov;
assert.ok(Math.abs(phoneAngularScale - ipadAngularScale) < 1e-12,
  `Phone/iPad horizontal star scale diverged: ${phoneAngularScale} vs ${ipadAngularScale}`);
assert.ok(ipad9.visibleTextureU > 0.88 && ipad9.visibleTextureU < 0.90,
  `4:3 iPad should see about 0.89 star-texture widths at 68° FOV, got ${ipad9.visibleTextureU}`);

// Vertical FOV is identical on both devices, so the apparent vertical texture
// scale should also remain identical rather than changing with plane coverage.
assert.ok(Math.abs(phone.visibleTextureV - ipad9.visibleTextureV) < 1e-12,
  `Phone/iPad vertical star scale diverged: ${phone.visibleTextureV} vs ${ipad9.visibleTextureV}`);

// Preserve the approved phone appearance exactly: the reference aspect must
// retain the old repeat values (visibleU horizontally, 1 vertically).
assert.ok(Math.abs(phone.repeatU - phone.visibleU) < 1e-12,
  'Reference phone horizontal sampling must remain visually unchanged');
assert.ok(Math.abs(phone.repeatV - 1) < 1e-12,
  'Reference phone vertical sampling must remain visually unchanged');

console.log('TURN MOUNTAIN sky aspect normalization preserves the phone composition and fixes 4:3 iPad sampling.');

function skySampling({ fov, aspect }) {
  const skyImageAspect = 2;
  const skyHorizontalTiles = 4;
  const overscan = 1.05;
  const referenceAspect = 1536 / 709;
  const verticalFov = fov * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const visibleU = horizontalFov / (Math.PI * 2) * skyHorizontalTiles;
  const coverage = planeCoverage(aspect, skyImageAspect, overscan);
  const referenceCoverage = planeCoverage(referenceAspect, skyImageAspect, overscan);
  const repeatU = visibleU * referenceCoverage.x / coverage.x;
  const repeatV = referenceCoverage.y / coverage.y;
  return {
    horizontalFov,
    visibleU,
    repeatU,
    repeatV,
    visibleTextureU: repeatU * coverage.x,
    visibleTextureV: repeatV * coverage.y
  };
}

function planeCoverage(aspect, skyImageAspect, overscan) {
  const coverHeightInVisibleHeights = Math.max(1, aspect / skyImageAspect) * overscan;
  return {
    x: Math.min(1, aspect / (coverHeightInVisibleHeights * skyImageAspect)),
    y: Math.min(1, 1 / coverHeightInVisibleHeights)
  };
}
