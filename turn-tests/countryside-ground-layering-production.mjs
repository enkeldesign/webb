import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [beautySource, indexSource] = await Promise.all([
  fs.readFile(new URL('../turn/world-beauty.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8')
]);

assert.match(beautySource, /function stripTreeClusterGroundBase\(root\)/);
assert.match(beautySource, /TREE_BASE_HEIGHT_RATIO = 0\.09/);
assert.match(beautySource, /TREE_BASE_WIDTH_RATIO = 0\.78/);
assert.match(
  beautySource,
  /maxY <= baseMaxY && Math\.max\(spanX, spanZ\) >= wideTriangleThreshold/,
  'Only broad triangles confined to the shallow Kenney ground tile may be removed'
);
assert.match(beautySource, /strippedGeometry\.setIndex\(keptIndices\)/);
assert.match(beautySource, /node\.userData\.turnGroundBaseRemoved = true/);
assert.match(
  beautySource,
  /if \(key === 'trees' \|\| key === 'tallTrees'\) stripTreeClusterGroundBase\(gltf\.scene\)/,
  'Both repeated Kenney tree-cluster sources must lose their overlapping tile before cloning'
);
assert.doesNotMatch(
  beautySource,
  /requestAnimationFrame|setAnimationLoop|setInterval/,
  'The ground-base cleanup must remain a one-time asset preparation step'
);
assert.match(
  indexSource,
  /app\.js\?build=[^"']*-r518-landmark-framing-ground-layering/,
  'Production must refresh the world module chain so the terrain cleanup reaches cached clients'
);

console.log('TURN Countryside tree-cluster ground layering passed.');
