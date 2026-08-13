import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, labIndex, wrapperSource, controllerSource, leadSource, bassSource, arpSource] = await Promise.all([
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tone-runtime-ties.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tie-tone-controller.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tie-lead.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tie-bass.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/music/tie-arp.js', import.meta.url), 'utf8')
]);
const { bars, makeSection } = await import(new URL('../turn/audio/music/song-tools.js?test=note-ties', import.meta.url));
const { createTieToneController } = await import(new URL('../turn/audio/music/tie-tone-controller.js?test=note-ties', import.meta.url));

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
assert.deepEqual(tied.slice(0, 8), ['D5', '=', '=', '=', 'G5', '=', null, null]);
assert.doesNotThrow(() => makeSection({ name: 'tie-probe', lead: tied, bass: tied, arp: tied, drums }));
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
for (const source of [leadSource, bassSource, arpSource]) assert.match(source, /note === '='/);
assert.match(controllerSource, /cancelAndHoldAtTime/);

const events = [];
const gain = {
  cancelAndHoldAtTime(time) { events.push(['hold', time]); },
  cancelScheduledValues(time) { events.push(['cancel', time]); },
  setValueAtTime(value, time) { events.push(['set', value, time]); },
  exponentialRampToValueAtTime(value, time) { events.push(['ramp', value, time]); }
};
const stopped = [];
const controller = createTieToneController({ context: { currentTime: 0 }, getStepSeconds: () => .125 });
const state = {
  body: { stop(time) { stopped.push(['body', time]); } },
  harmonic: { stop(time) { stopped.push(['harmonic', time]); } },
  amp: { gain }, voice: { gain: .1 }, attackEnd: .01, end: .09
};
controller.remember('lead', state);
controller.extend('lead', .125);
assert.equal(state.end, .25, 'A tie extends the active note through the tied sixteenth');
assert.deepEqual(stopped, [['body', .26], ['harmonic', .26]]);
assert.ok(events.some(([type]) => type === 'hold'), 'A sustained note holds its current envelope before the later release');

console.log('TURN music note ties: pitched "=" sustain is valid, guarded, cache-routed, and drums reject ties.');
