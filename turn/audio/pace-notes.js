import {
  getTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '../tracks/pace-notes.js';

const PACE_NOTE_UPDATE_INTERVAL_MS = 1000 / 30;
const MIN_TRIGGER_SPEED = 5;
const MIN_FORWARD_ALIGNMENT = 0.35;
const NOTE_DURATION_SECONDS = 0.055;
const NOTE_MEDIUM_DURATION_SECONDS = 0.13;
const NOTE_LONG_DURATION_SECONDS = 0.21;
const NOTE_STEP_SECONDS = 0.105;
const GROUP_GAP_SECONDS = 0.22;

let installed = false;
let wrappedAudio = null;
let activeTrackId = null;
let activeLapKey = null;
let firedNoteIds = new Set();
let lastCheckedAt = -Infinity;

export function installPaceNotes() {
  if (installed) return wrappedAudio || globalThis.__turnAudio;
  const baseAudio = globalThis.__turnAudio;
  if (!baseAudio) return null;

  installed = true;
  installResetListeners();

  wrappedAudio = Object.freeze({
    unlock: (...args) => baseAudio.unlock(...args),
    update(frame = {}, now = performance.now()) {
      if (now - lastCheckedAt >= PACE_NOTE_UPDATE_INTERVAL_MS) {
        updatePaceNoteState(globalThis.__turnRuntime, frame);
        lastCheckedAt = now;
      }
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
    || firedNoteIds.size >= notes.length
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
  lastCheckedAt = -Infinity;
}

export function progressInRange(progress, start, end) {
  const value = normalizeProgress(progress);
  const from = normalizeProgress(start);
  const to = normalizeProgress(end);
  return from <= to
    ? value >= from && value <= to
    : value >= from || value <= to;
}

export function paceNoteLengthDuration(length) {
  switch (String(length || 'short').toLowerCase()) {
    case 'long':
      return NOTE_LONG_DURATION_SECONDS;
    case 'medium':
      return NOTE_MEDIUM_DURATION_SECONDS;
    case 'short':
    default:
      return NOTE_DURATION_SECONDS;
  }
}

export function paceNoteDuration(groups = []) {
  let cursor = 0;
  let end = 0;

  groups.forEach((group, groupIndex) => {
    const count = clamp(Math.round(Number(group?.severity) || 1), 1, 3);
    const finalBeepStart = cursor + (count - 1) * NOTE_STEP_SECONDS;
    end = Math.max(end, finalBeepStart + paceNoteLengthDuration(group?.length));
    if (groupIndex < groups.length - 1) cursor = finalBeepStart + GROUP_GAP_SECONDS;
  });

  return end;
}

function installResetListeners() {
  if (typeof window === 'undefined') return;
  window.addEventListener('turn:track-changed', () => {
    resetPaceNotePassage();
    publishPaceNoteSilence();
  });
  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    if (!event.detail?.running || reason === 'race-reset') {
      resetPaceNotePassage();
      publishPaceNoteSilence();
    }
  });
}

function publishPaceNote(detail) {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new globalThis.CustomEvent('turn:pace-note', { detail }));
}

function publishPaceNoteSilence() {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new globalThis.CustomEvent('turn:pace-note-silence'));
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
