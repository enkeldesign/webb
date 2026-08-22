import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8');

assert.match(source, /candidates\.push\(\{ node, material, explicit \}\)/,
  'Emergency livery placement must retain the body mesh that owns each paint material');
assert.match(source, /function boundsForLiverySurface\(records\)/,
  'Secondary accents must derive a body-surface envelope rather than use total vehicle width');
assert.match(source, /bounds\.expandByObject\(node\)/,
  'The livery surface envelope must be measured from the actual paintable body meshes');
assert.match(source, /const surfaceBounds = bodyBounds \|\| bounds/,
  'The full model bounds may be used only as a defensive fallback');
assert.match(source, /const surfaceGap = Math\.max\(0\.006, surfaceSize\.x \* 0\.002\)/,
  'Secondary geometry must keep a small physical gap outside the body surface');
assert.match(source, /left: surfaceBounds\.min\.x - sideDepth \* 0\.5 - surfaceGap/);
assert.match(source, /right: surfaceBounds\.max\.x \+ sideDepth \* 0\.5 \+ surfaceGap/);
assert.match(source, /panel\.position\.set\(direction < 0 \? sideX\.left : sideX\.right, y, z\)/,
  'Left and right accents must be placed fully outside their respective body surfaces');
assert.doesNotMatch(source, /size\.x \* 0\.405/,
  'The old in-body accent placement that caused angle-dependent occlusion must not return');
assert.match(source, /turnEmergencyLiverySurfaceGap/,
  'The resolved surface gap should remain inspectable on the visual for diagnostics');

console.log('Emergency livery layering regression passed.');
