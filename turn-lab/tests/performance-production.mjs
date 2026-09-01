import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTrackSpatialIndex, findNearestTrackBruteForce } from '../../turn/race/track-spatial-index.js';
import { performanceModeRequested, summarizeFrameSamples } from '../../turn/performance-monitor.js';
import {
  isLegacyTabletScreen,
  performanceProfileFromSearch,
  shadowsEnabledForTrack
} from '../../turn/performance-profile.js';
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

// Desktop/precise-pointer rendering keeps the established quality baseline.
const baselineProfile = performanceProfileFromSearch('?perf=1', 2, { touchOptimized: false });
assert.equal(baselineProfile.active, false, 'Perf diagnostics alone must not add a separate desktop quality tier');
assert.equal(baselineProfile.dprCap, 1.5, 'Desktop TURN must retain its DPR 1.5 ceiling');
assert.equal(baselineProfile.pixelRatio, 1.5);
assert.equal(baselineProfile.shadowsEnabled, true);
assert.equal(baselineProfile.shadowMapSize, 1024);
assert.equal(baselineProfile.touchOptimized, false);

// Touch hardware does the same gameplay work at a saner fill-rate/shadow cost.
const touchProfile = performanceProfileFromSearch('', 3, { touchOptimized: true });
assert.equal(touchProfile.active, false, 'Mobile thermal defaults are production behavior, not a diagnostic quality mode');
assert.equal(touchProfile.touchOptimized, true);
assert.equal(touchProfile.dprCap, 1.25, 'Touch devices must cap pixel density at 1.25 for long-session thermal headroom');
assert.equal(touchProfile.pixelRatio, 1.25);
assert.equal(touchProfile.shadowsEnabled, true);
assert.equal(touchProfile.shadowMapSize, 512, 'Touch devices must use the cheaper production shadow map');

const dprProfile = performanceProfileFromSearch('?perf=1&dpr=1.25', 2, { touchOptimized: false });
assert.equal(dprProfile.active, true);
assert.equal(dprProfile.dprCap, 1.25);
assert.equal(dprProfile.pixelRatio, 1.25);
assert.match(dprProfile.label, /DPR≤1\.25/);

const lowDprProfile = performanceProfileFromSearch('?perf=1&dpr=0.2', 2, { touchOptimized: false });
assert.equal(lowDprProfile.dprCap, 0.75, 'Diagnostic DPR overrides must stay within the safe lower bound');
const highDprProfile = performanceProfileFromSearch('?perf=1&dpr=9', 3, { touchOptimized: false });
assert.equal(highDprProfile.dprCap, 1.5, 'No diagnostic profile may exceed the desktop production cap');

const shadowProfile = performanceProfileFromSearch('?perf=1&shadow=512', 2, { touchOptimized: false });
assert.equal(shadowProfile.active, true);
assert.equal(shadowProfile.shadowsEnabled, true);
assert.equal(shadowProfile.shadowMapSize, 512);
const noShadowProfile = performanceProfileFromSearch('?perf=1&shadow=off', 2, { touchOptimized: false });
assert.equal(noShadowProfile.shadowsEnabled, false);
assert.match(noShadowProfile.label, /shadows off/);
const ignoredProfile = performanceProfileFromSearch('?dpr=1&shadow=off', 2, { touchOptimized: false });
assert.equal(ignoredProfile.active, false, 'Renderer overrides must be ignored outside explicit perf mode');
assert.equal(ignoredProfile.dprCap, 1.5);
assert.equal(ignoredProfile.pixelRatio, 1.5, 'Normal desktop play must retain the desktop DPR cap');
assert.equal(ignoredProfile.shadowsEnabled, true);

const touchDiagnosticOverride = performanceProfileFromSearch('?perf=1&dpr=1.5&shadow=1024', 3, { touchOptimized: true });
assert.equal(touchDiagnosticOverride.active, true, 'Perf mode may deliberately restore heavier settings for A/B diagnosis');
assert.equal(touchDiagnosticOverride.dprCap, 1.5);
assert.equal(touchDiagnosticOverride.shadowMapSize, 1024);

// The 10.2-inch legacy iPad class keeps all MOUNTAIN lights but skips the
// expensive global shadow map on that track only.
const legacyTabletProfile = performanceProfileFromSearch('', 2, {
  touchOptimized: true,
  legacyTablet: true
});
assert.equal(legacyTabletProfile.legacyTablet, true);
assert.equal(legacyTabletProfile.shadowOverride, false);
assert.equal(shadowsEnabledForTrack(legacyTabletProfile, 'mountain'), false,
  'Legacy tablets must skip MOUNTAIN track shadows');
assert.equal(shadowsEnabledForTrack(legacyTabletProfile, 'countryside'), true,
  'Legacy-tablet shadows must return on every other track');
assert.equal(shadowsEnabledForTrack(touchProfile, 'mountain'), true,
  'Modern touch devices must retain MOUNTAIN shadows');

const legacyTabletShadowOverride = performanceProfileFromSearch('?perf=1&shadow=512', 2, {
  touchOptimized: true,
  legacyTablet: true
});
assert.equal(legacyTabletShadowOverride.shadowOverride, true);
assert.equal(shadowsEnabledForTrack(legacyTabletShadowOverride, 'mountain'), true,
  'Explicit perf diagnostics must be able to restore MOUNTAIN shadows for A/B checks');
assert.equal(shadowsEnabledForTrack(noShadowProfile, 'countryside'), false,
  'The global no-shadow diagnostic must still win on every track');
assert.equal(isLegacyTabletScreen({ touchOptimized: true, width: 1080, height: 810 }), true,
  'The iPad 9 CSS screen size must receive the MOUNTAIN shadow reduction');
assert.equal(isLegacyTabletScreen({ touchOptimized: true, width: 852, height: 393 }), false,
  'The iPhone 16 must not be mistaken for a legacy tablet');
assert.equal(isLegacyTabletScreen({ touchOptimized: true, width: 1180, height: 820 }), false,
  'Newer full-size iPads must retain the complete MOUNTAIN shadow treatment');
assert.equal(isLegacyTabletScreen({ touchOptimized: false, width: 1080, height: 810 }), false,
  'A same-sized precise-pointer display must retain normal shadows');

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

const [
  index,
  releaseSource,
  app,
  main,
  worldAssets,
  worldRender,
  controls,
  menu,
  spectate,
  hud,
  physics,
  camera,
  cars,
  lot,
  trophyShowcase,
  monitor,
  profile,
  replay,
  audio,
  orientationCompat,
  airportWorld,
  airportPolish,
  worldCollision
] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
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
  fs.readFile(new URL('../../turn/achievements/trophy-road-showcase.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/performance-monitor.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/performance-profile.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/replay-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/orientation-compat.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/airport-world-r50.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/airport-world-r51.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/world-collision.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;
const releaseTarget = (path) => `${path}?build=${release.cacheKey}`;

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.equal(imports['./race/replay-system.js'], releaseTarget('./race/replay-system.js'), 'The current release must publish the shared replay sampler cache');
assert.equal(imports['./race/track-spatial-index.js?build=20260720-r19'], releaseTarget('./race/track-spatial-index.js'), 'The current release must publish the rebuildable bounded track search');
assert.equal(imports['./performance-monitor.js?build=20260720-r19'], releaseTarget('./performance-monitor.js'), 'The current release must publish the diagnostics module');
assert.equal(
  imports['./world-assets.js'],
  `${releaseTarget('./world-assets.js')}&revision=r532-countryside-nature-polish`,
  'The current release must publish the fresh planned Countryside world pass'
);
assert.equal(
  imports['/turn/achievements/trophy-road-showcase.js?revision=r160-reward-detail-sync'],
  '/turn/achievements/trophy-road-showcase.js?revision=r220-race-reward',
  'Trophy Road must receive the fresh throttled preview renderer instead of a cached full-refresh module'
);
assert.match(app, /performance-profile\.js\?revision=r187-legacy-tablet-mountain-shadows/,
  'The installed runtime must request the track-aware mobile shadow profile under a fresh URL');
assert.match(app, /installPerformanceProfile\(\)/, 'Renderer profile installation must run before gameplay starts');
assert.ok(app.indexOf('./performance-profile.js') < app.indexOf('./main.js'), 'The DPR cap must be ready before main.js creates the runtime');
assert.match(profile, /DEFAULT_DPR_CAP = 1\.5/, 'Desktop production DPR ceiling must stay at 1.5');
assert.match(profile, /TOUCH_DPR_CAP = 1\.25/, 'Touch production must reserve thermal headroom with DPR 1.25');
assert.match(profile, /TOUCH_SHADOW_MAP_SIZE = 512/, 'Touch devices must use the cheaper 512px shadow map');
assert.match(profile, /maxTouchPoints/);
assert.match(profile, /pointer: coarse/);
assert.match(profile, /LEGACY_TABLET_MAX_LONG_SIDE = 1080/,
  'The legacy-tablet policy must include the iPad 9 landscape width');
assert.match(profile, /LEGACY_TABLET_MIN_SHORT_SIDE = 700/,
  'Phones must remain outside the legacy-tablet policy');
assert.match(profile, /function shadowsEnabledForTrack\(profile, trackId\)/);
assert.match(profile, /function isLegacyTabletScreen\(/);
assert.match(profile, /normalizedTrackId === MOUNTAIN_TRACK_ID/,
  'The production shadow reduction must be restricted to MOUNTAIN');
assert.match(profile, /renderer\.shadowMap\.enabled = enabled/,
  'Track changes must apply the resolved shadow policy to the renderer');
assert.match(profile, /globalThis\.__turnTrackShadowPolicy = diagnostics/,
  'Perf diagnostics must expose the active track shadow policy');
assert.match(profile, /MAX_DPR_CAP = 1\.5/, 'Diagnostics must never restore the retired DPR 2 tier');
assert.match(profile, /if \(!runtime\?\.renderer\) return;/, 'The renderer profile must apply even without a diagnostic override');
assert.doesNotMatch(profile, /if \(!profile\.active \|\| !runtime\?\.renderer\) return;/, 'Normal play must not bypass its device-appropriate DPR cap');
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
assert.match(worldRender, /const worldSamples = samples\.slice\(\)/, 'Async Countryside art must use an immutable Track 1 sample snapshot');
assert.doesNotMatch(worldRender, /requestAnimationFrame|setAnimationLoop|setInterval/, 'Tree grounding must stay a one-time scenery setup cost');
assert.match(replay, /const replayFrameCache = new WeakMap\(\)/, 'Replay interpolation must cache the last sample per saved lap');
assert.match(replay, /return cached\.frame/, 'Repeated same-time replay lookups must take the cache fast path');
assert.match(monitor, /profile: currentPerformanceProfile\(\)/, 'Every performance snapshot must record its active renderer profile');
assert.match(monitor, /shadowPolicy: currentTrackShadowPolicy\(\)/,
  'Every performance snapshot must report a track-specific shadow reduction');
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
assert.match(lot, /LOT_FRAME_INTERVAL_MS = 1000 \/ 30/,
  'The two-renderer Lot surface must not render at 60/120 Hz');
assert.match(lot, /now - lastRenderAt < LOT_FRAME_INTERVAL_MS/);
assert.match(lot, /rendererPixelRatio\(1\.5\)/,
  'Both Lot renderers must inherit the production touch DPR cap');
assert.match(lot, /renderer\.forceContextLoss\?\.\(\)/,
  'Closing The Lot must release its WebGL context instead of accumulating contexts across visits');
assert.match(lot, /function disposeVisualMaterials\(/,
  'Repeated 3D viewer swaps must release cloned materials');
assert.doesNotMatch(lot, /geometry\.dispose/,
  'The Lot must not dispose shared cached vehicle geometries while releasing per-view materials');
assert.doesNotMatch(lot, /GLTFLoader|InstancedMesh|installBrickScenery/, 'The clean Lot must not spend asset or draw-call budget on decorative wall scenery');
assert.match(trophyShowcase, /SHOWCASE_FRAME_INTERVAL_MS = 1000 \/ 30/,
  'Trophy Road decorative 3D models must stay at 30 fps');
assert.match(trophyShowcase, /now - lastRenderAt < SHOWCASE_FRAME_INTERVAL_MS/);
assert.match(trophyShowcase, /__turnPerformanceProfile\?\.dprCap/);
assert.match(trophyShowcase, /renderer\?\.forceContextLoss\?\.\(\)/,
  'Closing the Achievements renderer must release its WebGL context');
assert.match(audio, /AUDIO_UPDATE_INTERVAL_MS = 1000 \/ 30/, 'Audio state must stay capped at 30 Hz');
assert.doesNotMatch(audio, /requestAnimationFrame|setAnimationLoop|setInterval/, 'New sound cues must not add a second loop');
assert.doesNotMatch(orientationCompat, /requestAnimationFrame|setAnimationLoop|setInterval/, 'The orientation guard must remain event-driven and add no render loop');
assert.doesNotMatch(airportWorld, /requestAnimationFrame|setAnimationLoop|setInterval/, 'The redesigned Airport world must stay a one-time setup cost');
assert.match(airportWorld, /new THREE\.Box3\(\)\.setFromObject\(object\)/, 'Airport safety must use measured object bounds without adding a runtime loop');
assert.doesNotMatch(airportPolish, /requestAnimationFrame|setAnimationLoop|setInterval/, 'The Airport polish layer must remain a one-time setup cost');
assert.doesNotMatch(worldCollision, /requestAnimationFrame|setAnimationLoop|setInterval/, 'World containment must run inside the existing fixed physics step without adding another loop');
assert.match(monitor, /turn:perf-snapshot/);
assert.match(monitor, /trackChecksPerQuery/);

console.log(`TURN ${release.id} mobile thermal profile, 30fps menu 3D, world containment, bounded spatial search and diagnostics passed (${(trackChecks / trackQueries).toFixed(1)} average on-track checks vs 720).`);
