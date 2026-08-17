import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const [baseRescue, correction, world] = await Promise.all([
  fs.readFile(path.join(turnDir, 'tracks/countryside-bella-rescue-r173.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/countryside-bella-rescue-r524.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'render/world.js'), 'utf8')
]);

assert.match(
  baseRescue,
  /cat\.getWorldPosition\(bellaWorldPosition\)/,
  'Bella meows must continue to use Bella’s exact rendered world position as the sound source'
);
assert.match(
  correction,
  /cameraRight\.set\(1, 0, 0\)\.applyQuaternion\(camera\.quaternion\)/,
  'Directional meows must derive screen-right from the live camera'
);
assert.match(
  correction,
  /-Number\(physicsRight\.x \|\| 0\)[\s\S]*-Number\(physicsRight\.z \|\| 0\)/,
  'The non-camera fallback must correct TURN physics-right handedness'
);
assert.match(
  world,
  /countryside-bella-rescue-r524\.js\?revision=r524-camera-relative-meow/,
  'Production world bootstrap must load the corrected Bella guidance under a fresh cache identity'
);
