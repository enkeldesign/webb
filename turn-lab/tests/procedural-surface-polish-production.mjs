import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [surfaceSource, airportContrastSource, registry] = await Promise.all([
  fs.readFile(new URL('../../turn/tracks/procedural-surface-polish-r522.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/airport-surface-contrast-r525.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

const planMatch = surfaceSource.match(/export const PROCEDURAL_SURFACE_PLAN = Object\.freeze\(\{([\s\S]*?)\n\}\);/);
assert.ok(planMatch, 'Procedural surface plan must remain exported from production source');
assert.match(planMatch[0], /airport: Object\.freeze\(\{ ground: true, road: true \}\)/);
assert.match(planMatch[0], /cliffside: Object\.freeze\(\{ ground: false, road: true \}\)/);
assert.match(planMatch[0], /harbor: Object\.freeze\(\{ ground: true, road: true \}\)/);
assert.doesNotMatch(planMatch[0], /countryside|midnight-city/, 'Countryside and Midnight City must stay out of this polish pass');

const uvFunctionMatch = surfaceSource.match(/export function createRoadUvArray\(sampleCount\) \{[\s\S]*?\n\}/);
assert.ok(uvFunctionMatch, 'Production source must expose the pure road UV helper');
const createRoadUvArray = Function(
  `${uvFunctionMatch[0].replace('export function', 'function')}; return createRoadUvArray;`
)();
const uv = Array.from(createRoadUvArray(4));
assert.deepEqual(
  uv,
  [
    0, 0, 1, 0,
    0, 0.25, 1, 0.25,
    0, 0.5, 1, 0.5,
    0, 0.75, 1, 0.75,
    0, 1, 1, 1
  ],
  'Road UVs must span the full road width and loop length without disturbing geometry'
);

assert.match(surfaceSource, /new THREE\.CanvasTexture\(canvas\)/, 'Surface variation must be generated in memory without image texture assets');
assert.match(surfaceSource, /broadFields\(/, 'Surface treatment must use broad low-frequency fields rather than scattered decals');
assert.match(surfaceSource, /broadSlabs\(/, 'Hard-surface treatment must include restrained large-scale slab variation');
assert.doesNotMatch(surfaceSource, /new THREE\.InstancedMesh/, 'The replacement surface treatment must not add decal draw-call batches');
assert.match(surfaceSource, /const wheelBands = \[0\.27, 0\.36, 0\.64, 0\.73\]/, 'Road polish must retain subtle wheel-path wear');
assert.match(surfaceSource, /maxAlpha: 0\.16/, 'Surface contrast must retain the stronger but still restrained lightness range');
assert.match(surfaceSource, /return finishTexture\(canvas, 1, 6\);/, 'Closed road texture repeat must use an integer repeat count so the loop seam is continuous');

assert.match(airportContrastSource, /new Set\(\['airport-grass', 'airport-concrete'\]\)/, 'Airport contrast pass must target only Airport ground textures');
assert.match(airportContrastSource, /contrast: 1\.6/, 'Airport ground texture range must be visibly wider than the base procedural pass');
assert.match(airportContrastSource, /darken: 0\.055/, 'Airport ground treatment must shift slightly darker overall');
assert.match(airportContrastSource, /trackId !== 'airport'/, 'Airport contrast pass must not alter Harbor, Cliffside, Countryside or Midnight City');
assert.doesNotMatch(airportContrastSource, /new THREE\.|InstancedMesh|requestAnimationFrame|setInterval/, 'Airport contrast must not add geometry, draw calls or a frame loop');

assert.match(registry, /procedural-surface-polish-r522\.js\?revision=r524-procedural-surfaces-contrast-r171/);
assert.match(registry, /airport-surface-contrast-r525\.js\?revision=r525-airport-ground-contrast/);
assert.doesNotMatch(registry, /ground-detail-polish-r521/, 'The old scattered Airport/Harbor ground-detail pass must no longer load');

console.log('TURN procedural surface polish contract passed.');
