import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  paintReward,
  achievementView,
  achievementRuntime,
  achievementStore,
  colorAccessibility,
  homeLayout,
  worldRender,
  rivalStorage,
  lapSystem,
  mainSource,
  rivalOnboarding,
  trackRegistry,
  trackManager
] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/lot-paint-reward.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/store.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-accessibility-r163.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/rival-storage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/rival-onboarding.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/track-manager.js', import.meta.url), 'utf8')
]);

// CHROMATIC CAMOUFLAGE matches the primary/body paint only. The visible Color Cue must
// therefore describe that same signal rather than mixing in bumpers, trim or fixed livery.
assert.match(paintReward, /function colorCueDescription\(car\)[\s\S]*describeColorCue\(bodyColorValue\(car\.id\)\)/);
const colorCueFunction = paintReward.match(/  function colorCueDescription\(car\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert.ok(colorCueFunction, 'Lot paint gate must keep a dedicated Color Cue description function');
assert.doesNotMatch(
  colorCueFunction,
  /secondary|fixedLivery|secondaryPaint/,
  'Lot Color Cue must communicate only the primary car color used by CHROMATIC CAMOUFLAGE'
);

// Achievement state changes happen while racing. Updating counters may invalidate the dialog,
// but rebuilding every card and Trophy Road marker while the dialog is closed is forbidden.
assert.match(achievementView, /let dialogDirty = true/);
assert.match(achievementView, /function render\(\{ force = false \} = \{\}\)/);
assert.match(achievementView, /if \(!force && !dialogIsOpen\(\)\)[\s\S]*dialogDirty = true;[\s\S]*return;/);
assert.match(achievementView, /render\(\{ force: true \}\)/,
  'Opening Achievements must perform the deferred full render');

// Toasts and trigger pulses may animate, but must not synchronously force layout in the race frame.
assert.doesNotMatch(achievementView, /\.offsetWidth|\.offsetHeight|getBoundingClientRect\(\)/,
  'Achievement hot paths must not force synchronous layout');
assert.match(achievementView, /requestAnimationFrame/,
  'Achievement entrance animations should cross a frame boundary without a forced reflow');

// CHASE YOUR BEST has its own WebGL context. The newer semantic car shaders make a first
// render there materially more expensive than the original r40 implementation, so the context,
// model and shader programs must be prepared before the first rival is saved/revealed.
const revealFunction = rivalOnboarding.match(/  function reveal\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
assert.ok(revealFunction, 'Rival onboarding must keep a bounded reveal function');
assert.doesNotMatch(revealFunction, /offsetWidth|offsetHeight|getBoundingClientRect|renderer\.render|renderFrame/,
  'CHASE YOUR BEST reveal must not force layout or perform a first WebGL render');
assert.match(revealFunction, /requestAnimationFrame/,
  'CHASE YOUR BEST should cross a frame boundary without a forced reflow');
assert.match(rivalOnboarding, /reason === 'race-started'[\s\S]*!hasRival && state[\s\S]*preparePreview\(state\)/,
  'The first-rival 3D preview must begin preparing during the first race, not at lap completion');
assert.match(rivalOnboarding, /requestIdleCallback\(prepare\)/,
  'Optional rival-preview context creation must wait for browser idle time when supported');
assert.match(rivalOnboarding, /renderer\.compileAsync\(scene, camera\)/,
  'The separate onboarding WebGL context must asynchronously precompile semantic car shaders');
assert.match(rivalOnboarding, /renderer\.render\(scene, camera\);\s*warmed = true;/,
  'The preview must warm one hidden frame before becoming eligible for visible rendering');
const previewStart = rivalOnboarding.match(/    start\(\) \{[\s\S]*?\n    \},/)?.[0] || '';
assert.ok(previewStart, 'Rival onboarding preview must expose a bounded start method');
assert.doesNotMatch(previewStart, /renderer\.render|renderFrame|compile/,
  'Starting the visible rival preview must never discover GPU programs synchronously');
assert.match(previewStart, /requestAnimationFrame\(tick\)/,
  'Visible rival rendering should begin on a later animation frame');

// One logical unlock batch may award multiple achievements and Trophy Road rewards. Persist it once.
assert.match(achievementStore, /function batch\(callback\)/);
assert.match(achievementStore, /batchDepth/);
assert.match(achievementStore, /savePending/);
assert.match(achievementRuntime, /store\.batch\(\(\) =>/,
  'Achievement runtime must batch synchronous persistence for one unlock event');

// The color accessibility observer lives for the entire app lifetime. It must ignore unrelated DOM
// churn (achievement toasts/dialogs, HUD updates, etc.) instead of rescanning Home and The Lot.
assert.match(colorAccessibility, /function mutationTouchesColorCueUi\(mutation\)/);
assert.match(
  colorAccessibility,
  /const observer = new MutationObserver\(\(mutations\) => \{[\s\S]*mutations\.some\(mutationTouchesColorCueUi\)[\s\S]*\}\);/,
  'The app-wide Color Cue observer must filter mutations before scheduling a global rescan'
);

// Large optional graphs can download/compile behind TURN's startup cover, but installation remains
// deferred until Home is ready/idle so user-visible lifecycle behavior stays unchanged.
const musicPrewarm = homeLayout.indexOf('const musicModulesPromise = Promise.all([');
const musicIdleGate = homeLayout.indexOf('await waitForPostHomeIdle();');
assert.ok(musicPrewarm >= 0 && musicIdleGate >= 0 && musicPrewarm < musicIdleGate,
  'Racing-music module graph must prewarm before the post-Home idle installation gate');

// Replay serialization can dwarf a toast update. Lap completion queues the four-rival payload
// for idle time and flushes it on page hide so the timed lap frame does not pay JSON/storage cost.
assert.match(mainSource, /function saveGhost\(\) \{[\s\S]*scheduleRivalsStateSave\(state\)/);
assert.doesNotMatch(mainSource, /function saveGhost\(\) \{[\s\S]*saveRivalsState\(state\)/);
assert.match(rivalStorage, /requestIdleCallback\(flush, \{ timeout: 800 \}\)/);
assert.match(rivalStorage, /addEventListener\?\.\('pagehide', flushScheduledRivalsState\)/);
assert.match(rivalStorage, /pendingRivalSaves = new Map\(\)/);
assert.match(lapSystem, /const candidateFrames = state\.recording;/,
  'Lap completion must transfer ownership of the replay buffer');
assert.doesNotMatch(lapSystem, /state\.recording\.map\(/,
  'Long-track finish-line work must not clone every replay frame synchronously');

// Home needs track metadata, not every track's complete Three.js world graph.
for (const worldModule of [
  'airport-world-r56.js',
  'cliffside-world.js',
  'harbor-world.js',
  'midnight-city-world-r11.js',
  'mountain-world-long.js'
]) {
  const escapedWorldModule = worldModule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(trackRegistry, new RegExp(`await import\\([\\s\\S]{0,160}${escapedWorldModule}`),
    `${worldModule} must load only after its track is selected`);
}
assert.doesNotMatch(trackRegistry, /^import\s+\{[^\n]*install(?:Airport|Cliffside|Harbor|MidnightCity|Mountain)World/m,
  'Track world installers must not return to the static startup graph');
assert.match(trackManager, /const nextState = await ensureTrackState\(nextTrack, currentRuntime\)/,
  'Track activation must await its selected lazy installer before swapping samples and worlds');
assert.match(trackManager, /const world = await entry\.installWorld\(/,
  'The track-state cache must store the resolved world rather than a pending Promise');

const worldPrewarm = worldRender.indexOf('const worldModulesPromise = loadWorldModules();');
const worldHomeGate = worldRender.indexOf('await waitForHomeBeforeCosmetics();');
assert.ok(worldPrewarm >= 0 && worldHomeGate >= 0 && worldPrewarm < worldHomeGate,
  'World cosmetic module graph must prewarm before Home while installation still waits for Home');

console.log('TURN runtime hot-path, observer, rival-preview and deferred-loading performance contracts passed.');
