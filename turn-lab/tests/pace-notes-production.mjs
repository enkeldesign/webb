import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { register } from 'node:module';

// SWOOSH pace notes in the race (#909 step 2, #928). The BIP/BEEP notes are retired: every
// bend of every course is cued from its centreline, through the engine's route channel,
// timed to end a steering lead before the bend, with no bend dropped, and route cues
// yield to recovery and safety.
const threeUrl = new URL('../../turn/vendor/three-0.184.0/build/three.module.js', import.meta.url).href;
register(`data:text/javascript,export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: ${JSON.stringify(threeUrl)}, shortCircuit: true };
  return next(specifier, context);
}`);

const {
  SWOOSH_PACE_TUNING,
  planSwooshes,
  resetSwooshDelivery,
  swooshLevel,
  swooshDuration,
  swooshTightness,
  updateSwooshPaceNotes
} = await import('../../turn/audio/swoosh-pace-notes.js');
const { routeForSamples } = await import('../../turn/audio/route-geometry.js');
const { SWOOSH_LENGTHS } = await import('../../turn/audio/swoosh-sound.js');
const { createTrackRuntime } = await import('../../turn/tracks/catalog.js');
const { TRACK_DEFINITIONS } = await import('../../turn/tracks/definitions.js');
const { TRAINING_STAGES } = await import('../../turn/training/stages.js');
const { buildTrainingCourse } = await import('../../turn/training/course.js');

const read = (path) => fs.readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const [releaseSource, app, loader, audio, scheduler, music, hud, training, stagesSource, menu, guide, pause] = await Promise.all([
  read('turn/release.json'),
  read('turn/app.js'),
  read('turn/audio/drive-by-ear-runtime.js'),
  read('turn/audio/audio-system.js'),
  read('turn/audio/swoosh-pace-notes.js'),
  read('turn/audio/racing-music-v5.js'),
  read('turn/testing/route-test-hud.js'),
  read('turn/training/drive-by-ear-training.js'),
  read('turn/training/stages.js'),
  read('turn/ui/in-game-menu.js'),
  read('turn/ui/how-to-play-guide.js'),
  read('turn/race/race-pause.js')
]);
const release = JSON.parse(releaseSource);

// A Web Audio stand-in that records what each swoosh does.
function param(value = 0) {
  return {
    value,
    events: [],
    setValueAtTime(next, at) { this.events.push(['set', next, at]); },
    linearRampToValueAtTime(next, at) { this.events.push(['linear', next, at]); },
    exponentialRampToValueAtTime(next, at) { this.events.push(['exp', next, at]); },
    setTargetAtTime() {},
    cancelScheduledValues() {}
  };
}
function createContext() {
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    panners: [],
    cancelled: 0,
    node(extra = {}) {
      return { connect: (target) => target, disconnect() {}, ...extra };
    },
    source(extra = {}) {
      return context.node({
        start() {},
        stop(...args) { if (!args.length) context.cancelled += 1; },
        addEventListener() {},
        ...extra
      });
    },
    createStereoPanner() {
      const panner = context.node({ pan: param() });
      context.panners.push(panner);
      return panner;
    },
    createGain: () => context.node({ gain: param(1) }),
    createBiquadFilter: () => context.node({ Q: param(), frequency: param() }),
    createOscillator: () => context.source({ frequency: param() }),
    createBufferSource: () => context.source({ buffer: null }),
    createBuffer: (channels, length) => ({ getChannelData: () => new Float32Array(length) })
  };
  return context;
}
function createRouteAudio() {
  const context = createContext();
  return {
    context,
    destination: context.node(),
    ready: true,
    held: 0,
    released: 0,
    holdMixUntil(time) { this.held = Math.max(this.held, time); },
    releaseMix() { this.released += 1; }
  };
}

const ducks = [];
globalThis.__turnRacingMusic = { duck: (inSeconds, seconds) => ducks.push([inSeconds, seconds]) };

// Drive laps at a steady speed, 30 updates a second, as the race loop does.
function drive(runtime, routeAudio, { speed = 40, seconds, frame = () => ({ active: true }), startDistance = 0 } = {}) {
  const route = routeForSamples(runtime.samples, runtime.trackId);
  const count = runtime.samples.length;
  const played = [];
  let distance = startDistance;
  const dt = 1 / 30;
  for (let step = 0; step < Math.round(seconds / dt); step += 1) {
    const index = Math.round(distance / route.sampleSpacing) % count;
    const tangent = runtime.samples[index].tangent;
    Object.assign(runtime.state, {
      nearestTrackIndex: index,
      speed,
      velocity: { x: tangent.x * speed, z: tangent.z * speed }
    });
    for (const swoosh of updateSwooshPaceNotes(runtime, frame(step * dt), routeAudio)) {
      played.push({ ...swoosh, lap: Math.floor(distance / route.trackLength), distance });
    }
    distance += speed * dt;
    routeAudio.context.currentTime += dt;
  }
  return { route, played };
}
function trackRuntime(id) {
  const definition = TRACK_DEFINITIONS.find((candidate) => candidate.id === id);
  const runtime = createTrackRuntime(id, definition.sampleCount || 2160);
  return { trackId: id, samples: runtime.samples, state: { trackId: id, running: true, mode: 'racing' } };
}

// Sound mapping: pitch from the tightest sustained radius, swipe speed from road length.
assert.equal(SWOOSH_PACE_TUNING.variant, 'swipe-undertone', 'the race uses the soft air with the pitch underneath (1.34.0 device test)');
// Level: close to the ribbon at TURN's default balance, rising to the listening-test level
// as the balance favours Drive By Ear (Erik's device test: 0.24 only suited 10–20% DBE).
assert.equal(swooshLevel(0.55), SWOOSH_PACE_TUNING.level);
assert.equal(swooshLevel(undefined), SWOOSH_PACE_TUNING.level, 'no stored balance is the default');
assert.ok(swooshLevel(0.1) === SWOOSH_PACE_TUNING.level, 'favouring other sounds never raises it');
assert.ok(Math.abs(swooshLevel(0.925) - 0.24) < 1e-9 && swooshLevel(1) === 0.24, '92.5% Drive By Ear and above: the former level');
assert.ok(swooshLevel(0.75) > SWOOSH_PACE_TUNING.level && swooshLevel(0.75) < 0.24);
assert.ok(Math.abs(SWOOSH_PACE_TUNING.level - 0.24 * 0.15) < 0.005, 'default ≈ the former level at 10–20% Drive By Ear');
assert.equal(swooshTightness({ peakRadius: 20 }), 'tight');
assert.equal(swooshTightness({ peakRadius: 80 }), 'medium');
assert.equal(swooshTightness({ peakRadius: 300 }), 'gentle');
assert.equal(swooshDuration({ length: 40 }), SWOOSH_LENGTHS.short);
assert.equal(swooshDuration({ length: 160 }), SWOOSH_LENGTHS.long);

// Planning: on open road a swoosh ends a steering lead before its bend; in a dense run
// the earlier swooshes start earlier so every one fits, in order, without overlapping.
{
  const segment = (length) => ({ length, peakRadius: 50 });
  const [lone] = planSwooshes([{ segment: segment(40), ahead: 200 }], 40);
  assert.ok(Math.abs(lone.entry - lone.end - SWOOSH_PACE_TUNING.steeringLeadSeconds) < 1e-9, 'a lone swoosh ends one steering lead before its bend');
  const dense = planSwooshes([
    { segment: segment(20), ahead: 100 },
    { segment: segment(20), ahead: 110 },
    { segment: segment(20), ahead: 120 },
    { segment: segment(160), ahead: 130 }
  ], 50);
  for (let index = 1; index < dense.length; index += 1) {
    assert.ok(dense[index - 1].end <= dense[index].start - SWOOSH_PACE_TUNING.gapSeconds + 1e-9, 'linked swooshes never overlap');
  }
  assert.ok(dense[0].end < dense[0].entry - SWOOSH_PACE_TUNING.steeringLeadSeconds, 'a dense run starts earlier instead of dropping a bend');
  const slow = planSwooshes([{ segment: segment(40), ahead: 12 }], 9);
  const fast = planSwooshes([{ segment: segment(40), ahead: 12 }], 60);
  assert.equal(slow[0].duration, fast[0].duration, 'speed never changes what a bend sounds like');
}

// Every production track: from the second lap, every swoosh plays exactly once a lap, in
// road order, on its own side, without overlapping, while the mix and music duck.
for (const definition of TRACK_DEFINITIONS) {
  resetSwooshDelivery();
  const runtime = trackRuntime(definition.id);
  const routeAudio = createRouteAudio();
  const speed = 40;
  const route = routeForSamples(runtime.samples, runtime.trackId);
  const { played } = drive(runtime, routeAudio, { speed, seconds: (route.trackLength * 3) / speed });
  for (const lap of [1, 2]) {
    const ids = played.filter((swoosh) => swoosh.lap === lap || (swoosh.lap === lap - 1 && swoosh.distance > route.trackLength * (lap) - 400)).map((swoosh) => swoosh.id);
    for (const segment of route.segments) {
      assert.ok(ids.includes(segment.id), `${definition.id}: swoosh ${segment.id} plays on lap ${lap + 1}`);
    }
  }
  for (let index = 1; index < played.length; index += 1) {
    assert.ok(played[index].at >= played[index - 1].endsAt + SWOOSH_PACE_TUNING.gapSeconds - 1e-6, `${definition.id}: swooshes never overlap`);
  }
  const sides = routeAudio.context.panners.map((panner) => Math.sign(panner.pan.events[0][1]));
  const expected = played.map((swoosh) => route.segments.find((segment) => segment.id === swoosh.id).direction);
  assert.deepEqual(sides, expected, `${definition.id}: every swoosh is on its bend's side`);
  for (const panner of routeAudio.context.panners) {
    assert.equal(Math.abs(panner.pan.events[0][1]), 0.5, 'the swipe starts at 50% on its side');
    assert.equal(Math.abs(panner.pan.events[1][1]), 1, 'and travels to the full side');
  }
  assert.ok(routeAudio.held > 0 && ducks.length > 0, `${definition.id}: the car sounds and music duck under swooshes`);
  const late = played.filter((swoosh) => swoosh.margin < SWOOSH_PACE_TUNING.steeringLeadSeconds / 2).length;
  assert.ok(late <= played.length * 0.25, `${definition.id}: at ${speed} m/s most swooshes end a steering lead early (${late}/${played.length} late)`);
}

// Off road the route yields: nothing plays, a swoosh already playing stops, and the bends
// passed meanwhile are recorded as held back. Back on the road, the next bends play.
{
  resetSwooshDelivery();
  const runtime = trackRuntime('countryside');
  const routeAudio = createRouteAudio();
  const { played } = drive(runtime, routeAudio, { seconds: 20, frame: (time) => ({ active: true, offRoad: time > 1 && time < 12 }) });
  assert.ok(played.every((swoosh) => swoosh.at <= 1.2 || swoosh.at >= 12), 'no swoosh starts while off road');
  assert.ok(played.some((swoosh) => swoosh.at >= 12), 'swooshes return with the road');
}

// Wrong way cancels: a scheduled swoosh is stopped and its bend re-armed, so it plays again
// once the car is the right way round and still before the bend.
{
  resetSwooshDelivery();
  const runtime = trackRuntime('mountain');
  const routeAudio = createRouteAudio();
  // Drive the long first bend until the next swoosh has just been scheduled, then turn
  // the wrong way for half a second, well before that next bend begins.
  let distance = 200;
  let first = [];
  while (!first.length && distance < 2000) {
    first = drive(runtime, routeAudio, { seconds: 1 / 30, startDistance: distance }).played;
    distance += 40 / 30;
  }
  assert.ok(first.length, 'a swoosh is scheduled on the approach');
  const { played } = drive(runtime, routeAudio, { seconds: 0.5, frame: () => ({ active: true, wrongWay: true }), startDistance: distance });
  assert.equal(played.length, 0, 'nothing plays the wrong way');
  assert.ok(routeAudio.context.cancelled > 0 && routeAudio.released > 0, 'the live swoosh is stopped and the mix released');
  const again = drive(runtime, routeAudio, { seconds: 0.2, startDistance: distance + 20 }).played;
  assert.ok(again.some((swoosh) => swoosh.id === first[0].id), 'the right way round, the cancelled bend plays again');
}

// Spectating, an inactive frame (garage, hidden page) and Drive By Ear off stay silent.
{
  for (const [label, mutate, frame] of [
    ['spectating', (state) => { state.mode = 'spectating'; }, { active: true }],
    ['an inactive frame', () => {}, { active: false }],
    ['Drive By Ear off', () => { globalThis.__turnDriveByEarEnabled = false; }, { active: true }]
  ]) {
    resetSwooshDelivery();
    const runtime = trackRuntime('airport');
    mutate(runtime.state);
    const { played } = drive(runtime, createRouteAudio(), { seconds: 15, frame: () => frame });
    assert.equal(played.length, 0, `${label} plays no pace notes`);
    delete globalThis.__turnDriveByEarEnabled;
  }
}

// A paused or suspended context loses nothing: once it runs, the next bends still play.
{
  resetSwooshDelivery();
  const runtime = trackRuntime('harbor');
  const routeAudio = createRouteAudio();
  routeAudio.ready = false;
  assert.equal(drive(runtime, routeAudio, { seconds: 2 }).played.length, 0);
  routeAudio.ready = true;
  assert.ok(drive(runtime, routeAudio, { seconds: 6, startDistance: 80 }).played.length > 0, 'a resumed context plays the bends ahead');
}

// DRIVE BY EAR 101 uses the same path: its open courses have no seam bend, and its texts
// name the sides the geometry gives.
{
  const sidesOf = (stage) => {
    const { samples } = buildTrainingCourse(stage, 27);
    const route = routeForSamples(samples, stage.id);
    assert.equal(route.closed, false, `${stage.id} is an open course`);
    return route.segments.filter((segment) => segment.angleDegrees > 20).map((segment) => segment.side[0].toUpperCase()).join('');
  };
  const [part1, part2, part3, part4, part5] = TRAINING_STAGES;
  assert.equal(sidesOf(part1), '', 'Part 1 is straight');
  assert.equal(sidesOf(part2), 'LR', 'Part 2: a left, then a right');
  assert.match(part2.lead, /a left, then later a right/);
  assert.equal(sidesOf(part3), 'L', 'Part 3: one long left');
  assert.match(part3.lead, /slow swipe in the left ear/);
  assert.equal(sidesOf(part4), 'RR', 'Part 4: one long right in two linked swipes');
  assert.match(part4.lead, /Two linked swipes in the right ear/);
  assert.equal(sidesOf(part5), 'LLR', 'Part 5: a left, then a left linked to a right');
  assert.match(part5.lead, /a swipe in the left ear, then a swipe in the right ear/);
  assert.equal(TRAINING_STAGES.some((stage) => 'notes' in stage), false, 'training has no hand-placed notes');
}

// Contracts: one supported route channel, no graph interception for pace notes, no
// second timing loop, BIP/BEEP retired everywhere players hear or read about them.
assert.match(audio, /globalThis\.__turnRouteAudio = routeAudio/, 'the engine publishes its route channel');
assert.match(audio, /get destination\(\) \{\s*return routeBus;/, 'pace notes play into routeBus: balance, DBE on/off, off-road and wrong-way muting apply');
assert.doesNotMatch(audio, /turn:pace-note'|handlePaceNoteAudio|schedulePaceNoteBeep/, 'the engine has no BIP renderer');
assert.doesNotMatch(loader, /pace-note-priority|preparePaceNotePriorityCapture|'\.\/pace-notes\.js/, 'the createGain capture and BIP modules are gone');
assert.match(loader, /installOrganicRibbon\(\);[\s\S]*installSwooshPaceNotes\(\);[\s\S]*installUniversalDrivingSoundscape\(\);[\s\S]*installOffroadEarDirection\(\);[\s\S]*installRecoveryGuidance\(\);/,
  'SWOOSH sits inside the soundscape, so it sees the off-road and wrong-way state the mix uses');
assert.match(app, /installSwooshPaceNotes\(\);/);
assert.doesNotMatch(scheduler, /requestAnimationFrame|setInterval|setTimeout|new AudioContext|createGain = |prototype/, 'the scheduler uses the audio update and the route channel only');
assert.match(scheduler, /mode \|\| ''\) !== 'spectating'/);
assert.match(scheduler, /if \(!event\.detail\?\.running \|\| event\.detail\?\.reason === 'race-reset'\)/);
assert.match(pause, /turn:pace-note-silence/, 'pausing still silences route cues');
assert.match(music, /function duck\(inSeconds = 0, seconds = 0\)/);
{
  // Linked swooshes scheduled in one update: the duck starts with the first, ends with the last.
  const { nextDuckWindow } = await import('../../turn/audio/racing-music-v5.js');
  let window = { from: 0, until: 0 };
  window = nextDuckWindow(window, 10, 0.05, 0.18);
  window = nextDuckWindow(window, 10, 0.265, 0.36);
  assert.ok(Math.abs(window.from - 10.05) < 1e-9 && Math.abs(window.until - 10.625) < 1e-9, 'a later linked cue never moves the duck start');
  window = nextDuckWindow(window, 20, 0.1, 0.2);
  assert.ok(Math.abs(window.from - 20.1) < 1e-9, 'a cue after the duck has ended starts a new one');
}
assert.match(music, /masterGain\.connect\(duckGain\);\s*duckGain\.connect\(compressor\);/, 'music ducks on its own gain, never the player volume');
assert.match(hud, /tight <r\$\{TIGHT_RADIUS\}/);
assert.match(hud, new RegExp(`const TIGHT_RADIUS = ${SWOOSH_PACE_TUNING.tightRadius};`));
assert.match(hud, new RegExp(`const MEDIUM_RADIUS = ${SWOOSH_PACE_TUNING.mediumRadius};`));
assert.doesNotMatch(training, /turn:pace-note-priority|fireScheduledNotes/);
for (const [label, source] of [['stages', stagesSource], ['menu', menu], ['guide', guide]]) {
  assert.doesNotMatch(source, /\bBIP|\bBEEP|beeps?\b/i, `${label}: no BIP/BEEP language remains`);
}
assert.match(guide, /Pace notes need stereo/);
assert.match(menu, /Drive By Ear sound guide/);
assert.match(menu, /Pace notes tell you what comes next/);
assert.match(menu, /A warm organic hum guides your steering/);
assert.match(menu, /Off road, centred gravel marks the surface/);
assert.match(menu, /nearby-rival warnings are directional/);

console.log(`TURN ${release.id} SWOOSH pace notes: every bend on every track and DRIVE BY EAR 101, timed, linked, on its side, ducked, and yielding off road and the wrong way.`);
