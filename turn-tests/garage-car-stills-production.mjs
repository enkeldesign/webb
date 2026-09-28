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
const [viewer, catalogSource] = await Promise.all([
  fs.readFile(new URL('../turn/garage/showroom-viewer.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/garage/garage-catalog.js', import.meta.url), 'utf8')
]);
assert.match(viewer, /import \{ CAR_VIEW \} from '\.\/car-view\.js';/, 'The live showroom starts from the shared view');
assert.match(catalogSource, /assets\/cars\/stills\/\$\{carId\}\$\{outline \? '-outline' : ''\}\.webp/,
  'ALL CARS shows the rendered stills, the line drawing for a locked car');
assert.doesNotMatch(catalogSource, /WebGLRenderer|createCarVisual/, 'ALL CARS never creates a WebGL context per card');

console.log(`ALL CARS has a ${STILL_WIDTH}×${STILL_HEIGHT} still and line drawing for all ${CAR_CATALOG.length} cars, current with their models.`);
