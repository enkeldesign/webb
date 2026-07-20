import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  createTrackSpatialIndex,
  findNearestTrackBruteForce
} from '../../turn/race/track-spatial-index.js';
import {
  performanceModeRequested,
  summarizeFrameSamples
} from '../../turn/performance-monitor.js';

const samples = Array.from({ length: 720 }, (_, index) => {
  const angle = index / 720 * Math.PI * 2;
  const radiusX = 208 + Math.sin(angle * 2 + 0.35) * 20 + Math.sin(angle * 3 - 0.8) * 9;
  const radiusZ = 146 + Math.cos(angle * 2 - 0.4) * 14 + Math.sin(angle * 3 + 0.6) * 8;
  return {
    point: {
      x: Math.cos(angle) * radiusX,
      z: Math.sin(angle) * radiusZ
    }
  };
});

const spatialIndex = createTrackSpatialIndex(samples, { cellSize: 32 });
let seed = 0x17c0ffee;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

for (let query = 0; query < 1200; query += 1) {
  const position = {
    x: (random() - 0.5) * 540,
    z: (random() - 0.5) * 420
  };
  const indexed = spatialIndex.find(position);
  const brute = findNearestTrackBruteForce(samples, position);
  assert.equal(indexed.index, brute.index, `Spatial query ${query} must preserve the exact nearest sample`);
  assert.ok(Math.abs(indexed.distance - brute.distance) < 1e-9);
}

const checksBeforeTrackPass = spatialIndex.getStats();
for (let index = 0; index < samples.length; index += 1) {
  spatialIndex.find({
    x: samples[index].point.x + Math.sin(index) * 3,
    z: samples[index].point.z + Math.cos(index) * 3
  });
}
const checksAfterTrackPass = spatialIndex.getStats();
const trackQueries = checksAfterTrackPass.queryCount - checksBeforeTrackPass.queryCount;
const trackChecks = checksAfterTrackPass.totalChecks - checksBeforeTrackPass.totalChecks;
assert.ok(
  trackChecks / trackQueries < 120,
  'Normal on-track queries should inspect far fewer than all 720 samples'
);

const fallback = spatialIndex.find({ x: 5000, z: -5000 });
const fallbackBrute = findNearestTrackBruteForce(samples, { x: 5000, z: -5000 });
assert.equal(fallback.index, fallbackBrute.index, 'Far teleports must retain the exact full-scan fallback');
assert.equal(fallback.checks, samples.length);

assert.equal(performanceModeRequested('?perf=1'), true);
assert.equal(performanceModeRequested('?perf=0'), false);
assert.equal(performanceModeRequested(''), false);

const summary = summarizeFrameSamples([10, 20, 30, 40, 50]);
assert.equal(summary.averageMs, 30);
assert.equal(summary.p50Ms, 30);
assert.equal(summary.p95Ms, 50);
assert.equal(summary.slowPercent, 40);
assert.ok(Math.abs(summary.fps - 1000 / 30) < 1e-9);

const [index, main, controls, menu, spectate, hud, physics, camera, cars, lot, monitor] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/spectate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/hud.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/camera.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/performance-monitor.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.9 · Build 2026\.07\.20-r25/);
assert.match(main, /mainSceneOcclusion/);
assert.match(main, /HUD_UPDATE_INTERVAL_MS = 1000 \/ 30/);
assert.match(main, /recordPerformanceFrame/);
assert.match(main, /createTrackSpatialIndex/);
assert.match(main, /globalThis\.__turnUpdateGameplayControls\?\.\(now\)/);
assert.doesNotMatch(controls, /requestAnimationFrame\(updateBoost\)/);
assert.match(controls, /globalThis\.__turnUpdateGameplayControls = updateBoost/);
assert.match(controls, /BOOST_VISUAL_INTERVAL_MS = 1000 \/ 30/);
assert.doesNotMatch(menu, /requestAnimationFrame\(syncMenu\)/);
assert.match(menu, /turn:ui-state-change/);
assert.doesNotMatch(spectate, /requestAnimationFrame\(syncUi\)/);
assert.match(spectate, /turn:ui-state-change/);
assert.match(hud, /function setText\(/);
assert.doesNotMatch(physics, /getForward\(\)\.clone\(\)/);
assert.doesNotMatch(camera, /state\.position\.clone\(\)/);
assert.match(cars, /record\.node\.castShadow = !ghost/);
assert.doesNotMatch(lot, /root\.scale\.lerp\(new THREE\.Vector3/);
assert.match(lot, /recordPerformanceFrame/);
assert.doesNotMatch(lot, /GLTFLoader|InstancedMesh|installBrickScenery/, 'The clean Lot must not spend asset or draw-call budget on decorative wall scenery');
assert.match(monitor, /turn:perf-snapshot/);
assert.match(monitor, /trackChecksPerQuery/);

console.log(
  `TURN production performance and diagnostics regression passed ` +
  `(${(trackChecks / trackQueries).toFixed(1)} average on-track checks vs 720).`
);
