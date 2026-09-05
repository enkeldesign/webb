import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  createTrackSpatialIndex,
  findNearestTrackBruteForce
} from '../turn/race/track-spatial-index.js';
import {
  DRIFT_ATTACK_SAMPLE_INTERVAL_SECONDS,
  createDriftAttackScorer
} from '../turn/scoring/drift-attack.js';
import { summarizePerformancePhases } from '../turn/performance-monitor.js';

const samplesA = [
  { point: { x: -20, z: 0 } },
  { point: { x: 0, z: 0 } },
  { point: { x: 20, z: 0 } },
  { point: { x: 40, z: 0 } }
];
const samplesB = [
  { point: { x: -20, z: 100 } },
  { point: { x: 0, z: 100 } },
  { point: { x: 20, z: 100 } },
  { point: { x: 40, z: 100 } }
];
const spatialIndex = createTrackSpatialIndex(samplesA, { cellSize: 16 });
const position = { x: 18, z: 3 };
const first = spatialIndex.find(position);
const afterFirst = spatialIndex.getStats();
const second = spatialIndex.find({ ...position });
const afterSecond = spatialIndex.getStats();
const brute = findNearestTrackBruteForce(samplesA, position);

assert.equal(first.index, brute.index);
assert.equal(second.index, brute.index,
  'An exact repeated physics position must retain the same nearest track sample');
assert.equal(second.distance, first.distance,
  'The zero-check reuse path must preserve the exact nearest-track distance');
assert.equal(second.checks, 0,
  'The second half of one physics step can seed the first half of the next step without another spatial scan');
assert.equal(afterSecond.queryCount, afterFirst.queryCount + 1,
  'Cached lookups remain visible to diagnostics as real queries');
assert.equal(afterSecond.totalChecks, afterFirst.totalChecks,
  'An exact repeated position performs no additional track-sample checks');
assert.equal(afterSecond.lastChecks, 0);

spatialIndex.replaceSamples(samplesB);
const afterReplace = spatialIndex.find(position);
const bruteAfterReplace = findNearestTrackBruteForce(samplesB, position);
assert.equal(afterReplace.index, bruteAfterReplace.index,
  'Replacing the active track must invalidate the repeated-position cache');
assert.equal(afterReplace.distance, bruteAfterReplace.distance);
assert.ok(afterReplace.checks > 0,
  'The first lookup after a track replacement must query the new index rather than reuse stale geometry');

const irregularScorer = createDriftAttackScorer();
irregularScorer.beginLap(0);
let elapsed = 0;
let now = 0;
const dts = [0.049, 0.031, 0.044, 0.027, 0.052, 0.036];
for (let index = 0; index < 120; index += 1) {
  const dt = dts[index % dts.length];
  elapsed += dt;
  now += dt * 1000;
  irregularScorer.advance(dt, now, 25, Math.PI / 3, false, false, true);
}
const expectedSamples = Math.floor((elapsed + Number.EPSILON) / DRIFT_ATTACK_SAMPLE_INTERVAL_SECONDS);
assert.equal(irregularScorer.inspect().sampleCount, expectedSamples,
  'DRIFT must retain fractional sample time instead of discarding it at irregular frame cadences');

assert.deepEqual(
  summarizePerformancePhases({ physics: 9, scoring: 3, hud: 1.5, render: 15 }, 3),
  { physicsMs: 3, scoringMs: 1, hudMs: 0.5, renderMs: 5 },
  'Perf diagnostics report CPU phase cost per delivered frame'
);

const [
  driftRuntimeSource,
  flowRuntimeSource,
  scoreFeedbackSource,
  scorekeeperSource,
  performanceSource,
  physicsSource,
  trackIndexSource
] = await Promise.all([
  fs.readFile(new URL('../turn/scoring/drift-attack-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/flow-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/score-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/scorekeeper-records.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/performance-monitor.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/track-spatial-index.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(driftRuntimeSource, /import ['"]\.\/scorekeeper-records\.js['"]/,
  'The DRIFT domain runtime must not bootstrap Scorekeeper presentation as an import side effect');
assert.match(scoreFeedbackSource, /import \{ installScorekeeperRecords \} from '\.\/scorekeeper-records\.js'/);
assert.match(scoreFeedbackSource, /installScorekeeperRecords\(\{ documentRef:/,
  'Scorekeeper is explicitly composed by the ScoreFeedback presentation layer');
assert.doesNotMatch(scorekeeperSource, /\ninstallScorekeeperRecords\(\);?\s*$/,
  'Importing Scorekeeper records alone must not mutate the document or attach listeners');
assert.equal((flowRuntimeSource.match(/scorer\.inspect\(\)/g) || []).length, 1,
  'One FLOW technique expiry should take one scorer snapshot instead of repeatedly allocating inspection objects');
assert.match(performanceSource, /globalThis\.__turnPerfRecordPhase/);
assert.match(performanceSource, /score HUD D:\$\{scoreHud\.drift\} · F:\$\{scoreHud\.flow\}/,
  'Perf mode must make the DRIFT/FLOW HUD A/B state explicit in its panel');
assert.match(performanceSource, /cpu\/frame phy/,
  'Perf mode must expose CPU phase timings next to the existing GPU/render diagnostics');
assert.match(physicsSource, /recordPhase\('physics'/,
  'Physics timing instrumentation must remain dormant behind the perf-mode hook');
assert.match(driftRuntimeSource, /recordPhase\('scoring'/);
assert.match(flowRuntimeSource, /recordPhase\('scoring'/);
assert.match(scoreFeedbackSource, /recordPhase\('hud'/);
assert.match(trackIndexSource, /function reuseLastResult\(x, z\)/);

console.log('TURN scoring performance and architecture regressions passed.');
