import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

const [
  moduleSource,
  indexSource,
  attributionSource,
  windmillBuffer,
  linerBuffer,
  windmillPalette,
  linerPalette
] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/kenney-track-landmarks-r517.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/assets/KENNEY-ASSETS.md', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/assets/scenery/fantasy-town/windmill.glb', import.meta.url)),
  fs.readFile(new URL('../turn/assets/scenery/watercraft/ship-ocean-liner.glb', import.meta.url)),
  fs.readFile(new URL('../turn/assets/scenery/fantasy-town/Textures/colormap.png', import.meta.url)),
  fs.readFile(new URL('../turn/assets/scenery/watercraft/Textures/colormap.png', import.meta.url))
]);

const windmill = readGlb(windmillBuffer);
const liner = readGlb(linerBuffer);

assert.equal(windmill.json.scenes[windmill.json.scene].name, 'windmill');
assert.equal(liner.json.scenes[liner.json.scene].name, 'ship-ocean-liner');
assert.equal(windmill.json.animations?.length || 0, 0, 'The supplied windmill rotor must remain static scenery');
assert.equal(liner.json.animations?.length || 0, 0, 'The supplied ocean liner must remain static scenery');
assert.equal(windmill.json.images?.[0]?.uri, 'Textures/colormap.png');
assert.equal(liner.json.images?.[0]?.uri, 'Textures/colormap.png');

assertPngPalette(
  windmillPalette,
  '4aac939dc33195e35caf8c382ee3cb170054da763577f22d3c22692ec6afccdf',
  'Fantasy Town windmill'
);
assertPngPalette(
  linerPalette,
  '311138350e74e35c5497a1bd8076a01740b7c302bed11027639fa553459a68de',
  'Watercraft luxury liner'
);
assert.notDeepEqual(
  windmillPalette,
  linerPalette,
  'Each Kenney pack must keep its own colormap despite sharing the same relative filename'
);

const windmillPosition = positionAccessor(windmill.json);
const linerPosition = positionAccessor(liner.json);
assert.ok(windmillPosition.count >= 1300, 'The real Kenney windmill rotor must be vendored');
assert.ok(linerPosition.count >= 4300, 'The full Kenney ocean liner must be vendored, not the small substitute');
assert.ok(horizontalSpan(linerPosition) > 20, 'The full-size ocean-liner source proportions must be preserved');

assert.match(moduleSource, /assets\/scenery\/fantasy-town\/windmill\.glb\?asset=kenney-fantasy-town-kit-2\.0-palette-4aac939d/);
assert.match(moduleSource, /assets\/scenery\/watercraft\/ship-ocean-liner\.glb\?asset=kenney-watercraft-kit-2\.1-luxury-palette-31113835/);
assert.match(moduleSource, /WINDMILL_TRACK_FRACTION = 0\.52/);
assert.match(moduleSource, /WINDMILL_LANDMARK_SCALE = 1\.35/);
assert.match(moduleSource, /OCEAN_LINER_TRACK_FRACTION = 0\.55/);
assert.match(moduleSource, /landmark\.scale\.setScalar\(WINDMILL_LANDMARK_SCALE\)/);
assert.match(moduleSource, /currentTrackId\(runtime\) !== 'countryside'/);
assert.match(moduleSource, /currentTrackId\(runtime\) !== 'cliffside'/);
assert.match(moduleSource, /side \* \(trackWidth \/ 2 \+ WINDMILL_TRACKSIDE_DISTANCE\)/);
assert.match(moduleSource, /-\(trackWidth \/ 2 \+ OCEAN_LINER_OFFSHORE_DISTANCE\)/);
assert.match(moduleSource, /liner\.position\.y = SEA_LEVEL - 4\.3 \+ normalizedBaseY/);
assert.match(moduleSource, /gameplayGeometryUnchanged = true/g);
assert.doesNotMatch(
  moduleSource,
  /resolveWorldCollisionState|collisionProfile|freeRoamDistance|localStorage|requestAnimationFrame|setAnimationLoop|setInterval/,
  'Landmarks must stay static, scenery-only additions with no physics, record, or animation loop changes'
);

const landmarkScript = './tracks/kenney-track-landmarks-r517.js?revision=r517-kenney-landmark-framing';
assert.ok(indexSource.includes(landmarkScript), 'Production TURN must load the cache-revisioned landmark module');
assert.ok(
  indexSource.indexOf('cliffside-house-inset-r203.js') < indexSource.indexOf(landmarkScript),
  'The ocean liner should install after the established Cliffside scenery modules'
);

assert.match(attributionSource, /Fantasy Town Kit 2\.0/);
assert.match(attributionSource, /Watercraft Kit 2\.1/);
assert.match(attributionSource, /scenery\/fantasy-town\/windmill\.glb/);
assert.match(attributionSource, /scenery\/watercraft\/ship-ocean-liner\.glb/);
assert.match(attributionSource, /All six packs are released under Creative Commons CC0 1\.0/);

console.log('TURN Kenney windmill and luxury-colour ocean-liner landmark assets passed.');

function assertPngPalette(buffer, expectedHash, label) {
  assert.equal(
    buffer.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    `${label} palette must be a PNG`
  );
  assert.equal(buffer.readUInt32BE(16), 512, `${label} palette width must stay intact`);
  assert.equal(buffer.readUInt32BE(20), 512, `${label} palette height must stay intact`);
  assert.equal(
    createHash('sha256').update(buffer).digest('hex'),
    expectedHash,
    `${label} palette must match the supplied Kenney source`
  );
}

function readGlb(buffer) {
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF', 'Asset must be a binary glTF file');
  assert.equal(buffer.readUInt32LE(4), 2, 'Asset must use glTF 2.0');
  assert.equal(buffer.readUInt32LE(8), buffer.length, 'GLB header length must match the vendored file');
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.subarray(16, 20).toString('ascii'), 'JSON');
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  return { json };
}

function positionAccessor(gltf) {
  const scene = gltf.scenes[gltf.scene];
  const rootNode = gltf.nodes[scene.nodes[0]];
  const mesh = gltf.meshes[rootNode.mesh];
  const accessorIndex = mesh.primitives[0].attributes.POSITION;
  return gltf.accessors[accessorIndex];
}

function horizontalSpan(accessor) {
  return Math.max(
    accessor.max[0] - accessor.min[0],
    accessor.max[2] - accessor.min[2]
  );
}
