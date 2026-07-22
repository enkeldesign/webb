import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTrackSpatialIndex, findNearestTrackBruteForce } from '../../turn/race/track-spatial-index.js';
import { performanceModeRequested, summarizeFrameSamples } from '../../turn/performance-monitor.js';
import { performanceProfileFromSearch } from '../../turn/performance-profile.js';
import { replayFrameAt } from '../../turn/race/replay-system.js';

const samples = Array.from({ length: 720 }, (_, index) => {
  const angle = index / 720 * Math.PI * 2;
  const radiusX = 208 + Math.sin(angle * 2 + 0.35) * 20 + Math.sin(angle * 3 - 0.8) * 9;
  const radiusZ = 146 + Math.cos(angle * 2 - 0.4) * 14 + Math.sin(angle * 3 + 0.6) * 8;
  return { point: { x: Math.cos(angle) * radiusX, z: Math.sin(angle) * radiusZ } };
});

const spatialIndex = createTrackSpatialIndex(samples, { cellSize: 32 });
let seed = 0x17c0ffee;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; }

for (let query = 0; query < 1200; query += 1) {
  const position = { x: (random() - 0.5) * 540, z: (random() - 0.5) * 420 };
  const indexed = spatialIndex.find(position);
  const brute = findNearestTrackBruteForce(samples, position);
  assert.equal(indexed.index, brute.index, `Spatial query ${query} must preserve the exact nearest sample`);
  assert.ok(Math.abs(indexed.distance - brute.distance) < 1e-9);
}

const checksBeforeTrackPass = spatialIndex.getStats();
for (let index = 0; index < samples.length; index += 1) {
  spatialIndex.find({ x: samples[index].point.x + Math.sin(index) * 3, z: samples[index].point.z + Math.cos(index) * 3 });
}
const checksAfterTrackPass = spatialIndex.getStats();
const trackQueries = checksAfterTrackPass.queryCount - checksBeforeTrackPass.queryCount;
const trackChecks = checksAfterTrackPass.totalChecks - checksBeforeTrackPass.totalChecks;
assert.ok(trackChecks / trackQueries < 120, 'Normal on-track queries should inspect far fewer than all 720 samples');

for (const position of [{ x: 5000, z: -5000 }, { x: 0, z: 0 }]) {
  const indexed = spatialIndex.find(position);
  const brute = findNearestTrackBruteForce(samples, position);
  assert.equal(indexed.index, brute.index, 'Wide off-track searches must preserve the exact nearest sample');
  assert.ok(Math.abs(indexed.distance - brute.distance) < 1e-9);
  assert.ok(indexed.checks < 160, `Wide off-track searches must avoid the old 720-sample spike, got ${indexed.checks}`);
}

assert.equal(performanceModeRequested('?perf=1'), true);
assert.equal(performanceModeRequested('?perf=0'), false);
assert.equal(performanceModeRequested(''), false);

const baselineProfile = performanceProfileFromSearch('?perf=1', 2);
assert.equal(baselineProfile.active, false, 'Perf diagnostics alone must not add a separate quality tier');
assert.equal(baselineProfile.dprCap, 1.5, 'TURN must use one universal DPR 1.5 ceiling');
assert.equal(baselineProfile.pixelRatio, 1.5);
assert.equal(baselineProfile.shadowsEnabled, true);
assert.equal(baselineProfile.shadowMapSize, 1024);

const dprProfile = performanceProfileFromSearch('?perf=1&dpr=1.25', 2);
assert.equal(dprProfile.active, true);
assert.equal(dprProfile.dprCap, 1.25);
assert.equal(dprProfile.pixelRatio, 1.25);
assert.match(dprProfile.label, /DPR≤1\.25/);

const lowDprProfile = performanceProfileFromSearch('?perf=1&dpr=0.2', 2);
assert.equal(lowDprProfile.dprCap, 0.75, 'Diagnostic DPR overrides must stay within the safe lower bound');
const highDprProfile = performanceProfileFromSearch('?perf=1&dpr=9', 3);
assert.equal(highDprProfile.dprCap, 1.5, 'No diagnostic profile may exceed the universal production cap');

const shadowProfile = performanceProfileFromSearch('?perf=1&shadow=512', 2);
assert.equal(shadowProfile.active, true);
assert.equal(shadowProfile.shadowsEnabled, true);
assert.equal(shadowProfile.shadowMapSize, 512);
const noShadowProfile = performanceProfileFromSearch('?perf=1&shadow=off', 2);
assert.equal(noShadowProfile.shadowsEnabled, false);
assert.match(noShadowProfile.label, /shadows off/);
const ignoredProfile = performanceProfileFromSearch('?dpr=1&shadow=off', 2);
assert.equal(ignoredProfile.active, false, 'Renderer overrides must be ignored outside explicit perf mode');
assert.equal(ignoredProfile.dprCap, 1.5);
assert.equal(ignoredProfile.pixelRatio, 1.5, 'Normal play must still receive the universal DPR cap');
assert.equal(ignoredProfile.shadowsEnabled, true);

const replayLap = {
  time: 2,
  frames: [
    { t: 0, x: 0, z: 0, h: 0, s: 0, d: 0, p: 0 },
    { t: 1, x: 10, z: 20, h: 0.5, s: 0.2, d: 0.4, p: 0.5 },
    { t: 2, x: 20, z: 40, h: 1, s: 0.4, d: 0.8, p: 1 }
  ]
};
const firstReplaySample = replayFrameAt(replayLap, 0.5);
const repeatedReplaySample = replayFrameAt(replayLap, 0.5);
assert.strictEqual(repeatedReplaySample, firstReplaySample, 'Repeated same-time rival sampling must reuse one interpolated frame');
const laterReplaySample = replayFrameAt(replayLap, 0.6);
assert.notStrictEqual(laterReplaySample, firstReplaySample, 'A new replay time must produce a fresh interpolation');
replayLap.frames.push({ t: 3, x: 30, z: 60, h: 1.5, s: 0.6, d: 1, p: 1.5 });
const changedReplaySample = replayFrameAt(replayLap, 0.6);
assert.notStrictEqual(changedReplaySample, laterReplaySample, 'Changing the replay frame list must invalidate the one-sample cache');

const summary = summarizeFrameSamples([10, 20, 30, 40, 50]);
assert.equal(summary.averageMs, 30);
assert.equal(summary.p50Ms, 30);
assert.equal(summary.p95Ms, 50);
assert.equal(summary.slowPercent, 40);
assert.ok(Math.abs(summary.fps - 1000 / 30) < 1e-9);

const [index, app, main, worldAssets, worldRender, controls, menu, spectate, hud, physics, camera, cars, lot, monitor, profile, replay, audio, orientationCompat] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/world-assets.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/spectate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/hud.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/camera.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/performance-monitor.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/performance-profile.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/replay-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/orientation-compat.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.5\.0 · Build 2026\.07\.22-r47/);
assert.match(index, /"\.\/race\/replay-system\.js": "\.\/race\/replay-system\.js\?build=20260722-r43"/, 'r47 must preserve the shared replay sampler cache');
assert.match(index, /"\.\/race\/track-spatial-index\.js\?build=20260720-r19": "\.\/race\/track-spatial-index\.js\?build=20260722-r47"/, 'r47 must use the rebuildable bounded track search');
assert.match(index, /"\.\/performance-monitor\.js\?build=20260720-r19": "\.\/performance-monitor\.js\?build=20260722-r43"/, 'r47 must preserve the diagnostics module');
assert.match(index, /"\.\/world-assets\.js": "\.\/world-assets\.js\?build=20260722-r44"/, 'r47 must preserve both countryside tree-grounding passes');
assert.match(app, /installPerformanceProfile\(\)/, 'Renderer profile installation must run before the game runtime');
assert.ok(app.indexOf('./performance-profile.js') < app.indexOf('./main.js'), 'The universal DPR cap must be ready before main.js creates the runtime');
assert.match(profile, /DEFAULT_DPR_CAP = 1\.5/, 'The universal production DPR ceiling must stay at 1.5');
assert.match(profile, /MAX_DPR_CAP = 1\.5/, 'Diagnostics must never restore the retired DPR 2 tier');
assert.match(profile, /if \(!runtime\?\.renderer\) return;/, 'The universal renderer profile must apply even without a diagnostic override');
assert.doesNotMatch(profile, /if \(!profile\.active \|\| !runtime\?\.renderer\) return;/, 'Normal play must not bypass the universal DPR cap');
assert.match(profile, /renderer\.setPixelRatio = \(value\) =>/, 'The DPR cap must survive TURN resize calls');
assert.match(profile, /renderer\.shadowMap\.enabled = profile\.shadowsEnabled/, 'Shadow A/B testing must remain available without a second loop');
assert.doesNotMatch(profile, /requestAnimationFrame|setAnimationLoop|setInterval/, 'Performance profiles must add no animation loop');
assert.match(worldAssets, /groundSink = 0/, 'Only explicitly sunk base-world assets may move below terrain');
assert.match(worldAssets, /model\.position\.y -= groundSink/, 'The first tree belt must sink in shared placement rather than edit the source asset');
assert.match(worldAssets, /groundSink: targetHeight \* 0\.07/, 'The first tree-belt bases must remain buried proportionally at both tree sizes');
assert.match(worldRender, /TREE_CLUSTER_SINK_RATIO = 0\.07/, 'Late forest clusters must use the same proportional grounding as the first tree belt');
assert.match(worldRender, /const beautyBaselineChildren = new Set\(world\.children\)/, 'Late tree grounding must only inspect scenery added by the beauty pass');
assert.match(worldRender, /groundLateTreeClusters\(world, beautyBaselineChildren\)/, 'Late forest clusters must be grounded after asynchronous beauty assets finish loading');
assert.match(worldRender, /size\.x >= 5\s*&& size\.z >= 5/, 'The late grounding filter must stay restricted to broad tree-cluster groups');
assert.doesNotMatch(worldRender, /requestAnimationFrame|setAnimationLoop|setInterval/, 'Tree grounding must stay a one-time scenery setup cost');
assert.match(replay, /const replayFrameCache = new WeakMap\(\)/, 'Replay interpolation must cache the last sample per saved lap');
assert.match(replay, /return cached\.frame/, 'Repeated same-time replay lookups must take the cache fast path');
assert.match(monitor, /profile: currentPerformanceProfile\(\)/, 'Every performance snapshot must record its active renderer profile');
assert.match(monitor, /actual DPR/, 'The overlay must distinguish requested profile from actual renderer DPR');
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
assert.match(audio, /AUDIO_UPDATE_INTERVAL_MS = 1000 \/ 30/, 'Audio state must stay capped at 30 Hz');
assert.doesNotMatch(audio, /requestAnimationFrame|setAnimationLoop|setInterval/, 'New sound cues must not add a second loop');
assert.doesNotMatch(orientationCompat, /requestAnimationFrame|setAnimationLoop|setInterval/, 'The orientation guard must remain event-driven and add no render loop');
assert.match(monitor, /turn:perf-snapshot/);
assert.match(monitor, /trackChecksPerQuery/);

console.log(`TURN universal DPR, complete tree grounding, rebuildable bounded spatial search and diagnostics regression passed (${(trackChecks / trackQueries).toFixed(1)} average on-track checks vs 720).`);