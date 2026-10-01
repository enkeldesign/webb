// SWOOSH candidate sounds (#909, #928). Listening test round 1 settled tightness on
// pitch (texture/roughness dropped: unreliable and uncomfortable) and Erik set what
// "painting" means: the sound travels from the centre out to the full side, drawing an
// arrow. Its end point is the side, its speed the curve's length (a quick arrow is a
// short curve, a slow arrow a long turn) and its pitch the tightness.
//
// 'arrow' is that candidate, with a smoother air band and a sine tone (round 1's
// comfort was held back by raspiness). 'pitch' is round 1's winner (static full-side
// pan) kept for comparison; 'texture' and 'combined' stay for reference only. Values
// are audition seeds, not tuned product constants: the listening test chooses.

export const SWOOSH_VARIANTS = Object.freeze(['arrow', 'pitch', 'texture', 'combined']);
export const SWOOSH_TIGHTNESS = Object.freeze(['gentle', 'medium', 'tight']);
export const SWOOSH_LENGTHS = Object.freeze({ short: 0.18, long: 0.36 });

const SWOOSH_TUNING = Object.freeze({
  durationSeconds: 0.3,
  attackSeconds: 0.02,
  releaseSeconds: 0.04,
  level: 0.5,
  // The arrow reaches the full side at this share of its duration, then holds there.
  travelShare: 0.85,
  // Gap between linked swooshes in a phrase.
  phraseGapSeconds: 0.035,
  // Texture (reference only): amplitude roughness at a fixed rate.
  roughnessRateHz: 50,
  roughnessDepth: Object.freeze({ gentle: 0, medium: 0.25, tight: 0.5 }),
  // Pitch: a tonal component inside the sweep, higher for tighter bends.
  pitchHz: Object.freeze({ gentle: 500, medium: 800, tight: 1250 })
});

// Round 1 sound (pitch/texture/combined) and the smoother arrow.
const TIMBRES = Object.freeze({
  round1: Object.freeze({ sweepFromHz: 900, sweepToHz: 2400, sweepQ: 1.1, noiseLevel: 1, toneType: 'triangle', toneLevel: 0.22 }),
  smooth: Object.freeze({ sweepFromHz: 500, sweepToHz: 1500, sweepQ: 0.7, noiseLevel: 0.6, toneType: 'sine', toneLevel: 0.34 })
});

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
  const texture = variant === 'texture' || variant === 'combined';
  const pitch = variant === 'pitch' || variant === 'combined' || variant === 'arrow';
  return Object.freeze({
    roughnessDepth: texture ? SWOOSH_TUNING.roughnessDepth[anchor] : 0,
    pitchHz: pitch ? SWOOSH_TUNING.pitchHz[anchor] : SWOOSH_TUNING.pitchHz.medium,
    travels: variant === 'arrow',
    timbre: variant === 'arrow' ? 'smooth' : 'round1'
  });
}

/**
 * Play one swoosh. side: -1 left, +1 right. durationSeconds: its length (see
 * SWOOSH_LENGTHS). Returns its end time.
 */
export function playSwoosh(context, destination, {
  side,
  tightness = 'medium',
  variant = 'arrow',
  at = context.currentTime + 0.02,
  durationSeconds = SWOOSH_TUNING.durationSeconds
} = {}) {
  const tuning = SWOOSH_TUNING;
  const { roughnessDepth, pitchHz, travels, timbre: timbreName } = swooshCharacter(variant, tightness);
  const timbre = TIMBRES[timbreName];
  const end = at + durationSeconds;
  const release = Math.min(tuning.releaseSeconds, durationSeconds * 0.25);
  const nodes = [];
  const track = (node) => {
    nodes.push(node);
    return node;
  };

  // Direction: the arrow travels from the centre to the full side; round 1 sounds
  // stay on the full side throughout. Either way it ends at -1 or +1.
  const panner = track(context.createStereoPanner());
  const fullSide = side < 0 ? -1 : 1;
  if (travels) {
    panner.pan.setValueAtTime(0, at);
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
  const peak = tuning.level * compensation;
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
  tone.frequency.value = pitchHz;
  toneGain.gain.value = timbre.toneLevel;
  tone.connect(toneGain).connect(roughness);
  tone.start(at);
  tone.stop(end + 0.05);

  noise.addEventListener('ended', () => {
    for (const node of nodes) {
      try {
        node.disconnect();
      } catch (_) {
        // Already disconnected.
      }
    }
  }, { once: true });
  return end;
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
