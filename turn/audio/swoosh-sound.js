// SWOOSH candidate sounds (#909, #928): one broadband air/brush sweep, hard-panned to
// the side of the bend, whose tightness is painted by texture, pitch or both. These are
// SOL's audition seeds, not tuned product values: the listening test exists to choose
// between them. Every anchor shares the same envelope, duration, pan and sweep, and is
// level-compensated, so "tighter" never just means "louder".

export const SWOOSH_VARIANTS = Object.freeze(['texture', 'pitch', 'combined']);
export const SWOOSH_TIGHTNESS = Object.freeze(['gentle', 'medium', 'tight']);

const SWOOSH_TUNING = Object.freeze({
  durationSeconds: 0.3,
  attackSeconds: 0.02,
  releaseSeconds: 0.04,
  level: 0.5,
  // The air sweep: a band of noise rising through this range over the swoosh.
  sweepFromHz: 900,
  sweepToHz: 2400,
  sweepQ: 1.1,
  // Texture: amplitude roughness at a fixed rate, deeper for tighter bends.
  roughnessRateHz: 50,
  roughnessDepth: Object.freeze({ gentle: 0, medium: 0.25, tight: 0.5 }),
  // Pitch: a restrained tonal component inside the sweep, higher for tighter bends.
  pitchHz: Object.freeze({ gentle: 500, medium: 800, tight: 1250 }),
  // The tone sits under the noise; variants without a pitch change keep it at medium.
  toneLevel: 0.22
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

/** What a variant changes for a tightness anchor: roughness depth and tone frequency. */
export function swooshCharacter(variant, tightness) {
  const anchor = SWOOSH_TIGHTNESS.includes(tightness) ? tightness : 'medium';
  const texture = variant === 'texture' || variant === 'combined';
  const pitch = variant === 'pitch' || variant === 'combined';
  return Object.freeze({
    roughnessDepth: texture ? SWOOSH_TUNING.roughnessDepth[anchor] : 0,
    pitchHz: pitch ? SWOOSH_TUNING.pitchHz[anchor] : SWOOSH_TUNING.pitchHz.medium
  });
}

/**
 * Play one swoosh. side: -1 left, +1 right (always full-side). Returns its end time.
 */
export function playSwoosh(context, destination, {
  side,
  tightness = 'medium',
  variant = 'combined',
  at = context.currentTime + 0.02,
  durationSeconds = SWOOSH_TUNING.durationSeconds
} = {}) {
  const tuning = SWOOSH_TUNING;
  const { roughnessDepth, pitchHz } = swooshCharacter(variant, tightness);
  const end = at + durationSeconds;
  const nodes = [];
  const track = (node) => {
    nodes.push(node);
    return node;
  };

  // Full-side direction: the whole cue stays on its side.
  const panner = track(context.createStereoPanner());
  panner.pan.value = side < 0 ? -1 : 1;
  panner.connect(destination);

  // Envelope, with the level lost to amplitude roughness given back:
  // mean((1 - d/2 + d/2·sin)²) = (1 - d/2)² + (d/2)²/2.
  const halfDepth = roughnessDepth / 2;
  const compensation = 1 / Math.sqrt((1 - halfDepth) ** 2 + (halfDepth ** 2) / 2);
  const envelope = track(context.createGain());
  const peak = tuning.level * compensation;
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(peak, at + tuning.attackSeconds);
  envelope.gain.setValueAtTime(peak, end - tuning.releaseSeconds);
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
  band.type = 'bandpass';
  band.Q.value = tuning.sweepQ;
  band.frequency.setValueAtTime(tuning.sweepFromHz, at);
  band.frequency.exponentialRampToValueAtTime(tuning.sweepToHz, end);
  noise.connect(band).connect(roughness);
  noise.start(at, Math.random() * 0.5);
  noise.stop(end + 0.05);

  // The tonal component.
  const tone = track(context.createOscillator());
  const toneGain = track(context.createGain());
  tone.type = 'triangle';
  tone.frequency.value = pitchHz;
  toneGain.gain.value = tuning.toneLevel;
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
