// SWOOSH sounds (#909, #928). Round 3 chose 'swipe-tone': 100% on S-curves and
// same-direction pairs, comfort 5/5. In the full race mix its tone drowned the air, so the
// race plays 'swipe-undertone': the same swipe, with the pitch under a soft air. Round 1
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
export function startSwoosh(context, destination, {
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
