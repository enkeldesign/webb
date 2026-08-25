import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [homeLayout, repair] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/pwa-short-viewport-repair-r184.js', import.meta.url), 'utf8')
]);

for (const verticalOnlyMenuRule of [
  'overflow-y: auto',
  'overflow-x: hidden',
  'overscroll-behavior-x: none',
  'touch-action: pan-y',
  'padding-right: 8px'
]) {
  assert.ok(
    homeLayout.includes(verticalOnlyMenuRule),
    `Short-viewport Home menu must keep scrolling vertical-only: ${verticalOnlyMenuRule}`
  );
}

assert.match(
  homeLayout,
  /pwa-short-viewport-repair-r184\.js\?build=\$\{buildKey\}&revision=r184-start-settle-first-activation/,
  'Production Home must load the cache-distinct minimal viewport repair module'
);

const parseableRepair = repair.replace('export function installShortViewportAutoRepair', 'function installShortViewportAutoRepair');
assert.doesNotThrow(() => new Function(parseableRepair), 'Production short-viewport repair must remain valid JavaScript');

for (const requiredRepair of [
  "measureHeight('100dvh')",
  "measureHeight('100lvh')",
  'BAD_GAP_MIN = 40',
  'Math.abs(sample.clientH - sample.dvh) <= 2',
  'Math.abs(sample.visualH - sample.dvh) <= 2',
  'AUTO_SETTLE_MS = 160',
  'AUTO_CONFIRM_MS = 90',
  'META_PULSE_MS = 120',
  "document.addEventListener('turn:home-ready'",
  "home.addEventListener('click', onFirstHomeActivation",
  "'first-home-activation'",
  "meta.setAttribute('content', pulse)",
  "meta.setAttribute('content', original)",
  'autoAttempted',
  'interactionAttempted'
]) {
  assert.ok(repair.includes(requiredRepair), `Production repair must include ${requiredRepair}`);
}

assert.doesNotMatch(repair, /screen\.(?:width|height)/,
  'Physical screen dimensions must never participate in viewport repair');
assert.doesNotMatch(repair, /TURN viewport repair bench|COPY REPAIR RESULT|COLOR LAYERS|AUTO_RETRY_DELAYS|STARTUP_CHECKS_MS/,
  'Production must not clone TURN LAB diagnostics, UI, or long-running watchdog machinery');
assert.doesNotMatch(repair, /document\.addEventListener\('click'|window\.addEventListener\('click'/,
  'The first-interaction fallback must stay scoped to Home rather than becoming a global click delegate');

// Drift Camera adds its opt-in control to the same Home Settings surface. Keep its
// preference and camera-direction contract in the production Home regression path.
await import('./drift-camera-production.mjs');

console.log('TURN short iOS viewport production repair and vertical-only Home menu passed.');
