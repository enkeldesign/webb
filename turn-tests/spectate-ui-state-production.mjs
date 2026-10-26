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
assert.doesNotMatch(controlsSource, /__turn(AnalogGas|DriftHeld|BoostActive|DriveControlMask|DriveSetup)|\.touch(Gas|Brake|Reverse)|manualSteering/,
  'It never touches the live controls');

// #1219: the bar names the perks the followed lap ran, from the lap's own setup, never
// the car's GARAGE setup now. Laps from before perks were kept name none.
assert.match(spectateSource, /perks: lap \? lapPerksLabel\(readableReplaySetup\(lap\)\.build\.perks\) : ''/);
assert.match(spectateSource, /<small class="spectate-perks" hidden><\/small>/);
assert.match(spectateSource, /perksEl\.hidden = !current\.perks;/);
assert.match(spectateCss, /\.spectate-perks \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/);
const { lapPerksLabel } = await import('../turn/vehicle/perk-presentation.js');
assert.equal(lapPerksLabel({ original: 'torque', installed: 'driftage' }), 'Torque + Driftage', 'Its car\'s own perk first');
assert.equal(lapPerksLabel({ original: '', installed: 'full-tank' }), 'Full Tank');
assert.equal(lapPerksLabel({ original: 'warp-drive' }), '');
assert.equal(lapPerksLabel(null), '');

// A lap from before this week (#1305): its label compares it with the other laps' dates.
// That comparison read its own variable before it existed, so a rival from an earlier
// week stopped TURN starting (ReferenceError: otherHitAt), from the first Monday after.
const labelSource = ['sameDate', 'spectateDateLabel'].map((name) => {
  const match = spectateSource.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${name} is found`);
  return match[0];
}).join('\n');
const labelContext = { Intl, Date, Number, globalThis: {} };
vm.createContext(labelContext);
vm.runInContext(`${labelSource}\nglobalThis.label = spectateDateLabel;`, labelContext);
const label = labelContext.globalThis.label;
const earlier = new Date();
earlier.setDate(earlier.getDate() - 14);
earlier.setHours(9, 5, 0, 0);
const sameDay = new Date(earlier);
sameDay.setHours(17, 40);
const older = { time: 70, hitAt: earlier.getTime() };
assert.doesNotThrow(() => label(older, [older]), 'A lap from an earlier week has a label');
assert.doesNotMatch(label(older, [older]), /,\s\d+\.\d\d$/, 'One lap that day: the date alone');
assert.match(label(older, [older, { time: 72, hitAt: sameDay.getTime() }, { time: 75, hitAt: null }]), / 9\.05$/,
  'Two laps that day: the time tells them apart');
assert.equal(label({ time: 70, hitAt: null }, []), 'Previous record');

console.log('Spectate UI-state snapshot and replay controls regression passed.');
