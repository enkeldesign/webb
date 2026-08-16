import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  PROCEDURAL_SURFACE_PLAN,
  createRoadUvArray
} from '../../turn/tracks/procedural-surface-polish-r522.js';

assert.deepEqual(
  PROCEDURAL_SURFACE_PLAN,
  {
    airport: { ground: true, road: true },
    cliffside: { ground: false, road: true },
    harbor: { ground: true, road: true }
  },
  'Airport and Harbor get ground + road polish, while Cliffside gets road polish only'
);
assert.equal(PROCEDURAL_SURFACE_PLAN.countryside, undefined, 'Countryside keeps its existing surface art pass');
assert.equal(PROCEDURAL_SURFACE_PLAN['midnight-city'], undefined, 'Midnight City stays untouched');

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

const [surfaceSource, registry] = await Promise.all([
  fs.readFile(new URL('../../turn/tracks/procedural-surface-polish-r522.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/registry.js', import.meta.url), 'utf8')
]);

assert.match(surfaceSource, /new THREE\.CanvasTexture\(canvas\)/, 'Surface variation must be generated in memory without image texture assets');
assert.match(surfaceSource, /broadFields\(/, 'Surface treatment must use broad low-frequency fields rather than scattered decals');
assert.match(surfaceSource, /broadSlabs\(/, 'Hard-surface treatment must include restrained large-scale slab variation');
assert.doesNotMatch(surfaceSource, /new THREE\.InstancedMesh/, 'The replacement surface treatment must not add decal draw-call batches');
assert.match(surfaceSource, /const wheelBands = \[0\.27, 0\.36, 0\.64, 0\.73\]/, 'Road polish must retain subtle wheel-path wear');
assert.match(surfaceSource, /maxAlpha: 0\.16/, 'Surface contrast must retain the stronger but still restrained lightness range');
assert.match(registry, /procedural-surface-polish-r522\.js\?revision=r523-procedural-surfaces-contrast/);
assert.doesNotMatch(registry, /ground-detail-polish-r521/, 'The old scattered Airport/Harbor ground-detail pass must no longer load');

console.log('TURN procedural surface polish contract passed.');
