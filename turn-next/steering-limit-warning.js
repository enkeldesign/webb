const LIMIT_EVENT = 'turn:steering-limit-feedback';
const SECOND_TONE_DELAY_MS = 90;
const MIN_VISIBLE_OPACITY = 0.1;
const MIN_VISIBLE_GROWTH = 0.22;
const HIDDEN_GROWTH = 0.08;

let installed = false;

export function steeringLimitAnnouncement(side) {
  if (side === 'left') return 'Left steering limit reached.';
  if (side === 'right') return 'Right steering limit reached.';
  return 'Steering limit reached.';
}

export function steeringLimitVisualOpacity(detail = {}) {
  if (!detail.active) return 0;
  const intensity = clamp(Number(detail.intensity) || 0, 0, 1);
  return MIN_VISIBLE_OPACITY + intensity * (1 - MIN_VISIBLE_OPACITY);
}

export function steeringLimitVisualGrowth(detail = {}) {
  if (!detail.active) return HIDDEN_GROWTH;
  const intensity = clamp(Number(detail.intensity) || 0, 0, 1);
  return MIN_VISIBLE_GROWTH + intensity * (1 - MIN_VISIBLE_GROWTH);
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
  let audioTimer = 0;
  let visualsActive = false;

  function setOverlayTarget(overlay, detail) {
    const active = Boolean(detail?.active);
    overlay.classList.toggle('is-active', active);
    overlay.style.setProperty('--turn-limit-opacity', String(steeringLimitVisualOpacity(detail)));
    overlay.style.setProperty('--turn-limit-growth', String(steeringLimitVisualGrowth(detail)));
  }

  function softenVisuals() {
    visualsActive = false;
    const hidden = { active: false, intensity: 0 };
    setOverlayTarget(overlays.left, hidden);
    setOverlayTarget(overlays.right, hidden);
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

  function handleLimitFeedback(event) {
    const detail = event.detail || {};
    const side = detail.side === 'left' || detail.side === 'right' ? detail.side : null;

    if (!detail.active || !side) {
      if (visualsActive) softenVisuals();
      return;
    }

    visualsActive = true;
    const activeOverlay = overlays[side];
    const inactiveOverlay = overlays[side === 'left' ? 'right' : 'left'];
    setOverlayTarget(inactiveOverlay, { active: false, intensity: 0 });
    setOverlayTarget(activeOverlay, detail);

    if (detail.enteredHard) {
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
      if (visualsActive) softenVisuals();
      announcer.textContent = '';
    }
  });

  return true;
}

function createEdge(side) {
  const edge = document.createElement('div');
  edge.className = `turn-steering-limit-edge turn-steering-limit-edge-${side}`;
  edge.setAttribute('aria-hidden', 'true');
  edge.style.setProperty('--turn-limit-opacity', '0');
  edge.style.setProperty('--turn-limit-growth', String(HIDDEN_GROWTH));
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
