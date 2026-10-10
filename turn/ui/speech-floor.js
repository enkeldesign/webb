// One voice at a time in a race (#1133, with #906). A live region cannot tell when the
// screen reader has finished, so each race announcement holds the floor for as long as
// it takes to say, and a DRIVE BY EAR pace note holds it while it sounds. Race speech is
// said at once; guidance that can wait, such as a tutorial's, waits for the floor.
const SPEECH_START_BUFFER_MS = 900;
const SPEECH_MS_PER_WORD = 440;

// Each speaker's hold, so one cut short (a pause, a restart, leaving) can let go of it.
const holds = new Map();

const now = () => globalThis.performance?.now?.() ?? Date.now();

// How long a screen reader takes to say a message, from its word count.
export function estimatedSpeechMs(message) {
  const words = String(message || '').trim().split(/\s+/).filter(Boolean).length;
  return words ? SPEECH_START_BUFFER_MS + words * SPEECH_MS_PER_WORD : 0;
}

export function holdSpeechFloor(ms, owner) {
  if (!(Number.isFinite(ms) && ms > 0)) return;
  holds.set(owner, Math.max(holds.get(owner) || 0, now() + ms));
}

export function releaseSpeechFloor(owner) {
  holds.delete(owner);
}

// Milliseconds until nothing is being said or played; 0 when the floor is free.
export function speechFloorWait() {
  const at = now();
  let until = at;
  for (const [owner, end] of holds) {
    if (end <= at) holds.delete(owner);
    else until = Math.max(until, end);
  }
  return until - at;
}
