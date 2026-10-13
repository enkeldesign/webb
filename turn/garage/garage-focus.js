// A car to show over the one GARAGE would otherwise open on, once GARAGE is showing:
// a support challenge's recommended car, or the SEDAN the SHIFT introduction sends
// players to (progression/unlock-introductions.js).
const VIEW_TIMEOUT_MS = 12000;
const STYLE_ID = 'turn-garage-point-styles';
const POINT_SECONDS = 4.5;
// After GARAGE's own opening speech (its title, then the car).
const SAY_DELAY_MS = 1200;

// Asked for before GARAGE opens, then the GARAGE it was shown in.
let focusPending = false;
let focusedRoot = null;

export function viewCarWhenGarageOpens(vehicleId) {
  if (!vehicleId) return false;
  focusPending = true;
  const select = () => {
    const garage = globalThis.__turnGarage;
    if (!garage?.root?.isConnected) return false;
    garage.viewCar(vehicleId);
    focusPending = false;
    focusedRoot = garage.root;
    return true;
  };
  if (select()) return true;

  const observer = new MutationObserver(() => {
    if (!select()) return;
    observer.disconnect();
    globalThis.clearTimeout(timeout);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timeout = globalThis.setTimeout(() => {
    observer.disconnect();
    focusPending = false;
  }, VIEW_TIMEOUT_MS);
  return true;
}

// True for a GARAGE opened for the player on a particular car, rather than by them.
export function garageOpenedForCar(root) {
  return focusPending || (Boolean(root) && root === focusedRoot);
}

function installStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #turnGarage .is-introduced { animation: turn-garage-point 1.5s ease-in-out 3; }
    @keyframes turn-garage-point {
      50% { box-shadow: 0 0 0 var(--turn-space-2) var(--turn-action-primary); }
    }
    /* Until it is used: a calmer, slower pulse on every visit (#1189). */
    #turnGarage .is-suggested:not(.is-introduced) { animation: turn-garage-suggest 2.4s ease-in-out infinite; }
    @keyframes turn-garage-suggest {
      50% { box-shadow: 0 0 0 var(--turn-space-1) color-mix(in srgb, var(--turn-action-primary) 70%, transparent); }
    }
    @media (prefers-reduced-motion: reduce) {
      #turnGarage .is-introduced,
      #turnGarage .is-suggested:not(.is-introduced) {
        animation: none;
        outline: var(--turn-border-control) solid var(--turn-action-primary);
        outline-offset: var(--turn-space-1);
      }
    }
    @media (forced-colors: active) {
      #turnGarage .is-introduced,
      #turnGarage .is-suggested:not(.is-introduced) {
        animation: none;
        outline: var(--turn-border-control) solid Highlight;
        outline-offset: var(--turn-space-1);
      }
    }
  `;
  documentRef.head.appendChild(style);
}

// A control the player has not used yet: a calm pulse until they do, silent and with no
// scrolling (progression/unlock-introductions.js ends it).
export function suggestInGarage(element, { documentRef = globalThis.document } = {}) {
  if (!element?.isConnected || element.classList.contains('is-suggested')) return false;
  installStyles(documentRef);
  element.classList.add('is-suggested');
  return true;
}

// Points out GARAGE controls: the first brought into view, each pulsed, and one
// message for all of them, in a status added empty and filled once GARAGE has spoken,
// so it is heard rather than talked over. Focus stays where it is.
export function pointOutInGarage(points, {
  sayAfterMs = SAY_DELAY_MS,
  documentRef = globalThis.document,
  windowRef = globalThis
} = {}) {
  const shown = points.filter(({ element }) => element?.isConnected);
  if (!shown.length) return false;
  installStyles(documentRef);
  const reduced = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  shown[0].element.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  for (const { element } of shown) {
    element.classList.remove('is-introduced');
    void element.offsetWidth;
    element.classList.add('is-introduced');
    windowRef.setTimeout?.(() => element.classList.remove('is-introduced'), POINT_SECONDS * 1000);
  }
  const section = shown[0].element.closest('section') || shown[0].element.parentElement;
  // A retained hint may be used in this or another tab during GARAGE's speech
  // delay. Recheck its owner before announcing it, just as its pulse is cleared.
  const currentMessages = () => shown
    .filter(({ element, isCurrent }) => element.isConnected && (!isCurrent || isCurrent()))
    .map(({ say }) => say).filter(Boolean);
  if (section && currentMessages().length) {
    const status = documentRef.createElement('p');
    status.className = 'turn-sr-only m8-unlock-hint-status';
    status.setAttribute('role', 'status');
    section.append(status);
    windowRef.setTimeout?.(() => { status.textContent = currentMessages().join(' '); }, sayAfterMs);
    windowRef.setTimeout?.(() => status.remove(), sayAfterMs + POINT_SECONDS * 1000);
  }
  return true;
}
