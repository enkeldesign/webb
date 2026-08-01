const PACE_NOTE_EVENT = 'turn:pace-note-priority';
const PACE_NOTE_SILENCE_EVENT = 'turn:pace-note-silence';
const PACE_NOTE_LEVEL = 0.084;
const PACE_NOTE_DURATION_SECONDS = 0.055;
const PACE_NOTE_LONG_DURATION_SECONDS = 0.17;
const PACE_NOTE_STEP_SECONDS = 0.105;
const PACE_NOTE_GROUP_GAP_SECONDS = 0.22;
const PACE_NOTE_PHRASE_GAP_SECONDS = 0.07;
const RESUME_RETRY_INTERVAL_MS = 180;
const DEFAULT_AUDIO_BALANCE = 0.5;

const CAPTURED_GRAPH = Object.seal({
  context: null,
  masterGain: null
});

let prepared = false;
let installed = false;
let wrappedAudio = null;
let baseAudio = null;
let priorityBus = null;
let nextPhraseAt = 0;
let resumeInFlight = false;
let lastResumeAttemptAt = -Infinity;
const pendingPaceNotes = [];
const pendingKeys = new Set();
const activePaceNoteSources = new Set();

export function preparePaceNotePriorityCapture() {
  if (prepared) return;
  prepared = true;

  const prototypes = [
    globalThis.AudioContext?.prototype,
    globalThis.webkitAudioContext?.prototype
  ].filter(Boolean);

  for (const prototype of [...new Set(prototypes)]) {
    const currentCreateGain = prototype?.createGain;
    if (typeof currentCreateGain !== 'function') continue;
    if (currentCreateGain.__turnPaceNotePriorityPatched) continue;

    function createCapturedGain(...args) {
      const node = currentCreateGain.apply(this, args);
      if (!CAPTURED_GRAPH.context) {
        CAPTURED_GRAPH.context = this;
        CAPTURED_GRAPH.masterGain = node;
      }
      return node;
    }

    createCapturedGain.__turnPaceNotePriorityPatched = true;
    replacePrototypeMethod(prototype, 'createGain', createCapturedGain);
  }
}

export function installPaceNotePriority() {
  if (installed) return wrappedAudio || globalThis.__turnAudio;
  const currentAudio = globalThis.__turnAudio;
  if (!currentAudio) return null;

  preparePaceNotePriorityCapture();
  installed = true;
  baseAudio = currentAudio;

  if (typeof window !== 'undefined') {
    window.addEventListener(PACE_NOTE_EVENT, handlePriorityPaceNote);
    window.addEventListener(PACE_NOTE_SILENCE_EVENT, clearPaceNoteDelivery);
  }

  wrappedAudio = Object.freeze({
    async unlock(...args) {
      const ready = await baseAudio.unlock(...args);
      if (ready) flushPendingPaceNotes(nowMilliseconds(), true);
      return ready;
    },
    update(frame = {}, now = performance.now()) {
      baseAudio.update(frame, now);
      flushPendingPaceNotes(now);
    },
    cue: (...args) => baseAudio.cue(...args),
    silence(...args) {
      clearPaceNoteDelivery();
      return baseAudio.silence(...args);
    },
    get available() {
      return baseAudio.available;
    },
    get state() {
      return baseAudio.state;
    }
  });

  globalThis.__turnPaceNotePriorityReady = true;
  globalThis.__turnAudio = wrappedAudio;
  return wrappedAudio;
}

export function enqueuePriorityPaceNote(detail = {}) {
  const groups = Array.isArray(detail.groups) ? detail.groups : [];
  if (!groups.length || !priorityAudioEnabled()) return false;

  const key = String(
    detail.passageKey
    || `${detail.trackId || 'track'}:${detail.id || 'note'}:${detail.progress ?? pendingPaceNotes.length}`
  );
  if (pendingKeys.has(key)) return false;

  pendingKeys.add(key);
  pendingPaceNotes.push(Object.freeze({
    key,
    groups: groups.map((group) => Object.freeze({ ...group }))
  }));
  return true;
}

export function pendingPriorityPaceNoteCount() {
  return pendingPaceNotes.length;
}

function handlePriorityPaceNote(event) {
  if (!enqueuePriorityPaceNote(event.detail)) return;
  flushPendingPaceNotes(nowMilliseconds(), true);
}

function flushPendingPaceNotes(now = nowMilliseconds(), forceResume = false) {
  if (!pendingPaceNotes.length) return;
  if (!priorityAudioEnabled()) {
    clearPaceNoteDelivery();
    return;
  }

  const context = CAPTURED_GRAPH.context;
  if (!context || context.state !== 'running') {
    requestAudioResume(now, forceResume);
    return;
  }
  if (!ensurePriorityGraph()) return;

  updatePriorityGain();
  while (pendingPaceNotes.length && context.state === 'running') {
    const note = pendingPaceNotes[0];
    try {
      const startAt = Math.max(context.currentTime + 0.012, nextPhraseAt);
      nextPhraseAt = schedulePaceNoteGroups(note.groups, startAt) + PACE_NOTE_PHRASE_GAP_SECONDS;
      pendingPaceNotes.shift();
      pendingKeys.delete(note.key);
    } catch (_) {
      requestAudioResume(now, true);
      return;
    }
  }
}

function requestAudioResume(now, force = false) {
  if (!baseAudio || resumeInFlight) return;
  if (!force && now - lastResumeAttemptAt < RESUME_RETRY_INTERVAL_MS) return;

  lastResumeAttemptAt = now;
  resumeInFlight = true;
  void Promise.resolve(baseAudio.unlock())
    .then((ready) => {
      resumeInFlight = false;
      if (ready || CAPTURED_GRAPH.context?.state === 'running') {
        flushPendingPaceNotes(nowMilliseconds(), true);
      }
    })
    .catch(() => {
      resumeInFlight = false;
    });
}

function ensurePriorityGraph() {
  if (priorityBus) return true;
  const context = CAPTURED_GRAPH.context;
  const masterGain = CAPTURED_GRAPH.masterGain;
  if (!context || !masterGain) return false;

  priorityBus = context.createGain();
  priorityBus.gain.value = 1;
  priorityBus.connect(masterGain);
  context.addEventListener?.('statechange', handleContextStateChange);
  return true;
}

function handleContextStateChange() {
  if (CAPTURED_GRAPH.context?.state === 'running') {
    flushPendingPaceNotes(nowMilliseconds(), true);
  }
}

function schedulePaceNoteGroups(groups, startAt) {
  let cursor = startAt;
  let phraseEndAt = startAt;

  groups.forEach((group, groupIndex) => {
    const direction = Math.sign(Number(group?.direction) || 0);
    const severity = clamp(Math.round(Number(group?.severity) || 1), 1, 3);
    const pan = direction < 0 ? -0.96 : 0.96;

    for (let index = 0; index < severity; index += 1) {
      const duration = index === severity - 1
        ? paceNoteFinalBeepDuration(group)
        : PACE_NOTE_DURATION_SECONDS;
      schedulePaceNoteBeep(cursor, pan, severity, duration);
      phraseEndAt = Math.max(phraseEndAt, cursor + duration);
      cursor += PACE_NOTE_STEP_SECONDS;
    }

    if (groupIndex < groups.length - 1) {
      cursor += PACE_NOTE_GROUP_GAP_SECONDS - PACE_NOTE_STEP_SECONDS;
    }
  });

  return Math.max(cursor, phraseEndAt);
}

function paceNoteFinalBeepDuration(group) {
  return clamp(
    Number(group?.finalBeepDurationSeconds) || PACE_NOTE_DURATION_SECONDS,
    PACE_NOTE_DURATION_SECONDS,
    PACE_NOTE_LONG_DURATION_SECONDS
  );
}

function schedulePaceNoteBeep(startAt, pan, severity, duration = PACE_NOTE_DURATION_SECONDS) {
  const context = CAPTURED_GRAPH.context;
  if (!context || context.state !== 'running' || !priorityBus) {
    throw new Error('Pace-note audio graph is not ready');
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const panner = createPannerNode(context);
  const endAt = startAt + duration;
  const baseFrequency = 650 + severity * 38;

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(baseFrequency, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 1.13, endAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(PACE_NOTE_LEVEL, startAt + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  if (panner.pan) panner.pan.setValueAtTime(pan, startAt);
  oscillator.connect(gain);
  gain.connect(panner);
  panner.connect(priorityBus);

  const record = { oscillator, gain, panner };
  activePaceNoteSources.add(record);
  oscillator.addEventListener('ended', () => {
    activePaceNoteSources.delete(record);
    oscillator.disconnect();
    gain.disconnect();
    panner.disconnect();
  }, { once: true });

  oscillator.start(startAt);
  oscillator.stop(endAt + 0.01);
}

function clearPaceNoteDelivery() {
  pendingPaceNotes.length = 0;
  pendingKeys.clear();
  nextPhraseAt = 0;
  lastResumeAttemptAt = -Infinity;

  for (const record of activePaceNoteSources) {
    try {
      record.oscillator.stop();
    } catch (_) {}
  }
  activePaceNoteSources.clear();
}

function priorityAudioEnabled() {
  const settings = globalThis.__turnAudioPreferences?.getSettings?.();
  return globalThis.__turnDriveByEarEnabled !== false
    && settings?.audioEnabled !== false
    && settings?.dbeEnabled !== false;
}

function updatePriorityGain() {
  if (!priorityBus?.gain) return;
  const settings = globalThis.__turnAudioPreferences?.getSettings?.();
  const balance = Number.isFinite(Number(settings?.balance))
    ? clamp(Number(settings.balance), 0, 1)
    : DEFAULT_AUDIO_BALANCE;
  const dbeFactor = balance < DEFAULT_AUDIO_BALANCE
    ? balance / DEFAULT_AUDIO_BALANCE
    : 1;
  const context = CAPTURED_GRAPH.context;
  const now = context?.currentTime || 0;

  try {
    priorityBus.gain.cancelScheduledValues(now);
    priorityBus.gain.setTargetAtTime(dbeFactor, now, 0.02);
  } catch (_) {
    try {
      priorityBus.gain.value = dbeFactor;
    } catch (_) {}
  }
}

function createPannerNode(context) {
  if (typeof context.createStereoPanner === 'function') return context.createStereoPanner();
  const panner = context.createPanner();
  panner.panningModel = 'equalpower';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = 2;
  panner.rolloffFactor = 0;
  return panner;
}

function replacePrototypeMethod(prototype, name, replacement) {
  try {
    prototype[name] = replacement;
    if (prototype[name] === replacement) return true;
  } catch (_) {}

  try {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    Object.defineProperty(prototype, name, {
      ...descriptor,
      configurable: true,
      writable: true,
      value: replacement
    });
    return prototype[name] === replacement;
  } catch (_) {
    return false;
  }
}

function nowMilliseconds() {
  return globalThis.performance?.now?.() || Date.now();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
