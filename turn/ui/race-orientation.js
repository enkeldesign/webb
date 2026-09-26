const SESSION_KEY = 'turn-first-race-orientation-v1';
let handoffSeen = false;
let fallbackTimer;

export function claimOrientationRecommendation({ portrait, storage } = {}) {
  // A landscape first handoff also consumes the session: later races never nag.
  if (handoffSeen) return false;
  handoffSeen = true;
  try {
    if (storage?.getItem(SESSION_KEY)) return false;
    storage?.setItem(SESSION_KEY, 'seen');
  } catch (_) { /* In-memory state still bounds private/storage-blocked sessions. */ }
  return Boolean(portrait);
}

function statusRegion() {
  let status = document.querySelector('#raceOrientationStatus');
  if (!status) {
    status = document.createElement('p');
    status.id = 'raceOrientationStatus';
    status.className = 'turn-orientation-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    document.body.appendChild(status);
  }
  return status;
}

// Establish the live region before the race transition changes its contents.
if (typeof document !== 'undefined' && document.body) statusRegion();

export function showRaceOrientationRecommendation(host, { staged = false } = {}) {
  let storage;
  try { storage = globalThis.sessionStorage; } catch (_) {}
  if (!claimOrientationRecommendation({
    portrait: window.matchMedia('(orientation: portrait)').matches,
    storage
  })) return;

  const hint = document.createElement('aside');
  hint.className = `turn-orientation-hint${staged ? ' is-staged' : ''}`;
  // One separate status owns the announcement; loading's atomic status must not repeat it.
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = '<strong>LANDSCAPE ORIENTATION RECOMMENDED FOR RACING</strong><p>Rotate your device for a wider view and more room for the controls. Portrait/upright orientation is fully supported if that is what you prefer.</p>';
  host.appendChild(hint);
  statusRegion().textContent = 'Landscape orientation recommended for racing. Portrait is fully supported.';
  if (staged) fallbackTimer = window.setTimeout(clearRaceOrientationRecommendation, 5000);
}

export function clearRaceOrientationRecommendation() {
  window.clearTimeout(fallbackTimer);
  document.querySelectorAll('.turn-orientation-hint').forEach((hint) => hint.remove());
  const status = document.querySelector('#raceOrientationStatus');
  if (status) status.textContent = '';
}

if (typeof window !== 'undefined') {
  // A fallback belongs to staging, never to active driving or DBE speech.
  const clearOnDriving = (event) => {
    if (event.target?.closest?.('.drive-stack, .manual-steer')
      || (event.type === 'keydown' && /^(Arrow(?:Up|Down|Left|Right)|[wasdqe r])$/i.test(event.key))) {
      clearRaceOrientationRecommendation();
    }
  };
  document.addEventListener('pointerdown', clearOnDriving, { capture: true, passive: true });
  document.addEventListener('keydown', clearOnDriving, { capture: true });
  window.addEventListener('turn:ui-state-change', (event) => {
    if (event.detail?.reason === 'lap-started') clearRaceOrientationRecommendation();
  });
  window.addEventListener('turn:home-shown', clearRaceOrientationRecommendation);
}
