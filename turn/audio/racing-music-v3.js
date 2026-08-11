const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

const MUSIC_VOLUME_STORAGE_KEY = 'turn-racing-music-volume-v1';
const MUSIC_LAST_VOLUME_STORAGE_KEY = 'turn-racing-music-last-volume-v1';
const DEFAULT_VOLUME = 25;
const BPM = 120;
const STEPS_PER_BEAT = 4;
const STEP_SECONDS = (60 / BPM) / STEPS_PER_BEAT;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.12;
const DESIGNED_MASTER_GAIN = 0.56;
const HOME_STYLE_ID = 'turn-racing-music-styles';

const NOTE_INDEX = Object.freeze({
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11
});

// T — the established short, punchy main tune.
const TUNE = Object.freeze({
  name: 'tune',
  lead: Object.freeze([
    'E5', null, 'G5', 'B5', 'D6', null, 'B5', 'G5',
    'E5', null, 'G5', 'A5', 'B5', 'D6', 'E6', null,
    'D6', null, 'B5', 'A5', 'G5', null, 'E5', 'G5',
    'A5', 'B5', 'D6', 'B5', 'A5', 'G5', 'F#5', null,
    'E5', null, 'B5', 'D6', 'E6', 'G6', 'F#6', 'E6',
    'D6', null, 'B5', 'G5', 'A5', 'B5', 'D6', null,
    'B5', 'D6', 'E6', 'G6', 'F#6', 'E6', 'D6', 'B5',
    'A5', 'B5', 'G5', 'F#5', 'E5', 'B5', 'E6', null
  ]),
  bass: Object.freeze([
    'E2', null, 'E2', 'E3', null, 'B2', 'D3', null,
    'E2', null, 'G2', 'B2', 'D3', 'B2', 'E3', null,
    'C2', null, 'C3', 'G2', null, 'C3', 'B2', null,
    'D2', null, 'D3', 'A2', 'D3', 'F#3', 'A2', null,
    'E2', null, 'E3', 'B2', 'D3', 'B2', 'G2', null,
    'E2', 'B2', 'E3', null, 'D3', 'B2', 'G2', null,
    'C2', null, 'G2', 'C3', 'B2', null, 'D3', 'C3',
    'D2', 'A2', 'D3', 'F#3', 'E2', 'B2', 'E3', null
  ]),
  arp: Object.freeze([
    'E4', 'B4', 'G4', 'B4', 'E5', 'B4', 'G4', 'B4',
    'E4', 'B4', 'G4', 'B4', 'E5', 'B4', 'G4', 'D5',
    'C4', 'G4', 'E4', 'G4', 'C5', 'G4', 'E4', 'G4',
    'D4', 'A4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'A4',
    'E4', 'B4', 'G4', 'B4', 'E5', 'B4', 'G4', 'B4',
    'E4', 'G4', 'B4', 'D5', 'E5', 'D5', 'B4', 'G4',
    'C4', 'G4', 'E4', 'G4', 'C5', 'B4', 'G4', 'E4',
    'D4', 'A4', 'F#4', 'A4', 'E4', 'B4', 'G4', 'E5'
  ]),
  drums: Object.freeze([
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'K', 'H',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'S', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'SH', 'H', 'S', 'S', 'KS', 'OH'
  ])
});

// B — contrast and harmonic tension before returning to T.
const BRIDGE = Object.freeze({
  name: 'bridge',
  lead: Object.freeze([
    'G5', null, 'B5', 'D6', 'G6', 'F#6', 'D6', 'B5',
    'A5', 'B5', 'D6', 'E6', 'D6', 'B5', 'G5', null,
    'F#5', null, 'A5', 'D6', 'F#6', 'E6', 'D6', 'A5',
    'B5', 'D6', 'E6', 'F#6', 'E6', 'D6', 'A5', null,
    'E5', 'G5', 'C6', 'E6', 'G6', 'E6', 'D6', 'C6',
    'G5', 'C6', 'D6', 'E6', 'G6', 'E6', 'C6', null,
    'F#5', 'A5', 'B5', 'D#6', 'F#6', 'D#6', 'B5', 'A5',
    'F#5', 'A5', 'B5', 'D#6', 'F#6', 'D#6', 'B5', 'D#6'
  ]),
  bass: Object.freeze([
    'G2', null, 'G2', 'D3', null, 'G3', 'F#3', 'D3',
    'G2', 'B2', 'D3', null, 'G3', 'D3', 'B2', null,
    'D2', null, 'D3', 'A2', null, 'D3', 'F#3', 'A2',
    'D2', 'A2', 'D3', null, 'F#3', 'D3', 'A2', null,
    'C2', null, 'C3', 'G2', null, 'C3', 'E3', 'G2',
    'C2', 'G2', 'C3', null, 'E3', 'C3', 'G2', null,
    'B1', null, 'B2', 'F#2', 'A2', 'B2', 'D#3', 'F#3',
    'B1', 'F#2', 'A2', 'B2', 'D#3', 'F#3', 'B2', 'D#3'
  ]),
  arp: Object.freeze([
    'G4', 'D5', 'B4', 'D5', 'G5', 'D5', 'B4', 'D5',
    'G4', 'B4', 'D5', 'G5', 'D5', 'B4', 'D5', 'G5',
    'D4', 'A4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'A4',
    'D4', 'F#4', 'A4', 'D5', 'F#5', 'D5', 'A4', 'F#4',
    'C4', 'G4', 'E4', 'G4', 'C5', 'G4', 'E4', 'G4',
    'C4', 'E4', 'G4', 'C5', 'E5', 'C5', 'G4', 'E4',
    'B3', 'F#4', 'A4', 'D#5', 'B4', 'F#4', 'A4', 'D#5',
    'B3', 'A4', 'D#5', 'F#5', 'A5', 'F#5', 'D#5', 'B4'
  ]),
  drums: Object.freeze([
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'K', 'H',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'KS', 'OH',
    'KH', 'H', 'H', 'H', 'SH', 'H', 'KH', 'H',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', 'KH', 'H', 'SH', 'H', 'KH', 'H',
    'KS', 'H', 'KS', 'H', 'S', 'KS', 'KS', 'KSO'
  ])
});

// C — a short, articulated flute hook over Em → C → G → B7.
// The sequencer grid is sixteenth notes, so alternating note/null slots make true eighth notes.
const CHORUS = Object.freeze({
  name: 'chorus',
  leadVoice: 'flute',
lead: Object.freeze([
  'E6', 'E6', 'G6', 'G6', 'B6', 'B6', 'G6', 'G6',
  'E7', 'E7', 'B6', 'B6', 'G6', 'G6', 'B6', 'B6',
  'G6', 'G6', 'E6', 'E6', 'C7', 'C7', 'E7', 'E7',
  'G7', 'G7', 'E7', 'E7', 'D7', 'D7', 'C7', 'C7',
  'D7', 'D7', 'B6', 'B6', 'G6', 'G6', 'B6', 'B6',
  'D7', 'D7', 'B6', 'B6', 'A6', 'A6', 'G6', 'G6',
  'F#6', 'F#6', 'A6', 'A6', 'B6', 'B6', 'D#7', 'D#7',
  'B6', 'B6', 'A6', 'A6', 'F#6', 'F#6', 'D#6', 'D#6'
]),

  bass: Object.freeze([
  'E2', 'E2', 'E2', 'E2', 'B2', 'B2', 'B2', 'B2',
  'E3', 'E3', 'E3', 'E3', 'B2', 'B2', 'B2', 'B2',
  'C2', 'C2', 'C2', 'C2', 'G2', 'G2', 'G2', 'G2',
  'C3', 'C3', 'C3', 'C3', 'G2', 'G2', 'G2', 'G2',
  'G2', 'G2', 'G2', 'G2', 'D3', 'D3', 'D3', 'D3',
  'G3', 'G3', 'G3', 'G3', 'D3', 'D3', 'D3', 'D3',
  'B1', 'B1', 'B1', 'B1', 'F#2', 'F#2', 'F#2', 'F#2',
  'A2', 'A2', 'A2', 'A2', 'D#3', 'D#3', 'F#3', 'F#3'
]),

  arp: Object.freeze([
    'E4', null, 'G4', null, 'B4', null, 'G4', null,
    'E5', null, 'B4', null, 'G4', null, 'B4', null,
    'C4', null, 'E4', null, 'G4', null, 'E4', null,
    'C5', null, 'G4', null, 'E4', null, 'G4', null,
    'G4', null, 'B4', null, 'D5', null, 'B4', null,
    'G5', null, 'D5', null, 'B4', null, 'D5', null,
    'B3', null, 'D#4', null, 'F#4', null, 'A4', null,
    'B4', null, 'F#4', null, 'D#4', null, 'F#4', null
  ]),
  drums: Object.freeze([
    'KH', 'H', null, 'H', 'SH', 'H', null, 'H',
    'KH', 'H', null, 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', null, 'H', 'SH', 'H', null, 'H',
    'KH', 'H', null, 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', null, 'H', 'SH', 'H', null, 'H',
    'KH', 'H', null, 'H', 'SH', 'H', 'K', 'OH',
    'KH', 'H', null, 'H', 'SH', 'H', 'KH', 'H',
    'KS', 'H', 'K', 'H', 'SH', 'H', 'KS', 'OH'
  ])
});

// Song form: establish T, contrast with B, return to T, then make C the scarce payoff.
const ARRANGEMENT = Object.freeze([TUNE, TUNE, BRIDGE, TUNE, CHORUS, CHORUS]);

let installed = false;
let context = null;
let masterGain = null;
let noiseBuffer = null;
let schedulerTimer = 0;
let currentSection = 0;
let currentStep = 0;
let nextStepTime = 0;
let playing = false;
let soundEnabled = true;
let musicVolume = readStoredNumber(MUSIC_VOLUME_STORAGE_KEY, DEFAULT_VOLUME);
let lastNonZeroVolume = readStoredNumber(MUSIC_LAST_VOLUME_STORAGE_KEY, DEFAULT_VOLUME);
let homeToggle = null;
let blankToggle = null;
let settingsSlider = null;
let settingsOutput = null;
const activeSources = new Set();

function clamp(value, min, max, fallback = min) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function readStoredNumber(key, fallback) {
  try {
    const stored = globalThis.localStorage?.getItem(key);
    if (stored == null || stored === '') return fallback;
    const value = Number(stored);
    return Number.isFinite(value) ? clamp(value, 0, 100, fallback) : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeStoredNumber(key, value) {
  try {
    globalThis.localStorage?.setItem(key, String(Math.round(value)));
    return true;
  } catch (_) {
    return false;
  }
}

function noteToFrequency(note) {
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
  if (!match) return 440;
  const pitch = match[1];
  const octave = Number(match[2]);
  const midi = NOTE_INDEX[pitch] + (octave + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function makeGain(value = 1) {
  if (!context || typeof globalThis.GainNode !== 'function') return null;
  return new globalThis.GainNode(context, { gain: value });
}

function makeNoiseBuffer() {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}

function ensureGraph() {
  if (context || !AudioContextClass || typeof globalThis.GainNode !== 'function') return Boolean(context);
  try {
    context = new AudioContextClass({ latencyHint: 'playback' });
  } catch (_) {
    context = new AudioContextClass();
  }

  masterGain = makeGain(0);
  if (!masterGain) {
    void context.close?.();
    context = null;
    return false;
  }

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 18;
  compressor.ratio.value = 2.5;
  compressor.attack.value = 0.015;
  compressor.release.value = 0.28;
  masterGain.connect(compressor);
  compressor.connect(context.destination);
  noiseBuffer = makeNoiseBuffer();
  return true;
}

function trackSource(source) {
  activeSources.add(source);
  source.addEventListener?.('ended', () => activeSources.delete(source), { once: true });
  return source;
}

function stopActiveSources() {
  for (const source of activeSources) {
    try { source.stop(); } catch (_) {}
  }
  activeSources.clear();
}

function scheduleGainEnvelope(gain, time, peak, releaseTime, attack = 0.018) {
  gain.setValueAtTime(0.0001, time);
  gain.exponentialRampToValueAtTime(peak, time + attack);
  gain.exponentialRampToValueAtTime(0.0001, releaseTime);
}

function playFluteLead(note, time) {
  if (!note) return;
  // Chorus flute stays one octave above the T/B lead transposition.
  const hz = noteToFrequency(note) / 2;
  // One eighth note = two sixteenth-note sequencer steps. Leave a tiny articulation gap.
const duration = STEP_SECONDS * 0.88;
  const endTime = time + duration;

  const body = trackSource(context.createOscillator());
  const overtone = trackSource(context.createOscillator());
  const bodyGain = makeGain(0.9);
  const overtoneGain = makeGain(0.04);
  const amp = makeGain(0.0001);
  if (!bodyGain || !overtoneGain || !amp) return;
  const filter = context.createBiquadFilter();

  body.type = 'sine';
  overtone.type = 'sine';
  body.frequency.setValueAtTime(hz, time);
  overtone.frequency.setValueAtTime(hz * 2, time);
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  filter.Q.value = 0.18;
  scheduleGainEnvelope(amp.gain, time, 0.05, endTime, 0.035);

  body.connect(bodyGain);
  overtone.connect(overtoneGain);
  bodyGain.connect(filter);
  overtoneGain.connect(filter);
  filter.connect(amp);
  amp.connect(masterGain);

  body.start(time);
  overtone.start(time);
  body.stop(endTime + 0.01);
  overtone.stop(endTime + 0.01);
}

function playLead(note, time, { voice = 'lead' } = {}) {
  if (!note) return;
  if (voice === 'flute') {
    playFluteLead(note, time);
    return;
  }

  // User-tuned T/B lead transposition: two octaves below the written melody.
  const hz = noteToFrequency(note) / 4;
  const body = trackSource(context.createOscillator());
  const overtone = trackSource(context.createOscillator());
  const bodyGain = makeGain(0.82);
  const overtoneGain = makeGain(0.12);
  const amp = makeGain(0.0001);
  if (!bodyGain || !overtoneGain || !amp) return;
  const filter = context.createBiquadFilter();
  const duration = STEP_SECONDS;

  body.type = 'triangle';
  overtone.type = 'sine';
  body.frequency.setValueAtTime(hz, time);
  overtone.frequency.setValueAtTime(hz * 2, time);
  filter.type = 'lowpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.45;
  scheduleGainEnvelope(amp.gain, time, 0.18, time + duration * 1.05, 0.022);

  body.connect(bodyGain);
  overtone.connect(overtoneGain);
  bodyGain.connect(filter);
  overtoneGain.connect(filter);
  filter.connect(amp);
  amp.connect(masterGain);
  body.start(time);
  overtone.start(time);
  body.stop(time + duration * 1.08);
  overtone.stop(time + duration * 1.08);
}

function playBass(note, time) {
  if (!note) return;
  // User-tuned bass transposition: one octave below the written bass line.
  const hz = noteToFrequency(note) / 2;
  const body = trackSource(context.createOscillator());
  const sub = trackSource(context.createOscillator());
  const bodyGain = makeGain(0.64);
  const subGain = makeGain(0.34);
  const amp = makeGain(0.0001);
  if (!bodyGain || !subGain || !amp) return;
  const filter = context.createBiquadFilter();

  body.type = 'triangle';
  sub.type = 'sine';
  body.frequency.setValueAtTime(hz, time);
  sub.frequency.setValueAtTime(hz / 2, time);
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(1050, time);
  filter.frequency.exponentialRampToValueAtTime(280, time + STEP_SECONDS * 0.95);
  scheduleGainEnvelope(amp.gain, time, 0.21, time + STEP_SECONDS * 1.02, 0.016);

  body.connect(bodyGain);
  sub.connect(subGain);
  bodyGain.connect(filter);
  subGain.connect(filter);
  filter.connect(amp);
  amp.connect(masterGain);
  body.start(time);
  sub.start(time);
  body.stop(time + STEP_SECONDS * 1.05);
  sub.stop(time + STEP_SECONDS * 1.05);
}

function playArp(note, time) {
  if (!note) return;
  const oscillator = trackSource(context.createOscillator());
  const amp = makeGain(0.0001);
  if (!amp) return;
  const filter = context.createBiquadFilter();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(noteToFrequency(note), time);
  filter.type = 'lowpass';
  filter.frequency.value = 2300;
  filter.Q.value = 0.35;
  scheduleGainEnvelope(amp.gain, time, 0.036, time + STEP_SECONDS * 0.92, 0.012);
  oscillator.connect(filter);
  filter.connect(amp);
  amp.connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + STEP_SECONDS * 0.95);
}

function playKick(time) {
  const oscillator = trackSource(context.createOscillator());
  const amp = makeGain(0.48);
  if (!amp) return;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(112, time);
  oscillator.frequency.exponentialRampToValueAtTime(45, time + 0.16);
  amp.gain.setValueAtTime(0.48, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  oscillator.connect(amp);
  amp.connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.19);
}

function playSnare(time) {
  const source = trackSource(context.createBufferSource());
  const filter = context.createBiquadFilter();
  const amp = makeGain(0.18);
  if (!amp) return;
  source.buffer = noiseBuffer;
  filter.type = 'bandpass';
  filter.frequency.value = 1350;
  filter.Q.value = 0.55;
  amp.gain.setValueAtTime(0.18, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(masterGain);
  source.start(time);
  source.stop(time + 0.14);
}

function playHat(time, open = false) {
  const source = trackSource(context.createBufferSource());
  const filter = context.createBiquadFilter();
  const amp = makeGain(open ? 0.045 : 0.026);
  if (!amp) return;
  const duration = open ? 0.18 : 0.055;
  source.buffer = noiseBuffer;
  filter.type = 'highpass';
  filter.frequency.value = open ? 4300 : 5200;
  amp.gain.setValueAtTime(open ? 0.045 : 0.026, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(masterGain);
  source.start(time);
  source.stop(time + duration);
}

function playDrums(pattern, time) {
  if (!pattern) return;
  if (pattern.includes('K')) playKick(time);
  if (pattern.includes('S')) playSnare(time);
  if (pattern.includes('O')) playHat(time, true);
  else if (pattern.includes('H')) playHat(time, false);
}

function scheduleStep(step, time) {
  const section = ARRANGEMENT[currentSection];
  playLead(section.lead[step], time, {
    voice: section.leadVoice || 'lead'
  });
  playBass(section.bass[step], time);
  playArp(section.arp[step], time);
  playDrums(section.drums[step], time);
}

function advanceStep() {
  const section = ARRANGEMENT[currentSection];
  currentStep += 1;
  if (currentStep >= section.lead.length) {
    currentStep = 0;
    currentSection = (currentSection + 1) % ARRANGEMENT.length;
  }
  nextStepTime += STEP_SECONDS;
}

function scheduler() {
  if (!playing || !context || context.state !== 'running') return;
  while (playing && nextStepTime < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
    scheduleStep(currentStep, nextStepTime);
    advanceStep();
  }
  schedulerTimer = globalThis.setTimeout(scheduler, LOOKAHEAD_MS);
}

function clearScheduler() {
  globalThis.clearTimeout(schedulerTimer);
  schedulerTimer = 0;
}

function applyMasterVolume() {
  if (!context || !masterGain) return;
  const now = context.currentTime;
  const gain = soundEnabled && musicVolume > 0 ? DESIGNED_MASTER_GAIN * (musicVolume / 100) : 0;
  try {
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(gain, now, 0.04);
  } catch (_) {
    masterGain.gain.value = gain;
  }
}

async function startPlayback({ restart = false } = {}) {
  if (!soundEnabled || musicVolume <= 0 || document.visibilityState === 'hidden') return false;
  if (!ensureGraph()) return false;
  if (restart) {
    currentSection = 0;
    currentStep = 0;
  }
  try {
    if (context.state !== 'running') await context.resume();
  } catch (_) {
    return false;
  }
  if (context.state !== 'running') return false;
  applyMasterVolume();
  if (!playing) {
    playing = true;
    nextStepTime = context.currentTime + 0.05;
    scheduler();
  }
  return true;
}

async function stopPlayback({ reset = false } = {}) {
  playing = false;
  clearScheduler();
  stopActiveSources();
  if (reset) {
    currentSection = 0;
    currentStep = 0;
  }
  if (!context) return;
  applyMasterVolume();
  try {
    if (context.state === 'running') await context.suspend();
  } catch (_) {}
}

function shouldPlay() {
  return soundEnabled && musicVolume > 0 && document.visibilityState !== 'hidden';
}

function volumeLabel(value) {
  return value <= 0 ? 'OFF' : `${Math.round(value)}%`;
}

function renderToggle(button, compact = false) {
  if (!button) return;
  const on = musicVolume > 0;
  const action = on ? 'off' : 'on';
  const icon = on ? '<span aria-hidden="true">♫×</span>' : '<span aria-hidden="true">♫</span>';
  button.innerHTML = compact ? icon : `${icon}<span>MUSIC ${action.toUpperCase()}</span>`;
  button.setAttribute('aria-label', `Turn music ${action}`);
  button.title = `Turn music ${action}`;
  button.dataset.musicEnabled = on ? 'true' : 'false';
}

function syncControls() {
  renderToggle(homeToggle, false);
  renderToggle(blankToggle, true);
  if (settingsSlider) settingsSlider.value = String(Math.round(musicVolume));
  if (settingsOutput) {
    settingsOutput.value = volumeLabel(musicVolume);
    settingsOutput.textContent = settingsOutput.value;
  }
}

function setVolume(nextVolume, { restart = false } = {}) {
  const previous = musicVolume;
  musicVolume = clamp(Number(nextVolume), 0, 100, DEFAULT_VOLUME);
  if (musicVolume > 0) {
    lastNonZeroVolume = musicVolume;
    writeStoredNumber(MUSIC_LAST_VOLUME_STORAGE_KEY, lastNonZeroVolume);
  }
  writeStoredNumber(MUSIC_VOLUME_STORAGE_KEY, musicVolume);
  syncControls();
  if (musicVolume <= 0 || !soundEnabled) {
    void stopPlayback({ reset: musicVolume <= 0 });
    return musicVolume;
  }
  if (context && context.state === 'running') applyMasterVolume();
  if (previous <= 0 || restart || !playing) void startPlayback({ restart: previous <= 0 || restart });
  return musicVolume;
}

function toggleMusic() {
  if (musicVolume > 0) return setVolume(0);
  const restored = clamp(lastNonZeroVolume || DEFAULT_VOLUME, 1, 100, DEFAULT_VOLUME);
  return setVolume(restored, { restart: true });
}

function setSystemSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  if (!soundEnabled) void stopPlayback({ reset: false });
  else if (musicVolume > 0) void startPlayback({ restart: false });
}

function installStyles() {
  if (document.getElementById(HOME_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HOME_STYLE_ID;
  style.textContent = `
    .m8-home.m8-home-fixed-layout .m8-home-head {
      grid-template-columns: clamp(84px, 10vw, 126px) minmax(180px, 1fr) auto auto !important;
    }
    .m8-home.m8-home-fixed-layout .turn-music-home-toggle {
      grid-column: 3; grid-row: 1; align-self: center; justify-self: center;
      display: inline-flex; align-items: center; justify-content: center; gap: .38em;
      min-width: 112px; min-height: 44px; margin: 0; padding: 6px 10px;
      border: 0; border-radius: 8px; background: transparent; color: var(--m8-ink, #08090a);
      box-shadow: none; font: inherit; font-size: clamp(.72rem, 1.15vw, .98rem);
      font-weight: 950; line-height: 1; letter-spacing: .035em; cursor: pointer;
    }
    .m8-home.m8-home-fixed-layout .turn-music-home-toggle > span:first-child {
      font-size: 1.35em; letter-spacing: -.2em; margin-right: .14em;
    }
    .m8-home.m8-home-fixed-layout .turn-music-home-toggle:hover {
      text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: .2em;
    }
    .m8-home.m8-home-fixed-layout .turn-music-home-toggle:focus-visible {
      outline: 4px solid var(--m8-blue, #66c7e8); outline-offset: 2px;
    }
    .m8-home.m8-home-fixed-layout .m8-home-build,
    .m8-home.m8-home-fixed-layout .m8-home-meta { grid-column: 4 !important; }
    .m8-music-volume-row { display: grid; gap: 3px; margin-top: 16px; }
    .m8-music-volume-row small { font-weight: 650; }
    #m8MusicVolume { width: 100%; margin-top: 8px; }
    .m8-music-volume-labels {
      display: flex; justify-content: space-between; gap: 12px; margin-top: 2px;
      font-size: .75rem; font-weight: 850;
    }
    #m8MusicVolumeValue { display: block; margin-top: 4px; font-weight: 950; }
    .turn-music-blank-toggle {
      position: fixed; z-index: 2147483001; display: grid; place-items: center;
      width: 50px; height: 50px; min-width: 50px; min-height: 50px; margin: 0; padding: 4px;
      border: 3px solid #08090a; border-radius: 12px; background: #ff7b54; color: #08090a;
      box-shadow: 5px 5px 0 #08090a; font: 950 1.25rem/1 system-ui, sans-serif; touch-action: manipulation;
    }
    .turn-music-blank-toggle[hidden] { display: none; }
    .turn-music-blank-toggle:focus-visible { outline: 4px solid #ffd43b; outline-offset: 4px; }
    @media (max-height: 560px) and (orientation: landscape) {
      .m8-home.m8-home-fixed-layout .m8-home-head {
        grid-template-columns: clamp(68px, 10vw, 84px) minmax(150px, 1fr) auto auto !important;
      }
      .m8-home.m8-home-fixed-layout .turn-music-home-toggle {
        min-width: 96px; min-height: 40px; padding: 4px 7px; font-size: .72rem;
      }
    }
    @media (max-height: 430px) {
      .turn-music-blank-toggle { width: 40px; height: 40px; min-width: 40px; min-height: 40px; padding: 3px; }
    }
    @media (max-width: 760px) and (orientation: portrait) {
      .m8-home.m8-home-fixed-layout .m8-home-head { grid-template-columns: 82px minmax(0, 1fr) auto !important; }
      .m8-home.m8-home-fixed-layout .turn-music-home-toggle {
        grid-column: 3; min-width: 48px; max-width: 92px; min-height: 44px; padding-inline: 5px; font-size: .64rem;
      }
      .m8-home.m8-home-fixed-layout .m8-home-build,
      .m8-home.m8-home-fixed-layout .m8-home-meta { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

function installHomeToggle(home) {
  const header = home?.querySelector('.m8-home-head');
  const pitch = header?.querySelector('.m8-home-pitch');
  if (!header || !pitch) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'turn-music-home-toggle';
  button.addEventListener('click', toggleMusic);
  pitch.after(button);
  homeToggle = button;
  renderToggle(homeToggle, false);
  return button;
}

function installSettingsControl() {
  const dialog = document.querySelector('.m8-settings-dialog');
  const audioTitle = dialog?.querySelector('#m8AudioTitle');
  const audioCard = audioTitle?.closest('.m8-setting-card');
  if (!dialog || !audioCard || dialog.querySelector('#m8MusicVolume')) return null;

  const label = document.createElement('label');
  label.className = 'm8-music-volume-row';
  label.htmlFor = 'm8MusicVolume';
  label.innerHTML = '<strong>Music volume</strong><small>OFF stops the music engine completely.</small>';
  const slider = document.createElement('input');
  slider.id = 'm8MusicVolume';
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.value = String(Math.round(musicVolume));
  slider.setAttribute('aria-describedby', 'm8MusicVolumeValue');
  const labels = document.createElement('div');
  labels.className = 'm8-music-volume-labels';
  labels.setAttribute('aria-hidden', 'true');
  labels.innerHTML = '<span>OFF</span><span>100%</span>';
  const output = document.createElement('output');
  output.id = 'm8MusicVolumeValue';
  output.htmlFor = 'm8MusicVolume';
  output.value = volumeLabel(musicVolume);
  output.textContent = output.value;
  audioCard.append(label, slider, labels, output);
  settingsSlider = slider;
  settingsOutput = output;
  slider.addEventListener('input', () => setVolume(Number(slider.value)));
  slider.addEventListener('change', () => {
    const status = dialog.querySelector('.m8-settings-status');
    if (status) status.textContent = `Music ${musicVolume <= 0 ? 'off' : `volume ${Math.round(musicVolume)}%`}.`;
  });
  const soundToggle = dialog.querySelector('#m8AudioEnabled');
  soundToggle?.addEventListener('change', () => {
    const enabled = globalThis.__turnAudioPreferences?.getSettings?.().audioEnabled !== false;
    setSystemSoundEnabled(enabled);
  });
  dialog.addEventListener('toggle', syncControls);
  return slider;
}

function positionBlankToggle() {
  if (!blankToggle) return;
  const blankControl = document.querySelector('.turn-screen-blank-control[data-state="active"]');
  const blanked = document.documentElement.classList.contains('turn-screen-blanked');
  if (!blanked || !blankControl || blankControl.hidden) {
    blankToggle.hidden = true;
    return;
  }
  const rect = blankControl.getBoundingClientRect();
  const gap = 10;
  const size = rect.width || 50;
  let left = rect.right + gap;
  if (left + size > globalThis.innerWidth - 8) left = Math.max(8, rect.left - gap - size);
  blankToggle.style.left = `${left}px`;
  blankToggle.style.top = `${rect.top}px`;
  blankToggle.style.width = `${size}px`;
  blankToggle.style.height = `${rect.height || size}px`;
  blankToggle.hidden = false;
}

function installBlankScreenToggle() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'turn-music-blank-toggle';
  button.hidden = true;
  button.addEventListener('click', toggleMusic);
  document.body.appendChild(button);
  blankToggle = button;
  renderToggle(blankToggle, true);
  const observer = new MutationObserver(positionBlankToggle);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  const blankControl = document.querySelector('.turn-screen-blank-control');
  if (blankControl) observer.observe(blankControl, { attributes: true, attributeFilter: ['data-state', 'hidden', 'style'] });
  globalThis.addEventListener('resize', positionBlankToggle, { passive: true });
  return button;
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    void stopPlayback({ reset: false });
    return;
  }
  if (shouldPlay()) void startPlayback({ restart: false });
}

function handleUserActivation() {
  if (!shouldPlay() || playing) return;
  void startPlayback({ restart: false });
}

export function installRacingMusic({ home = document.querySelector('.m8-home') } = {}) {
  if (installed) return globalThis.__turnRacingMusic;
  installed = true;
  soundEnabled = globalThis.__turnAudioPreferences?.getSettings?.().audioEnabled !== false;
  installStyles();
  installHomeToggle(home);
  installSettingsControl();
  installBlankScreenToggle();
  syncControls();
  document.addEventListener('pointerdown', handleUserActivation, { capture: true, passive: true });
  document.addEventListener('keydown', handleUserActivation, { capture: true });
  document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
  globalThis.addEventListener('pagehide', () => void stopPlayback({ reset: false }), { passive: true });
  if (shouldPlay()) void startPlayback({ restart: false });

  const api = Object.freeze({
    bpm: BPM,
    arrangement: Object.freeze(ARRANGEMENT.map((section) => section.name)),
    timbre: 'warm-v3-eighth-note-flute-chorus',
    get volume() { return musicVolume; },
    get enabled() { return musicVolume > 0; },
    get playing() { return playing; },
    get state() { return context?.state || 'not-created'; },
    setVolume,
    toggle: toggleMusic,
    start: () => startPlayback({ restart: false }),
    stop: () => setVolume(0),
    syncControls
  });
  globalThis.__turnRacingMusic = api;
  return api;
}
