import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const labDir = path.join(process.cwd(), 'turn-lab');

const retiredFiles = [
  'game.js',
  'game-prepatch.js',
  'gameplay-features.js',
  'core-state-v1.js',
  'driving-core-v1.js',
  'render-core-v1.js',
  'motion-adapter.js',
  'patch-capture-init.js',
  'legacy-bootstrap.js',
  'lab-motion-loader.js',
  'scripts/build-static-main.mjs',
  'scripts/check-static-runtime.mjs'
];

for (const relativePath of retiredFiles) {
  try {
    await fs.access(path.join(labDir, relativePath));
    assert.fail(`Retired runtime file still exists: ${relativePath}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const [index, app, main] = await Promise.all([
  fs.readFile(path.join(labDir, 'index.html'), 'utf8'),
  fs.readFile(path.join(labDir, 'app.js'), 'utf8'),
  fs.readFile(path.join(labDir, 'main.js'), 'utf8')
]);

assert.match(index, /TURN LAB v1\.0\.0 · Build 2026\.07\.19-r7/);
assert.match(index, /<script type="module" src="\.\/app\.js\?build=20260719-r7"><\/script>/);

const forbiddenRuntimeReferences = [
  'game-prepatch.js',
  'gameplay-features.js',
  'core-state-v1.js',
  'driving-core-v1.js',
  'render-core-v1.js',
  'motion-adapter.js',
  'patch-capture-init.js',
  'legacy-bootstrap.js',
  'lab-motion-loader.js'
];

for (const name of forbiddenRuntimeReferences) {
  assert.equal(index.includes(name), false, `index.html still references ${name}`);
  assert.equal(app.includes(name), false, `app.js still references ${name}`);
  assert.equal(main.includes(name), false, `main.js still references ${name}`);
}

for (const required of [
  './input/analog-gas.js',
  './ui/gameplay-controls.js',
  './main.js',
  './render/world.js',
  './ui/spectate.js'
]) {
  assert.equal(app.includes(required), true, `app.js is missing ${required}`);
}

for (const required of [
  "from './race/game-state.js'",
  "from './race/lap-system.js'",
  "from './race/replay-system.js'",
  "from './race/rival-storage.js'",
  "from './input/motion.js'",
  "from './vehicle/physics.js'",
  "from './render/camera.js'",
  "from './ui/hud.js'",
  "from './world-assets.js'",
  'updateVehiclePhysicsState({',
  'updateLapProgressState({',
  'updateRaceCameraState({',
  'updateHudState({',
  'globalThis.__turnRuntime = turnRuntime;'
]) {
  assert.equal(main.includes(required), true, `main.js is missing required architecture anchor: ${required}`);
}

for (const forbidden of [
  'URL.createObjectURL(new Blob',
  '__turnCaptureLegacyPatch',
  '__turnLegacyPipeline',
  'window.fetch =',
  "from 'https://enkel.design/turn-lab/"
]) {
  assert.equal(main.includes(forbidden), false, `main.js contains retired runtime machinery: ${forbidden}`);
}

console.log('TURN release architecture check passed.');
