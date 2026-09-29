// Offline play (#1030): registers TURN's service worker (sw.js) once the app has
// started, asks the browser to keep TURN's storage, and says when a new release has
// taken over: "New TURN version ready — RESTART", never in the middle of a race.
//
// Automated browsers and local servers skip the worker unless a test opts in, so the
// browser smokes and local development keep talking to their servers directly.

const INSTALL_KEY = '__turnOffline';
const TEST_OPT_IN = 'turn-offline-under-test';
const REGISTER_DELAY_MS = 1500;

function scopeFor(pathname) {
  if (pathname.startsWith('/turn-next/')) return '/turn-next/';
  if (pathname.startsWith('/turn/')) return '/turn/';
  return null;
}

export function installOffline({ windowRef = globalThis, documentRef = globalThis.document } = {}) {
  if (windowRef[INSTALL_KEY]) return windowRef[INSTALL_KEY];
  const nav = windowRef.navigator;
  const scope = scopeFor(windowRef.location?.pathname || '');
  const local = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(windowRef.location?.hostname || '');
  let optedIn = !nav?.webdriver && !local;
  try {
    optedIn = optedIn || windowRef.localStorage.getItem(TEST_OPT_IN) === '1';
  } catch {
    // No storage: no opt-in.
  }
  if (!scope || !nav?.serviceWorker || !windowRef.isSecureContext || !optedIn) return null;

  // The first worker taking over a page is not an update; any later one is.
  let controlled = Boolean(nav.serviceWorker.controller);
  let registration = null;
  let toast = null;

  function showUpdate() {
    if (toast?.isConnected) return;
    // Never over a race: wait until it ends.
    if (documentRef.body.classList.contains('turn-race-active')) {
      const observer = new MutationObserver(() => {
        if (documentRef.body.classList.contains('turn-race-active')) return;
        observer.disconnect();
        showUpdate();
      });
      observer.observe(documentRef.body, { attributes: true, attributeFilter: ['class'] });
      return;
    }
    toast = documentRef.createElement('div');
    toast.className = 'turn-update-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <p class="turn-update-toast-text">New TURN version ready</p>
      <button class="turn-update-toast-restart" type="button">RESTART</button>
      <button class="turn-update-toast-later" type="button" aria-label="Later">×</button>`;
    toast.querySelector('.turn-update-toast-restart').addEventListener('click', () => windowRef.location.reload());
    toast.querySelector('.turn-update-toast-later').addEventListener('click', () => toast.remove());
    const region = documentRef.querySelector('.turn-toast-region') || documentRef.body;
    region.appendChild(toast);
  }

  // A new release's worker takes over once its files are stored; the page that is
  // running keeps its own build until the player restarts.
  nav.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) showUpdate();
    controlled = true;
  });

  function register() {
    nav.serviceWorker.register(`${scope}sw.js`, { scope })
      .then((value) => {
        registration = value;
      })
      .catch(() => {});
    nav.storage?.persist?.().catch?.(() => {});
  }

  // Look for a new release whenever TURN comes back to the foreground.
  documentRef.addEventListener('visibilitychange', () => {
    if (!documentRef.hidden) registration?.update().catch(() => {});
  });

  // After the app has started, so storing the release never competes with first paint.
  if (documentRef.readyState === 'complete') windowRef.setTimeout(register, REGISTER_DELAY_MS);
  else windowRef.addEventListener('load', () => windowRef.setTimeout(register, REGISTER_DELAY_MS), { once: true });

  // How ready offline play is: { release, files, failed } once stored, else null.
  async function status() {
    const ready = await nav.serviceWorker.ready;
    const worker = ready.active;
    if (!worker) return null;
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(event.data);
      worker.postMessage({ type: 'turn-offline-status' }, [channel.port2]);
      windowRef.setTimeout(() => resolve(null), 3000);
    });
  }

  const api = Object.freeze({ scope, status, showUpdate });
  windowRef[INSTALL_KEY] = api;
  return api;
}
