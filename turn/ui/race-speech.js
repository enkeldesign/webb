import {
  ordinalWord,
  setLiveAnnouncement,
  spokenPosition,
  spokenRivalCount
} from './race-announcements.js';

const START_CONTEXT_DELAY_MS = 320;
const LAP_RESULT_HANDOFF_MS = 1600;

let installed = false;

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
  let suppressPositionUntil = -Infinity;

  globalThis.__turnSetRacePosition = (position, total) => {
    baseSetRacePosition(position, total);

    if (position == null) {
      positionValue.removeAttribute('aria-label');
      lastPosition = null;
      return;
    }

    const normalizedPosition = Math.max(1, Math.round(Number(position) || 1));
    const normalizedTotal = Math.max(1, Math.round(Number(total) || 1));
    positionValue.setAttribute(
      'aria-label',
      `Position, ${spokenPosition(normalizedPosition, normalizedTotal)}`
    );

    const changed = lastPosition !== null && normalizedPosition !== lastPosition;
    if (changed && performance.now() >= suppressPositionUntil) {
      setLiveAnnouncement(positionAnnouncer, ordinalWord(normalizedPosition));
    }

    lastPosition = normalizedPosition;
  };

  window.addEventListener('turn:lap-result', () => {
    suppressPositionUntil = performance.now() + LAP_RESULT_HANDOFF_MS;
  });

  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;

    if (reason === 'lap-started') {
      window.clearTimeout(contextTimer);
      const rivalCount = globalThis.__turnRuntime?.state?.competitorLaps?.length || 0;
      if (rivalCount > 0) {
        contextTimer = window.setTimeout(() => {
          contextTimer = 0;
          setLiveAnnouncement(contextAnnouncer, spokenRivalCount(rivalCount));
        }, START_CONTEXT_DELAY_MS);
      }
    }

    if (!event.detail?.running || reason === 'race-reset') {
      window.clearTimeout(contextTimer);
      contextTimer = 0;
      suppressPositionUntil = -Infinity;
      setLiveAnnouncement(positionAnnouncer, '');
      setLiveAnnouncement(contextAnnouncer, '');
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
