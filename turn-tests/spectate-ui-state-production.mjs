import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const spectateSource = await fs.readFile(new URL('../turn/ui/spectate.js', import.meta.url), 'utf8');
const paceNotesSource = await fs.readFile(new URL('../turn/audio/swoosh-pace-notes.js', import.meta.url), 'utf8');

const notifyMatch = spectateSource.match(/function notifyUiState\(runtime, reason\) \{[\s\S]*?\n\}/);
assert.ok(notifyMatch, 'Spectate must publish UI-state changes through the runtime snapshot helper');

const events = [];
const context = {
  globalThis: {
    __turnGetTrackId: () => 'fallback-track'
  },
  window: {
    dispatchEvent(event) {
      events.push(event);
    }
  },
  CustomEvent: class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }
};
vm.createContext(context);
vm.runInContext(`${notifyMatch[0]}\nglobalThis.notifyUiState = notifyUiState;`, context);

const runtime = {
  trackId: 'mountain',
  state: {
    mode: 'spectating',
    running: true,
    trackId: 'mountain'
  }
};

context.globalThis.notifyUiState(runtime, 'spectate-started');
context.globalThis.notifyUiState(runtime, 'spectate-next');
runtime.state.mode = 'staged';
context.globalThis.notifyUiState(runtime, 'spectate-stopped');

assert.equal(events.length, 3);
assert.deepEqual(
  JSON.parse(JSON.stringify(events.map((event) => event.detail))),
  [
    { reason: 'spectate-started', mode: 'spectating', running: true, trackId: 'mountain' },
    { reason: 'spectate-next', mode: 'spectating', running: true, trackId: 'mountain' },
    { reason: 'spectate-stopped', mode: 'staged', running: true, trackId: 'mountain' }
  ],
  'Spectate transitions must preserve the complete current runtime snapshot'
);

for (const reason of ['spectate-started', 'spectate-next', 'spectate-stopped']) {
  assert.match(
    spectateSource,
    new RegExp(`notifyUiState\\(runtime, '${reason}'\\)`),
    `${reason} must use the complete runtime snapshot publisher`
  );
}
assert.doesNotMatch(
  spectateSource,
  /detail:\s*\{\s*reason\s*\}/,
  'Spectate must not publish a reason-only UI-state event'
);

assert.match(
  paceNotesSource,
  /if \(!event\.detail\?\.running \|\| event\.detail\?\.reason === 'race-reset'\)/,
  'The regression must continue covering a consumer that treats missing running as stopped'
);

// #1217: the followed lap's recorded controls play back on every SPECTATE frame, and go
// with SPECTATE. Live steering and the score cards, which show none of the replay, give
// way while it runs.
assert.match(spectateSource, /const frame = lap \? replayFrameAt\(lap, spectate\.elapsed\) : null;\n  spectateControls\?\.update\(lap, frame, spectate\.elapsed\);/);
assert.match(spectateSource, /spectate\.active = false;\n    spectate\.elapsed = 0;\n    spectateControls\?\.hide\(\);/);
assert.match(spectateSource, /if \(!current\.active\) spectateControls\?\.hide\(\);/);
const spectateCss = await fs.readFile(new URL('../turn/spectate-v3.css', import.meta.url), 'utf8');
assert.match(spectateCss, /\.turn-spectating \.controls,\n\.turn-spectating \.manual-steer,\n\.turn-spectating \.boost-hud,\n\.turn-spectating \.race-position-hud,\n\.turn-spectating #scoreFeedback \{\n  display: none !important;/);
const controlsSource = await fs.readFile(new URL('../turn/ui/spectate-controls.js', import.meta.url), 'utf8');
assert.match(controlsSource, /root\.setAttribute\('aria-hidden', 'true'\);/, 'A picture, hidden from assistive technology');
assert.doesNotMatch(controlsSource, /__turn(AnalogGas|DriftHeld|BoostActive|DriveControlMask)|\.touch(Gas|Brake|Reverse)|manualSteering/,
  'It never touches the live controls');

console.log('Spectate UI-state snapshot and replay controls regression passed.');
