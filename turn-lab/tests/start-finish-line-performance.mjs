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

assert.match(sharing, /const shareStateByTrack = new Map\(\)/,
  'YOUR TURN must own lightweight in-memory sharing state for the active browser session');
assert.match(sharing, /Hydrate once[\s\S]*getStoredBestLap\(track\.id\)[\s\S]*hasStoredBestReplayLap\(track\.id\)/,
  'Persistent rival metadata may seed YOUR TURN once during installation');

const shareButtonSync = sharing.match(
  /function syncTrackShareButtons\(\) \{[\s\S]*?\n  \}/
)?.[0] || '';
assert.ok(shareButtonSync, 'YOUR TURN must retain Home share-button synchronization');
assert.match(shareButtonSync, /shareStateFor\(trackId\)/,
  'Home share buttons must read session state');
assert.doesNotMatch(shareButtonSync, /getStoredBestLap|getStoredBestReplayLap|hasStoredBestReplayLap/,
  'Returning from a race to Home must not consult persistence for share-button state');

const lapResultListener = sharing.match(
  /window\.addEventListener\('turn:lap-result',[\s\S]*?\n  \}\);/
)?.[0] || '';
assert.ok(lapResultListener, 'YOUR TURN must keep its lap-result integration');
assert.match(lapResultListener, /runtime\?\.state\?\.competitorLaps\?\.\[0\]/,
  'Lap-result sharing must use the just-finished runtime replay already in memory');
assert.match(lapResultListener, /setShareState\(trackId/,
  'Lap completion must update the in-memory source of truth directly');
assert.doesNotMatch(lapResultListener, /getStoredBestLap|getStoredBestReplayLap|hasStoredBestReplayLap|syncTrackShareButtons/,
  'The crossing frame must neither consult persistence nor rescan Home share controls');

const rivalResetListener = sharing.match(
  /window\.addEventListener\('turn:rivals-reset',[\s\S]*?\n  \}\);/
)?.[0] || '';
assert.ok(rivalResetListener, 'YOUR TURN must keep rival-reset integration');
assert.match(rivalResetListener, /setShareState/,
  'Rival reset must update session sharing state directly');
assert.doesNotMatch(rivalResetListener, /getStoredBestLap|getStoredBestReplayLap|hasStoredBestReplayLap/,
  'Rival reset must not rebuild session UI state by rereading persistence');

assert.match(sharing, /shareButtonsDirty = true/,
  'Lap completion should only mark Home share controls dirty');
assert.match(sharing, /if \(shareButtonsDirty\) syncTrackShareButtons\(\)/,
  'Dirty share controls should refresh after racing leaves the hot path');
assert.match(sharing, /reason === 'rivals-loaded'[\s\S]*updateActiveTrackShareStateFromRuntime/,
  'Track loading must refresh the active session share state from runtime rather than persistence');

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
  'Production must publish the summary-only rival-storage path under a fresh cache identity');
assert.match(index, /rival-onboarding\.js\?build=20260909-r212&revision=r277-main-rival-gpu-warmup/,
  'Production must publish the main-renderer rival warm-up under a fresh cache identity');
assert.match(index, /chromatic-camouflage-r183\.js\?revision=r184-idle-summary-check/,
  'Production must publish the deferred Chromatic evaluator under a fresh cache identity');
assert.match(index, /your-turn-share-bootstrap\.js\?revision=r4-runtime-share-state/,
  'Production must publish the runtime-authoritative sharing fix under a fresh bootstrap identity');
assert.match(shareBootstrap, /your-turn-share\.js\?revision=r4-runtime-share-state/,
  'The refreshed sharing bootstrap must request the runtime-authoritative sharing module');

console.log('TURN start/finish-line performance contracts passed.');
