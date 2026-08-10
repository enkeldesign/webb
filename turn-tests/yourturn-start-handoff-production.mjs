import assert from 'node:assert/strict';
import fs from 'node:fs';

const handoff = fs.readFileSync('yourturn/start-handoff-r416.js', 'utf8');
const trackMap = fs.readFileSync('yourturn/track-map-r411.js', 'utf8');

assert.match(trackMap, /start-handoff-r416\.js\?revision=r416/,
  'YOUR TURN must install the start handoff guard before a challenge can be accepted.');
assert.doesNotMatch(trackMap, /viewport-transition-r414/,
  'The failed viewport-only workaround must not remain on the live YOUR TURN path.');

assert.match(handoff, /OPTIONAL_PLATFORM_WAIT_MS\s*=\s*900/,
  'Optional fullscreen/orientation APIs need a bounded wait.');
assert.match(handoff, /Promise\.race\(/,
  'Optional platform promises must not be allowed to stall the race indefinitely.');
assert.match(handoff, /requestFullscreen/,
  'Fullscreen requests must be bounded on the YOUR TURN path.');
assert.match(handoff, /screen\?\.orientation[\s\S]*'lock'/,
  'Orientation lock must also be bounded on the YOUR TURN path.');

assert.match(handoff, /hud\?\.hidden === false/,
  'The handoff must confirm the HUD is visible before dismissing the preparing screen.');
assert.match(handoff, /controls\?\.hidden === false/,
  'The handoff must confirm race controls are visible before dismissing the preparing screen.');
assert.match(handoff, /turn-lot-open/,
  'The handoff must not finish while the hard runtime pause remains active.');
assert.match(handoff, /yourturn-runtime-paused/,
  'The handoff must not finish while YOUR TURN runtime pause remains active.');
assert.match(handoff, /PREPARING YOUR RACE/,
  'The rotate surface should become an explicit preparing state rather than exposing cyan canvas.');
assert.match(handoff, /RACE DID NOT START/,
  'A visible recovery state is required if the handoff still fails.');
assert.match(handoff, /TRY AGAIN/,
  'The recovery state must offer a direct retry.');
assert.match(handoff, /__yourTurnStartHandoffDiagnostics/,
  'Real-device handoff diagnostics must remain available for follow-up.');

console.log('YOUR TURN start handoff production contract passed.');
