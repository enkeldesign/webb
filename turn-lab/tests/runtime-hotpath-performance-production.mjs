import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  paintReward,
  achievementView,
  achievementRuntime,
  achievementStore,
  colorAccessibility,
  homeLayout,
  worldRender
] = await Promise.all([
  fs.readFile(new URL('../../turn/progression/lot-paint-reward.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/view.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/achievements/store.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/accessibility/color-accessibility-r163.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/render/world.js', import.meta.url), 'utf8')
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

// One logical unlock batch may award multiple achievements and Trophy Road rewards. Persist it once.
assert.match(achievementStore, /function batch\(callback\)/);
assert.match(achievementStore, /batchDepth/);
assert.match(achievementStore, /savePending/);
assert.match(achievementRuntime, /store\.batch\(\(\) =>/,
  'Achievement runtime must batch synchronous persistence for one unlock event');

// The color accessibility observer lives for the entire app lifetime. It must ignore unrelated DOM
// churn (achievement toasts/dialogs, HUD updates, etc.) instead of rescanning Home and The Lot.
assert.match(colorAccessibility, /function mutationTouchesColorCueUi\(mutation\)/);
assert.doesNotMatch(colorAccessibility, /new MutationObserver\(scheduleSync\)/);
assert.match(colorAccessibility, /mutations\.some\(mutationTouchesColorCueUi\)/);

// Large optional graphs can download/compile behind TURN's startup cover, but installation remains
// deferred until Home is ready/idle so user-visible lifecycle behavior stays unchanged.
const musicPrewarm = homeLayout.indexOf('const musicModulesPromise = Promise.all([');
const musicIdleGate = homeLayout.indexOf('await waitForPostHomeIdle();');
assert.ok(musicPrewarm >= 0 && musicIdleGate >= 0 && musicPrewarm < musicIdleGate,
  'Racing-music module graph must prewarm before the post-Home idle installation gate');

const worldPrewarm = worldRender.indexOf('const worldModulesPromise = loadWorldModules();');
const worldHomeGate = worldRender.indexOf('await waitForHomeBeforeCosmetics();');
assert.ok(worldPrewarm >= 0 && worldHomeGate >= 0 && worldPrewarm < worldHomeGate,
  'World cosmetic module graph must prewarm before Home while installation still waits for Home');

console.log('TURN runtime hot-path, observer and deferred-loading performance contracts passed.');
