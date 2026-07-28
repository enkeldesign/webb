import {
  getTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '../tracks/pace-notes.js';

const PACE_NOTE_UPDATE_INTERVAL_MS = 1000 / 30;
const MIN_FORWARD_SPEED = 0.25;
const MAX_FORWARD_PROGRESS_DELTA = 0.22;
const NOTE_DURATION_SECONDS = 0.055;
const NOTE_STEP_SECONDS = 0.105;
const GROUP_GAP_SECONDS = 0.22;

let installed = false;
let wrappedAudio = null;
let activeTrackId = null;
let activeLapKey = null;
let firedNoteIds = new Set();
let lastCheckedAt = -Infinity;
let lastProgress = null;

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

  const mode = String(state.mode || '');
  if (
    state.running !== true
    || mode === 'spectating'
    || frame.active === false
    || firedNoteIds.size >= notes.length
  ) return null;

  const sampleCount = samples.length;
  const index = normalizeIndex(state.nearestTrackIndex, sampleCount);
  const sample = samples[index];
  const progress = normalizeProgress(
    Number.isFinite(Number(state.progress)) ? Number(state.progress) : index / sampleCount
  );
  const previousProgress = lastProgress;
  lastProgress = progress;

  const forwardSpeed = dot2(state.velocity, sample?.tangent);
  const crossedForward = previousProgress !== null
    && forwardProgressDelta(previousProgress, progress) <= MAX_FORWARD_PROGRESS_DELTA;
  if (forwardSpeed < MIN_FORWARD_SPEED && !crossedForward) return null;

  const speed = Math.max(0, Number(state.speed) || Number(frame.speed) || 0);
  const triggeredNotes = [];

  for (const note of notes) {
    if (firedNoteIds.has(note.id)) continue;
    const trigger = speedAdjustedPaceNoteTrigger(note, speed, runtime.maxSpeed);
    const crossedTrigger = progressCrossedForward(previousProgress, progress, trigger);
    const insideTriggerZone = progressInRange(progress, trigger, note.triggerEnd);
    if (!crossedTrigger && !insideTriggerZone) continue;

    firedNoteIds.add(note.id);
    const detail = {
      id: note.id,
      passageKey: `${lapKey}:${note.id}`,
      trackId,
      progress,
      trigger,
      speed,
      authoredGroups: note.groups,
      groups: paceNotePhraseGroups(note.groups)
    };
    publishPaceNote(detail);
    triggeredNotes.push(note);
  }

  return triggeredNotes[0] || null;
}

export function resetPaceNotePassage(trackId = null, lapKey = null) {
  activeTrackId = trackId;
  activeLapKey = lapKey;
  firedNoteIds = new Set();
  lastCheckedAt = -Infinity;
  lastProgress = null;
}

export function progressInRange(progress, start, end) {
  const value = normalizeProgress(progress);
  const from = normalizeProgress(start);
  const to = normalizeProgress(end);
  return from <= to
    ? value >= from && value <= to
    : value >= from || value <= to;
}

export function progressCrossedForward(previousProgress, progress, target) {
  if (!Number.isFinite(Number(previousProgress))) return false;
  const advance = forwardProgressDelta(previousProgress, progress);
  if (advance <= 0 || advance > MAX_FORWARD_PROGRESS_DELTA) return false;
  const distanceToTarget = forwardProgressDelta(previousProgress, target);
  return distanceToTarget > 0 && distanceToTarget <= advance;
}

export function paceNoteLengthTailCount(length) {
  return String(length || 'short').toLowerCase() === 'long' ? 1 : 0;
}

export function paceNotePhraseGroups(groups = []) {
  const phrase = [];

  for (const group of groups) {
    phrase.push({ ...group });
    const tailCount = paceNoteLengthTailCount(group?.length);
    for (let index = 0; index < tailCount; index += 1) {
      phrase.push({
        direction: group?.direction,
        severity: 1,
        lengthMarker: true
      });
    }
  }

  return phrase;
}

export function paceNoteDuration(groups = []) {
  const phrase = paceNotePhraseGroups(groups);
  let duration = 0;

  phrase.forEach((group, groupIndex) => {
    const count = clamp(Math.round(Number(group?.severity) || 1), 1, 3);
    duration += NOTE_DURATION_SECONDS + (count - 1) * NOTE_STEP_SECONDS;
    if (groupIndex < phrase.length - 1) duration += GROUP_GAP_SECONDS;
  });

  return duration;
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
  const eventName = globalThis.__turnPaceNotePriorityReady === true
    ? 'turn:pace-note-priority'
    : 'turn:pace-note';
  globalThis.dispatchEvent(new globalThis.CustomEvent(eventName, { detail }));
}

function publishPaceNoteSilence() {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new globalThis.CustomEvent('turn:pace-note-silence'));
}

function dot2(a, b) {
  return (Number(a?.x) || 0) * (Number(b?.x) || 0)
    + (Number(a?.z) || 0) * (Number(b?.z) || 0);
}

function forwardProgressDelta(from, to) {
  return normalizeProgress(Number(to) - Number(from));
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
