import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CAR_CATALOG } from '../turn/vehicle/catalog.js';
import { CAR_VIEW } from '../turn/garage/car-view.js';
import {
  STILL_HEIGHT,
  STILL_WIDTH,
  STILLS_DIRECTORY,
  checkStills
} from '../turn/scripts/render-car-stills.mjs';

// ALL CARS artwork: every catalog car has a still and a locked line drawing, rendered
// from its current model (render-car-stills.mjs records each model's hash), at one
// size, from the view the live showroom starts on.
const problems = await checkStills();
assert.deepEqual(problems, [], `Car stills are out of date; run node turn/scripts/render-car-stills.mjs:\n${problems.join('\n')}`);

// A WebP's canvas size: VP8X carries it directly (alpha pictures always use VP8X).
function webpSize(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(bytes.toString('ascii', 12, 16), 'VP8X', 'A card still keeps its transparent background');
  return {
    width: 1 + bytes.readUIntLE(24, 3),
    height: 1 + bytes.readUIntLE(27, 3)
  };
}

for (const car of CAR_CATALOG) {
  for (const suffix of ['', '-outline']) {
    const bytes = await fs.readFile(`${STILLS_DIRECTORY}/${car.id}${suffix}.webp`);
    assert.deepEqual(webpSize(bytes), { width: STILL_WIDTH, height: STILL_HEIGHT }, `${car.id}${suffix}: one card size`);
    assert.ok(bytes.length < 40 * 1024, `${car.id}${suffix}: a small card image (${bytes.length} bytes)`);
  }
}

assert.equal(CAR_VIEW.yawDegrees, 200, 'Cards and the showroom share the 20° view');
const [viewer, catalogSource, stillSource, garageSource] = await Promise.all([
  fs.readFile(new URL('../turn/garage/showroom-viewer.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/garage-catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/car-still.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/garage.js', import.meta.url), 'utf8')
]);
assert.match(viewer, /import \{ CAR_VIEW \} from '\.\/car-view\.js';/, 'The live showroom starts from the shared view');
assert.match(catalogSource, /stillUrl\(`\$\{carId\}\$\{outline \? '-outline' : ''\}\.webp`\)/,
  'ALL CARS shows the rendered stills, the line drawing for a locked car');
assert.match(stillSource, /new URL\(`\.\.\/assets\/cars\/stills\/\$\{file\}`, import\.meta\.url\)/);
assert.doesNotMatch(catalogSource, /WebGLRenderer|createCarVisual/, 'ALL CARS never creates a WebGL context per card');
assert.match(catalogSource, /import \{ paintedStillUrl, stillUrl \} from '\.\/car-still\.js';/,
  'car-still.js takes its identity from the release, not a manual revision');

// A saved repaint shows on the card: rendered at runtime into the stills' own frame, by
// one renderer that works one car at a time and is released when nothing waits.
assert.match(garageSource, /savedPaint: \(carId\) => \(isPaintUnlocked\(\) \? getSavedLotPaint\(carId\) : null\)/,
  'Only saved paint, once Paintjob is unlocked, recolours a card');
assert.match(garageSource, /saveLotPaint\(current\.carId, current\);\s*syncPaintAction\(\);\s*catalog\.sync\(\);/,
  'Saving colours updates the card straight away');
assert.match(stillSource, /frameStill\(camera, frame, width, height\)/, 'Repaints use the shared frame');
assert.match(stillSource, /fetch\(stillUrl\('manifest\.json'\)\)/);
assert.equal((stillSource.match(/new THREE\.WebGLRenderer/g) || []).length, 1, 'One renderer for every repainted card');
assert.match(stillSource, /function releaseStudio\(\) \{\s*if \(!studio \|\| pending\) return;\s*studio\.renderer\.dispose\(\);\s*studio\.renderer\.forceContextLoss\?\.\(\);/,
  'The repaint renderer is released once nothing waits');
assert.match(catalogSource, /if \(!active\) return;/, 'Repaints render only once ALL CARS is on screen');

console.log(`ALL CARS has a ${STILL_WIDTH}×${STILL_HEIGHT} still and line drawing for all ${CAR_CATALOG.length} cars, current with their models.`);
