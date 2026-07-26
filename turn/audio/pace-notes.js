import {
  getTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '../tracks/pace-notes.js';

const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
const MIN_TRIGGER_SPEED = 5;
const MIN_FORWARD_ALIGNMENT = 0.35;
const NOTE_LEVEL = 0.052;
const NOTE_DURATION_SECONDS = 0.055;
const NOTE_STEP_SECONDS = 0.105;
const GROUP_GAP_SECONDS = 0.22;

let installed = false;
let context = null;
let masterGain = null;
let wrappedAudio = null;
let activeTrackId = null;
let activeLapKey = null;
let firedNoteIds = new Set();
const activeSources = new Set();

export function installPaceNotes() {
  if (installed) return wrappedAudio || globalThis.__turnAudio;
  const baseAudio = globalThis.__turnAudio;
  if (!baseAudio) return null;

  installed = true;
  installUnlockListeners();
  installResetListeners();

  wrappedAudio = Object.freeze({
    unlock: (...args) => Promise.all([baseAudio.unlock(...args), unlock()]).then(([ready]) => ready),
    update(frame = {}, now = performance.now()) {
      updatePaceNoteState(globalThis.__turnRuntime, frame);
      baseAudio.update(frame, now);
    },
    cue: (...args) => baseAudio.cue(...args),
    silence(...args) {
      silencePaceNotes();
      return baseAudio.silence(...args);
    },
    get available() {
      return baseAudio.available;
    },
    get state() {
      return baseAudio.state;
    }
  });

  globalThis.__turnAudio = wrappedAudio;
  return wrappedAudio;
}

export function updatePaceNoteState(runtime, frame = {}) {
  const state = runtime?.state;
  const samples = runtime?.samples;
  const trackId = String(runtime?.trackId || state?.trackId || globalThis.__turnGetTrackId?.() || '');
  const notes = getTrackPaceNotes(trackId);

  if (!state || !Array.isArray(samples) || !notes.length) {
    resetPaceNotePassage(trackId || null, null);
    return null;
  }

  const lapKey = `${trackId}:${Math.max(1, Math.round(Number(state.lap) || 1))}`;
  if (trackId !== activeTrackId || lapKey !== activeLapKey) {
    resetPaceNotePassage(trackId, lapKey);
  }

  const speed = Math.max(0, Number(state.speed) || Number(frame.speed) || 0);
  const mode = String(state.mode || '');
  if (
    state.running !== true
    || mode === 'spectating'
    || frame.active === false
    || state.offRoad === true
    || speed < MIN_TRIGGER_SPEED
  ) return null;

  const sampleCount = samples.length;
  const index = normalizeIndex(state.nearestTrackIndex, sampleCount);
  const sample = samples[index];
  const forward = runtime.getForward?.();
  const headingAlignment = dot2(forward, sample?.tangent);
  const forwardSpeed = dot2(state.velocity, sample?.tangent);
  if (headingAlignment < MIN_FORWARD_ALIGNMENT || forwardSpeed < 2) return null;

  const progress = normalizeProgress(
    Number.isFinite(Number(state.progress)) ? Number(state.progress) : index / sampleCount
  );

  for (const note of notes) {
    if (firedNoteIds.has(note.id)) continue;
    const trigger = speedAdjustedPaceNoteTrigger(note, speed, runtime.maxSpeed);
    if (!progressInRange(progress, trigger, note.triggerEnd)) continue;

    firedNoteIds.add(note.id);
    playPaceNote(note.groups);
    publishPaceNote({
      id: note.id,
      trackId,
      progress,
      trigger,
      speed,
      groups: note.groups
    });
    return note;
  }

  return null;
}

export function resetPaceNotePassage(trackId = null, lapKey = null) {
  activeTrackId = trackId;
  activeLapKey = lapKey;
  firedNoteIds = new Set();
}

export function progressInRange(progress, start, end) {
  const value = normalizeProgress(progress);
  const from = normalizeProgress(start);
  const to = normalizeProgress(end);
  return from <= to
    ? value >= from && value <= to
    : value >= from || value <= to;
}

export function paceNoteDuration(groups = []) {
  let duration = 0;
  groups.forEach((group, groupIndex) => {
    const count = clamp(Math.round(Number(group?.severity) || 1), 1, 3);
    duration += NOTE_DURATION_SECONDS + (count - 1) * NOTE_STEP_SECONDS;
    if (groupIndex < groups.length - 1) duration += GROUP_GAP_SECONDS;
  });
  return duration;
}

function installUnlockListeners() {
  if (typeof document === 'undefined') return;
  document.addEventListener('pointerdown', unlockFromGesture, { capture: true, passive: true });
  document.addEventListener('keydown', unlockFromGesture, { capture: true });
}

function installResetListeners() {
  if (typeof window === 'undefined') return;
  window.addEventListener('turn:track-changed', () => resetPaceNotePassage());
  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    if (!event.detail?.running || reason === 'race-reset') {
      resetPaceNotePassage();
      silencePaceNotes();
    }
  });
}

function unlockFromGesture() {
  void unlock();
}

async function unlock() {
  if (!AudioContextClass) return false;
  ensureGraph();
  if (!context) return false;
  if (context.state === 'running') return true;
  try {
    await context.resume();
  } catch (_) {
    return false;
  }
  return context.state === 'running';
}

function ensureGraph() {
  if (context || !AudioContextClass) return;
  try {
    context = new AudioContextClass({ latencyHint: 'interactive' });
  } catch (_) {
    context = new AudioContextClass();
  }

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 8;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.12;

  masterGain = context.createGain();
  masterGain.gain.value = 0.72;
  masterGain.connect(compressor);
  compressor.connect(context.destination);
}

function playPaceNote(groups = []) {
  void unlock().then((ready) => {
    if (!ready || !context || !masterGain) return;
    let cursor = context.currentTime + 0.012;

    groups.forEach((group, groupIndex) => {
      const direction = Math.sign(Number(group?.direction) || 0);
      const severity = clamp(Math.round(Number(group?.severity) || 1), 1, 3);
      const pan = direction < 0 ? -0.96 : 0.96;

      for (let index = 0; index < severity; index += 1) {
        scheduleDryPaceBeep(cursor, pan, severity);
        cursor += NOTE_STEP_SECONDS;
      }

      if (groupIndex < groups.length - 1) cursor += GROUP_GAP_SECONDS - NOTE_STEP_SECONDS;
    });
  });
}

function scheduleDryPaceBeep(startAt, pan, severity) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const panner = createPanner();
  const endAt = startAt + NOTE_DURATION_SECONDS;
  const baseFrequency = 650 + severity * 38;

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(baseFrequency, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 1.13, endAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(NOTE_LEVEL, startAt + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  if (panner.pan) panner.pan.setValueAtTime(pan, startAt);
  oscillator.connect(gain);
  gain.connect(panner);
  panner.connect(masterGain);

  activeSources.add(oscillator);
  oscillator.addEventListener('ended', () => {
    activeSources.delete(oscillator);
    oscillator.disconnect();
    gain.disconnect();
    panner.disconnect();
  }, { once: true });

  oscillator.start(startAt);
  oscillator.stop(endAt + 0.01);
}

function createPanner() {
  if (typeof context.createStereoPanner === 'function') return context.createStereoPanner();
  const gain = context.createGain();
  gain.pan = null;
  return gain;
}

function silencePaceNotes() {
  for (const source of activeSources) {
    try {
      source.stop();
    } catch (_) {}
  }
  activeSources.clear();
}

function publishPaceNote(detail) {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new globalThis.CustomEvent('turn:pace-note', { detail }));
}

function dot2(a, b) {
  return (Number(a?.x) || 0) * (Number(b?.x) || 0)
    + (Number(a?.z) || 0) * (Number(b?.z) || 0);
}

function normalizeIndex(value, length) {
  const index = Math.round(Number(value) || 0) % length;
  return index < 0 ? index + length : index;
}

function normalizeProgress(value) {
  const progress = Number(value) || 0;
  return ((progress % 1) + 1) % 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
