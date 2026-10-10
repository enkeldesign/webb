import {
  lapResultAnnouncement,
  lapVoidAnnouncement,
  ordinalWord,
  setLiveAnnouncement,
  spokenPosition,
  spokenRivalCount
} from './race-announcements.js';
import { estimatedSpeechMs, holdSpeechFloor, releaseSpeechFloor } from './speech-floor.js';

const FLOOR_OWNER = 'race-speech';

const START_CONTEXT_DELAY_MS = 320;
const LAP_PRIORITY_MIN_MS = 3200;
const LAP_PRIORITY_MAX_MS = 7200;

let installed = false;

export function lapAnnouncementPriorityMs(message) {
  return Math.min(LAP_PRIORITY_MAX_MS, Math.max(LAP_PRIORITY_MIN_MS, estimatedSpeechMs(message)));
}

export function installRaceSpeech() {
  if (installed) return true;

  const hud = document.querySelector('#hud');
  const positionHud = document.querySelector('.race-position-hud');
  const positionValue = positionHud?.querySelector('strong');
  const positionLabel = positionHud?.querySelector('span');
  const baseSetRacePosition = globalThis.__turnSetRacePosition;
  if (!hud || !positionHud || !positionValue || typeof baseSetRacePosition !== 'function') {
    requestAnimationFrame(installRaceSpeech);
    return false;
  }

  installed = true;
  positionLabel?.setAttribute('aria-hidden', 'true');

  const positionAnnouncer = createAnnouncer('race-position-announcer', 'assertive');
  const contextAnnouncer = createAnnouncer('race-context-announcer', 'polite');
  hud.append(positionAnnouncer, contextAnnouncer);

  let lastPosition = null;
  let contextTimer = 0;
  let lapPriorityTimer = 0;
  let lapPriorityUntil = -Infinity;
  let pendingPositionAnnouncement = null;

  function lapPriorityActive() {
    return performance.now() < lapPriorityUntil;
  }

  function resetLapPriority() {
    window.clearTimeout(lapPriorityTimer);
    lapPriorityTimer = 0;
    lapPriorityUntil = -Infinity;
    pendingPositionAnnouncement = null;
  }

  function flushPendingPosition() {
    lapPriorityTimer = 0;
    lapPriorityUntil = -Infinity;
    const pending = pendingPositionAnnouncement;
    pendingPositionAnnouncement = null;
    if (pending == null || lastPosition == null) return;
    setLiveAnnouncement(positionAnnouncer, ordinalWord(lastPosition));
  }

  function beginLapPriority(message) {
    window.clearTimeout(contextTimer);
    contextTimer = 0;
    window.clearTimeout(lapPriorityTimer);
    pendingPositionAnnouncement = null;
    setLiveAnnouncement(positionAnnouncer, '');

    const priorityMs = lapAnnouncementPriorityMs(message);
    lapPriorityUntil = performance.now() + priorityMs;
    lapPriorityTimer = window.setTimeout(flushPendingPosition, priorityMs);
    holdSpeechFloor(priorityMs, FLOOR_OWNER);
  }

  globalThis.__turnSetRacePosition = (position, total) => {
    baseSetRacePosition(position, total);

    if (position == null) {
      positionValue.removeAttribute('aria-label');
      lastPosition = null;
      pendingPositionAnnouncement = null;
      return;
    }

    const normalizedPosition = Math.max(1, Math.round(Number(position) || 1));
    const normalizedTotal = Math.max(1, Math.round(Number(total) || 1));
    positionValue.setAttribute(
      'aria-label',
      `Position, ${spokenPosition(normalizedPosition, normalizedTotal)}`
    );

    const changed = lastPosition !== null && normalizedPosition !== lastPosition;
    if (lapPriorityActive()) {
      if (changed || lastPosition === null) {
        pendingPositionAnnouncement = normalizedPosition;
        // Kept through the position that follows the lap, so nothing waiting slips in between.
        holdSpeechFloor(lapPriorityUntil - performance.now() + estimatedSpeechMs(ordinalWord(normalizedPosition)), FLOOR_OWNER);
      }
    } else if (changed) {
      resetLapPriority();
      // Race speech is said at once, and holds the floor (speech-floor.js) while it is.
      holdSpeechFloor(estimatedSpeechMs(ordinalWord(normalizedPosition)), FLOOR_OWNER);
      setLiveAnnouncement(positionAnnouncer, ordinalWord(normalizedPosition));
    }

    lastPosition = normalizedPosition;
  };

  window.addEventListener('turn:lap-result', (event) => {
    beginLapPriority(lapResultAnnouncement(event.detail));
  });

  window.addEventListener('turn:lap-invalid', (event) => {
    beginLapPriority(lapVoidAnnouncement(event.detail?.reason));
  });

  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;

    if (reason === 'lap-started') {
      window.clearTimeout(contextTimer);
      contextTimer = 0;
      if (!lapPriorityActive()) {
        const rivalCount = globalThis.__turnRuntime?.state?.competitorLaps?.length || 0;
        if (rivalCount > 0) {
          holdSpeechFloor(START_CONTEXT_DELAY_MS + estimatedSpeechMs(spokenRivalCount(rivalCount)), FLOOR_OWNER);
          contextTimer = window.setTimeout(() => {
            contextTimer = 0;
            setLiveAnnouncement(contextAnnouncer, spokenRivalCount(rivalCount));
          }, START_CONTEXT_DELAY_MS);
        }
      }
    }

    // A pause drops what was waiting to be said: nothing speaks up late.
    if (!event.detail?.running || reason === 'race-reset' || reason === 'race-paused') {
      window.clearTimeout(contextTimer);
      contextTimer = 0;
      resetLapPriority();
      setLiveAnnouncement(positionAnnouncer, '');
      setLiveAnnouncement(contextAnnouncer, '');
      // And lets go of the floor it held, so nothing waits on words no longer coming.
      releaseSpeechFloor(FLOOR_OWNER);
    }
  });

  return true;
}

function createAnnouncer(className, politeness) {
  const announcer = document.createElement('div');
  announcer.className = `turn-sr-only ${className}`;
  announcer.setAttribute('aria-live', politeness);
  announcer.setAttribute('aria-atomic', 'true');
  return announcer;
}
