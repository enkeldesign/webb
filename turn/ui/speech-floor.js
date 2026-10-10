// One voice at a time in a race (#1133, with #906). A live region cannot tell when the
// screen reader has finished, so each race announcement holds the floor for as long as
// it takes to say, and a DRIVE BY EAR pace note holds it while it sounds. Race speech is
// said at once; guidance that can wait, such as a tutorial's, waits for the floor.
const SPEECH_START_BUFFER_MS = 900;
const SPEECH_MS_PER_WORD = 440;

let heldUntil = 0;

const now = () => globalThis.performance?.now?.() ?? Date.now();

// How long a screen reader takes to say a message, from its word count.
export function estimatedSpeechMs(message) {
  const words = String(message || '').trim().split(/\s+/).filter(Boolean).length;
  return words ? SPEECH_START_BUFFER_MS + words * SPEECH_MS_PER_WORD : 0;
}

export function holdSpeechFloor(ms) {
  if (Number.isFinite(ms) && ms > 0) heldUntil = Math.max(heldUntil, now() + ms);
}

// Milliseconds until nothing is being said or played; 0 when the floor is free.
export function speechFloorWait() {
  return Math.max(0, heldUntil - now());
}
