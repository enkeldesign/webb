import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, loader, legacyControls, map] = await Promise.all([
  fs.readFile(new URL('../yourturn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/race-controls-r417.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/race-controls-r411.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../yourturn/track-map-r417.js', import.meta.url), 'utf8')
]);

assert.match(index, /race-controls-r417\.js\?revision=r417/,
  'YOUR TURN must load the fixed control entry point with a new cache key');
assert.doesNotMatch(index, /race-controls-r411\.js\?revision=r411/,
  'The self-observing #413 control entry point must not be loaded directly');
assert.match(index, /track-map-r417\.js\?revision=r417/,
  'YOUR TURN must load the clean map entry point with a new cache key');

assert.match(legacyControls, /observe\(utilityGroup, \{ childList: true \}\)/,
  'This regression documents the #413 self-observing edge that caused the landscape freeze');
assert.match(legacyControls, /utilityGroup\.appendChild\(node\)/,
  'This regression documents the matching child mutation in #413');

assert.match(loader, /target === utilityGroup && options\.childList === true/,
  'The fixed loader must suppress only the utility-row child-list observer');
assert.match(loader, /race-controls-r411\.js\?revision=r417-observer-loop-fix/,
  'The fixed loader must force a fresh copy of the controls implementation');
assert.match(loader, /globalThis\.MutationObserver = NativeMutationObserver/,
  'The MutationObserver shim must be temporary');

assert.doesNotMatch(map, /viewport-transition|start-handoff/,
  'The live track-map path must not carry the falsified viewport/start-handoff hotfixes');

console.log('YOUR TURN r417 observer-loop regression passed.');
