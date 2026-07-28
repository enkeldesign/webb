import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  calculateOrientationFreezeTransform,
  normalizeDegrees,
  snapToQuarterTurn
} from '../turn-next/orientation-freeze.js';

assert.equal(normalizeDegrees(0), 0);
assert.equal(normalizeDegrees(270), -90);
assert.equal(normalizeDegrees(-270), 90);
assert.equal(normalizeDegrees(540), 180);
assert.equal(snapToQuarterTurn(43), 0);
assert.equal(snapToQuarterTurn(47), 90);
assert.equal(snapToQuarterTurn(-136), 180);

const portraitTurn = calculateOrientationFreezeTransform({
  lockedAngle: 90,
  currentAngle: 0,
  logicalWidth: 844,
  logicalHeight: 390,
  viewportWidth: 390,
  viewportHeight: 844
});
assert.deepEqual(
  {
    rotation: portraitTurn.rotation,
    scale: portraitTurn.scale,
    rotatedWidth: portraitTurn.rotatedWidth,
    rotatedHeight: portraitTurn.rotatedHeight
  },
  {
    rotation: -90,
    scale: 1,
    rotatedWidth: 390,
    rotatedHeight: 844
  },
  'Turning from landscape to portrait must counter-rotate the locked landscape viewport without scaling'
);

const oppositeLandscape = calculateOrientationFreezeTransform({
  lockedAngle: 90,
  currentAngle: -90,
  logicalWidth: 844,
  logicalHeight: 390,
  viewportWidth: 844,
  viewportHeight: 390
});
assert.equal(oppositeLandscape.rotation, 180, 'The opposite landscape side must counter-rotate by a half turn');
assert.equal(oppositeLandscape.scale, 1);

const constrainedViewport = calculateOrientationFreezeTransform({
  lockedAngle: 90,
  currentAngle: 0,
  logicalWidth: 844,
  logicalHeight: 390,
  viewportWidth: 380,
  viewportHeight: 820
});
assert.ok(constrainedViewport.scale < 1, 'Browser chrome or safe-area loss must scale the frozen viewport down rather than clip it');
assert.ok(constrainedViewport.scale > 0.9, 'Small viewport losses must not collapse the game');

const [
  productionIndex,
  nextIndex,
  nextApp,
  preflight,
  freezeSource,
  freezeCss
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/orientation-preflight.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/orientation-freeze.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/orientation-freeze.css', import.meta.url), 'utf8')
]);

assert.match(nextIndex, /id="turnAppViewport"/, 'TURN NEXT must wrap every visual surface in one transformable viewport');
assert.match(nextIndex, /orientation-preflight\.js\?source=/);
assert.match(nextIndex, /orientation-freeze\.css\?source=/);
assert.ok(
  nextIndex.indexOf('/turn-next/orientation-preflight.js') < nextIndex.indexOf('./orientation-compat.js'),
  'The raw ScreenOrientation getter must be captured before TURN installs its compatibility shim'
);
assert.doesNotMatch(productionIndex, /turnAppViewport|orientation-preflight|orientation-freeze/, 'Production TURN must remain outside the experimental visual-freeze path');

assert.match(preflight, /ownAngleDescriptor/);
assert.match(preflight, /prototypeAngleDescriptor/);
assert.match(preflight, /__TURN_NEXT_ORIENTATION_PREFLIGHT__/);
assert.match(preflight, /getViewportSize/);

assert.match(nextApp, /installTurnNextOrientationFreeze/);
assert.match(nextApp, /Platform M1 · Orientation M2/);
assert.ok(
  nextApp.indexOf('installTurnNextOrientationFreeze') < nextApp.indexOf("withBuild('./main.js')"),
  'Visual compensation must install before the production game core registers resize handlers'
);

assert.match(freezeSource, /turn:ui-state-change/);
assert.match(freezeSource, /turn:runtime-ready/);
assert.match(freezeSource, /renderer\.setSize = function setOrientationAwareSize/);
assert.match(freezeSource, /camera\.updateProjectionMatrix = function updateOrientationAwareProjection/);
assert.match(freezeSource, /data-turn-orientation-freeze/);
assert.match(freezeSource, /lockLandscape/);
assert.match(freezeSource, /visualViewport/);
assert.match(freezeSource, /orientationchange/);
assert.match(freezeSource, /pageshow/);

assert.match(freezeCss, /#turnAppViewport/);
assert.match(freezeCss, /--turn-freeze-rotation/);
assert.match(freezeCss, /--turn-freeze-scale/);
assert.doesNotMatch(freezeCss, /transition:\s*transform/, 'The counter-rotation must not add another visible rotation animation');

console.log('TURN NEXT visual orientation freeze geometry and staging boundaries passed.');
