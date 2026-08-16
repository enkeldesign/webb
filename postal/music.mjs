import { createToneRuntime } from '../turn/audio/music/tone-runtime.js?revision=r184-score-v2';
import { createDrumRuntime } from '../turn/audio/music/drum-runtime.js?revision=r184-score-v2';
import { bars, makeSection, makeSong } from '../turn/audio/music/song-tools.js?revision=r186-note-ties';

const TUNE = makeSection({
  name: 'tune',
  leadVoice: 'organ', bassVoice: 'drone', arpVoice: 'glass', drumKit: 'brush',
  lead: bars(
    'G5 - - - B5 - - - D6 - - - B5 - - -',
    'A5 - - - F#5 - - - D6 - - - A5 - - -',
    'G5 - - - E5 - - - B5 - - - G5 - - -',
    'E5 - - - G5 - - - B5 - - - D6 - - -'
  ),
  bass: bars(
    'G2 - - - D3 - - - G2 - - - D3 - - -',
    'F#2 - - - A2 - - - D3 - - - A2 - - -',
    'E2 - - - B2 - - - E3 - - - B2 - - -',
    'C2 - - - G2 - - - C3 - - - D3 - - -'
  ),
  arp: bars(
    'G4 - B4 - D5 - B4 - G5 - D5 - B4 - D5 -',
    'F#4 - A4 - D5 - A4 - F#5 - D5 - A4 - D5 -',
    'E4 - G4 - B4 - G4 - E5 - B4 - G4 - B4 -',
    'C4 - E4 - G4 - E4 - C5 - G4 - D5 - G4 -'
  ),
  drums: bars(
    'K - - - R - - - - - - - R - - -',
    '- - - - R - - - K - - - R - - -',
    'K - - - R - - - - - - - R - - -',
    '- - - - R - - - K - - - R - - -'
  )
});

const CHORUS = makeSection({
  name: 'chorus',
  leadVoice: 'bell', bassVoice: 'drone', arpVoice: 'soft', drumKit: 'brush',
  lead: bars(
    'B5 - - - D6 - - - G6 - - - D6 - - -',
    'A5 - - - D6 - - - F#6 - - - E6 - - -',
    'G5 - - - B5 - - - E6 - - - B5 - - -',
    'A5 - - - D6 - - - F#6 - - - D6 - - -'
  ),
  bass: bars(
    'E2 - - - B2 - - - E3 - - - B2 - - -',
    'C2 - - - G2 - - - C3 - - - G2 - - -',
    'G2 - - - D3 - - - G3 - - - D3 - - -',
    'D2 - - - A2 - - - D3 - - - A2 - - -'
  ),
  arp: bars(
    'E4 - B4 - G4 - B4 - E5 - B4 - G4 - B4 -',
    'C4 - G4 - E4 - G4 - C5 - G4 - E4 - G4 -',
    'G4 - D5 - B4 - D5 - G5 - D5 - B4 - D5 -',
    'D4 - A4 - F#4 - A4 - D5 - A4 - F#4 - A4 -'
  ),
  drums: bars(
    'K - - - R - - - - - - - R - - -',
    '- - - - R - - - K - - - R - - -',
    'K - - - R - - - - - - - R - - -',
    '- - - - R - - - K - - - R - - -'
  )
});

const BRIDGE = makeSection({
  name: 'bridge',
  leadVoice: 'organ', bassVoice: 'drone', arpVoice: 'organ', drumKit: 'brush',
  lead: bars(
    'C6 - - - B5 - - - G5 - - - E5 - - -',
    'A5 - - - F#5 - - - D5 - - - F#5 - - -',
    'B5 - - - G5 - - - E5 - - - G5 - - -',
    'A5 - - - D6 - - - B5 - - - G5 - - -'
  ),
  bass: bars(
    'C2 - - - G2 - - - C3 - - - G2 - - -',
    'D2 - - - A2 - - - D3 - - - A2 - - -',
    'E2 - - - B2 - - - E3 - - - B2 - - -',
    'G2 - - - D3 - - - G3 - - - D3 - - -'
  ),
  arp: bars(
    'C4 - - E4 - - G4 - - E4 - - G4 - - -',
    'D4 - - F#4 - - A4 - - F#4 - - A4 - - -',
    'E4 - - G4 - - B4 - - G4 - - B4 - - -',
    'G4 - - B4 - - D5 - - B4 - - D5 - - -'
  ),
  drums: bars(
    '- - R - - - R - - - R - - - R -',
    '- - R - - - R - - - R - - - R -',
    '- - R - - - R - - - R - - - R -',
    '- - R - - - R - - - R - - - R -'
  )
});

export const POSTAL_SONG = makeSong({
  id: 'morning-routes',
  name: 'Morning Routes',
  bpm: 78,
  key: 'G major / E minor',
  style: 'calm Scandinavian logistics score',
  swing: 0.08,
  sections: [TUNE, CHORUS, BRIDGE],
  arrangement: ['tune', 'tune', 'chorus', 'tune', 'bridge', 'chorus']
});

const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
const STORAGE_KEY = 'postal-music-volume-v1';
const LAST_VOLUME_KEY = 'postal-music-last-volume-v1';
const DEFAULT_VOLUME = 48;
const DESIGNED_MASTER_GAIN = 0.28;
const STEPS_PER_BEAT = 4;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.12;
const NOTE_INDEX = Object.freeze({
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
});

let installed = false;
let context = null;
let masterGain = null;
let tones = null;
let drums = null;
let schedulerTimer = 0;
let currentSection = 0;
let currentStep = 0;
let nextStepTime = 0;
let playing = false;
let musicButton = null;
let musicVolume = readStoredNumber(STORAGE_KEY, DEFAULT_VOLUME);
let lastNonZeroVolume = readStoredNumber(LAST_VOLUME_KEY, DEFAULT_VOLUME);
const stepSeconds = (60 / POSTAL_SONG.bpm) / STEPS_PER_BEAT;
const supported = Boolean(AudioContextClass && typeof globalThis.GainNode === 'function');

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
  } catch { return fallback; }
}

function writeStoredNumber(key, value) {
  try { globalThis.localStorage?.setItem(key, String(Math.round(value))); }
  catch {}
}

function noteToFrequency(note) {
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note);
  if (!match) return 440;
  const midi = NOTE_INDEX[match[1]] + (Number(match[2]) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function makeNoiseBuffer() {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
  return buffer;
}

function ensureGraph() {
  if (context || !supported) return Boolean(context);
  try { context = new AudioContextClass({ latencyHint: 'playback' }); }
  catch { context = new AudioContextClass(); }

  masterGain = new GainNode(context, { gain: 0 });
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 22;
  compressor.ratio.value = 2.2;
  compressor.attack.value = 0.025;
  compressor.release.value = 0.4;
  masterGain.connect(compressor);
  compressor.connect(context.destination);

  const noiseBuffer = makeNoiseBuffer();
  tones = createToneRuntime({ context, masterGain, noteToFrequency, getStepSeconds: () => stepSeconds });
  drums = createDrumRuntime({ context, masterGain, noiseBuffer });
  return true;
}

function activeSection() {
  return POSTAL_SONG.arrangement[currentSection];
}

function scheduleStep(step, time) {
  const section = activeSection();
  tones?.playLead(section.lead[step], time, section.leadVoice);
  tones?.playBass(section.bass[step], time, section.bassVoice);
  tones?.playArp(section.arp[step], time, section.arpVoice);
  drums?.play(section.drums[step], time, section.drumKit);
}

function advanceStep() {
  const completedStep = currentStep;
  currentStep += 1;
  if (currentStep >= activeSection().lead.length) {
    currentStep = 0;
    currentSection = (currentSection + 1) % POSTAL_SONG.arrangement.length;
  }
  const swing = POSTAL_SONG.swing;
  nextStepTime += stepSeconds * (completedStep % 2 === 0 ? 1 + swing : 1 - swing);
}

function scheduler() {
  if (!playing || !context || context.state !== 'running') return;
  while (nextStepTime < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
    scheduleStep(currentStep, nextStepTime);
    advanceStep();
  }
  schedulerTimer = globalThis.setTimeout(scheduler, LOOKAHEAD_MS);
}

function clearScheduler() {
  globalThis.clearTimeout(schedulerTimer);
  schedulerTimer = 0;
}

function applyVolume() {
  if (!masterGain || !context) return;
  const gain = musicVolume > 0 ? DESIGNED_MASTER_GAIN * (musicVolume / 100) : 0;
  const now = context.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setTargetAtTime(gain, now, 0.08);
}

function syncButton() {
  if (!musicButton) return;
  const enabled = supported && musicVolume > 0;
  musicButton.disabled = !supported;
  musicButton.setAttribute('aria-pressed', String(enabled));
  musicButton.setAttribute('aria-label', supported ? `Turn music ${enabled ? 'off' : 'on'}` : 'Music is not supported on this device');
  musicButton.title = musicButton.getAttribute('aria-label');
}

async function startPlayback({ restart = false } = {}) {
  if (!supported || musicVolume <= 0 || document.visibilityState === 'hidden') return false;
  if (!ensureGraph()) return false;
  if (restart) { currentSection = 0; currentStep = 0; }
  try { if (context.state !== 'running') await context.resume(); }
  catch { return false; }
  if (context.state !== 'running') return false;
  applyVolume();
  if (!playing) {
    playing = true;
    nextStepTime = context.currentTime + 0.06;
    scheduler();
  }
  return true;
}

async function stopPlayback({ reset = false } = {}) {
  playing = false;
  clearScheduler();
  tones?.stop();
  drums?.stop();
  if (reset) { currentSection = 0; currentStep = 0; }
  if (!context) return;
  applyVolume();
  try { if (context.state === 'running') await context.suspend(); }
  catch {}
}

function setVolume(nextVolume, { restart = false } = {}) {
  const previous = musicVolume;
  musicVolume = clamp(Number(nextVolume), 0, 100, DEFAULT_VOLUME);
  if (musicVolume > 0) {
    lastNonZeroVolume = musicVolume;
    writeStoredNumber(LAST_VOLUME_KEY, lastNonZeroVolume);
  }
  writeStoredNumber(STORAGE_KEY, musicVolume);
  syncButton();
  if (musicVolume <= 0) void stopPlayback({ reset: true });
  else if (previous <= 0 || restart || !playing) void startPlayback({ restart: previous <= 0 || restart });
  else applyVolume();
  return musicVolume;
}

function toggleMusic() {
  if (musicVolume > 0) return setVolume(0);
  return setVolume(clamp(lastNonZeroVolume || DEFAULT_VOLUME, 1, 100, DEFAULT_VOLUME), { restart: true });
}

function announceMusic() {
  const live = document.querySelector('#live-region');
  if (live) live.textContent = musicVolume > 0 ? `Music on. ${POSTAL_SONG.name}.` : 'Music off.';
}

function handleActivation() {
  if (musicVolume > 0 && !playing) void startPlayback();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') void stopPlayback();
  else if (musicVolume > 0) void startPlayback();
}

export function installPostalMusic({ button = document.querySelector('#music-btn') } = {}) {
  if (installed) return globalThis.__postalMusic;
  installed = true;
  musicButton = button;
  syncButton();
  musicButton?.addEventListener('click', () => { toggleMusic(); announceMusic(); });
  document.addEventListener('pointerdown', handleActivation, { capture: true, passive: true });
  document.addEventListener('keydown', handleActivation, { capture: true });
  document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
  globalThis.addEventListener('pagehide', () => void stopPlayback(), { passive: true });

  const api = Object.freeze({
    name: POSTAL_SONG.name,
    bpm: POSTAL_SONG.bpm,
    get enabled() { return musicVolume > 0; },
    get playing() { return playing; },
    get volume() { return musicVolume; },
    get state() { return context?.state || 'not-created'; },
    setVolume,
    toggle: toggleMusic,
    start: () => startPlayback(),
    stop: () => setVolume(0)
  });
  globalThis.__postalMusic = api;
  return api;
}
