const CAPTURED = Object.seal({
  contexts: [],
  oscillators: [],
  gains: [],
  filters: []
});

const FACTORY_NAMES = Object.freeze([
  ['createOscillator', 'oscillators'],
  ['createGain', 'gains'],
  ['createBiquadFilter', 'filters']
]);

let installed = false;
let decorated = false;
let restoreFactories = null;
let organicRoot = null;
let organicSub = null;
let organicContext = null;

export function installOrganicRibbon() {
  if (installed) return globalThis.__turnAudio;
  const baseAudio = globalThis.__turnAudio;
  if (!baseAudio) return null;

  installed = true;
  restoreFactories = captureAudioFactories();

  const enhancedAudio = Object.freeze({
    async unlock(...args) {
      const ready = await baseAudio.unlock(...args);
      if (ready) decorateCapturedRibbon();
      return ready;
    },
    update(frame = {}, now = performance.now()) {
      decorateCapturedRibbon();
      updateOrganicVoices(frame);
      baseAudio.update(frame, now);
    },
    cue: (...args) => baseAudio.cue(...args),
    silence: (...args) => baseAudio.silence(...args),
    get available() {
      return baseAudio.available;
    },
    get state() {
      return baseAudio.state;
    }
  });

  globalThis.__turnAudio = enhancedAudio;

  const scheduleDecoration = () => queueMicrotask(decorateCapturedRibbon);
  document.addEventListener('pointerdown', scheduleDecoration, { capture: true, passive: true, once: true });
  document.addEventListener('keydown', scheduleDecoration, { capture: true, once: true });

  return enhancedAudio;
}

function captureAudioFactories() {
  const prototypes = uniqueAudioContextPrototypes();
  const originals = [];

  for (const prototype of prototypes) {
    for (const [factoryName, collectionName] of FACTORY_NAMES) {
      const original = prototype?.[factoryName];
      if (typeof original !== 'function') continue;

      try {
        prototype[factoryName] = function capturedFactory(...args) {
          const node = original.apply(this, args);
          if (!CAPTURED.contexts.includes(this)) CAPTURED.contexts.push(this);
          CAPTURED[collectionName].push(node);
          return node;
        };
        originals.push([prototype, factoryName, original]);
      } catch (_) {}
    }
  }

  return () => {
    for (const [prototype, factoryName, original] of originals) {
      try {
        prototype[factoryName] = original;
      } catch (_) {}
    }
  };
}

function uniqueAudioContextPrototypes() {
  const prototypes = [
    globalThis.AudioContext?.prototype,
    globalThis.webkitAudioContext?.prototype
  ].filter(Boolean);
  return [...new Set(prototypes)];
}

function decorateCapturedRibbon() {
  if (decorated) return true;

  const context = CAPTURED.contexts.at(-1);
  const sliderTone = findOscillatorNear(390, 12);
  const sliderHarmonic = findOscillatorNear(585, 18);
  const sliderToneMix = findGainNear(0.78, 0.012);
  const sliderHarmonicMix = findGainNear(0.14, 0.012);
  const sliderFilter = CAPTURED.filters.find((filter) => (
    filter.type === 'lowpass'
    && Math.abs(filter.frequency.value - 1050) < 80
    && Math.abs(filter.Q.value - 0.42) < 0.16
  ));

  if (!context || !sliderTone || !sliderHarmonic || !sliderToneMix || !sliderHarmonicMix || !sliderFilter) {
    return false;
  }

  restoreFactories?.();
  restoreFactories = null;
  decorated = true;
  organicContext = context;

  const warmWave = makeWarmPeriodicWave(context, [1, 0.23, 0.105, 0.048, 0.022, 0.01]);
  const softWave = makeWarmPeriodicWave(context, [1, 0.09, 0.035, 0.014]);

  sliderTone.setPeriodicWave(warmWave);
  sliderHarmonic.setPeriodicWave(softWave);
  sliderTone.detune.value = -1800;
  sliderHarmonic.detune.value = -1797;

  // A nearly-unison companion creates slow acoustic beating instead of a static oscillator tone.
  organicRoot = context.createOscillator();
  organicRoot.setPeriodicWave(warmWave);
  organicRoot.frequency.value = sliderTone.frequency.value;
  organicRoot.detune.value = -1794.5;
  organicRoot.connect(sliderToneMix);

  // A quiet octave-below anchor carries the grounded quality of the reference without
  // asking tiny phone speakers to reproduce its sub-30 Hz fundamental.
  organicSub = context.createOscillator();
  organicSub.type = 'sine';
  organicSub.frequency.value = sliderTone.frequency.value * 0.5;
  organicSub.detune.value = -1800;
  const subGain = context.createGain();
  subGain.gain.value = 0.075;
  organicSub.connect(subGain);
  subGain.connect(sliderFilter);

  // Very dark, heavily correlated noise behaves as breath around the drone, not as hiss.
  const breathSource = context.createBufferSource();
  breathSource.buffer = makeOrganicNoiseBuffer(context, 4.8, 0.992);
  breathSource.loop = true;
  const breathFilter = context.createBiquadFilter();
  breathFilter.type = 'lowpass';
  breathFilter.frequency.value = 310;
  breathFilter.Q.value = 0.35;
  const breathGain = context.createGain();
  breathGain.gain.value = 0.024;
  breathSource.connect(breathFilter);
  breathFilter.connect(breathGain);
  breathGain.connect(sliderFilter);

  // Slow cycles make the ribbon feel alive while keeping a reliable audibility floor.
  const breathLfo = context.createOscillator();
  breathLfo.type = 'sine';
  breathLfo.frequency.value = 0.083;
  const rootBreathDepth = context.createGain();
  rootBreathDepth.gain.value = 0.045;
  const harmonicBreathDepth = context.createGain();
  harmonicBreathDepth.gain.value = 0.012;
  breathLfo.connect(rootBreathDepth);
  breathLfo.connect(harmonicBreathDepth);
  rootBreathDepth.connect(sliderToneMix.gain);
  harmonicBreathDepth.connect(sliderHarmonicMix.gain);

  const pitchLfo = context.createOscillator();
  pitchLfo.type = 'sine';
  pitchLfo.frequency.value = 0.097;
  const pitchDepth = context.createGain();
  pitchDepth.gain.value = 1.8;
  pitchLfo.connect(pitchDepth);
  pitchDepth.connect(sliderTone.detune);
  pitchDepth.connect(sliderHarmonic.detune);
  pitchDepth.connect(organicRoot.detune);

  const colourLfo = context.createOscillator();
  colourLfo.type = 'sine';
  colourLfo.frequency.value = 0.061;
  const colourDepth = context.createGain();
  colourDepth.gain.value = 48;
  colourLfo.connect(colourDepth);
  colourDepth.connect(sliderFilter.frequency);

  // Keep headroom after adding the companion and sub layers.
  const rootTrim = context.createConstantSource?.();
  if (rootTrim) {
    rootTrim.offset.value = -0.15;
    rootTrim.connect(sliderToneMix.gain);
    rootTrim.start();
  }
  const harmonicTrim = context.createConstantSource?.();
  if (harmonicTrim) {
    harmonicTrim.offset.value = -0.025;
    harmonicTrim.connect(sliderHarmonicMix.gain);
    harmonicTrim.start();
  }

  organicRoot.start();
  organicSub.start();
  breathSource.start();
  breathLfo.start();
  pitchLfo.start();
  colourLfo.start();
  return true;
}

function updateOrganicVoices(frame) {
  if (!decorated || !organicContext || !organicRoot || !organicSub) return;

  const risk = clamp(Number(frame.sliderRisk) || 0, 0, 1);
  const recovery = frame.sliderMode === 'recovery';
  const fundamental = recovery
    ? 326 + risk * 52
    : 388 + risk * 72;
  const now = organicContext.currentTime;

  organicRoot.frequency.setTargetAtTime(fundamental, now, 0.18);
  organicSub.frequency.setTargetAtTime(fundamental * 0.5, now, 0.22);
}

function findOscillatorNear(frequency, tolerance) {
  return CAPTURED.oscillators.find((oscillator) => (
    Math.abs(oscillator.frequency.value - frequency) <= tolerance
  ));
}

function findGainNear(value, tolerance) {
  return CAPTURED.gains.find((gain) => (
    Math.abs(gain.gain.value - value) <= tolerance
  ));
}

function makeWarmPeriodicWave(context, harmonics) {
  const real = new Float32Array(harmonics.length + 1);
  const imag = new Float32Array(harmonics.length + 1);
  harmonics.forEach((amount, index) => {
    imag[index + 1] = amount;
  });
  return context.createPeriodicWave(real, imag, { disableNormalization: false });
}

function makeOrganicNoiseBuffer(context, seconds, smoothing) {
  const frameCount = Math.max(1, Math.ceil(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  const memory = clamp(smoothing, 0.9, 0.998);
  const fresh = 1 - memory;
  let previous = 0;

  for (let index = 0; index < frameCount; index += 1) {
    previous = previous * memory + (Math.random() * 2 - 1) * fresh;
    data[index] = previous;
  }
  return buffer;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
