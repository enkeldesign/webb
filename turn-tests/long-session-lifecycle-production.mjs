import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  index,
  labIndex,
  releaseSource,
  app,
  fixedLayout,
  achievementsFacade,
  achievementRuntime,
  performanceProfile,
  worldAssets,
  worldRender,
  bellaRescue,
  bellaBootstrap,
  screenReaderCoordinator,
  harborOptimized
] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/performance-profile.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/world-assets.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/render/world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/countryside-bella-rescue-r173.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/countryside-bella-rescue-hotfix-r176.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/startup-screen-reader-handoff-r529.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/harbor-world-r82.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);

function importMap(source) {
  const json = source.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(json, 'TURN entry must expose an import map');
  return JSON.parse(json).imports;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const productionImports = importMap(index);
const labImports = importMap(labIndex);
const optimizedWorldAssetTarget = `./world-assets.js?build=${release.cacheKey}&revision=r532-countryside-nature-polish`;
const optimizedHarborTarget = `./tracks/harbor-world-r82.js?build=${release.cacheKey}&revision=r164-long-session-robustness`;

assert.equal(
  productionImports['./world-assets.js'],
  optimizedWorldAssetTarget,
  'Production must request the tree-optimized shared world assets under a fresh module identity'
);
assert.equal(
  labImports['./world-assets.js'],
  optimizedWorldAssetTarget,
  'TURN LAB must exercise the same tree-optimized world asset module as production'
);
assert.equal(
  productionImports['./tracks/harbor-world.js'],
  optimizedHarborTarget,
  'Production Harbor must use the draw-call-batched container-yard layer'
);
assert.equal(
  labImports['./tracks/harbor-world.js'],
  optimizedHarborTarget,
  'TURN LAB must use the same optimized Harbor world as production'
);
assert.match(
  app,
  /render\/world\.js\?revision=r532-countryside-nature-polish/,
  'The runtime must receive the planned Countryside world bootstrap through a fresh URL'
);
assert.match(
  worldRender,
  /countryside-bella-rescue-r173\.js\?revision=r164-long-session-robustness/,
  'The world bootstrap must request Bella’s on-demand audio lifecycle through a fresh URL'
);
assert.match(
  index,
  new RegExp(`countryside-bella-rescue-hotfix-r176\\.js\\?build=${escapeRegex(release.cacheKey)}&revision=r530-screen-reader-quality`),
  'Production must bind the independent Bella bootstrap to the current release cache identity'
);
assert.match(
  index,
  new RegExp(`startup-screen-reader-handoff-r529\\.js\\?build=${escapeRegex(release.cacheKey)}&revision=r531-screen-reader-followup`),
  'Production must bind the screen-reader coordinator follow-up to the current release cache identity'
);

// Touch hardware keeps 60 Hz gameplay but should not redraw the complete dynamic
// shadow map at 60 Hz too. The profile piggybacks the existing renderer call rather
// than adding another timer or animation loop.
assert.match(performanceProfile, /TOUCH_SHADOW_REFRESH_INTERVAL_MS = 1000 \/ 30/);
assert.match(performanceProfile, /function installTouchShadowRefreshCap\(renderer, profile, runtime\)/);
assert.match(performanceProfile, /renderer\.shadowMap\.autoUpdate = false/,
  'Touch rendering should explicitly own shadow refresh cadence');
assert.match(performanceProfile, /renderer\.userData\.turnOriginalRender = originalRender/,
  'The runtime renderer must only be wrapped once');
assert.match(performanceProfile, /now - lastShadowRefreshAt >= TOUCH_SHADOW_REFRESH_INTERVAL_MS/);
assert.match(performanceProfile, /renderer\.shadowMap\.needsUpdate = true/);
assert.match(performanceProfile, /syncTrackShadowPolicy\(\)/,
  'Touch shadow throttling must update its policy when the selected track changes');
assert.match(performanceProfile, /renderer\.shadowMap\.enabled = enabled/,
  'The renderer must restore normal shadows after leaving legacy-tablet MOUNTAIN');
assert.match(performanceProfile, /renderer\.shadowMap\.autoUpdate = true/,
  'Desktop and non-touch rendering must retain full-refresh shadow behavior');
assert.doesNotMatch(performanceProfile, /setInterval|requestAnimationFrame|setAnimationLoop/,
  'Shadow throttling must add no independent scheduling loop');

// Achievements need 100 ms samples while driving, but should contribute zero timer
// wake-ups while the player is on Home, in The Lot, backgrounded, or otherwise idle.
assert.match(achievementRuntime, /const SAMPLE_INTERVAL_MS = 100/);
assert.match(achievementRuntime, /samplingTimer: 0/);
assert.match(achievementRuntime, /function startDrivingSampler\(\)/);
assert.match(achievementRuntime, /function stopDrivingSampler\(\)/);
assert.match(achievementRuntime, /function syncDrivingSampler\(\)/);
assert.match(
  achievementRuntime,
  /const active = state\?\.running === true \|\| state\?\.lapActive === true/,
  'Achievement sampling must be scoped to active driving state'
);
assert.match(
  achievementRuntime,
  /session\.samplingTimer = window\.setInterval\(sampleDrivingState, SAMPLE_INTERVAL_MS\)/,
  'The 100 ms sampler should only be created by its lifecycle helper'
);
assert.equal(
  (achievementRuntime.match(/window\.setInterval\(sampleDrivingState, SAMPLE_INTERVAL_MS\)/g) || []).length,
  1,
  'There must be one controlled achievement sampling interval, not duplicate or unconditional samplers'
);
assert.match(
  achievementRuntime,
  /document\.addEventListener\('visibilitychange', syncDrivingSampler, \{ passive: true \}\)/,
  'Backgrounding must stop the achievement sampler'
);
assert.doesNotMatch(
  achievementRuntime,
  /importStoredTimeTrials\(\);\s*window\.setInterval\(sampleDrivingState/,
  'Achievement installation must never start an unconditional all-session 10 Hz timer'
);
assert.match(
  fixedLayout,
  /achievements\.js\?build=\$\{buildKey\}-r166-bella-records&robustness=r164-long-session/,
  'Home must request the facade containing the lifecycle-optimized achievement runtime under a fresh URL'
);
assert.match(
  achievementsFacade,
  /achievements\/runtime\.js\?revision=r240-trophy-road-2/,
  'The achievement facade must cache-bust the race-scoped sampler and Trophy Road implementation'
);

// The screen-reader coordinator may discover dynamic live regions while Home is being
// assembled, but it must not keep a document-wide observer or polling loop alive for
// the rest of a long race session. The follow-up also protects the user-facing speech
// contracts that depend on this coordinator.
assert.match(screenReaderCoordinator, /discoveryObserver = new MutationObserver/);
assert.match(screenReaderCoordinator, /discoveryObserver\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
assert.match(screenReaderCoordinator, /discoveryObserver\?\.disconnect\(\);\s*discoveryObserver = null;/,
  'The broad accessibility discovery observer must disconnect once Home is ready');
assert.doesNotMatch(screenReaderCoordinator, /setInterval/,
  'Screen-reader coordination must not add an independent polling interval');
assert.match(
  screenReaderCoordinator,
  /return `\$\{dbe\}% Drive By Ear, \$\{other\}% other sounds\$\{balance\}`/,
  'Sound balance must expose percentages at every slider position rather than repeating Balanced across a range'
);
assert.match(screenReaderCoordinator, /navigation\.innerHTML = `[\s\S]*Non-visual onboarding[\s\S]*Drive By Ear 101/,
  'Home accessibility shortcuts must put Non-visual onboarding before Drive By Ear 101');
assert.match(screenReaderCoordinator, /function scheduleNonVisualOnboarding\(\)[\s\S]*if \(viewportIsPortrait\(\)\) return;[\s\S]*speak\(`TURN is ready\. \$\{NON_VISUAL_ONBOARDING_MESSAGE\}`, \{ priority: 'assertive' \}\)/,
  'The one-time non-visual onboarding must remain assertive but wait until landscape is confirmed');
assert.match(screenReaderCoordinator, /if \(viewportIsPortrait\(\)\) \{\s*speak\('TURN is ready\. Rotate your device to landscape\.', \{ priority: 'assertive' \}\);\s*\} else \{\s*scheduleNonVisualOnboarding\(\);/,
  'Portrait startup must not append the non-visual onboarding before the OS landscape announcement has cleared');
assert.match(screenReaderCoordinator, /summary\.setAttribute\('aria-hidden', 'true'\)/,
  'Track cards must expose their composed button name once rather than repeating the visible summary');
assert.match(screenReaderCoordinator, /window\.addEventListener\('turn:dbe-training-stage-started'/,
  'Training speech must follow the exact stage-start event rather than the earlier track-swap event');
assert.match(screenReaderCoordinator, /clearSpeechChannel\(TRAINING_SPEECH_CHANNEL\)/,
  'Moving to another DBE part must cancel stale queued instructions');
assert.match(screenReaderCoordinator, /speak\(`\$\{instructions\} Go!`, \{[\s\S]*priority: 'assertive'[\s\S]*channel: TRAINING_SPEECH_CHANNEL/,
  'DBE instructions and the single GO cue must be one ordered assertive utterance');

// Repeated vegetation is a poor place to spend a second draw call per source mesh.
// Buildings/start landmarks may keep intentional contours; tree belts opt out before
// the broad compatibility art pass can add enlarged back-face shells.
assert.match(worldAssets, /suppressAutoOutline = false/);
assert.match(
  worldAssets,
  /if \(suppressAutoOutline\) node\.userData\.turnOutlined = true/,
  'Shared model preparation must expose a marker understood by the world contour pass'
);
assert.match(
  worldAssets,
  /function placeTreeBelt[\s\S]*suppressAutoOutline: true/,
  'The repeated Countryside tree belt must not receive duplicate contour meshes'
);
assert.match(
  worldAssets,
  /function placeStartArea[\s\S]*outline: true/,
  'Intentional start-area silhouettes should remain available rather than globally removing TURN outlines'
);
assert.match(worldRender, /function suppressTreeClusterContours\(/);
assert.match(worldRender, /if \(isContourShell\(node\)\)/);
assert.match(worldRender, /for \(const shell of contourShells\) shell\.parent\?\.remove\(shell\)/);
assert.match(
  worldRender,
  /node\.userData\.turnOutlined = true/,
  'Late tree clusters must remain opted out after any already-created contour shell is stripped'
);
assert.match(
  worldRender,
  /suppressTreeClusterContours\(child\)/,
  'Late forest clusters must be de-contoured as part of their one-time grounding pass'
);

// Harbor used to keep one MeshStandardMaterial shell plus a separate wireframe mesh for
// every container. Grouping identical geometry by paint colour retains the yard while
// collapsing those permanent draw calls to a handful of InstancedMesh batches.
assert.match(harborOptimized, /installHarborWorldR81/);
assert.match(harborOptimized, /function batchContainerYards\(world\)/);
assert.match(harborOptimized, /const shellsByColor = new Map\(\)/);
assert.match(harborOptimized, /new THREE\.InstancedMesh\(containerGeometry, material, entries\.length\)/);
assert.match(harborOptimized, /new THREE\.InstancedMesh\(ribGeometry, ribMaterial, ribs\.length\)/);
assert.match(harborOptimized, /batch\.castShadow = true/,
  'Batching must preserve the established container shadows');
assert.match(harborOptimized, /batch\.receiveShadow = true/,
  'Batching must preserve the established container shadow reception');
assert.match(harborOptimized, /gameplayGeometryUnchanged: true/,
  'Harbor batching must remain a rendering-only optimization');
assert.doesNotMatch(harborOptimized, /setAnimationLoop|requestAnimationFrame|setInterval/,
  'The Harbor optimization must add no independent runtime loop');

// Bella may use a tiny separate Web Audio context, but ordinary TURN sessions should
// never keep a third live context merely because the rescue behavior is installed.
assert.match(bellaRescue, /function meowContextWanted\(/);
assert.match(
  bellaRescue,
  /activeTrackId\(runtime\) === 'countryside'[\s\S]*vehicleId \|\| ''\)\.toLowerCase\(\) === REQUIRED_VEHICLE_ID[\s\S]*otherSoundPreference\(\) > 0\.001[\s\S]*document\.visibilityState !== 'hidden'/,
  'Bella audio should be eligible only for a visible Countryside Fire Truck run with other sounds enabled'
);
assert.match(
  bellaRescue,
  /function unlockMeowContext\(\)[\s\S]*if \(meowContextWanted\(\)\) ensureMeowContext\(\)/,
  'Ordinary pointer/key gestures must not eagerly create Bella’s AudioContext'
);
assert.doesNotMatch(
  bellaRescue,
  /function unlockMeowContext\(\) \{\s*ensureMeowContext\(\)/,
  'Bella’s old eager gesture-unlock behavior must not return'
);
assert.match(bellaRescue, /function suspendMeowContext\(\)/);
assert.match(
  bellaRescue,
  /if \(!eligible \|\| document\.hidden\) \{[\s\S]*suspendMeowContext\(\)/,
  'Leaving the eligible rescue state must suspend Bella audio rather than leaving another running context'
);
assert.match(
  bellaRescue,
  /meowContext\.close\?\.\(\)[\s\S]*meowContext = null/,
  'Disposing the rescue behavior must close and release Bella’s context'
);
assert.match(bellaBootstrap, /countryside-bella-rescue-r173\.js\?revision=r164-long-session-robustness/);
assert.match(bellaBootstrap, /RETRY_DELAYS_MS = Object\.freeze/);
assert.doesNotMatch(bellaBootstrap, /setInterval/,
  'The independent Bella bootstrap must use bounded startup retries rather than a fixed polling interval');

console.log(`TURN ${release.id} long-session timers, touch shadows, accessibility observers, screen-reader speech contracts, scenery batching/contours, cache and Bella audio lifecycle passed.`);
