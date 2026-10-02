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
  swooshLengthClass,
  swooshTightness,
  updateSwooshPaceNotes
} = await import('../../turn/audio/swoosh-pace-notes.js');
const { routeForSamples } = await import('../../turn/audio/route-geometry.js');
const { SWOOSH_LENGTHS, swooshLengths } = await import('../../turn/audio/swoosh-sound.js');
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
    setValueCurveAtTime(curve, at, duration) { this.events.push(['curve', Array.from(curve), at, duration]); },
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
    createOscillator: () => context.source({ frequency: param(), detune: param() }),
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
assert.equal(SWOOSH_PACE_TUNING.variant, 'voice-chime-ring', 'the race plays CHIME RING, Erik\'s choice from the sound picker (1.35.4)');
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
// The race sound has three lengths (Erik): short 0.2 s below 80 m of road, medium 0.4 s
// below 150 m, long 0.6 s from 150 m. Sounds with two lengths keep long from 100 m.
{
  const race = swooshLengths(SWOOSH_PACE_TUNING.variant);
  assert.deepEqual({ ...race }, { short: 0.2, medium: 0.4, long: 0.6 });
  const classOf = (metres) => swooshLengthClass({ length: metres }, SWOOSH_PACE_TUNING, race);
  assert.deepEqual([40, 79, 80, 149, 150, 300].map(classOf), ['short', 'short', 'medium', 'medium', 'long', 'long']);
  assert.equal(swooshDuration({ length: 100 }, SWOOSH_PACE_TUNING, race), race.medium);
  assert.equal(swooshLengthClass({ length: 99 }), 'short', 'two lengths: short below 100 m');
  assert.equal(swooshLengthClass({ length: 100 }), 'long', 'two lengths: long from 100 m');
  const [planned] = planSwooshes([{ segment: { length: 160, peakRadius: 50 }, ahead: 200 }], 40, SWOOSH_PACE_TUNING, race);
  assert.ok(Math.abs(planned.end - planned.start - race.long) < 1e-9, 'the race plans with its own lengths');
}

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

// The start note (#1068): MIDNIGHT CITY's grid sits inside a right-hander that began
// behind it, so that bend is never ahead to plan. A standing start hears it first, the
// moment the car rolls. A grid bend with less than a speakable turn left stays silent,
// and a car already rolling after a reset hears no start note.
{
  const { routeSegmentAt } = await import('../../turn/audio/route-geometry.js');
  const standingStart = (id) => {
    resetSwooshDelivery('race start');
    const runtime = trackRuntime(id);
    const routeAudio = createRouteAudio();
    const route = routeForSamples(runtime.samples, id);
    const grid = runtime.samples.length - 24;
    Object.assign(runtime.state, { nearestTrackIndex: grid, speed: 0, velocity: { x: 0, z: 0 } });
    let standing = [];
    for (let step = 0; step < 30; step += 1) standing = standing.concat(updateSwooshPaceNotes(runtime, { active: true }, routeAudio));
    const tangent = runtime.samples[grid].tangent;
    Object.assign(runtime.state, { speed: 3, velocity: { x: tangent.x * 3, z: tangent.z * 3 } });
    const rolled = updateSwooshPaceNotes(runtime, { active: true }, routeAudio);
    return { standing, rolled, gridBend: routeSegmentAt(route, grid * route.sampleSpacing) };
  };

  const city = standingStart('midnight-city');
  assert.equal(city.gridBend?.side, 'right', 'MIDNIGHT CITY starts inside a right-hander');
  assert.equal(city.standing.length, 0, 'nothing plays while the car stands on the grid');
  assert.equal(city.rolled[0]?.id, city.gridBend.id, 'the grid bend plays first, as the car rolls');

  const beach = standingStart('beachfront');
  assert.ok(beach.gridBend, 'BEACHFRONT starts inside the end of a gentle bend');
  assert.ok(beach.rolled.every((swoosh) => swoosh.id !== beach.gridBend.id), 'a bend nearly over at the grid stays silent');

  resetSwooshDelivery('resumed');
  const runtime = trackRuntime('midnight-city');
  const route = routeForSamples(runtime.samples, 'midnight-city');
  const { played } = drive(runtime, createRouteAudio(), { seconds: 1, startDistance: (runtime.samples.length - 24) * route.sampleSpacing });
  assert.ok(played.every((swoosh) => swoosh.id !== city.gridBend.id), 'a car already rolling hears no start note');
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

// Admin sound picker: fifteen polished voices beside the race sound, chosen only by admin
// profiles; every player keeps choice 00.
{
  const { SWOOSH_SOUND_CHOICES, SWOOSH_SOUND_STORAGE_KEY, swooshSoundIndex } = await import('../../turn/audio/swoosh-pace-notes.js');
  const { VOICE_VARIANTS, VOICE_PITCH_HZ, SWOOSH_VOICES, startSwoosh, swooshLengths } = await import('../../turn/audio/swoosh-sound.js');
  const { swooshCaption, currentCaptionEntry } = await import('../../turn/testing/swoosh-sound-picker.js');
  assert.equal(VOICE_VARIANTS.length, 15, 'fifteen polished voices');
  assert.equal(SWOOSH_SOUND_CHOICES.length, 16);
  assert.deepEqual(SWOOSH_SOUND_CHOICES.slice(1, 11).map((choice) => choice.name), ['GLIDE', 'BREATH', 'SILK', 'CHIME', 'FLUTE', 'SWELL', 'HALO', 'WIND', 'PEBBLE', 'WOOD'], 'choices 01–10 keep their numbers');
  assert.equal(SWOOSH_SOUND_CHOICES[0].variant, SWOOSH_PACE_TUNING.variant, 'choice 00 is the race sound');
  const store = (entries) => ({ getItem: (key) => entries[key] ?? null });
  assert.equal(swooshSoundIndex(store({ [SWOOSH_SOUND_STORAGE_KEY]: '4' })), 0, 'a player without admin unlock always hears the race sound');
  assert.equal(swooshSoundIndex(store({ 'turn-admin-unlock-v1': '1', [SWOOSH_SOUND_STORAGE_KEY]: '4' })), 4);
  assert.equal(swooshSoundIndex(store({ 'turn-admin-unlock-v1': '1', [SWOOSH_SOUND_STORAGE_KEY]: '99' })), 0, 'an unknown choice falls back to the race sound');
  for (const variant of VOICE_VARIANTS) {
    const voice = SWOOSH_VOICES[variant];
    const pitches = [];
    for (const tightness of ['gentle', 'medium', 'tight']) {
      const context = createContext();
      const oscillators = [];
      const filters = [];
      const gains = [];
      const { createOscillator, createBiquadFilter, createGain } = context;
      context.createOscillator = () => { const node = createOscillator(); oscillators.push(node); return node; };
      context.createBiquadFilter = () => { const node = createBiquadFilter(); filters.push(node); return node; };
      context.createGain = () => { const node = createGain(); gains.push(node); return node; };
      const handle = startSwoosh(context, context.node(), { side: -1, tightness, variant, at: 1, durationSeconds: 0.18 });
      const [panner] = context.panners;
      assert.deepEqual(panner.pan.events.slice(0, 2).map(([, value]) => value), [-0.5, -1], `${variant}: the same 50% → 100% swipe`);
      assert.ok(Math.abs(handle.endsAt - 1.18) < 1e-9 && typeof handle.stop === 'function');
      // Smooth: each envelope is one curve from silence back to silence, never a ramp.
      const curves = gains.flatMap((gain) => gain.gain.events).filter((event) => event[0] === 'curve');
      assert.equal(curves.length, voice.layer ? 2 : 1, `${variant}: one envelope per layer`);
      for (const curve of curves) {
        assert.ok(curve[1][0] === 0 && Math.abs(curve[1].at(-1)) < 1e-6, `${variant}: fades in from and out to silence`);
        assert.ok(curve[1].every((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) < 0.35 * Math.max(...values)), `${variant}: no step in the envelope`);
      }
      assert.ok(filters.some((filter) => filter.type === 'lowpass' && filter.frequency.value <= 5000), `${variant}: a gentle low-pass keeps it soft`);
      const carrier = voice.partials.length ? oscillators[0].frequency : filters.find((filter) => filter.type === 'bandpass').frequency;
      pitches.push(carrier.events[0][1] / VOICE_PITCH_HZ[tightness]);
    }
    assert.ok(pitches.every((ratio) => Math.abs(ratio - pitches[0]) < 1e-9), `${variant}: pitch follows tightness`);
  }
  // CHIME variants: each tries one remedy for CHIME fading out before the full side.
  {
    const render = (variant) => {
      const context = createContext();
      const gains = [];
      const { createGain } = context;
      context.createGain = () => { const node = createGain(); gains.push(node); return node; };
      startSwoosh(context, context.node(), { side: 1, tightness: 'medium', variant, at: 1, durationSeconds: 0.36 });
      const curves = gains.flatMap((gain) => gain.gain.events).filter((event) => event[0] === 'curve').map(([, values]) => values);
      return { curves, pan: context.panners[0].pan.events };
    };
    // Summed envelope where the swipe has reached the full side, against the strike.
    const atFullSide = (variant) => {
      const { curves, pan } = render(variant);
      const index = Math.round((pan[1][2] - 1) / 0.36 * (curves[0].length - 1));
      const sum = (at) => curves.reduce((total, values) => total + values[at], 0);
      return sum(index) / Math.max(...curves[0]);
    };
    const chime = atFullSide('voice-chime');
    assert.ok(atFullSide('voice-chime-ring') > 3 * chime, 'CHIME RING: the ring lives on out to the full side');
    assert.ok(Math.abs(render('voice-chime-early').pan[1][2] - (1 + 0.36 * 0.3)) < 1e-9, 'CHIME EARLY: the swipe reaches the full side within its first 30%');
    assert.ok(atFullSide('voice-chime-early') > 3 * chime, 'CHIME EARLY: the strike is still ringing at the full side');
    for (const variant of ['voice-chime-wind', 'voice-chime-mirrored']) {
      const [, layer] = render(variant).curves;
      const peak = layer.indexOf(Math.max(...layer));
      assert.ok(peak > layer.length * 0.75, `${variant}: its second layer peaks near the end, at the full side`);
      assert.ok(atFullSide(variant) > 5 * chime, `${variant}: loud at the full side`);
    }
    assert.equal(SWOOSH_VOICES['voice-chime-mirrored'].layer.fm.rising, true, 'CHIME MIRRORED: a reversed chime, its brightness growing');
    assert.ok(SWOOSH_VOICES['voice-chime-wind'].layer.noise, 'CHIME WIND: a wind layer');
    // CHIME LONGER: a long curve's swipe is markedly longer, and the scheduler plans with it.
    const longer = swooshLengths('voice-chime-longer');
    const chimeLengths = swooshLengths('voice-chime');
    assert.equal(longer.short, chimeLengths.short);
    assert.ok(longer.long >= 1.5 * chimeLengths.long, 'CHIME LONGER: a long curve gets a markedly longer chime');
    assert.equal(swooshLengths('swipe-undertone'), SWOOSH_LENGTHS, 'the race sound keeps its lengths');
    assert.equal(swooshDuration({ length: 160 }, SWOOSH_PACE_TUNING, longer), longer.long);
    const [planned] = planSwooshes([{ segment: { id: 'x', length: 160 }, ahead: 200 }], 40, SWOOSH_PACE_TUNING, longer);
    assert.ok(Math.abs(planned.end - planned.start - longer.long) < 1e-9, 'the plan makes room for the longer chime');
  }
  assert.ok(Math.abs(VOICE_PITCH_HZ.medium / VOICE_PITCH_HZ.gentle - 1.5) < 0.01 && Math.abs(VOICE_PITCH_HZ.tight / VOICE_PITCH_HZ.medium - 1.5) < 0.01, 'tightness pitches a fifth apart');
  // A picker preview is heard as in the race: the mix and the music duck under it.
  {
    const routeAudio = createRouteAudio();
    const before = ducks.length;
    globalThis.__turnRouteAudio = routeAudio;
    try {
      const { installSwooshPaceNotes } = await import('../../turn/audio/swoosh-pace-notes.js');
      globalThis.__turnAudio = { unlock() {}, update() {}, cue() {}, silence() {} };
      installSwooshPaceNotes();
      assert.equal(globalThis.__turnSwooshPaceNotes.preview({ side: 1 }), true);
      assert.ok(routeAudio.held > 0, 'a preview holds the car sounds back');
      assert.equal(ducks.length, before + 1, 'a preview ducks the music');
    } finally {
      delete globalThis.__turnRouteAudio;
    }
  }
  assert.equal(swooshCaption({ tightness: 'gentle', length: 'long', side: 'left' }), 'GENTLE LONG LEFT');
  assert.equal(swooshCaption({ tightness: 'medium', length: 'medium', side: 'left' }), 'MEDIUM MID LEFT');
  assert.equal(swooshCaption({ tightness: 'tight', length: 'short', side: 'right' }), 'TIGHT SHORT RIGHT');
  const history = [
    { status: 'fired', at: 10, endsAt: 10.2, tightness: 'gentle', long: true, side: 'left' },
    { status: 'cancelled', at: 11, endsAt: 11.2 },
    { status: 'fired', at: 12, endsAt: 12.2, tightness: 'tight', long: false, side: 'right' }
  ];
  assert.equal(currentCaptionEntry(history, 11.5)?.tightness, 'gentle', 'the latest swoosh already heard, not one still to come');
  assert.equal(currentCaptionEntry(history, 12.1)?.tightness, 'tight');
  assert.equal(currentCaptionEntry(history, 20), null, 'the caption clears after its hold');
  const [picker, turnPage, labPage] = await Promise.all([read('turn/testing/swoosh-sound-picker.js'), read('turn/index.html'), read('turn-lab/index.html')]);
  assert.match(picker, /if \(!isAdminProfile\(\) \|\| !document\.body\) return;/, 'the picker installs nothing for players');
  assert.match(picker, /aria-label="Previous sound"[\s\S]*aria-label="Next sound"/);
  for (const page of [turnPage, labPage]) assert.match(page, /<script type="module" src="\.\/testing\/swoosh-sound-picker\.js\?build=/);
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
