const LIMIT_EVENT = 'turn:steering-limit-feedback';
const FLASH_DURATION_MS = 520;
const SECOND_TONE_DELAY_MS = 90;

let installed = false;

export function steeringLimitAnnouncement(side) {
  if (side === 'left') return 'Left steering limit reached.';
  if (side === 'right') return 'Right steering limit reached.';
  return 'Steering limit reached.';
}

export function steeringLimitVisualOpacity(detail = {}) {
  if (!detail.active) return 0;
  if (detail.hard) return 1;
  const intensity = clamp(Number(detail.intensity) || 0, 0, 1);
  return 0.08 + intensity * 0.72;
}

export function installTurnNextSteeringLimitWarning() {
  if (installed) return true;
  if (!document.body) return false;
  installed = true;

  const overlays = {
    left: createEdge('left'),
    right: createEdge('right')
  };
  const announcer = createAnnouncer();
  document.body.append(overlays.left, overlays.right, announcer);

  const announcedSides = { left: false, right: false };
  let flashTimer = 0;
  let audioTimer = 0;

  function clearVisuals() {
    window.clearTimeout(flashTimer);
    flashTimer = 0;
    for (const overlay of Object.values(overlays)) {
      overlay.classList.remove('is-hard', 'is-flashing');
      overlay.style.opacity = '0';
    }
  }

  function resetRaceAnnouncements() {
    announcedSides.left = false;
    announcedSides.right = false;
    announcer.textContent = '';
  }

  function playLimitCue() {
    window.clearTimeout(audioTimer);
    const audio = globalThis.__turnAudio;
    audio?.cue?.('ui-back');
    audioTimer = window.setTimeout(() => {
      globalThis.__turnAudio?.cue?.('ui-tap');
    }, SECOND_TONE_DELAY_MS);
  }

  function announceLimit(side) {
    if (announcedSides[side]) return;
    announcedSides[side] = true;
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = steeringLimitAnnouncement(side);
    });
  }

  function flash(overlay) {
    window.clearTimeout(flashTimer);
    overlay.classList.remove('is-flashing');
    void overlay.offsetWidth;
    overlay.classList.add('is-flashing');
    flashTimer = window.setTimeout(() => {
      overlay.classList.remove('is-flashing');
    }, FLASH_DURATION_MS);
  }

  function handleLimitFeedback(event) {
    const detail = event.detail || {};
    const side = detail.side === 'left' || detail.side === 'right' ? detail.side : null;

    if (!detail.active || !side) {
      clearVisuals();
      return;
    }

    const activeOverlay = overlays[side];
    const inactiveOverlay = overlays[side === 'left' ? 'right' : 'left'];
    inactiveOverlay.classList.remove('is-hard', 'is-flashing');
    inactiveOverlay.style.opacity = '0';

    activeOverlay.style.opacity = String(steeringLimitVisualOpacity(detail));
    activeOverlay.classList.toggle('is-hard', Boolean(detail.hard));

    if (detail.enteredHard) {
      flash(activeOverlay);
      playLimitCue();
      announceLimit(side);
    }
  }

  window.addEventListener(LIMIT_EVENT, handleLimitFeedback);
  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    if (reason === 'race-started') resetRaceAnnouncements();
    if (!event.detail?.running) {
      window.clearTimeout(audioTimer);
      audioTimer = 0;
      clearVisuals();
      announcer.textContent = '';
    }
  });

  return true;
}

function createEdge(side) {
  const edge = document.createElement('div');
  edge.className = `turn-steering-limit-edge turn-steering-limit-edge-${side}`;
  edge.setAttribute('aria-hidden', 'true');
  return edge;
}

function createAnnouncer() {
  const announcer = document.createElement('div');
  announcer.className = 'turn-sr-only turn-steering-limit-announcer';
  announcer.setAttribute('aria-live', 'assertive');
  announcer.setAttribute('aria-atomic', 'true');
  return announcer;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
