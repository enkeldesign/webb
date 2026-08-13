import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, labIndex, wrapperSource, controllerSource, leadSource, bassSource, arpSource] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tone-runtime-ties.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tie-tone-controller-v2.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tie-lead-v2.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tie-bass-v2.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tie-arp-v2.js', import.meta.url), 'utf8')
]);
const { bars, makeSection } = await import(new URL('../turn/audio/music/song-tools.js?test=note-ties', import.meta.url));
const { createTieToneController } = await import(new URL('../turn/audio/music/tie-tone-controller-v2.js?test=note-ties', import.meta.url));

function importsOf(source) {
  const json = source.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(json, 'TURN must expose an import map');
  return JSON.parse(json).imports;
}

const toneSpecifier = '/turn/audio/music/tone-runtime.js?revision=r184-score-v2';
const toneTarget = '/turn/audio/music/tone-runtime-ties.js?revision=r186-note-ties';
const songTarget = '/turn/audio/music/song-tools.js?revision=r186-note-ties';
for (const source of [index, labIndex]) {
  const imports = importsOf(source);
  assert.equal(imports[toneSpecifier], toneTarget, 'The established engine must resolve to the tie-aware tone adapter');
  assert.equal(imports['/turn/audio/music/song-tools.js?revision=r184-score-v2'], songTarget);
  assert.equal(imports['/turn/audio/music/song-tools.js?revision=r185-menu-orchestration'], songTarget);
}

const tied = bars('D5 = = = G5 = - - A5 = = - C6 - - -');
const quiet = bars('- - - - - - - - - - - - - - - -');
const drums = bars('K - - - - - - - - - - - - - - -');
assert.deepEqual(tied.slice(0, 8), ['D5', '=', '=', '=', 'G5', '=', null, null], 'bars() keeps the author-facing tie notation');
const section = makeSection({ name: 'tie-probe', lead: tied, bass: tied, arp: tied, drums });
assert.deepEqual(section.lead.slice(0, 8), [
  { note: 'D5', heldSteps: 4 }, null, null, null,
  { note: 'G5', heldSteps: 2 }, null, null, null
], 'makeSection compiles each tie run into one held-note event without retriggers');
assert.throws(() => makeSection({
  name: 'leading-tie', lead: bars('= - - - - - - - - - - - - - - -'), bass: quiet, arp: quiet, drums
}), /must immediately follow a note or another tie/);
assert.throws(() => makeSection({
  name: 'orphan-tie', lead: bars('D5 - = - - - - - - - - - - - - -'), bass: quiet, arp: quiet, drums
}), /must immediately follow a note or another tie/);
assert.throws(() => makeSection({
  name: 'drum-tie', lead: quiet, bass: quiet, arp: quiet, drums: bars('K = - - - - - - - - - - - - - -')
}), /drums cannot use note ties/);

assert.match(wrapperSource, /tone-runtime\.js\?revision=r184-score-v2-base/,
  'The adapter must reach the unwrapped base runtime without import-map recursion');
for (const source of [leadSource, bassSource, arpSource]) {
  assert.match(source, /heldSteps/);
  assert.match(source, /ties\.sustain/);
}
assert.match(controllerSource, /setValueAtTime\(sustainGain, releaseStart\)/,
  'A tie must hold a stable sustain level until its short release');

const events = [];
const gain = {
  cancelScheduledValues(time) { events.push(['cancel', time]); },
  setValueAtTime(value, time) { events.push(['set', value, time]); },
  exponentialRampToValueAtTime(value, time) { events.push(['ramp', value, time]); }
};
const stopped = [];
const controller = createTieToneController({ getStepSeconds: () => .125 });
const state = {
  body: { stop(time) { stopped.push(['body', time]); } },
  harmonic: { stop(time) { stopped.push(['harmonic', time]); } },
  amp: { gain }, voice: { gain: .1 }, attackEnd: .01, end: .09
};
controller.remember('lead', state);
controller.sustain('lead', 0, 4);
assert.equal(state.end, .5, 'D5 = = = gates one oscillator for four sixteenth-note steps');
assert.deepEqual(stopped, [['body', .51], ['harmonic', .51]]);
assert.ok(events.some(([type]) => type === 'cancel'));
assert.ok(events.filter(([type]) => type === 'set').length >= 2, 'The tied voice reaches a sustained plateau before release');
assert.ok(events.some(([type]) => type === 'ramp'), 'The tied voice still gets a short release at the end of its gate');

console.log('TURN music note ties: pitched "=" compiles to one gated note, invalid/drum ties are rejected, and cache routing is fresh.');
