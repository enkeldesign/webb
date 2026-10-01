// SWOOSH sounds (#909, #928). Since 1.35.3 the race plays CHIME (SWOOSH_VOICES below),
// Erik's favourite from the admin sound picker. Round 3 chose 'swipe-tone': 100% on
// S-curves and same-direction pairs, comfort 5/5. In the full race mix its tone drowned
// the air, so 1.35.1 played 'swipe-undertone': the pitch under a soft air. Round 1
// settled tightness on pitch (texture
// dropped: unreliable and raspy). Round 2's arrow (centre → full side) and smoother
// timbre raised comfort but made S-curves harder: starting in the centre, its side is
// ambiguous at first. Erik keeps the travelling arrow — the pan paints the curve — and
// round 3 tests a swipe from 50% to 100% on its own side (+0.5 → +1 for RIGHT), so the
// side is clear from the first moment, in three timbres.
//
// End point = side, speed = the curve's length (a quick swipe is a short curve, a slow
// one a long turn), pitch = tightness. 'arrow' (round 2), 'pitch' (round 1), 'texture'
// and 'combined' stay for reference. Values are audition seeds: the test chooses.

export const SWOOSH_VARIANTS = Object.freeze(['swipe-undertone', 'swipe-air', 'swipe-tone', 'swipe-breath', 'arrow', 'pitch', 'texture', 'combined']);
export const SWOOSH_TIGHTNESS = Object.freeze(['gentle', 'medium', 'tight']);
export const SWOOSH_LENGTHS = Object.freeze({ short: 0.18, long: 0.36 });

const SWOOSH_TUNING = Object.freeze({
  durationSeconds: 0.3,
  attackSeconds: 0.02,
  releaseSeconds: 0.04,
  level: 0.5,
  // A travelling swoosh reaches the full side at this share of its duration, then holds.
  travelShare: 0.85,
  // Where a swipe starts on its own side (round 2's arrow started in the centre, 0).
  swipeStartPan: 0.5,
  // Gap between linked swooshes in a phrase.
  phraseGapSeconds: 0.035,
  // Texture (reference only): amplitude roughness at a fixed rate.
  roughnessRateHz: 50,
  roughnessDepth: Object.freeze({ gentle: 0, medium: 0.25, tight: 0.5 }),
  // Pitch: a tonal component inside the sweep, higher for tighter bends.
  pitchHz: Object.freeze({ gentle: 500, medium: 800, tight: 1250 })
});

// Timbres: round 1's sound, round 2's smooth air (the swipe's 'air'), a clean tone with
// a soft octave and almost no air ('tone'), and a breathier, darker air with the tone
// tucked underneath ('breath').
const TIMBRES = Object.freeze({
  round1: Object.freeze({ sweepFromHz: 900, sweepToHz: 2400, sweepQ: 1.1, noiseLevel: 1, toneType: 'triangle', toneLevel: 0.22, octaveLevel: 0 }),
  smooth: Object.freeze({ sweepFromHz: 500, sweepToHz: 1500, sweepQ: 0.7, noiseLevel: 0.6, toneType: 'sine', toneLevel: 0.34, octaveLevel: 0 }),
  tone: Object.freeze({ sweepFromHz: 600, sweepToHz: 1400, sweepQ: 0.7, noiseLevel: 0.12, toneType: 'sine', toneLevel: 0.42, octaveLevel: 0.12 }),
  breath: Object.freeze({ sweepFromHz: 300, sweepToHz: 900, sweepQ: 0.5, noiseLevel: 0.85, toneType: 'sine', toneLevel: 0.26, octaveLevel: 0 }),
  // In the race 'tone' was all that came through and the swoosh was lost (1.34.0 device
  // test): a soft air leads, and the tightness pitch sits an octave below, underneath it.
  undertone: Object.freeze({ sweepFromHz: 450, sweepToHz: 1300, sweepQ: 0.55, noiseLevel: 0.9, toneType: 'sine', toneLevel: 0.24, octaveLevel: 0, toneRatio: 0.5 })
});
const SWIPE_TIMBRES = Object.freeze({ 'swipe-undertone': 'undertone', 'swipe-air': 'smooth', 'swipe-tone': 'tone', 'swipe-breath': 'breath' });

const noiseBuffers = new WeakMap();

function noiseBuffer(context) {
  let buffer = noiseBuffers.get(context);
  if (buffer) return buffer;
  buffer = context.createBuffer(1, Math.round(context.sampleRate), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  noiseBuffers.set(context, buffer);
  return buffer;
}

/** What a variant does for a tightness anchor: roughness, tone, travel and timbre. */
export function swooshCharacter(variant, tightness) {
  const anchor = SWOOSH_TIGHTNESS.includes(tightness) ? tightness : 'medium';
  const swipe = Object.hasOwn(SWIPE_TIMBRES, variant);
  const texture = variant === 'texture' || variant === 'combined';
  const pitch = swipe || variant === 'pitch' || variant === 'combined' || variant === 'arrow';
  return Object.freeze({
    roughnessDepth: texture ? SWOOSH_TUNING.roughnessDepth[anchor] : 0,
    pitchHz: pitch ? SWOOSH_TUNING.pitchHz[anchor] : SWOOSH_TUNING.pitchHz.medium,
    travels: swipe || variant === 'arrow',
    startPan: swipe ? SWOOSH_TUNING.swipeStartPan : 0,
    timbre: swipe ? SWIPE_TIMBRES[variant] : variant === 'arrow' ? 'smooth' : 'round1'
  });
}

/**
 * Play one swoosh. side: -1 left, +1 right. durationSeconds: its length (see
 * SWOOSH_LENGTHS). level: its peak, before any mix. Returns its end time.
 */
export function playSwoosh(context, destination, options = {}) {
  return startSwoosh(context, destination, options).endsAt;
}

/** Play one swoosh and keep a handle: { endsAt, stop() } silences it, even before it starts. */
export function startSwoosh(context, destination, options = {}) {
  if (Object.hasOwn(SWOOSH_VOICES, options.variant)) return startVoiceSwoosh(context, destination, options);
  return startAirSwoosh(context, destination, options);
}

// Polished voices (admin sound picker). DBE is on by default for every player, so a
// pace note must sound finished, not like a test tone. Each voice is built to avoid
// roughness:
// - raised-cosine envelopes (setValueCurveAtTime), never linear ramps or clicks;
// - a gentle low-pass over everything, so no hiss or harsh top;
// - a small, quiet room on the cue's own side, for space without smearing the side;
// - musical tightness pitches a fifth apart (A4 / E5 / B5), each voice gliding a little
//   so the cue moves.
// Each keeps the 50% → 100% swipe, pitch = tightness and duration = length. gain matches
// each voice's loudness (RMS, rendered offline) to the race sound 'swipe-undertone'.
export const VOICE_PITCH_HZ = Object.freeze({ gentle: 440, medium: 659.25, tight: 987.77 });
const sine = (ratio, gain, detuneCents = 0) => Object.freeze({ ratio, gain, type: 'sine', detuneCents });
// A soft bell: gentle FM whose brightness fades, like glass. The race sound since 1.35.3,
// a little longer than the other voices so its ring reaches further out to the side.
const CHIME = Object.freeze({ name: 'CHIME', partials: [sine(1, 1)], fm: { ratio: 2, index: 1.2 }, glide: [1, 1], envelope: 'pluck', attack: 0.006, release: 0.12, lowpassHz: 5000, reverb: 0.22, gain: 0.924, lengths: Object.freeze({ short: 0.22, long: 0.45 }) });
export const SWOOSH_VOICES = Object.freeze({
  // A clean sine that rises a semitone: a calm interface glide.
  'voice-glide': Object.freeze({ name: 'GLIDE', partials: [sine(1, 1), sine(2, 0.12)], glide: [0.944, 1], envelope: 'bell', attack: 0.03, release: 0.07, lowpassHz: 4000, reverb: 0.16, gain: 0.326 }),
  // Warm air at the pitch, a soft sine beneath it: the race sound's idea, smoothed.
  'voice-breath': Object.freeze({ name: 'BREATH', partials: [sine(0.5, 0.35)], noise: { level: 1, q: 2.2, ratio: 1.5 }, glide: [0.9, 1.04], envelope: 'bell', attack: 0.035, release: 0.08, lowpassHz: 3200, reverb: 0.14, gain: 0.836 }),
  // Two slightly detuned sines: a soft chorused shimmer.
  'voice-silk': Object.freeze({ name: 'SILK', partials: [sine(1, 0.6, -7), sine(1, 0.6, 7), sine(2, 0.08)], glide: [0.97, 1], envelope: 'bell', attack: 0.04, release: 0.09, lowpassHz: 3500, reverb: 0.2, gain: 0.425 }),
  'voice-chime': CHIME,
  // Air through a narrow band at the pitch, with a hint of tone: a breathy flute.
  'voice-flute': Object.freeze({ name: 'FLUTE', partials: [sine(1, 0.55)], noise: { level: 0.7, q: 9, ratio: 1 }, glide: [0.97, 1], envelope: 'bell', attack: 0.04, release: 0.07, lowpassHz: 3800, reverb: 0.16, gain: 0.602 }),
  // Swells toward the bend, then lets go quickly: the cue leans forward.
  'voice-swell': Object.freeze({ name: 'SWELL', partials: [sine(1, 0.9), sine(1.5, 0.15)], glide: [0.97, 1.02], envelope: 'swell', attack: 0.02, release: 0.05, lowpassHz: 3600, reverb: 0.15, gain: 0.457 }),
  // Root and fifth, softly: an open, musical halo.
  'voice-halo': Object.freeze({ name: 'HALO', partials: [sine(1, 0.75), sine(1.5, 0.4), sine(2, 0.1)], glide: [1, 1], envelope: 'bell', attack: 0.035, release: 0.1, lowpassHz: 3800, reverb: 0.24, gain: 0.395 }),
  // A smooth wind sweep, filtered so it never hisses, with the pitch in the sweep.
  'voice-wind': Object.freeze({ name: 'WIND', partials: [], noise: { level: 1, q: 3.5, ratio: 1.5 }, glide: [0.8, 1.08], envelope: 'bell', attack: 0.03, release: 0.08, lowpassHz: 3000, reverb: 0.18, gain: 1.687 }),
  // A rounded triangle tone: firmer and closer, still soft at the edges.
  'voice-pebble': Object.freeze({ name: 'PEBBLE', partials: [Object.freeze({ ratio: 1, gain: 0.8, type: 'triangle', detuneCents: 0 })], glide: [1.02, 1], envelope: 'pluck', attack: 0.008, release: 0.1, lowpassHz: 2400, reverb: 0.12, gain: 1.102 }),
  // A muted marimba-like tap with a woody partial.
  'voice-wood': Object.freeze({ name: 'WOOD', partials: [sine(1, 1), sine(3.9, 0.12)], glide: [1, 1], envelope: 'pluck', attack: 0.006, release: 0.12, lowpassHz: 4200, reverb: 0.14, gain: 0.766 }),
  // CHIME variants (Erik's race test of 1.35.2). CHIME is the favourite, but its strike
  // has faded by the time the swipe reaches the full side, so the side it lands on is
  // the quietest part. Each variant tries one remedy, so the race can tell which works:
  // A slower decay: the ring lives on out to the full side.
  'voice-chime-ring': Object.freeze({ ...CHIME, name: 'CHIME RING', decay: 1.1, release: 0.05, gain: 0.561 }),
  // The same strike, but the swipe reaches the full side within its first 30%.
  'voice-chime-early': Object.freeze({ ...CHIME, name: 'CHIME EARLY', travelShare: 0.3 }),
  // The strike carries tightness; a soft wind at the same pitch rises behind it and
  // carries the length out to the full side.
  'voice-chime-wind': Object.freeze({
    ...CHIME,
    name: 'CHIME WIND',
    layer: Object.freeze({ partials: [], noise: { level: 2.5, q: 5, ratio: 1 }, glide: [0.85, 1.05], envelope: 'rise', attack: 0.01, release: 0.08, level: 1 }),
    gain: 0.733
  }),
  // Erik's idea: a long curve gets a markedly longer chime (0.75 s against CHIME's 0.45 s).
  'voice-chime-longer': Object.freeze({ ...CHIME, name: 'CHIME LONGER', lengths: Object.freeze({ short: CHIME.lengths.short, long: 0.75 }) }),
  // Erik's drawing: the chime, mirrored at the end. A reversed chime (its brightness
  // growing) swells under it and peaks at the full side, then lets go.
  'voice-chime-mirrored': Object.freeze({
    ...CHIME,
    name: 'CHIME MIRRORED',
    layer: Object.freeze({ partials: [sine(1, 1)], fm: { ratio: 2, index: 1.2, rising: true }, envelope: 'reverse', decay: 5, attack: 0.01, release: 0.03, level: 0.6 }),
    gain: 0.742
  })
});
export const VOICE_VARIANTS = Object.freeze(Object.keys(SWOOSH_VOICES));

/** A variant's two swipe lengths: a voice may have its own (CHIME, CHIME LONGER). */
export function swooshLengths(variant) {
  return Object.hasOwn(SWOOSH_VOICES, variant) && SWOOSH_VOICES[variant].lengths ? SWOOSH_VOICES[variant].lengths : SWOOSH_LENGTHS;
}

const reverbBuffers = new WeakMap();

// A small, dark room: 0.4 s of decaying, smoothed noise.
function reverbBuffer(context) {
  let buffer = reverbBuffers.get(context);
  if (buffer) return buffer;
  const length = Math.round(context.sampleRate * 0.4);
  buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let smooth = 0;
  for (let index = 0; index < length; index += 1) {
    smooth += ((Math.random() * 2 - 1) - smooth) * 0.35;
    data[index] = smooth * Math.exp(-index / (context.sampleRate * 0.09));
  }
  reverbBuffers.set(context, buffer);
  return buffer;
}

// Envelope shapes over the cue's length, as raised-cosine curves at 1 ms resolution, so
// even a 4 ms pluck attack is a smooth curve. 'pluck' decays from its strike; 'reverse'
// is a pluck mirrored, swelling to its peak where the release begins; 'rise' grows from
// silence to full over the cue.
function envelopeCurve(shape, durationSeconds, attack, release, decay = 3.2, points = Math.max(64, Math.ceil(durationSeconds * 1000) + 1)) {
  const curve = new Float32Array(points);
  const rise = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
  for (let index = 0; index < points; index += 1) {
    const t = (index / (points - 1)) * durationSeconds;
    const fadeIn = rise(t / attack);
    const fadeOut = rise((durationSeconds - t) / release);
    let body = 1;
    if (shape === 'swell') body = 0.45 + 0.55 * rise(t / Math.max(attack, durationSeconds - release));
    if (shape === 'pluck') body = Math.exp(-decay * Math.max(0, t - attack) / durationSeconds);
    if (shape === 'reverse') body = Math.exp(-decay * Math.max(0, durationSeconds - release - t) / durationSeconds);
    if (shape === 'rise') body = rise(t / Math.max(attack, durationSeconds - release));
    curve[index] = fadeIn * fadeOut * body;
  }
  return curve;
}

function addVoiceSources(context, layer, [glideFrom, glideTo], pitchHz, at, end, envelope, track, source) {
  const glide = (param, base) => {
    param.setValueAtTime(base * glideFrom, at);
    param.exponentialRampToValueAtTime(base * glideTo, end);
  };
  for (const partial of layer.partials) {
    const oscillator = source(context.createOscillator());
    const partialGain = track(context.createGain());
    oscillator.type = partial.type;
    oscillator.detune.value = partial.detuneCents;
    glide(oscillator.frequency, pitchHz * partial.ratio);
    partialGain.gain.value = partial.gain;
    oscillator.connect(partialGain).connect(envelope);
    if (layer.fm) {
      // Brightness that fades: the modulator's depth decays over the cue. A reversed
      // chime's brightness grows instead.
      const modulator = source(context.createOscillator());
      const depth = track(context.createGain());
      const [from, to] = layer.fm.rising ? [0.05, 1] : [1, 0.05];
      glide(modulator.frequency, pitchHz * partial.ratio * layer.fm.ratio);
      depth.gain.setValueAtTime(pitchHz * layer.fm.index * from, at);
      depth.gain.exponentialRampToValueAtTime(pitchHz * layer.fm.index * to, end);
      modulator.connect(depth).connect(oscillator.frequency);
    }
  }
  if (layer.noise) {
    const noise = source(context.createBufferSource());
    const band = track(context.createBiquadFilter());
    const noiseGain = track(context.createGain());
    noise.buffer = noiseBuffer(context);
    band.type = 'bandpass';
    band.Q.value = layer.noise.q;
    glide(band.frequency, pitchHz * layer.noise.ratio);
    // A band passes little of the noise: give back √Q. A constant-Q band passes more at
    // higher pitch: give back √pitch, so tight is not simply louder than gentle.
    noiseGain.gain.value = layer.noise.level * Math.sqrt(layer.noise.q) * Math.sqrt(VOICE_PITCH_HZ.medium / pitchHz);
    noise.connect(band).connect(noiseGain).connect(envelope);
  }
}

function startVoiceSwoosh(context, destination, {
  side,
  tightness = 'medium',
  variant,
  at = context.currentTime + 0.02,
  durationSeconds = SWOOSH_TUNING.durationSeconds,
  level = SWOOSH_TUNING.level
} = {}) {
  const voice = SWOOSH_VOICES[variant];
  const pitchHz = VOICE_PITCH_HZ[SWOOSH_TIGHTNESS.includes(tightness) ? tightness : 'medium'];
  const end = at + durationSeconds;
  const nodes = [];
  const sources = [];
  const track = (node) => {
    nodes.push(node);
    return node;
  };
  const source = (node) => {
    sources.push(track(node));
    return node;
  };

  // The same swipe as the race sound: 50% → 100% on its own side.
  const panner = track(context.createStereoPanner());
  const fullSide = side < 0 ? -1 : 1;
  panner.pan.setValueAtTime(fullSide * SWOOSH_TUNING.swipeStartPan, at);
  panner.pan.linearRampToValueAtTime(fullSide, at + durationSeconds * (voice.travelShare ?? SWOOSH_TUNING.travelShare));
  panner.connect(destination);

  // Dry and a small room, both on the cue's side.
  const tone = track(context.createBiquadFilter());
  tone.type = 'lowpass';
  tone.frequency.value = voice.lowpassHz;
  tone.Q.value = 0.5;
  tone.connect(panner);
  let tail = 0;
  if (voice.reverb > 0 && typeof context.createConvolver === 'function') {
    const room = track(context.createConvolver());
    const wet = track(context.createGain());
    room.buffer = reverbBuffer(context);
    wet.gain.value = voice.reverb;
    tone.connect(room).connect(wet).connect(panner);
    tail = 0.4;
  }

  // The voice, and a second layer with its own envelope where it has one (CHIME WIND,
  // CHIME MIRRORED).
  let envelope = null;
  for (const layer of voice.layer ? [voice, voice.layer] : [voice]) {
    const layerEnvelope = track(context.createGain());
    layerEnvelope.gain.value = 0;
    layerEnvelope.gain.setValueCurveAtTime(
      envelopeCurve(layer.envelope, durationSeconds, Math.min(layer.attack, durationSeconds * 0.4), Math.min(layer.release, durationSeconds * 0.5), layer.decay)
        .map((value) => value * level * voice.gain * (layer.level ?? 1)),
      at,
      durationSeconds
    );
    layerEnvelope.connect(tone);
    envelope ||= layerEnvelope;
    addVoiceSources(context, layer, layer.glide || voice.glide, pitchHz, at, end, layerEnvelope, track, source);
  }

  for (const node of sources) {
    if (node.buffer) node.start(at, Math.random() * 0.5);
    else node.start(at);
    node.stop(end + 0.02);
  }
  const disconnect = () => {
    for (const node of nodes) {
      try {
        node.disconnect();
      } catch (_) {
        // Already disconnected.
      }
    }
  };
  // Let the room ring out on its own side before letting go of the nodes.
  const timer = typeof context.createConstantSource === 'function' ? track(context.createConstantSource()) : sources[0];
  if (timer !== sources[0]) {
    timer.offset.value = 0;
    timer.connect(envelope);
    timer.start(at);
    timer.stop(end + tail + 0.05);
  }
  timer.addEventListener('ended', disconnect, { once: true });
  return Object.freeze({
    endsAt: end,
    stop() {
      for (const node of [...sources, timer]) {
        try {
          node.stop();
        } catch (_) {
          // Already stopped.
        }
      }
      disconnect();
    }
  });
}

function startAirSwoosh(context, destination, {
  side,
  tightness = 'medium',
  variant = 'arrow',
  at = context.currentTime + 0.02,
  durationSeconds = SWOOSH_TUNING.durationSeconds,
  level = SWOOSH_TUNING.level
} = {}) {
  const tuning = SWOOSH_TUNING;
  const { roughnessDepth, pitchHz, travels, startPan, timbre: timbreName } = swooshCharacter(variant, tightness);
  const timbre = TIMBRES[timbreName];
  const end = at + durationSeconds;
  const release = Math.min(tuning.releaseSeconds, durationSeconds * 0.25);
  const nodes = [];
  const track = (node) => {
    nodes.push(node);
    return node;
  };

  // Direction: a travelling swoosh moves from startPan on its own side (0 for round 2's
  // arrow) out to the full side; round 1 sounds stay on the full side throughout.
  // Either way it ends at -1 or +1.
  const panner = track(context.createStereoPanner());
  const fullSide = side < 0 ? -1 : 1;
  if (travels) {
    panner.pan.setValueAtTime(fullSide * startPan, at);
    panner.pan.linearRampToValueAtTime(fullSide, at + durationSeconds * tuning.travelShare);
  } else {
    panner.pan.value = fullSide;
  }
  panner.connect(destination);

  // Envelope, with the level lost to amplitude roughness given back:
  // mean((1 - d/2 + d/2·sin)²) = (1 - d/2)² + (d/2)²/2.
  const halfDepth = roughnessDepth / 2;
  const compensation = 1 / Math.sqrt((1 - halfDepth) ** 2 + (halfDepth ** 2) / 2);
  const envelope = track(context.createGain());
  const peak = level * compensation;
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(peak, at + tuning.attackSeconds);
  envelope.gain.setValueAtTime(peak, end - release);
  envelope.gain.linearRampToValueAtTime(0, end);
  envelope.connect(panner);

  // Roughness: a gain swinging around 1 - d/2 by ±d/2 at a fixed rate.
  const roughness = track(context.createGain());
  roughness.gain.value = 1 - halfDepth;
  roughness.connect(envelope);
  if (roughnessDepth > 0) {
    const modulator = track(context.createOscillator());
    const modulatorDepth = track(context.createGain());
    modulator.frequency.value = tuning.roughnessRateHz;
    modulatorDepth.gain.value = halfDepth;
    modulator.connect(modulatorDepth).connect(roughness.gain);
    modulator.start(at);
    modulator.stop(end + 0.05);
  }

  // The air sweep.
  const noise = track(context.createBufferSource());
  noise.buffer = noiseBuffer(context);
  const band = track(context.createBiquadFilter());
  const noiseGain = track(context.createGain());
  band.type = 'bandpass';
  band.Q.value = timbre.sweepQ;
  band.frequency.setValueAtTime(timbre.sweepFromHz, at);
  band.frequency.exponentialRampToValueAtTime(timbre.sweepToHz, end);
  noiseGain.gain.value = timbre.noiseLevel;
  noise.connect(band).connect(noiseGain).connect(roughness);
  noise.start(at, Math.random() * 0.5);
  noise.stop(end + 0.05);

  // The tonal component carries tightness.
  const tone = track(context.createOscillator());
  const toneGain = track(context.createGain());
  tone.type = timbre.toneType;
  tone.frequency.value = pitchHz * (timbre.toneRatio || 1);
  toneGain.gain.value = timbre.toneLevel;
  tone.connect(toneGain).connect(roughness);
  tone.start(at);
  tone.stop(end + 0.05);
  if (timbre.octaveLevel > 0) {
    const octave = track(context.createOscillator());
    const octaveGain = track(context.createGain());
    octave.type = 'sine';
    octave.frequency.value = pitchHz * (timbre.toneRatio || 1) * 2;
    octaveGain.gain.value = timbre.octaveLevel;
    octave.connect(octaveGain).connect(roughness);
    octave.start(at);
    octave.stop(end + 0.05);
  }

  const sources = nodes.filter((node) => typeof node.stop === 'function');
  const disconnect = () => {
    for (const node of nodes) {
      try {
        node.disconnect();
      } catch (_) {
        // Already disconnected.
      }
    }
  };
  noise.addEventListener('ended', disconnect, { once: true });
  return Object.freeze({
    endsAt: end,
    stop() {
      for (const source of sources) {
        try {
          source.stop();
        } catch (_) {
          // Already stopped.
        }
      }
      disconnect();
    }
  });
}

/** Linked swooshes with a short gap between them. Returns the phrase's end time. */
export function playSwooshPhrase(context, destination, swooshes, {
  at = context.currentTime + 0.02,
  gapSeconds = SWOOSH_TUNING.phraseGapSeconds
} = {}) {
  let cursor = at;
  for (const swoosh of swooshes) {
    cursor = playSwoosh(context, destination, { ...swoosh, at: cursor }) + gapSeconds;
  }
  return cursor - gapSeconds;
}
