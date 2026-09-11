import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [storage, sharing, chromatic, rivalOnboarding, index, shareBootstrap] = await Promise.all([
  fs.readFile(new URL('../../turn/race/rival-storage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/social/your-turn-share.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/chromatic-camouflage-r183.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/rival-onboarding.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/social/your-turn-share-bootstrap.js', import.meta.url), 'utf8')
]);

const bestLapSummary = storage.match(
  /export function getStoredBestLap\([\s\S]*?\n\}/
)?.[0] || '';
assert.ok(bestLapSummary, 'Rival storage must expose a best-lap summary API');
assert.match(bestLapSummary, /readBestLapRecord/,
  'Best-lap metadata must use the summary record path');
assert.doesNotMatch(bestLapSummary, /getStoredBestReplayLap|frames\.map/,
  'Best-lap metadata must never clone full replay frames');
assert.match(storage, /bestLapSummaryCache = new Map\(\)/,
  'Repeated Home and achievement metadata reads should reuse cached best-lap summaries');
assert.match(storage, /pendingRivalPayload\(activeTrackId\)/,
  'Summary reads must see a freshly queued rival save without waiting for localStorage persistence');

const lapResultListener = sharing.match(
  /window\.addEventListener\('turn:lap-result',[\s\S]*?\n  \}\);/
)?.[0] || '';
assert.ok(lapResultListener, 'YOUR TURN must keep its lap-result integration');
assert.match(lapResultListener, /runtime\?\.state\?\.competitorLaps\?\.\[0\]/,
  'Lap-result sharing must use the just-finished runtime replay already in memory');
assert.doesNotMatch(lapResultListener, /getStoredBestReplayLap|syncTrackShareButtons/,
  'The crossing frame must not reread replay blobs or rescan Home share controls');
assert.match(sharing, /shareButtonsDirty = true/,
  'Lap completion should only mark Home share controls dirty');
assert.match(sharing, /if \(shareButtonsDirty\) syncTrackShareButtons\(\)/,
  'Dirty share controls should refresh after racing leaves the hot path');

assert.match(chromatic, /requestIdleCallback\(runScheduledEvaluation, \{ timeout: 1200 \}\)/,
  'Chromatic Camouflage must defer its six-track evaluation until browser idle time');
assert.match(chromatic, /addEventListener\?\.\('turn:lap-result', scheduleEvaluation\)/,
  'Lap completion should schedule rather than execute the Chromatic evaluation synchronously');

assert.match(rivalOnboarding, /scheduleRaceRivalWarmup\(\)/,
  'Loaded stored rivals must schedule a pre-race GPU warm-up');
assert.match(rivalOnboarding, /scheduleRaceRivalWarmup\(\{ racing: true \}\)/,
  'Race start must retry the warm-up before the first timing-line crossing');
assert.match(rivalOnboarding, /renderer\.compileAsync\(warm\.scene, warm\.camera, runtime\.scene\)/,
  'Stored-rival shaders must compile asynchronously on the main race WebGL context');
assert.match(rivalOnboarding, /new THREE\.WebGLRenderTarget\(/,
  'Stored-rival geometry and textures must receive one off-screen warm render');
assert.match(rivalOnboarding, /renderer\.setRenderTarget\(target\)/,
  'The GPU warm-up must stay off the visible gameplay framebuffer');

assert.match(index, /rival-storage\.js\?build=20260909-r212&revision=r224-finish-line-summary/,
  'Production must publish the summary-only rival-storage hot path under a fresh cache identity');
assert.match(index, /rival-onboarding\.js\?build=20260909-r212&revision=r277-main-rival-gpu-warmup/,
  'Production must publish the main-renderer rival warm-up under a fresh cache identity');
assert.match(index, /chromatic-camouflage-r183\.js\?revision=r184-idle-summary-check/,
  'Production must publish the deferred Chromatic evaluator under a fresh cache identity');
assert.match(index, /your-turn-share-bootstrap\.js\?revision=r3-lap-result-hot-path/,
  'Production must publish the finish-line sharing fix under a fresh cache identity');
assert.match(shareBootstrap, /your-turn-share\.js\?revision=r3-lap-result-hot-path/,
  'The refreshed sharing bootstrap must request the optimized sharing module');

console.log('TURN start/finish-line performance contracts passed.');
