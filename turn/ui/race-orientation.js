const SESSION_KEY = 'turn-first-race-orientation-v1';

// The familiar rotate-device symbol: a phone between two turning arrows. The phone
// turns to landscape once, unless motion is reduced.
const ROTATE_DEVICE_ICON = `<svg viewBox="0 0 48 48" focusable="false" aria-hidden="true">
  <g class="turn-orientation-arrows" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M28.5 4.6a20 20 0 0 1 15 14.9"/><path d="M39.6 17.9l3.9 1.6 1.5-3.9"/>
    <path d="M19.5 43.4a20 20 0 0 1-15-14.9"/><path d="M8.4 30.1l-3.9-1.6-1.5 3.9"/>
  </g>
  <g class="turn-orientation-phone">
    <rect x="17" y="11" width="14" height="26" rx="3.5" fill="var(--cyan, #2fd3ff)" stroke="currentColor" stroke-width="3"/>
    <circle cx="24" cy="32.5" r="1.5" fill="currentColor"/>
  </g>
</svg>`;
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
  // Short enough to read before the track has loaded (#1041): the symbol says it first.
  hint.innerHTML = `<span class="turn-orientation-icon">${ROTATE_DEVICE_ICON}</span><strong>TIP: ROTATE TO LANDSCAPE FOR RACING</strong>`;
  host.appendChild(hint);
  statusRegion().textContent = 'Tip: rotate to landscape for racing.';
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
